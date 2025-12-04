import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fetchFromAPI } from '../lib/loadBalancer';
import { cache } from '../index';

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
    const address = req.query.address as string;
    const limit = parseInt(req.query.limit as string || '50');

    if (!chainName) {
      return res.status(400).json({ error: 'Chain name is required' });
    }

    const cacheKey = address 
      ? `transactions_${chainName}_${address}_${limit}`
      : `transactions_${chainName}_${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Flexible chain matching
    const chainsDir = process.env.CHAINS_DIR || path.join(__dirname, '../../chains');
    let chainFilePath = path.join(chainsDir, `${chainName}.json`);
    
    if (!fs.existsSync(chainFilePath)) {
      const files = fs.readdirSync(chainsDir).filter(f => f.endsWith('.json'));
      const chainLower = chainName.toLowerCase();
      let match = files.find(f => f.toLowerCase() === `${chainLower}.json`);
      if (!match) {
        match = files.find(f => {
          const baseName = f.replace('.json', '').toLowerCase();
          return baseName.includes(chainLower) || chainLower.includes(baseName);
        });
      }
      if (match) {
        chainFilePath = path.join(chainsDir, match);
      } else {
        return res.status(404).json({ error: 'Chain not found' });
      }
    }

    const chain = JSON.parse(fs.readFileSync(chainFilePath, 'utf-8'));
    const apiUrl = chain.api?.[0]?.address;

    if (!apiUrl) {
      return res.status(500).json({ error: 'No API URL configured' });
    }

    // If address is provided, search by sender/recipient
    if (address) {
      try {
        // Try to fetch transactions by sender
        const senderQuery = `message.sender='${address}'`;
        const txData = await fetchFromAPI(
          chainName,
          chain.api,
          `/cosmos/tx/v1beta1/txs?events=${encodeURIComponent(senderQuery)}&pagination.limit=${limit}&order_by=2`
        );
        
        const txResponses = txData?.tx_responses || [];
        const txs = txData?.txs || [];
        
        if (txResponses.length > 0) {
          const transactions = txResponses.map((txResponse: any, i: number) => {
            const tx = txs[i];
            const messageType = tx?.body?.messages?.[0]?.['@type'] || '';
            const action = messageType.split('.').pop() || 'Transaction';
            const feeAmount = tx?.auth_info?.fee?.amount?.[0]?.amount || '0';
            const feeDenom = tx?.auth_info?.fee?.amount?.[0]?.denom || '';
            
            return {
              hash: txResponse.txhash,
              type: action,
              result: txResponse.code === 0 ? 'Success' : 'Failed',
              fee: `${feeAmount} ${feeDenom}`,
              height: parseInt(txResponse.height || '0'),
              time: txResponse.timestamp || new Date().toISOString(),
            };
          });
          
          cache.set(cacheKey, transactions, 30);
          return res.json(transactions);
        }
      } catch (err) {
        console.error('Error fetching transactions by address:', err);
      }
      
      // If no transactions found, return empty array
      cache.set(cacheKey, [], 30);
      return res.json([]);
    }

    // Strategy 1: Try tx search API (fast)
    try {
      const latestBlockData = await fetchFromAPI(
        chainName,
        chain.api,
        '/cosmos/base/tendermint/v1beta1/blocks/latest'
      );
      const latestHeight = parseInt(latestBlockData?.block?.header?.height || '0');
      
      if (latestHeight > 0) {
        const minHeight = Math.max(1, latestHeight - 500);
        
        const txData = await fetchFromAPI(
          chainName,
          chain.api,
          `/cosmos/tx/v1beta1/txs?events=tx.height>=${minHeight}&pagination.limit=${limit}&order_by=2`
        );
        
        const txResponses = txData?.tx_responses || [];
        const txs = txData?.txs || [];
        
        if (txResponses.length > 0) {
          const transactions = txResponses.slice(0, limit).map((txResponse: any, i: number) => {
            const tx = txs[i];
            const messageType = tx?.body?.messages?.[0]?.['@type'] || '';
            const action = messageType.split('.').pop() || 'Transaction';
            const feeAmount = tx?.auth_info?.fee?.amount?.[0]?.amount || '0';
            const feeDenom = tx?.auth_info?.fee?.amount?.[0]?.denom || '';
            
            return {
              hash: txResponse.txhash || `tx-${i}`,
              type: action,
              result: txResponse.code === 0 ? 'Success' : 'Failed',
              fee: `${feeAmount} ${feeDenom}`,
              height: parseInt(txResponse.height || '0'),
              time: txResponse.timestamp || new Date().toISOString(),
            };
          });
          
          cache.set(cacheKey, transactions, 10);
          return res.json(transactions);
        }
      }
    } catch (err) {
      console.log('TX search API not available, trying blocks method');
    }

    // Strategy 2: Get from recent blocks (parallel fetch)
    try {
      const latestBlockData = await fetchFromAPI(
        chainName,
        chain.api,
        '/cosmos/base/tendermint/v1beta1/blocks/latest'
      );
      const latestHeight = parseInt(latestBlockData?.block?.header?.height || '0');
      
      if (latestHeight > 0) {
        const transactions: any[] = [];
        const blocksToCheck = 100;
        
        const blockPromises = [];
        for (let i = 0; i < blocksToCheck; i++) {
          const height = latestHeight - i;
          blockPromises.push(
            fetchFromAPI(chainName, chain.api, `/cosmos/base/tendermint/v1beta1/blocks/${height}`)
              .catch(() => null)
          );
        }
        
        const blocks = await Promise.all(blockPromises);
        
        for (const blockData of blocks) {
          if (!blockData || transactions.length >= limit) break;
          
          const block = blockData.block;
          const txsData = block?.data?.txs || [];
          const blockTime = block?.header?.time || new Date().toISOString();
          const blockHeight = parseInt(block?.header?.height || '0');
          
          for (let j = 0; j < txsData.length && transactions.length < limit; j++) {
            const txBytes = Buffer.from(txsData[j], 'base64');
            const txHash = crypto
              .createHash('sha256')
              .update(txBytes)
              .digest('hex')
              .toUpperCase();
            
            transactions.push({
              hash: txHash,
              type: 'Transfer',
              result: 'Success',
              fee: '0',
              height: blockHeight,
              time: blockTime,
            });
          }
        }
        
        const result = transactions.slice(0, limit);
        cache.set(cacheKey, result, 10);
        return res.json(result);
      }
    } catch (err) {
      console.error('Error fetching from blocks:', err);
    }

    // If all fails, return empty array
    return res.json([]);
    
  } catch (error: any) {
    console.error('Error fetching transactions:', error.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

export default router;
