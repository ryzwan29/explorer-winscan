import express, { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { cache } from '../index';
import { getCombinedEndpoints } from '../utils/publicEndpoints';
import { optimisticCache, smartCache, CacheTier } from '../utils/smartCache';
import { bech32 } from 'bech32';
const router = express.Router();
function findChainFile(chainsDir: string, chainName: string): string | null {
  let chainFilePath = path.join(chainsDir, `${chainName}.json`);
  if (fs.existsSync(chainFilePath)) {
    return chainFilePath;
  }
  const capitalizedName = chainName.charAt(0).toUpperCase() + chainName.slice(1);
  chainFilePath = path.join(chainsDir, `${capitalizedName}.json`);
  if (fs.existsSync(chainFilePath)) {
    return chainFilePath;
  }
  const files = fs.readdirSync(chainsDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(chainsDir, file), 'utf-8'));
      if (content.chain_name?.toLowerCase() === chainName.toLowerCase()) {
        return path.join(chainsDir, file);
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const chainName = req.query.chain as string;
    const address = req.query.address as string;
    const limit = parseInt(req.query.limit as string) || 50;
    if (!chainName || !address) {
      return res.status(400).json({ error: 'Missing chain or address parameter' });
    }
    const cacheKey = `validator_txs_${chainName}_${address}_${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    const chainsDir = process.env.CHAINS_DIR || path.join(__dirname, '../../chains');
    let chainFilePath = path.join(chainsDir, `${chainName}.json`);
    if (!fs.existsSync(chainFilePath)) {
      const files = fs.readdirSync(chainsDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const filePath = path.join(chainsDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (data.chain_name === chainName || file.replace('.json', '') === chainName) {
          chainFilePath = filePath;
          break;
        }
      }
    }
    if (!fs.existsSync(chainFilePath)) {
      return res.status(404).json({ error: 'Chain not found' });
    }
    const chainData = JSON.parse(fs.readFileSync(chainFilePath, 'utf-8'));
    
    // Combine chain endpoints with public fallback endpoints
    const rpcEndpoints = getCombinedEndpoints(chainData.rpc, chainName, chainData.chain_id, 'rpc');
    
    const rpcUrl = rpcEndpoints[0]?.address;
    if (!rpcUrl) {
      return res.status(500).json({ error: 'No RPC URL configured' });
    }
    let accountAddress = address as string;
    if ((address as string).includes('valoper')) {
      try {
        const decoded = bech32.decode(address as string);
        const valoperPrefix = decoded.prefix;
        let basePrefix = valoperPrefix;
        if (valoperPrefix.endsWith('valoper')) {
          basePrefix = valoperPrefix.slice(0, -7);
        }
        accountAddress = bech32.encode(basePrefix, decoded.words);
      } catch (err) {
        console.error('Address conversion error:', err);
        accountAddress = (address as string).replace(/valoper/g, '');
      }
    }
    let transactions: any[] = [];
    
    // Use smart cache with request deduplication for validator transactions
    const txResult = await smartCache(
      `validator_txs_fetch_${chainName}_${accountAddress}_${limit}`,
      async () => {
        // Smart load balancing: Try all RPC endpoints with multiple query formats
        const queries = [
          `message.sender='${accountAddress}'`,
          `tx.height>0 AND (transfer.sender='${accountAddress}' OR message.sender='${accountAddress}')`,
          `transfer.sender='${accountAddress}'`,
          `transfer.recipient='${accountAddress}'`
        ];
        
        let txData: any = null;
        let successRpcUrl = rpcUrl;
        
        // Try all RPC endpoints (load balancing on rate limit/error)
        for (const rpcEndpoint of rpcEndpoints) {
          const currentRpcUrl = rpcEndpoint.address;
          for (const query of queries) {
            try {
              const url = `${currentRpcUrl}/tx_search?query="${query}"&order_by="desc"&per_page=${limit}`;
              const response = await axios.get(url, {
                headers: { 'Accept': 'application/json' },
                timeout: 8000
              });
              if (response.status === 200 && response.data?.result?.txs && response.data.result.txs.length > 0) {
                txData = response.data;
                successRpcUrl = currentRpcUrl;
                console.log(`[Validator Detail] Success with RPC ${currentRpcUrl}`);
                break;
              }
            } catch (queryErr: any) {
              console.log(`[Validator Detail] RPC ${currentRpcUrl} failed:`, queryErr.message);
              continue;
            }
          }
          if (txData) break;
        }
        
        return { txData, successRpcUrl };
      },
      CacheTier.SHORT
    );
    
    const { txData, successRpcUrl } = txResult;
    
    if (txData?.result?.txs && txData.result.txs.length > 0) {
      try {
        const data = txData;
          const heights = Array.from(new Set(data.result.txs.map((tx: any) => tx.height))).slice(0, 10) as string[];
          const blockTimestamps: { [key: string]: string } = {};
          await Promise.allSettled(
            heights.map(async (height: string) => {
              try {
                const blockResp = await axios.get(`${successRpcUrl}/block?height=${height}`, {
                  timeout: 3000
                });
                if (blockResp.data?.result?.block?.header?.time) {
                  blockTimestamps[height] = blockResp.data.result.block.header.time;
                }
              } catch (err) {
              }
            })
          );
          transactions = data.result.txs.map((tx: any) => {
            let msgType = 'Unknown';
            const messageEvents = tx.tx_result?.events?.filter((e: any) => e.type === 'message') || [];
            for (const event of messageEvents) {
              const actionAttr = event.attributes?.find((attr: any) => attr.key === 'action');
              if (actionAttr && actionAttr.value) {
                msgType = actionAttr.value.split('.').pop() || 'Unknown';
                break;
              }
            }
            if (msgType === 'Unknown') {
              const bodyMsgType = tx.tx?.body?.messages?.[0]?.['@type'] || '';
              msgType = bodyMsgType.split('.').pop() || 'Unknown';
            }
            const formatType = (type: string): string => {
              const typeMap: { [key: string]: string } = {
                'MsgSend': 'Send',
                'MsgDelegate': 'Delegate',
                'MsgUndelegate': 'Undelegate',
                'MsgBeginRedelegate': 'Redelegate',
                'MsgWithdrawDelegatorReward': 'Withdraw Reward',
                'MsgWithdrawValidatorCommission': 'Withdraw Commission',
                'MsgVote': 'Vote',
                'MsgDeposit': 'Deposit',
                'MsgSubmitProposal': 'Submit Proposal',
                'MsgCreateValidator': 'Create Validator',
                'MsgEditValidator': 'Edit Validator',
                'MsgUnjail': 'Unjail',
                'MsgMultiSend': 'Multi Send',
                'MsgFundCommunityPool': 'Fund Community Pool',
                'MsgSetWithdrawAddress': 'Set Withdraw Address',
              };
              return typeMap[type] || type;
            };
            const success = (tx.tx_result?.code || 0) === 0;
            const timestamp = blockTimestamps[tx.height] || new Date().toISOString();
            return {
              hash: tx.hash,
              height: parseInt(tx.height) || 0,
              type: formatType(msgType),
              time: timestamp,
              result: success ? 'Success' : 'Failed',
              code: tx.tx_result?.code || 0,
              success: success,
              gas_used: tx.tx_result?.gas_used || '0',
              gas_wanted: tx.tx_result?.gas_wanted || '0',
            };
          });
      } catch (rpcErr: any) {
        console.error('RPC error:', rpcErr.message);
      }
    }
    
    cache.set(cacheKey, transactions, 60);
    res.json(transactions);
  } catch (error: any) {
    console.error('Validator transactions error:', error.message);
    res.json([]);
  }
});
router.get('/delegations', async (req: Request, res: Response) => {
  try {
    const chainName = req.query.chain as string;
    const address = req.query.address as string;
    if (!chainName || !address) {
      return res.status(400).json({ error: 'Missing chain or address parameter' });
    }
    const cacheKey = `validator_delegations_${chainName}_${address}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    const chainsDir = process.env.CHAINS_DIR || path.join(__dirname, '../../chains');
    const chainFilePath = findChainFile(chainsDir, chainName);
    if (!chainFilePath) {
      return res.status(404).json({ error: 'Chain not found' });
    }
    const chainData = JSON.parse(fs.readFileSync(chainFilePath, 'utf-8'));
    const apiUrl = chainData.api?.[0]?.address;
    if (!apiUrl) {
      return res.status(500).json({ error: 'No API URL configured' });
    }
    const [delegationsResponse, unbondingResponse] = await Promise.all([
      axios.get(
        `${apiUrl}/cosmos/staking/v1beta1/validators/${address}/delegations?pagination.limit=100`,
        { timeout: 8000 }
      ),
      axios.get(
        `${apiUrl}/cosmos/staking/v1beta1/validators/${address}/unbonding_delegations?pagination.limit=100`,
        { timeout: 8000 }
      ).catch(() => null) // Don't fail if no unbonding
    ]);
    const delegations = delegationsResponse.data.delegation_responses?.map((d: any) => ({
      delegator: d.delegation.delegator_address,
      shares: d.delegation.shares,
      balance: d.balance.amount,
    })) || [];
    const unbonding = unbondingResponse?.data.unbonding_responses?.map((u: any) => ({
      delegator: u.delegator_address,
      entries: u.entries.map((e: any) => ({
        balance: e.balance,
        completionTime: e.completion_time,
      })),
    })) || [];
    const result = { delegations, unbonding };
    cache.set(cacheKey, result, 60);
    res.json(result);
  } catch (error: any) {
    console.error('Validator delegations error:', error.message);
    res.json({ delegations: [], unbonding: [] }); // Return empty structure on error
  }
});
export default router;
