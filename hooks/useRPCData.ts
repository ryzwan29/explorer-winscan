import { useState, useEffect, useCallback } from 'react';
import { rpcClient } from '@/lib/rpcClient';

interface UseRPCDataOptions {
  enabled?: boolean;
  refetchInterval?: number;
  cacheTime?: number;
}

export function useRPCData<T>(
  rpcUrls: string[],
  endpoint: string,
  cacheKey: string,
  options: UseRPCDataOptions = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const {
    enabled = true,
    refetchInterval,
    cacheTime = 30,
  } = options;

  const fetchData = useCallback(async () => {
    if (!enabled || rpcUrls.length === 0) return;

    try {
      setLoading(true);
      setError(null);

      const result = await rpcClient.fetch<T>(
        rpcUrls,
        endpoint,
        { key: cacheKey, ttl: cacheTime }
      );

      setData(result);
    } catch (err: any) {
      console.error('[useRPCData] Error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [rpcUrls, endpoint, cacheKey, cacheTime, enabled]);

  useEffect(() => {
    fetchData();

    if (refetchInterval && enabled) {
      const interval = setInterval(fetchData, refetchInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refetchInterval, enabled]);

  const refetch = useCallback(() => {
    rpcClient.clearCacheKey(cacheKey);
    fetchData();
  }, [fetchData, cacheKey]);

  return { data, loading, error, refetch };
}

export function useValidators(rpcUrls: string[], status: string = 'BOND_STATUS_BONDED') {
  return useRPCData(
    rpcUrls,
    `/cosmos/staking/v1beta1/validators?status=${status}&pagination.limit=1000`,
    `validators_${status}`,
    { cacheTime: 60, refetchInterval: 60000 } // 1 menit (sebelum: 30 detik)
  );
}

export function useValidator(rpcUrls: string[], address: string) {
  return useRPCData(
    rpcUrls,
    `/cosmos/staking/v1beta1/validators/${address}`,
    `validator_${address}`,
    { cacheTime: 60, refetchInterval: 60000 } // 1 menit (sebelum: 30 detik)
  );
}

export function useLatestBlock(rpcUrls: string[]) {
  return useRPCData(
    rpcUrls,
    `/cosmos/base/tendermint/v1beta1/blocks/latest`,
    'latest_block',
    { cacheTime: 10, refetchInterval: 10000 } // 10 detik (sebelum: 6 detik)
  );
}
