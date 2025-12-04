import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
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
    const hash = req.query.hash as string;

    if (!chainName || !hash) {
      return res.status(400).json({ error: 'Chain name and transaction hash are required' });
    }

    const cacheKey = `transaction_${chainName}_${hash}`;
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

    const txData = await fetchFromAPI(
      chainName,
      chain.api,
      `/cosmos/tx/v1beta1/txs/${hash}`
    );

    const txResponse = txData.tx_response;
    const tx = txData.tx;

    const messages = tx.body?.messages || [];
    const messageType = messages[0]?.['@type'] || '';
    const action = messageType.split('.').pop() || 'Transaction';
    
    const feeAmount = tx.auth_info?.fee?.amount?.[0]?.amount || '0';
    const feeDenom = tx.auth_info?.fee?.amount?.[0]?.denom || '';
    const gasUsed = txResponse.gas_used || '0';
    const gasWanted = txResponse.gas_wanted || '0';

    const txDetail = {
      hash: txResponse.txhash,
      height: parseInt(txResponse.height),
      time: txResponse.timestamp,
      success: txResponse.code === 0,
      type: action,
      fee: `${feeAmount} ${feeDenom}`,
      gasUsed: gasUsed,
      gasWanted: gasWanted,
      memo: tx.body?.memo || '',
      messages: messages.map((msg: any) => ({
        type: msg['@type'],
        data: msg
      })),
      events: txResponse.events || [],
      rawLog: txResponse.raw_log || ''
    };

    cache.set(cacheKey, txDetail, 60);

    res.json(txDetail);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to fetch transaction', 
      details: error.message 
    });
  }
});

export default router;
