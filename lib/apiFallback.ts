/**
 * Fallback API utility
 * Tries primary API, falls back to backup if primary fails
 */

const PRIMARY_API = 'https://ssl.winsnip.xyz';
const BACKUP_API = 'https://ssl2.winsnip.xyz';

export interface FetchWithFallbackOptions {
  path: string;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  cache?: RequestCache;
  revalidate?: number;
}

/**
 * Fetch with automatic fallback to backup API
 */
export async function fetchWithFallback(options: FetchWithFallbackOptions): Promise<Response> {
  const { path, params = {}, headers = {}, cache, revalidate = 60 } = options;
  
  // Build query string
  const queryString = new URLSearchParams(params).toString();
  const fullPath = queryString ? `${path}?${queryString}` : path;
  
  // Try primary API
  const primaryUrl = `${PRIMARY_API}${fullPath}`;
  
  try {
    const response = await fetch(primaryUrl, {
      headers: {
        'Accept': 'application/json',
        ...headers,
      },
      cache,
      next: revalidate ? { revalidate } : undefined,
    });

    if (response.ok) {
      return response;
    }
    
    console.warn(`Primary API failed (${response.status}): ${primaryUrl}`);
  } catch (error) {
    console.error(`Primary API error: ${primaryUrl}`, error);
  }

  // Try backup API
  const backupUrl = `${BACKUP_API}${fullPath}`;
  
  try {
    console.log(`Trying backup API: ${backupUrl}`);
    const response = await fetch(backupUrl, {
      headers: {
        'Accept': 'application/json',
        ...headers,
      },
      cache,
      next: revalidate ? { revalidate } : undefined,
    });

    if (response.ok) {
      return response;
    }
    
    console.error(`Backup API also failed (${response.status}): ${backupUrl}`);
    return response;
  } catch (error) {
    console.error(`Backup API error: ${backupUrl}`, error);
    throw new Error('Both primary and backup APIs are unavailable');
  }
}

/**
 * Fetch JSON with automatic fallback
 */
export async function fetchJsonWithFallback<T = any>(
  options: FetchWithFallbackOptions
): Promise<T> {
  const response = await fetchWithFallback(options);
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get primary API URL
 */
export function getPrimaryApiUrl(): string {
  return PRIMARY_API;
}

/**
 * Get backup API URL
 */
export function getBackupApiUrl(): string {
  return BACKUP_API;
}
