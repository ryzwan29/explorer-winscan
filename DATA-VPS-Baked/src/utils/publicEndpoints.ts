/**
 * Public RPC/API Endpoints Aggregator
 * Fallback ke public endpoints komunitas kalau chain endpoints kena rate limit
 */

export interface PublicEndpoint {
  address: string;
  provider: string;
  type: 'rpc' | 'api';
}

/**
 * List public endpoints by chain (dari cosmos.directory, polkachu, dll)
 */
const PUBLIC_ENDPOINTS: Record<string, PublicEndpoint[]> = {
  // Cosmos Hub
  'cosmoshub': [
    { address: 'https://cosmos-rpc.publicnode.com', provider: 'PublicNode', type: 'rpc' },
    { address: 'https://cosmos-rpc.polkachu.com', provider: 'Polkachu', type: 'rpc' },
    { address: 'https://rpc-cosmoshub.blockapsis.com', provider: 'Blockapsis', type: 'rpc' },
    { address: 'https://cosmos-rest.publicnode.com', provider: 'PublicNode', type: 'api' },
    { address: 'https://cosmos-api.polkachu.com', provider: 'Polkachu', type: 'api' },
  ],
  'cosmoshub-4': [
    { address: 'https://cosmos-rpc.publicnode.com', provider: 'PublicNode', type: 'rpc' },
    { address: 'https://cosmos-rpc.polkachu.com', provider: 'Polkachu', type: 'rpc' },
  ],
  
  // Osmosis
  'osmosis': [
    { address: 'https://osmosis-rpc.polkachu.com', provider: 'Polkachu', type: 'rpc' },
    { address: 'https://rpc.osmosis.zone', provider: 'Osmosis Foundation', type: 'rpc' },
    { address: 'https://osmosis.rpc.kjnodes.com', provider: 'kjnodes', type: 'rpc' },
    { address: 'https://osmosis-api.polkachu.com', provider: 'Polkachu', type: 'api' },
    { address: 'https://lcd.osmosis.zone', provider: 'Osmosis Foundation', type: 'api' },
  ],
  'osmosis-1': [
    { address: 'https://osmosis-rpc.polkachu.com', provider: 'Polkachu', type: 'rpc' },
    { address: 'https://rpc.osmosis.zone', provider: 'Osmosis Foundation', type: 'rpc' },
  ],
  
  // Celestia
  'celestia': [
    { address: 'https://celestia-rpc.polkachu.com', provider: 'Polkachu', type: 'rpc' },
    { address: 'https://rpc.celestia.pops.one', provider: 'POPS', type: 'rpc' },
    { address: 'https://celestia-api.polkachu.com', provider: 'Polkachu', type: 'api' },
  ],
  
  // Injective
  'injective': [
    { address: 'https://injective-rpc.polkachu.com', provider: 'Polkachu', type: 'rpc' },
    { address: 'https://sentry.tm.injective.network:443', provider: 'Injective', type: 'rpc' },
    { address: 'https://injective-api.polkachu.com', provider: 'Polkachu', type: 'api' },
  ],
  
  // Dymension
  'dymension': [
    { address: 'https://dymension-rpc.polkachu.com', provider: 'Polkachu', type: 'rpc' },
    { address: 'https://dymension-api.polkachu.com', provider: 'Polkachu', type: 'api' },
  ],
  
  // Noble
  'noble': [
    { address: 'https://noble-rpc.polkachu.com', provider: 'Polkachu', type: 'rpc' },
    { address: 'https://rpc.noble.chaintools.tech', provider: 'ChainTools', type: 'rpc' },
    { address: 'https://noble-api.polkachu.com', provider: 'Polkachu', type: 'api' },
  ],
  'noble-1': [
    { address: 'https://noble-rpc.polkachu.com', provider: 'Polkachu', type: 'rpc' },
  ],
  
  // Akash
  'akash': [
    { address: 'https://akash-rpc.polkachu.com', provider: 'Polkachu', type: 'rpc' },
    { address: 'https://rpc.akash.forbole.com:443', provider: 'Forbole', type: 'rpc' },
    { address: 'https://akash-api.polkachu.com', provider: 'Polkachu', type: 'api' },
  ],
  
  // Juno
  'juno': [
    { address: 'https://juno-rpc.polkachu.com', provider: 'Polkachu', type: 'rpc' },
    { address: 'https://rpc-juno.ecostake.com', provider: 'ECOStake', type: 'rpc' },
    { address: 'https://juno-api.polkachu.com', provider: 'Polkachu', type: 'api' },
  ],
  
  // Stargaze
  'stargaze': [
    { address: 'https://stargaze-rpc.polkachu.com', provider: 'Polkachu', type: 'rpc' },
    { address: 'https://rpc.stargaze-apis.com', provider: 'Stargaze', type: 'rpc' },
    { address: 'https://stargaze-api.polkachu.com', provider: 'Polkachu', type: 'api' },
  ],
  
  // Evmos
  'evmos': [
    { address: 'https://evmos-rpc.polkachu.com', provider: 'Polkachu', type: 'rpc' },
    { address: 'https://evmos-json-rpc.stakely.io', provider: 'Stakely', type: 'rpc' },
    { address: 'https://evmos-api.polkachu.com', provider: 'Polkachu', type: 'api' },
  ],
  
  // Secret Network
  'secret': [
    { address: 'https://secret-rpc.polkachu.com', provider: 'Polkachu', type: 'rpc' },
    { address: 'https://rpc.secret.express', provider: 'Secret Express', type: 'rpc' },
    { address: 'https://secret-api.polkachu.com', provider: 'Polkachu', type: 'api' },
  ],
  
  // Kujira
  'kujira': [
    { address: 'https://kujira-rpc.polkachu.com', provider: 'Polkachu', type: 'rpc' },
    { address: 'https://rpc.kujira.chaintools.tech', provider: 'ChainTools', type: 'rpc' },
    { address: 'https://kujira-api.polkachu.com', provider: 'Polkachu', type: 'api' },
  ],
  
  // Neutron
  'neutron': [
    { address: 'https://neutron-rpc.polkachu.com', provider: 'Polkachu', type: 'rpc' },
    { address: 'https://rpc-neutron.whispernode.com', provider: 'WhisperNode', type: 'rpc' },
    { address: 'https://neutron-api.polkachu.com', provider: 'Polkachu', type: 'api' },
  ],
};

