import express, { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { cache } from '../index';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const chainName = req.query.chain as string;
    const limit = req.query.limit || '100';

    if (!chainName) {
      return res.status(400).json({ error: 'Missing chain parameter' });
    }

    const cacheKey = `assets_${chainName}`;
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

    let metadatas: any[] = [];
    let pagination = { next_key: null, total: '0' };

    // Try to fetch from blockchain API
    if (apiUrl) {
      try {
        // Fetch denom metadata
        const denomsResponse = await axios.get(
          `${apiUrl}/cosmos/bank/v1beta1/denoms_metadata`,
          { 
            timeout: 8000,
            params: {
              'pagination.limit': limit
            }
          }
        );

        if (denomsResponse.data?.metadatas) {
          metadatas = denomsResponse.data.metadatas;
          pagination = denomsResponse.data.pagination || pagination;
          
          console.log(`✅ Fetched ${metadatas.length} assets from blockchain API for ${chainName}`);
        }

        // Also fetch IBC denom traces for IBC tokens
        try {
          const ibcResponse = await axios.get(
            `${apiUrl}/ibc/apps/transfer/v1/denom_traces`,
            { 
              timeout: 8000,
              params: {
                'pagination.limit': limit
              }
            }
          );

          if (ibcResponse.data?.denom_traces) {
            const ibcDenoms = ibcResponse.data.denom_traces;
            console.log(`✅ Found ${ibcDenoms.length} IBC tokens for ${chainName}`);
            
            // Add IBC tokens to metadatas
            for (const trace of ibcDenoms) {
              const ibcDenom = `ibc/${trace.hash}`;
              const baseDenom = trace.base_denom;
              
              // Check if not already in metadatas
              if (!metadatas.find(m => m.base === ibcDenom)) {
                metadatas.push({
                  description: `IBC Token: ${baseDenom}`,
                  denom_units: [
                    {
                      denom: ibcDenom,
                      exponent: 0,
                      aliases: [baseDenom]
                    },
                    {
                      denom: baseDenom.replace(/^u/, '').toUpperCase(),
                      exponent: 6,
                      aliases: []
                    }
                  ],
                  base: ibcDenom,
                  display: baseDenom.replace(/^u/, '').toUpperCase(),
                  name: baseDenom.replace(/^u/, '').toUpperCase(),
                  symbol: baseDenom.replace(/^u/, '').toUpperCase(),
                  uri: '',
                  uri_hash: '',
                  ibc_info: {
                    path: trace.path,
                    base_denom: baseDenom,
                    hash: trace.hash
                  }
                });
              }
            }
          }
        } catch (ibcError) {
          console.warn(`⚠️ No IBC tokens found for ${chainName}`);
        }

      } catch (apiError: any) {
        console.warn(`⚠️ Failed to fetch from blockchain API: ${apiError.message}`);
      }
    }

    // Fallback: Use assets from chain config if API failed or no results
    if (metadatas.length === 0 && chainData.assets) {
      metadatas = chainData.assets.map((asset: any) => ({
        description: asset.description || `Native token of ${chainData.pretty_name || chainData.chain_name}`,
        denom_units: [
          {
            denom: asset.base,
            exponent: 0,
            aliases: []
          },
          {
            denom: asset.display,
            exponent: asset.exponent || 6,
            aliases: []
          }
        ],
        base: asset.base,
        display: asset.display,
        name: asset.name || asset.symbol,
        symbol: asset.symbol,
        uri: asset.logo || chainData.logo || '',
        uri_hash: '',
        coingecko_id: asset.coingecko_id || ''
      }));
      pagination.total = metadatas.length.toString();
      console.log(`📁 Using ${metadatas.length} assets from chain config for ${chainName}`);
    }

    // ALWAYS inject native token from chain config if exists (even if IBC tokens present)
    if (chainData.assets && chainData.assets.length > 0) {
      const nativeAssets = chainData.assets.filter((asset: any) => 
        !asset.base.startsWith('ibc/') && !asset.base.startsWith('factory/')
      );
      
      for (const nativeAsset of nativeAssets) {
        // Check if already exists in metadatas
        const exists = metadatas.some(m => m.base === nativeAsset.base);
        
        if (!exists) {
          // Inject at the beginning (native tokens first)
          metadatas.unshift({
            description: nativeAsset.description || `Native token of ${chainData.pretty_name || chainData.chain_name}`,
            denom_units: [
              {
                denom: nativeAsset.base,
                exponent: 0,
                aliases: []
              },
              {
                denom: nativeAsset.display,
                exponent: nativeAsset.exponent || 6,
                aliases: []
              }
            ],
            base: nativeAsset.base,
            display: nativeAsset.display,
            name: nativeAsset.name || nativeAsset.symbol,
            symbol: nativeAsset.symbol,
            uri: nativeAsset.logo || chainData.logo || '',
            uri_hash: '',
            coingecko_id: nativeAsset.coingecko_id || ''
          });
          console.log(`➕ Injected native token ${nativeAsset.base} for ${chainName}`);
        }
      }
    }

    const response = {
      metadatas,
      pagination
    };

    cache.set(cacheKey, response, 300);
    res.json(response);
  } catch (error: any) {
    console.error('Assets error:', error.message);
    res.json({
      metadatas: [],
      pagination: { next_key: null, total: '0' }
    });
  }
});

export default router;
