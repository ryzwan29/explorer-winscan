import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

// In-memory cache for Keybase results
const keybaseCache = new Map<string, any>();
const CACHE_TTL = 3600000; // 1 hour

router.get('/', async (req: Request, res: Response) => {
  try {
    const identity = req.query.identity as string;
    
    if (!identity) {
      return res.status(400).json({ error: 'Missing identity parameter' });
    }

    // Check cache
    const cached = keybaseCache.get(identity);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json(cached.data);
    }

    // Try key_suffix lookup
    try {
      const response = await axios.get(
        `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=${identity}&fields=pictures`,
        { timeout: 3000 }
      );

      if (response.data.them && response.data.them.length > 0) {
        const user = response.data.them[0];
        const avatarUrl = user.pictures?.primary?.url;
        
        const result = { avatarUrl: avatarUrl || null };
        keybaseCache.set(identity, { data: result, timestamp: Date.now() });
        return res.json(result);
      }
    } catch (error) {
      // Continue to username lookup
    }

    // Try username lookup
    try {
      const response = await axios.get(
        `https://keybase.io/_/api/1.0/user/lookup.json?username=${identity}&fields=pictures`,
        { timeout: 3000 }
      );

      if (response.data.them && response.data.them.length > 0) {
        const user = response.data.them[0];
        const avatarUrl = user.pictures?.primary?.url;
        
        const result = { avatarUrl: avatarUrl || null };
        keybaseCache.set(identity, { data: result, timestamp: Date.now() });
        return res.json(result);
      }
    } catch (error) {
      // User not found
    }

    // Not found
    const result = { avatarUrl: null };
    keybaseCache.set(identity, { data: result, timestamp: Date.now() });
    res.json(result);
  } catch (error: any) {
    console.error('Keybase error:', error.message);
    res.json({ avatarUrl: null });
  }
});

export default router;
