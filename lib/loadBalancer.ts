interface Endpoint {
  address: string;
  provider: string;
  failures?: number;
  lastFailure?: number;
  rateLimit?: number;
  lastRequest?: number;
}
interface EndpointHealth {
  healthy: boolean;
  latency: number;
  lastCheck: number;
}
class APILoadBalancer {
  private endpoints: Endpoint[] = [];
  private currentIndex: number = 0;
  private healthStatus: Map<string, EndpointHealth> = new Map();
  private requestCounts: Map<string, number[]> = new Map();
  private requestQueue: Array<() => void> = [];
  private activeRequests: number = 0;
  private readonly MAX_CONCURRENT = 10; // Max 10 concurrent requests per balancer
  private readonly RATE_LIMIT_WINDOW = 10000; // 10 detik
  private readonly RATE_LIMIT_MAX = 100; // 100 requests per 10s (lebih tinggi)
  private readonly MAX_FAILURES = 5; // Toleransi failure lebih besar
  private readonly FAILURE_COOLDOWN = 30000; // 30 detik cooldown (lebih cepat recover)
  constructor(endpoints: Endpoint[]) {
    this.endpoints = endpoints.map(ep => ({
      ...ep,
      failures: 0,
      lastFailure: 0,
      rateLimit: 0,
    }));
  }
  private getNextEndpoint(): Endpoint | null {
    // Smart selection: Prioritize healthy endpoints dengan latency rendah
    const healthyEndpoints = this.endpoints.filter(ep => {
      // Check if failed too many times
      if (ep.failures && ep.failures >= this.MAX_FAILURES) {
        const timeSinceFailure = Date.now() - (ep.lastFailure || 0);
        if (timeSinceFailure < this.FAILURE_COOLDOWN) {
          return false;
        }
        ep.failures = 0; // Reset setelah cooldown
      }
      
      // Check rate limit
      if (this.isRateLimited(ep.address)) {
        return false;
      }
      
      return true;
    });
    
    if (healthyEndpoints.length === 0) {
      // Semua endpoint bermasalah, ambil yang failure paling sedikit
      const sorted = [...this.endpoints].sort((a, b) => 
        (a.failures || 0) - (b.failures || 0)
      );
      return sorted[0] || null;
    }
    
    // Prioritize endpoint dengan latency rendah
    const withLatency = healthyEndpoints.map(ep => ({
      endpoint: ep,
      health: this.healthStatus.get(ep.address),
    }));
    
    // Sort by: healthy first, then by latency
    withLatency.sort((a, b) => {
      const aHealthy = a.health?.healthy ? 1 : 0;
      const bHealthy = b.health?.healthy ? 1 : 0;
      
      if (aHealthy !== bHealthy) return bHealthy - aHealthy;
      
      const aLatency = a.health?.latency || 9999;
      const bLatency = b.health?.latency || 9999;
      
      return aLatency - bLatency;
    });
    
    // Round-robin pada top 3 tercepat untuk distribusi load
    const topEndpoints = withLatency.slice(0, 3).map(w => w.endpoint);
    const selected = topEndpoints[this.currentIndex % topEndpoints.length];
    this.currentIndex = (this.currentIndex + 1) % topEndpoints.length;
    
    return selected;
  }
  private isRateLimited(address: string): boolean {
    const requests = this.requestCounts.get(address) || [];
    const now = Date.now();
    const recentRequests = requests.filter(
      timestamp => now - timestamp < this.RATE_LIMIT_WINDOW
    );
    this.requestCounts.set(address, recentRequests);
    return recentRequests.length >= this.RATE_LIMIT_MAX;
  }
  private recordRequest(address: string): void {
    const requests = this.requestCounts.get(address) || [];
    requests.push(Date.now());
    this.requestCounts.set(address, requests);
  }
  
  private async waitForSlot(): Promise<void> {
    if (this.activeRequests < this.MAX_CONCURRENT) {
      this.activeRequests++;
      return Promise.resolve();
    }
    
    // Queue request
    return new Promise((resolve) => {
      this.requestQueue.push(() => {
        this.activeRequests++;
        resolve();
      });
    });
  }
  
