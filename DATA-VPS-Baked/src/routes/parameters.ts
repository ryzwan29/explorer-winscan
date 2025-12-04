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

    const cacheKey = `parameters_${chainName}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Read chain config - handle different naming formats
    const chainsDir = process.env.CHAINS_DIR || path.join(__dirname, '../../chains');
    
    // Try exact match first
    let chainFilePath = path.join(chainsDir, `${chainName}.json`);
    
    // If not found, try case-insensitive and partial match
    if (!fs.existsSync(chainFilePath)) {
      const files = fs.readdirSync(chainsDir).filter(f => f.endsWith('.json'));
      const chainLower = chainName.toLowerCase();
      
      // Try exact case-insensitive match
      let match = files.find(f => f.toLowerCase() === `${chainLower}.json`);
      
      // Try partial match (e.g., "gitopia-mainnet" matches "Gitopia.json")
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

    const chainData = JSON.parse(fs.readFileSync(chainFilePath, 'utf-8'));
    const apiUrl = chainData.api?.[0]?.address;

    if (!apiUrl) {
      return res.status(500).json({ error: 'No API URL configured' });
    }

    // Fetch parameters from multiple modules
    const [staking, slashing, distribution, gov, mint] = await Promise.allSettled([
      axios.get(`${apiUrl}/cosmos/staking/v1beta1/params`, { timeout: 5000 }),
      axios.get(`${apiUrl}/cosmos/slashing/v1beta1/params`, { timeout: 5000 }),
      axios.get(`${apiUrl}/cosmos/distribution/v1beta1/params`, { timeout: 5000 }),
      axios.get(`${apiUrl}/cosmos/gov/v1beta1/params/voting`, { timeout: 5000 }),
      axios.get(`${apiUrl}/cosmos/mint/v1beta1/params`, { timeout: 5000 })
    ]);

    const parameters = {
      staking: staking.status === 'fulfilled' ? staking.value.data.params : null,
      slashing: slashing.status === 'fulfilled' ? slashing.value.data.params : null,
      distribution: distribution.status === 'fulfilled' ? distribution.value.data.params : null,
      gov: gov.status === 'fulfilled' ? gov.value.data.voting_params : null,
      mint: mint.status === 'fulfilled' ? mint.value.data.params : null
    };

    cache.set(cacheKey, parameters, 300); // Cache 5 min
    res.json(parameters);
  } catch (error: any) {
    console.error('Parameters error:', error.message);
    res.status(500).json({ error: 'Failed to fetch parameters' });
  }
});

export default router;
