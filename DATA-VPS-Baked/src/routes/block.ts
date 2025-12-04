import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fetchFromAPI } from '../lib/loadBalancer';
import { cache } from '../index';
import { bech32 } from 'bech32';

const router = express.Router();

function getChainConfig(chainName: string) {
  const chainsDir = process.env.CHAINS_DIR || path.join(__dirname, '../../chains');
  const chainFilePath = path.join(chainsDir, `${chainName}.json`);

  if (!fs.existsSync(chainFilePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(chainFilePath, 'utf-8'));
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const chainName = req.query.chain as string;
    const height = req.query.height as string;

    if (!chainName || !height) {
      return res.status(400).json({ error: 'Chain name and height are required' });
    }

    const cacheKey = `block_${chainName}_${height}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const chain = getChainConfig(chainName);
    if (!chain) {
      return res.status(404).json({ error: 'Chain not found' });
    }

    const apiUrl = chain.api?.[0]?.address;
    if (!apiUrl) {
      return res.status(500).json({ error: 'No API URL configured' });
    }

    const blockData = await fetchFromAPI(
      chainName,
      chain.api,
      `/cosmos/base/tendermint/v1beta1/blocks/${height}`
    );

    let proposerToValidatorMap: { [key: string]: any } = {};
    
    try {
      const [validatorSetData, validatorsData] = await Promise.all([
        fetchFromAPI(
          chainName,
          chain.api,
          `/cosmos/base/tendermint/v1beta1/validatorsets/latest`
        ),
        fetchFromAPI(
          chainName,
          chain.api,
          `/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=300`
        )
      ]);

      const pubkeyToValidator: { [key: string]: any } = {};
      
      for (const val of validatorsData.validators || []) {
        const pubkey = val.consensus_pubkey?.key;
        if (pubkey) {
          const validatorInfo = {
            moniker: val.description?.moniker || 'Unknown',
            identity: val.description?.identity,
            address: val.operator_address
          };
          pubkeyToValidator[pubkey] = validatorInfo;
        }
      }

      for (const v of validatorSetData.validators || []) {
        const bech32Addr = v.address;
        const pubkey = v.pub_key?.key;
        
        if (bech32Addr && pubkey && pubkeyToValidator[pubkey]) {
          try {
            const decoded = bech32.decode(bech32Addr);
            const hexAddr = Buffer.from(bech32.fromWords(decoded.words)).toString('hex').toUpperCase();
            proposerToValidatorMap[hexAddr] = pubkeyToValidator[pubkey];
          } catch (e) {
          }
        }
      }
    } catch (err) {
    }

    const proposerAddressBase64 = blockData.block.header.proposer_address;
    const proposerAddressHex = Buffer.from(proposerAddressBase64, 'base64').toString('hex').toUpperCase();
    const validatorInfo = proposerToValidatorMap[proposerAddressHex] || null;

    const transactions = [];
    const txsData = blockData.block.data.txs || [];
    
    for (let i = 0; i < txsData.length; i++) {
      const txHash = blockData.block_id.hash; 
      transactions.push({
        hash: txHash,
        type: 'Transaction',
        result: 'Success'
      });
    }

    const blockDetail = {
      height: blockData.block.header.height,
      hash: blockData.block_id.hash,
      time: blockData.block.header.time,
      txs: txsData.length,
      proposer: proposerAddressBase64,
      proposerMoniker: validatorInfo?.moniker,
      proposerIdentity: validatorInfo?.identity,
      proposerAddress: validatorInfo?.address,
      gasUsed: 'N/A',
      gasWanted: 'N/A',
      transactions: transactions
    };

    cache.set(cacheKey, blockDetail, 60);

    res.json(blockDetail);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to fetch block', 
      details: error.message 
    });
  }
});

export default router;
