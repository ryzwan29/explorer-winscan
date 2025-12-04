import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { cache } from '../index';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const chainName = req.query.chain as string;

    if (!chainName) {
      return res.status(400).json({ error: 'Missing chain parameter' });
    }

    const cacheKey = `stats_${chainName}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Read chain config
    const chainsDir = process.env.CHAINS_DIR || path.join(__dirname, '../../chains');
    const chainFilePath = path.join(chainsDir, `${chainName}.json`);
    
    if (!fs.existsSync(chainFilePath)) {
      return res.status(404).json({ error: 'Chain not found' });
    }

    // Basic stats from chain config
    const chainData = JSON.parse(fs.readFileSync(chainFilePath, 'utf-8'));
    const stats = {
      chainName: chainData.chain_name,
      sdkVersion: chainData.sdk_version,
      coinType: chainData.coin_type,
      assets: chainData.assets?.length || 0
    };

    cache.set(cacheKey, stats, 300);
    res.json(stats);
  } catch (error: any) {
    console.error('Stats error:', error.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
