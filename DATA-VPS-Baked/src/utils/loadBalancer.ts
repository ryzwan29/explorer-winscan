import axios, { AxiosRequestConfig } from 'axios';

interface Endpoint {
  address: string;
  provider?: string;
}

// Track failed endpoints to skip them temporarily
const failedEndpoints = new Map<string, number>(); // endpoint -> timestamp
const FAILED_TIMEOUT = 60000; // Skip failed endpoints for 1 minute

// Track successful endpoints for prioritization (like PingPub strategy)
const successfulEndpoints = new Map<string, number>(); // endpoint -> success count
const lastSuccessfulEndpoint = new Map<string, string>(); // chain -> endpoint address

/**
 * Get a random endpoint (PingPub strategy)
 * Prioritize last successful endpoint, then random selection
 */
function getSmartEndpoint(endpoints: Endpoint[], chainKey: string): Endpoint[] {
  // Check if we have a last successful endpoint for this chain
  const lastSuccess = lastSuccessfulEndpoint.get(chainKey);
  if (lastSuccess) {
    const preferred = endpoints.find(e => e.address === lastSuccess);
    if (preferred) {
      // Put preferred endpoint first, then shuffle rest
      const others = endpoints.filter(e => e.address !== lastSuccess);
      return [preferred, ...shuffleArray(others)];
    }
  }
  
  // No last success, sort by success count and shuffle equally successful ones
  return endpoints.slice().sort((a, b) => {
    const aCount = successfulEndpoints.get(a.address) || 0;
    const bCount = successfulEndpoints.get(b.address) || 0;
    const aFailed = failedEndpoints.get(a.address) || 0;
    const bFailed = failedEndpoints.get(b.address) || 0;
    
    // Skip recently failed endpoints
    const now = Date.now();
    if (aFailed && now - aFailed < FAILED_TIMEOUT) return 1;
    if (bFailed && now - bFailed < FAILED_TIMEOUT) return -1;
    
    // Random among equally successful endpoints
    if (aCount === bCount) return Math.random() - 0.5;
    return bCount - aCount;
  });
}

/**
 * Shuffle array (Fisher-Yates algorithm)
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Smart load balancer that tries multiple endpoints until one succeeds
 * Uses PingPub strategy: prioritize last successful, then random selection
 * Automatically retries on rate limit, timeout, or other errors
 */
export async function fetchWithLoadBalancer(
  endpoints: Endpoint[],
  buildUrl: (endpoint: string) => string,
  options?: AxiosRequestConfig,
  chainKey?: string
): Promise<any> {
  if (!endpoints || endpoints.length === 0) {
    throw new Error('No endpoints available');
  }

  // Smart endpoint selection (PingPub strategy)
  const sortedEndpoints = getSmartEndpoint(endpoints, chainKey || 'default');

  let lastError: any = null;

  for (const endpoint of sortedEndpoints) {
    const url = buildUrl(endpoint.address);
    
    try {
      const response = await axios.get(url, {
        timeout: options?.timeout || 8000,
        headers: options?.headers || { 'Accept': 'application/json' },
        ...options
      });

      if (response.status === 200 && response.data) {
        // Mark as successful (PingPub strategy: remember this endpoint)
        const currentCount = successfulEndpoints.get(endpoint.address) || 0;
        successfulEndpoints.set(endpoint.address, currentCount + 1);
        failedEndpoints.delete(endpoint.address);
        if (chainKey) {
          lastSuccessfulEndpoint.set(chainKey, endpoint.address);
        }
        
        console.log(`✓ Load Balancer: Success with ${endpoint.provider || endpoint.address}`);
        return response.data;
      }
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error
      const isRateLimit = 
        error.response?.status === 429 || 
        error.response?.status === 503 ||
        error.code === 'ECONNABORTED' ||
        error.message?.includes('timeout') ||
        error.message?.includes('rate limit');
      
      if (isRateLimit) {
        // Mark as failed temporarily
        failedEndpoints.set(endpoint.address, Date.now());
        console.log(`⚠ Load Balancer: Rate limit/timeout on ${endpoint.provider || endpoint.address}, trying next...`);
      } else {
        console.log(`✗ Load Balancer: Error on ${endpoint.provider || endpoint.address}:`, error.message);
      }
      
      continue;
    }
  }

  throw new Error(`All endpoints failed. Last error: ${lastError?.message || 'Unknown'}`);
}

/**
 * Fetch with multiple query formats (for tx_search and similar endpoints)
 * Uses PingPub strategy for endpoint selection
 */
export async function fetchWithQueryFormats(
  endpoints: Endpoint[],
  queryFormats: string[],
  buildUrl: (endpoint: string, query: string) => string,
  options?: AxiosRequestConfig,
  chainKey?: string
): Promise<any> {
  if (!endpoints || endpoints.length === 0) {
    throw new Error('No endpoints available');
  }

  // Smart endpoint selection (PingPub strategy)
  const sortedEndpoints = getSmartEndpoint(endpoints, chainKey || 'default');

  let lastError: any = null;

  // Try all combinations of endpoints and query formats
  for (const endpoint of sortedEndpoints) {
    for (const query of queryFormats) {
      const url = buildUrl(endpoint.address, query);
      
      try {
        const response = await axios.get(url, {
          timeout: options?.timeout || 8000,
          headers: options?.headers || { 'Accept': 'application/json' },
          ...options
        });

        if (response.status === 200 && response.data?.result?.txs && response.data.result.txs.length > 0) {
          const currentCount = successfulEndpoints.get(endpoint.address) || 0;
          successfulEndpoints.set(endpoint.address, currentCount + 1);
          failedEndpoints.delete(endpoint.address);
          if (chainKey) {
            lastSuccessfulEndpoint.set(chainKey, endpoint.address);
          }
          
          console.log(`✓ Query Format: Success with ${endpoint.provider || endpoint.address}`);
          return response.data;
        }
      } catch (error: any) {
        lastError = error;
        
        const isRateLimit = 
          error.response?.status === 429 || 
          error.response?.status === 503 ||
          error.code === 'ECONNABORTED';
        
        if (isRateLimit) {
          failedEndpoints.set(endpoint.address, Date.now());
          console.log(`⚠ Query Format: Rate limit on ${endpoint.provider || endpoint.address}, skipping...`);
          break; // Skip other query formats for this endpoint
        }
        
        continue;
      }
    }
  }

  throw new Error(`All endpoint/query combinations failed. Last error: ${lastError?.message || 'Unknown'}`);
}

/**
 * Fetch from REST API with load balancing (PingPub-inspired)
 */
export async function fetchRestWithLoadBalancer(
  endpoints: Endpoint[],
  path: string,
  options?: AxiosRequestConfig,
  chainKey?: string
): Promise<any> {
  return fetchWithLoadBalancer(
    endpoints,
    (endpoint) => `${endpoint}${path}`,
    options,
    chainKey
  );
}

/**
 * Fetch from RPC with load balancing (PingPub-inspired)
 */
export async function fetchRpcWithLoadBalancer(
  endpoints: Endpoint[],
  method: string,
  params?: any,
  options?: AxiosRequestConfig,
  chainKey?: string
): Promise<any> {
  return fetchWithLoadBalancer(
    endpoints,
    (endpoint) => {
      if (params) {
        const queryString = Object.entries(params)
          .map(([key, value]) => `${key}=${value}`)
          .join('&');
        return `${endpoint}/${method}?${queryString}`;
      }
      return `${endpoint}/${method}`;
    },
    options,
    chainKey
  );
}
