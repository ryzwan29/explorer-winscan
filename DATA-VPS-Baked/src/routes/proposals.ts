import express, { Request, Response } from 'express';
import axios from 'axios';
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

    const cacheKey = `proposals_${chainName}`;
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

    const chainData = JSON.parse(fs.readFileSync(chainFilePath, 'utf-8'));
    const apiUrl = chainData.api?.[0]?.address;

    if (!apiUrl) {
      return res.status(500).json({ error: 'No API URL configured' });
    }

    // Fetch proposals - try v1 first, fallback to v1beta1
    let proposals = [];
    
    try {
      // Try v1 API first (newer chains)
      const responseV1 = await axios.get(
        `${apiUrl}/cosmos/gov/v1/proposals`,
        { timeout: 8000 }
      );
      proposals = responseV1.data.proposals || [];
    } catch (v1Error) {
      // Fallback to v1beta1 (older chains)
      try {
        const responseV1Beta = await axios.get(
          `${apiUrl}/cosmos/gov/v1beta1/proposals`,
          { timeout: 8000 }
        );
        proposals = responseV1Beta.data.proposals || [];
      } catch (v1BetaError) {
        console.error('Both v1 and v1beta1 proposals failed:', chainName);
        proposals = [];
      }
    }

    cache.set(cacheKey, proposals, 60);
    res.json(proposals);
  } catch (error: any) {
    console.error('Proposals error:', error.message);
    res.json([]);
  }
});

export default router;
