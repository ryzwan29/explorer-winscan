import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { cache } from '../index';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const cacheKey = 'all_chains';
    
    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const chainsDir = process.env.CHAINS_DIR || path.join(__dirname, '../../chains');
    
    if (!fs.existsSync(chainsDir)) {
      return res.status(500).json({ error: 'Chains directory not found' });
    }

    const files = fs.readdirSync(chainsDir).filter(file => file.endsWith('.json'));
    
    const chains = files.map(file => {
      const filePath = path.join(chainsDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      // Add chain_id as filename without .json for API requests
      const chainId = file.replace('.json', '');
      return {
        ...data,
        chain_id: chainId // e.g., "Gitopia" instead of "Gitopia-Mainnet"
      };
    });

    // Cache for 5 minutes
    cache.set(cacheKey, chains, 300);

    res.json(chains);
  } catch (error: any) {
    console.error('Chains error:', error.message);
    res.status(500).json({ error: 'Failed to load chains' });
  }
});

export default router;
