const express_1 = __importDefault(require("express"));
const node_cache_1 = __importDefault(require("node-cache"));
const bech32_1 = require("bech32");
const router = express_1.default.Router();
const cache = new node_cache_1.default({ stdTTL: 60 }); // 60 seconds cache
// Convert validator address to account address
function convertValidatorToAccountAddress(validatorAddress) {
    try {
        const decoded = bech32_1.bech32.decode(validatorAddress);
        const operatorPrefix = decoded.prefix;
        let accountPrefix = operatorPrefix;
        if (operatorPrefix.endsWith('valoper')) {
            accountPrefix = operatorPrefix.slice(0, -7);
        }
        const accountAddress = bech32_1.bech32.encode(accountPrefix, decoded.words);
        return accountAddress;
    }
    catch (err) {
        return '';
    }
}
// GET /api/validator/transactions
router.get('/transactions', async (req, res) => {
    try {
        const { chain, address, limit = '10' } = req.query;
        if (!chain || !address) {
            return res.status(400).json({ error: 'Chain and address are required' });
        }
        const cacheKey = `validator_txs_${chain}_${address}_${limit}`;
        const cached = cache.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        // Load chain config
        // Try to find chain config by chain_name
        const fs = require('fs');
        const path = require('path');
        let chainConfig = null;
        const chainsDir = path.join(__dirname, '../../../Chains');
        // First try exact filename match
        try {
            chainConfig = require(`../../../Chains/${chain}.json`);
        }
        catch (err) {
            // If not found, search all chain files for matching chain_name
            try {
                const files = fs.readdirSync(chainsDir);
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        const config = require(path.join(chainsDir, file));
                        if (config.chain_name === chain) {
                            chainConfig = config;
                            break;
                        }
                    }
                }
            }
            catch (searchErr) {
                // Ignore search errors
            }
        }
        if (!chainConfig || !chainConfig.apis) {
            return res.status(404).json({ error: 'Chain not found' });
        }
        const apiEndpoints = chainConfig.apis.rest || [];
        if (apiEndpoints.length === 0) {
            return res.status(404).json({ error: 'No API endpoints available' });
        }
        // Determine if address is validator operator or account address
        let accountAddress = address;
        // If it's a valoper address, convert it to account address
        if (address.includes('valoper')) {
            accountAddress = convertValidatorToAccountAddress(address);
            if (!accountAddress) {
                return res.status(400).json({ error: 'Invalid validator address' });
            }
        }
        let transactions = [];
        // Try RPC first (more reliable for tx_search)
        if (chainConfig.apis.rpc) {
            const rpcEndpoints = chainConfig.apis.rpc || [];
            for (const rpc of rpcEndpoints) {
                try {
                    const rpcUrl = rpc.address;
                    // RPC tx_search format: query="message.sender='address'"
                    // Important: Do NOT URL encode the inner query, only wrap in quotes
                    const url = `${rpcUrl}/tx_search?query="message.sender='${accountAddress}'"&order_by="desc"&per_page=${limit}`;
                    console.log('[Validator Transactions] Fetching from:', url);
                    const response = await fetch(url, {
                        headers: { 'Accept': 'application/json' },
                        signal: AbortSignal.timeout(10000)
                    });
                    if (response.ok) {
                        const data = await response.json();
                        console.log('[Validator Transactions] Response:', JSON.stringify(data).substring(0, 200));
                        if (data.result?.txs && data.result.txs.length > 0) {
                            console.log('[Validator Transactions] Found', data.result.txs.length, 'transactions');
                            transactions = data.result.txs.map((tx) => ({
                                hash: tx.hash,
                                height: tx.height,
                                type: tx.tx?.body?.messages?.[0]?.['@type']?.split('.')?.pop() || 'Unknown',
                                timestamp: new Date().toISOString(),
                                code: tx.tx_result?.code || 0,
                                success: (tx.tx_result?.code || 0) === 0,
                                gas_used: tx.tx_result?.gas_used || '0',
                                gas_wanted: tx.tx_result?.gas_wanted || '0',
                                fee: '0',
                                memo: '',
                            }));
                            break;
                        }
                    }
                }
                catch (err) {
                    continue;
                }
            }
        }
        // If RPC failed, try REST API fallback
        // If RPC failed, try REST API fallback
        if (transactions.length === 0) {
            const apiUrl = apiEndpoints[0].address;
            const queryFormats = [
                { param: 'events', query: `message.sender='${accountAddress}'` },
                { param: 'events', query: `transfer.sender='${accountAddress}'` },
            ];
            for (const format of queryFormats) {
                try {
                    const url = `${apiUrl}/cosmos/tx/v1beta1/txs?${format.param}=${encodeURIComponent(format.query)}&limit=${limit}&order_by=2`;
                    const response = await fetch(url, {
                        headers: { 'Accept': 'application/json' },
                        signal: AbortSignal.timeout(8000)
                    });
                    if (response.ok) {
                        const data = await response.json();
                        if (data.tx_responses && data.tx_responses.length > 0) {
                            transactions = data.tx_responses.map((tx) => ({
                                hash: tx.txhash,
                                height: tx.height,
                                type: tx.tx?.body?.messages?.[0]?.['@type']?.split('.')?.pop() || 'Unknown',
                                timestamp: tx.timestamp,
                                code: tx.code || 0,
                                success: tx.code === 0,
                                gas_used: tx.gas_used,
                                gas_wanted: tx.gas_wanted,
                                fee: tx.tx?.auth_info?.fee?.amount?.[0]?.amount || '0',
                                memo: tx.tx?.body?.memo || '',
                            }));
                            break;
                        }
                    }
                }
                catch (err) {
                    continue;
                }
            }
        }
        // Cache result
        cache.set(cacheKey, transactions);
        res.json(transactions);
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to fetch validator transactions',
            details: error.message
        });
    }
});
exports.default = router;
