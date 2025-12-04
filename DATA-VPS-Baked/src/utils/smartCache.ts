/**
 * Advanced Caching Strategy for Instant Loading Experience
 * - Aggressive caching with smart invalidation
 * - Request deduplication
 * - Predictive prefetching
 */

import NodeCache from 'node-cache';

// Multiple cache layers with different TTLs
const instantCache = new NodeCache({ stdTTL: 5 }); // 5 seconds - ultra fast
const shortCache = new NodeCache({ stdTTL: 30 }); // 30 seconds - normal data
const mediumCache = new NodeCache({ stdTTL: 300 }); // 5 minutes - semi-static data
const longCache = new NodeCache({ stdTTL: 3600 }); // 1 hour - static data

// Track in-flight requests to avoid duplicates
const inflightRequests = new Map<string, Promise<any>>();

// Manual stats tracking (NodeCache stats not reliable)
const cacheStats = {
  instant: { hits: 0, misses: 0 },
  short: { hits: 0, misses: 0 },
  medium: { hits: 0, misses: 0 },
  long: { hits: 0, misses: 0 },
};

/**
 * Cache tiers based on data type
 */
export enum CacheTier {
  INSTANT = 'instant', // 5s - blocks, network status
  SHORT = 'short',     // 30s - transactions, accounts
  MEDIUM = 'medium',   // 5m - validators, proposals
  LONG = 'long'        // 1h - chain params, assets
}

/**
 * Get cache instance by tier
 */
function getCacheByTier(tier: CacheTier): NodeCache {
  switch (tier) {
    case CacheTier.INSTANT: return instantCache;
    case CacheTier.SHORT: return shortCache;
    case CacheTier.MEDIUM: return mediumCache;
    case CacheTier.LONG: return longCache;
    default: return shortCache;
  }
}

/**
 * Smart cache wrapper with request deduplication
 */
export async function smartCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  tier: CacheTier = CacheTier.SHORT
): Promise<T> {
  const cache = getCacheByTier(tier);
  
  // Check cache first (instant return)
  const cached = cache.get<T>(key);
  if (cached !== undefined) {
    console.log(`⚡ Cache HIT (${tier}):`, key);
    // Track hit
    cacheStats[tier].hits++;
    return cached;
  }
  
  // Track miss
  cacheStats[tier].misses++;
  
  // Check if request already in-flight (deduplication)
  const inflight = inflightRequests.get(key);
  if (inflight) {
    console.log(`🔄 Request DEDUP:`, key);
    return inflight as Promise<T>;
  }
  
  // Execute fetch and store promise
  const fetchPromise = fetchFn()
    .then(result => {
      cache.set(key, result);
      inflightRequests.delete(key);
      console.log(`💾 Cache SET (${tier}):`, key);
      return result;
    })
    .catch(error => {
      inflightRequests.delete(key);
      throw error;
    });
  
  inflightRequests.set(key, fetchPromise);
  return fetchPromise;
}

/**
 * Optimistic cache - return stale data immediately while refreshing
 */
export async function optimisticCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  tier: CacheTier = CacheTier.SHORT
): Promise<T> {
  const cache = getCacheByTier(tier);
  
  // Always return cached data immediately if available
  const cached = cache.get<T>(key);
  
  // Refresh in background (fire and forget)
  const inflight = inflightRequests.get(key);
  if (!inflight) {
    const refreshPromise = fetchFn()
      .then(result => {
        cache.set(key, result);
        inflightRequests.delete(key);
        return result;
      })
      .catch(() => {
        inflightRequests.delete(key);
      });
    
    inflightRequests.set(key, refreshPromise);
  }
  
  // Return cached immediately, or wait for fresh data
  if (cached !== undefined) {
    console.log(`⚡ Optimistic HIT:`, key);
    cacheStats[tier].hits++;
    return cached;
  }
  
  console.log(`⏳ Optimistic WAIT:`, key);
  cacheStats[tier].misses++;
  return inflightRequests.get(key) as Promise<T>;
}

/**
 * Prefetch data predictively
 */
export async function prefetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  tier: CacheTier = CacheTier.SHORT
): Promise<void> {
  const cache = getCacheByTier(tier);
  
  // Skip if already cached
  if (cache.has(key)) return;
  
  // Skip if already fetching
  if (inflightRequests.has(key)) return;
  
  console.log(`🔮 Prefetch:`, key);
  
  // Fire and forget
  const fetchPromise = fetchFn()
    .then(result => {
      cache.set(key, result);
      inflightRequests.delete(key);
    })
    .catch(() => {
      inflightRequests.delete(key);
    });
  
  inflightRequests.set(key, fetchPromise);
}

/**
 * Batch prefetch multiple keys
 */
export async function batchPrefetch(
  items: Array<{ key: string; fetchFn: () => Promise<any>; tier?: CacheTier }>
): Promise<void> {
  await Promise.allSettled(
    items.map(item => prefetch(item.key, item.fetchFn, item.tier))
  );
}

/**
 * Invalidate cache by pattern
 */
export function invalidatePattern(pattern: string | RegExp): number {
  let count = 0;
  const caches = [instantCache, shortCache, mediumCache, longCache];
  
  caches.forEach(cache => {
    const keys = cache.keys();
    keys.forEach(key => {
      if (typeof pattern === 'string' && key.includes(pattern)) {
        cache.del(key);
        count++;
      } else if (pattern instanceof RegExp && pattern.test(key)) {
        cache.del(key);
        count++;
      }
    });
  });
  
  console.log(`🗑️ Invalidated ${count} cache entries matching:`, pattern);
  return count;
}

/**
 * Warm up cache for common queries
 */
export function warmupCache(
  chain: string,
  fetchFunctions: {
    blocks?: () => Promise<any>;
    validators?: () => Promise<any>;
    network?: () => Promise<any>;
  }
): void {
  console.log(`🔥 Warming up cache for ${chain}...`);
  
  if (fetchFunctions.blocks) {
    prefetch(`blocks_${chain}`, fetchFunctions.blocks, CacheTier.INSTANT);
  }
  
  if (fetchFunctions.validators) {
    prefetch(`validators_${chain}`, fetchFunctions.validators, CacheTier.MEDIUM);
  }
  
  if (fetchFunctions.network) {
    prefetch(`network_${chain}`, fetchFunctions.network, CacheTier.INSTANT);
  }
}

/**
 * Get cache stats
 */
export function getCacheStats() {
  return {
    instant: {
      keys: instantCache.keys().length,
      hits: cacheStats.instant.hits,
      misses: cacheStats.instant.misses,
    },
    short: {
      keys: shortCache.keys().length,
      hits: cacheStats.short.hits,
      misses: cacheStats.short.misses,
    },
    medium: {
      keys: mediumCache.keys().length,
      hits: cacheStats.medium.hits,
      misses: cacheStats.medium.misses,
    },
    long: {
      keys: longCache.keys().length,
      hits: cacheStats.long.hits,
      misses: cacheStats.long.misses,
    },
    inflight: inflightRequests.size,
  };
}