/**
 * Get public endpoints for a chain (fallback)
 */
export function getPublicEndpoints(chainName: string, chainId?: string, type: 'rpc' | 'api' = 'rpc'): PublicEndpoint[] {
  const endpoints: PublicEndpoint[] = [];
  
  // Try exact chain name match
  if (PUBLIC_ENDPOINTS[chainName]) {
    endpoints.push(...PUBLIC_ENDPOINTS[chainName].filter(e => e.type === type));
  }
  
  // Try chain ID match
  if (chainId && PUBLIC_ENDPOINTS[chainId]) {
    endpoints.push(...PUBLIC_ENDPOINTS[chainId].filter(e => e.type === type));
  }
  
  // Try fuzzy match (remove -mainnet, -testnet suffix)
  const baseChainName = chainName.replace(/-mainnet|-testnet|-test/g, '');
  if (PUBLIC_ENDPOINTS[baseChainName]) {
    endpoints.push(...PUBLIC_ENDPOINTS[baseChainName].filter(e => e.type === type));
  }
  
  return endpoints;
}

/**
 * Combine chain endpoints with public fallback endpoints
 */
export function getCombinedEndpoints(
  chainEndpoints: { address: string; provider?: string }[],
  chainName: string,
  chainId?: string,
  type: 'rpc' | 'api' = 'rpc'
): { address: string; provider?: string }[] {
  // Start with chain-specific endpoints
  const combined = [...(chainEndpoints || [])];
  
  // Add public endpoints as fallback
  const publicEndpoints = getPublicEndpoints(chainName, chainId, type);
  
  // Avoid duplicates
  publicEndpoints.forEach(pub => {
    const exists = combined.some(ep => 
      ep.address.toLowerCase().includes(pub.address.toLowerCase()) ||
      pub.address.toLowerCase().includes(ep.address.toLowerCase())
    );
    if (!exists) {
      combined.push({ address: pub.address, provider: `${pub.provider} (Public)` });
    }
  });
  
  console.log(`[Public Endpoints] ${chainName}: ${chainEndpoints?.length || 0} chain + ${publicEndpoints.length} public = ${combined.length} total`);
  
  return combined;
}