  private releaseSlot(): void {
    this.activeRequests--;
    const next = this.requestQueue.shift();
    if (next) {
      next();
    }
  }
  private markFailure(endpoint: Endpoint, error: any): void {
    endpoint.failures = (endpoint.failures || 0) + 1;
    endpoint.lastFailure = Date.now();
    console.error(
      `[LoadBalancer] Endpoint ${endpoint.address} failed (${endpoint.failures}/${this.MAX_FAILURES})`,
      error.message
    );
  }
  private markSuccess(endpoint: Endpoint): void {
    if (endpoint.failures && endpoint.failures > 0) {
      console.info(`[LoadBalancer] Endpoint ${endpoint.address} recovered`);
      endpoint.failures = 0;
    }
  }
  async fetch<T = any>(
    path: string,
    options?: RequestInit,
    retries: number = this.endpoints.length // Retry semua endpoints
  ): Promise<T> {
    // Wait for available slot (prevent burst)
    await this.waitForSlot();
    
    try {
      let lastError: Error | null = null;
      let attemptsLeft = Math.min(retries, this.endpoints.length * 2); // Max 2 putaran
      const triedEndpoints = new Set<string>();
      
      while (attemptsLeft > 0) {
        const endpoint = this.getNextEndpoint();
        if (!endpoint) {
          throw new Error('No available endpoints');
        }
        
        // Skip jika sudah dicoba 2x
        if (triedEndpoints.has(endpoint.address) && triedEndpoints.size >= this.endpoints.length) {
          attemptsLeft--;
          continue;
        }
        
        triedEndpoints.add(endpoint.address);
        
        try {
        const url = `${endpoint.address}${path}`;
        this.recordRequest(endpoint.address);
        
        console.log(`[LoadBalancer] Trying ${endpoint.provider}: ${url.substring(0, 80)}...`);
        
          const response = await fetch(url, {
            ...options,
            signal: AbortSignal.timeout(10000), // 10s timeout
            headers: {
              'Accept': 'application/json',
              ...options?.headers,
            },
          });
          
          // Rate limit - langsung pindah endpoint
          if (response.status === 429) {
            console.warn(`[LoadBalancer] ${endpoint.provider} rate limited, switching...`);
            this.markFailure(endpoint, new Error('Rate limit exceeded'));
            attemptsLeft--;
            await new Promise(resolve => setTimeout(resolve, 100)); // Minimal delay
            continue;
          }
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          this.markSuccess(endpoint);
          
          console.log(`[LoadBalancer] ✓ ${endpoint.provider} succeeded`);
          
          return data;
        } catch (error: any) {
          lastError = error;
          console.warn(`[LoadBalancer] ${endpoint.provider} failed: ${error.message}`);
          this.markFailure(endpoint, error);
          attemptsLeft--;
          
          // Jika masih ada endpoint lain, langsung coba tanpa delay
          if (triedEndpoints.size < this.endpoints.length) {
            continue;
          }
          
          // Exponential backoff: 200ms, 400ms, 800ms, ...
          if (attemptsLeft > 0) {
            const backoffDelay = Math.min(200 * Math.pow(2, triedEndpoints.size - 1), 2000);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
          }
        }
      }
      
      throw lastError || new Error(`All ${this.endpoints.length} endpoints failed`);
    } finally {
      // Always release slot
      this.releaseSlot();
    }
  }

  async healthCheck(): Promise<void> {
    const checks = this.endpoints.map(async (endpoint) => {
      const start = Date.now();
      try {
        const response = await fetch(`${endpoint.address}/cosmos/base/tendermint/v1beta1/node_info`, {
          signal: AbortSignal.timeout(5000),
        });
        const latency = Date.now() - start;
        const healthy = response.ok;
        this.healthStatus.set(endpoint.address, {
          healthy,
          latency,
          lastCheck: Date.now(),
        });
        console.log(
          `[LoadBalancer] ${endpoint.provider} (${endpoint.address}): ` +
          `${healthy ? '✓' : '✗'} ${latency}ms`
        );
      } catch (error) {
        this.healthStatus.set(endpoint.address, {
          healthy: false,
          latency: -1,
          lastCheck: Date.now(),
        });
        console.error(`[LoadBalancer] ${endpoint.provider} health check failed`);
      }
    });
    await Promise.allSettled(checks);
  }

  getHealthStatus(): Map<string, EndpointHealth> {
    return this.healthStatus;
  }

  getStats() {
    return {
      endpoints: this.endpoints.map(ep => ({
        address: ep.address,
        provider: ep.provider,
        failures: ep.failures || 0,
        healthy: (ep.failures || 0) < this.MAX_FAILURES,
        health: this.healthStatus.get(ep.address),
      })),
      currentIndex: this.currentIndex,
    };
  }
}

const loadBalancers = new Map<string, { api: APILoadBalancer; rpc: APILoadBalancer }>();

export function getLoadBalancer(
  chainName: string,
  apiEndpoints: Endpoint[],
  rpcEndpoints: Endpoint[]
): { api: APILoadBalancer; rpc: APILoadBalancer } {
  if (!loadBalancers.has(chainName)) {
    loadBalancers.set(chainName, {
      api: new APILoadBalancer(apiEndpoints),
      rpc: new APILoadBalancer(rpcEndpoints),
    });
    const balancer = loadBalancers.get(chainName)!;
    
    // Initial health check
    balancer.api.healthCheck().catch(() => {});
    balancer.rpc.healthCheck().catch(() => {});
    
    // Periodic health check setiap 2 menit (lebih sering dari 5 menit)
    setInterval(() => {
      balancer.api.healthCheck().catch(() => {});
      balancer.rpc.healthCheck().catch(() => {});
    }, 2 * 60 * 1000);
  }
  return loadBalancers.get(chainName)!;
}

export async function fetchFromAPI<T = any>(
  chainName: string,
  apiEndpoints: Endpoint[],
  path: string,
  options?: RequestInit
): Promise<T> {
  const balancer = getLoadBalancer(chainName, apiEndpoints, []);
  return balancer.api.fetch<T>(path, options);
}

export async function fetchFromRPC<T = any>(
  chainName: string,
  rpcEndpoints: Endpoint[],
  path: string,
  options?: RequestInit
): Promise<T> {
  const balancer = getLoadBalancer(chainName, [], rpcEndpoints);
  return balancer.rpc.fetch<T>(path, options);
}

export function getLoadBalancerStats(chainName: string) {
  const balancer = loadBalancers.get(chainName);
  if (!balancer) return null;
  return {
    api: balancer.api.getStats(),
    rpc: balancer.rpc.getStats(),
  };
}

export function clearLoadBalancer(chainName: string): void {
  loadBalancers.delete(chainName);
}

export function getAllLoadBalancerStats() {
  const stats: Record<string, any> = {};
  loadBalancers.forEach((balancer, chainName) => {
    stats[chainName] = {
      api: balancer.api.getStats(),
      rpc: balancer.rpc.getStats(),
    };
  });
  return stats;
}

// Expose ke window untuk debugging
if (typeof window !== 'undefined') {
  (window as any).getLoadBalancerStats = getAllLoadBalancerStats;
}
