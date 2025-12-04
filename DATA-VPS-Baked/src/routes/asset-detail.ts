import express, { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { cache } from '../index';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const chainName = req.query.chain as string;
    const denom = req.query.denom as string;

    if (!chainName || !denom) {
      return res.status(400).json({ error: 'Missing chain or denom parameter' });
    }

    const cacheKey = `asset_detail_${chainName}_${denom}`;
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
    const apiUrl = chainData.api?.[0]?.address || chainData.apis?.rest?.[0]?.url || chainData.apis?.api?.[0]?.url;

    if (!apiUrl) {
      return res.status(500).json({ error: 'No API URL configured' });
    }

    let assetDetail: any = {
      denom: denom,
      metadata: null,
      supply: null,
      holders: null,
      price: null
    };

    // 1. Fetch metadata
    try {
      const metadataResponse = await axios.get(
        `${apiUrl}/cosmos/bank/v1beta1/denoms_metadata/${denom}`,
        { timeout: 8000 }
      );
      assetDetail.metadata = metadataResponse.data.metadata;
    } catch (e: any) {
      console.log(`⚠️ No metadata for ${denom}: ${e.message}`);
      
      // Fallback: Check if it's in chain config assets
      if (chainData.assets) {
        const asset = chainData.assets.find((a: any) => 
          a.base === denom || a.denom === denom
        );
        if (asset) {
          assetDetail.metadata = {
            description: `Native token of ${chainData.chain_name}`,
            denom_units: [
              {
                denom: asset.base || denom,
                exponent: 0,
                aliases: []
              },
              {
                denom: asset.symbol || denom.replace(/^u/, '').toUpperCase(),
                exponent: parseInt(asset.exponent) || 6,
                aliases: []
              }
            ],
            base: asset.base || denom,
            display: asset.symbol || denom.replace(/^u/, '').toUpperCase(),
            name: asset.symbol || denom.replace(/^u/, '').toUpperCase(),
            symbol: asset.symbol || denom.replace(/^u/, '').toUpperCase(),
            uri: asset.logo || '',
            uri_hash: ''
          };
        }
      }
    }

    // 2. Fetch total supply
    try {
      const supplyResponse = await axios.get(
        `${apiUrl}/cosmos/bank/v1beta1/supply/${denom}`,
        { timeout: 8000 }
      );
      assetDetail.supply = supplyResponse.data.amount?.amount || '0';
    } catch (e: any) {
      console.log(`⚠️ Failed to fetch supply for ${denom}: ${e.message}`);
      
      // Try alternative endpoint for all supply
      try {
        const allSupplyResponse = await axios.get(
          `${apiUrl}/cosmos/bank/v1beta1/supply`,
          { timeout: 8000 }
        );
        const supply = allSupplyResponse.data.supply?.find((s: any) => s.denom === denom);
        if (supply) {
          assetDetail.supply = supply.amount;
        }
      } catch (e2) {
        console.log(`⚠️ Failed to fetch from supply list`);
      }
    }

    // 3. Estimate holder count (via account balances with specific denom)
    // Note: Most Cosmos chains don't have a direct "holders count by denom" endpoint
    // We'll try to get total accounts as a rough estimate
    try {
      // Method 1: Try to count accounts with balance of this denom
      // This is expensive and most APIs don't support it directly
      
      // Method 2: Get staking pool info for native token holders estimate
      if (chainData.assets && chainData.assets[0]?.base === denom) {
        try {
          const poolResponse = await axios.get(
            `${apiUrl}/cosmos/staking/v1beta1/pool`,
            { timeout: 5000 }
          );
          
          // Get delegations count as proxy for native token holders
          const delegationsResponse = await axios.get(
            `${apiUrl}/cosmos/staking/v1beta1/delegations?pagination.limit=1&pagination.count_total=true`,
            { timeout: 5000 }
          );
          
          const delegationCount = parseInt(delegationsResponse.data.pagination?.total || '0');
          
          // Rough estimate: delegators are likely holders
          // Add some percentage for non-delegating holders (estimate 20-30% more)
          assetDetail.holders = Math.floor(delegationCount * 1.25);
          assetDetail.holders_type = 'estimated_from_delegations';
        } catch (e2) {
          console.log(`⚠️ Could not estimate holders from delegations`);
        }
      }
      
      // Fallback: Just get total accounts in chain
      if (!assetDetail.holders) {
        try {
          const authResponse = await axios.get(
            `${apiUrl}/cosmos/auth/v1beta1/accounts?pagination.limit=1&pagination.count_total=true`,
            { timeout: 5000 }
          );
          assetDetail.holders = authResponse.data.pagination?.total || null;
          assetDetail.holders_type = 'total_accounts';
        } catch (e3) {
          console.log(`⚠️ Could not get total accounts`);
        }
      }
    } catch (e: any) {
      console.log(`⚠️ Could not fetch holder count: ${e.message}`);
      assetDetail.holders = null;
      assetDetail.holders_type = 'unavailable';
    }

    // 4. Try to fetch price from CoinGecko (if coingecko_id exists)
    if (assetDetail.metadata || chainData.assets) {
      let coingeckoId = null;
      
      if (chainData.assets) {
        const asset = chainData.assets.find((a: any) => 
          a.base === denom || a.denom === denom
        );
        coingeckoId = asset?.coingecko_id;
      }

      if (coingeckoId && coingeckoId !== 'HEART' && coingeckoId !== 'CNHO') {
        try {
          const priceResponse = await axios.get(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`,
            { timeout: 5000 }
          );
          
          if (priceResponse.data[coingeckoId]) {
            assetDetail.price = {
              usd: priceResponse.data[coingeckoId].usd,
              usd_24h_change: priceResponse.data[coingeckoId].usd_24h_change,
              usd_market_cap: priceResponse.data[coingeckoId].usd_market_cap
            };
          }
        } catch (e) {
          console.log(`⚠️ Could not fetch price from CoinGecko`);
        }
      }
    }

    // Calculate some derived data
    if (assetDetail.supply && assetDetail.metadata?.denom_units) {
      const displayUnit = assetDetail.metadata.denom_units.find((u: any) => 
        u.denom === assetDetail.metadata.display
      );
      const exponent = displayUnit?.exponent || 6;
      assetDetail.supply_formatted = (parseInt(assetDetail.supply) / Math.pow(10, exponent)).toLocaleString();
    }

    cache.set(cacheKey, assetDetail, 60); // Cache 1 minute
    res.json(assetDetail);
  } catch (error: any) {
    console.error('Asset detail error:', error.message);
    res.status(500).json({ error: 'Failed to fetch asset details' });
  }
});

export default router;
