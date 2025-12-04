import express, { Request, Response } from 'express';
import { getCacheStats } from '../utils/smartCache';

const router = express.Router();

/**
 * GET /api/cache/stats
 * Get cache statistics for monitoring
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = getCacheStats();
    
    const totalKeys = stats.instant.keys + stats.short.keys + stats.medium.keys + stats.long.keys;
    const totalHits = stats.instant.hits + stats.short.hits + stats.medium.hits + stats.long.hits;
    const totalMisses = stats.instant.misses + stats.short.misses + stats.medium.misses + stats.long.misses;
    const hitRate = totalHits + totalMisses > 0 
      ? ((totalHits / (totalHits + totalMisses)) * 100).toFixed(2) 
      : '0.00';
    
    res.json({
      summary: {
        totalKeys,
        totalHits,
        totalMisses,
        hitRate: `${hitRate}%`,
        inflightRequests: stats.inflight,
      },
      tiers: stats,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get cache stats', message: error.message });
  }
});

export default router;
