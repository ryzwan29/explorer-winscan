import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fetchFromAPI } from '../lib/loadBalancer';
import { pubkeyToAddress } from '../lib/validatorAddress';
import { pubkeyToConsensusAddress } from '../lib/bech32';
import { cache } from '../index';

const router = express.Router();

// Cache with TTL
const inMemoryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds

function getCached(key: string) {
  const cached = inMemoryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  inMemoryCache.delete(key);
  return null;
}

function setCache(key: string, data: any) {
  inMemoryCache.set(key, { data, timestamp: Date.now() });
  // Cleanup - keep max 20 entries
  if (inMemoryCache.size > 20) {
    const firstKey = inMemoryCache.keys().next().value;
    if (firstKey) inMemoryCache.delete(firstKey);
  }
}

function getChainConfig(chainName: string) {
  const chainsDir = process.env.CHAINS_DIR || path.join(__dirname, '../../chains');
  const chainFilePath = path.join(chainsDir, `${chainName}.json`);
  
  if (!fs.existsSync(chainFilePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(chainFilePath, 'utf-8'));
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const chainName = req.query.chain as string;
    const blocksToCheck = parseInt(req.query.blocks as string || '100');

    if (!chainName) {
      return res.status(400).json({ error: 'Chain name is required' });
    }

    const cacheKey = `uptime_${chainName}_${blocksToCheck}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const chain = getChainConfig(chainName);
    if (!chain) {
      return res.status(404).json({ error: 'Chain not found' });
    }

    // Get latest block height
    const latestBlockData = await fetchFromAPI(
      chainName,
      chain.api,
      '/cosmos/base/tendermint/v1beta1/blocks/latest'
    );
    const latestHeight = parseInt(latestBlockData?.block?.header?.height || '0');

    if (latestHeight === 0) {
      return res.status(500).json({ error: 'Could not fetch latest block' });
    }

    // Get slashing params for signing window
    const slashingParams = await fetchFromAPI(
      chainName,
      chain.api,
      '/cosmos/slashing/v1beta1/params'
    );

    const signedBlocksWindow = parseInt(slashingParams?.params?.signed_blocks_window || '10000');
    const minSignedPerWindow = parseFloat(slashingParams?.params?.min_signed_per_window || '0.5');

    const validatorsData = await fetchFromAPI(
      chainName,
      chain.api,
      '/cosmos/staking/v1beta1/validators?pagination.limit=200&status=BOND_STATUS_BONDED'
    );

    const allValidators = validatorsData?.validators || [];

    const validatorByAddress = new Map<string, any>();
    const validatorByConsensusAddr = new Map<string, any>();
    
    const chainPrefix = chain.addr_prefix || 'cosmos';
    const consensusPrefix = chainPrefix + 'valcons';
    
    allValidators.forEach((validator: any) => {
      const hexAddr = pubkeyToAddress(validator.consensus_pubkey);
      if (hexAddr) {
        validatorByAddress.set(hexAddr.toUpperCase(), validator);
        
        try {
          const consensusAddr = pubkeyToConsensusAddress(validator.consensus_pubkey.key, consensusPrefix);
          validatorByConsensusAddr.set(consensusAddr, validator);
          validator.consensus_address_bech32 = consensusAddr;
        } catch (e) {
          // Ignore
        }
      }
    });

    const startHeight = latestHeight - blocksToCheck + 1;
    const blockHeights = Array.from({ length: blocksToCheck }, (_, i) => startHeight + i);

    const batchSize = 20;
    const allBlocks: any[] = [];
    
    for (let i = 0; i < blockHeights.length; i += batchSize) {
      const batch = blockHeights.slice(i, i + batchSize);
      const blockPromises = batch.map(height =>
        fetchFromAPI(
          chainName,
          chain.api,
          `/cosmos/base/tendermint/v1beta1/blocks/${height}`
        ).catch(() => null)
      );
      const blocks = await Promise.all(blockPromises);
      // Keep all blocks including null to maintain array length
      allBlocks.push(...blocks);
    }

    console.log(`[Uptime] Fetched ${allBlocks.length} blocks (${allBlocks.filter(b => b !== null).length} successful)`);

    const signatureStats = new Map<string, {
      signedCount: number;
      blockSignatures: boolean[];
    }>();
    
    // Initialize stats for all validators
    validatorByAddress.forEach((validator: any, hexAddr: string) => {
      signatureStats.set(hexAddr, {
        signedCount: 0,
        blockSignatures: []
      });
    });

    // Process each block's signatures
    allBlocks.forEach((blockData, blockIdx) => {
      // If block is null (failed to fetch), mark all validators as not signed for this block
      if (blockData === null) {
        validatorByAddress.forEach((validator, hexAddr) => {
          const stats = signatureStats.get(hexAddr);
          if (stats) {
            stats.blockSignatures.push(false); // Mark as not signed if block data missing
          }
        });
        return;
      }

      const signatures = blockData?.block?.last_commit?.signatures || [];
      
      const signedAddresses = new Set<string>();
      signatures.forEach((sig: any) => {
        if (sig.validator_address && sig.signature) {
          const base64Addr = sig.validator_address;
          const hexAddr = Buffer.from(base64Addr, 'base64').toString('hex').toUpperCase();
          signedAddresses.add(hexAddr);
        }
      });
      
      if (blockIdx === 0) {
        console.log(`[Uptime] First block signed by ${signedAddresses.size} validators`);
      }
      
      validatorByAddress.forEach((validator, hexAddr) => {
        const stats = signatureStats.get(hexAddr);
        if (stats) {
          const signed = signedAddresses.has(hexAddr);
          stats.blockSignatures.push(signed);
          if (signed) {
            stats.signedCount++;
          }
        }
      });
    });

    console.log(`[Uptime] Processed ${allBlocks.length} blocks successfully`);
    
    // Fetch signing_infos
    console.log('[Uptime] Fetching signing_infos for missed blocks data...');
    const signingInfosData = await fetchFromAPI(
      chainName,
      chain.api,
      '/cosmos/slashing/v1beta1/signing_infos?pagination.limit=300'
    );
    
    const signingInfoByAddress = new Map<string, any>();
    
    if (signingInfosData?.info && signingInfosData.info.length > 0) {
      console.log(`[Uptime] Loaded ${signingInfosData.info.length} signing infos from API`);
      
      signingInfosData.info.forEach((info: any) => {
        const consensusAddr = info.address;
        const validator = validatorByConsensusAddr.get(consensusAddr);
        
        if (validator) {
          const hexAddr = pubkeyToAddress(validator.consensus_pubkey);
          if (hexAddr) {
            signingInfoByAddress.set(hexAddr.toUpperCase(), info);
          }
        }
      });
      
      console.log(`[Uptime] Matched ${signingInfoByAddress.size}/${validatorByAddress.size} validators with signing infos`);
    }
    
    // Build response data
    const uptimeData: any[] = [];
    
    validatorByAddress.forEach((validator: any, hexAddr: string) => {
      const stats = signatureStats.get(hexAddr);
      const signingInfo = signingInfoByAddress.get(hexAddr);
      
      const actualBlockCount = stats?.blockSignatures.length || 0;
      const signedBlocksIn100 = stats?.signedCount || 0;
      const missedBlocksIn100 = actualBlockCount - signedBlocksIn100;
      const uptimeIn100 = actualBlockCount > 0 ? (signedBlocksIn100 / actualBlockCount) * 100 : 0;
      const blockSignatures = stats?.blockSignatures || [];

      const missedBlocksCounter = signingInfo?.missed_blocks_counter || '0';
      const indexOffset = signingInfo?.index_offset || '0';
      const startHeight = signingInfo?.start_height || '0';
      const jailedUntil = signingInfo?.jailed_until || null;
      
      const missedInFullWindow = parseInt(missedBlocksCounter);
      const signedInFullWindow = signedBlocksWindow - missedInFullWindow;
      const uptimeFromWindow = signedBlocksWindow > 0 ? (signedInFullWindow / signedBlocksWindow) * 100 : uptimeIn100;
      
      const maxMissedBlocks = Math.floor(signedBlocksWindow * (1 - minSignedPerWindow));
      const willBeJailed = missedInFullWindow >= maxMissedBlocks;

      uptimeData.push({
        moniker: validator.description?.moniker || 'Unknown',
        operator_address: validator.operator_address,
        consensus_address: hexAddr,
        identity: validator.description?.identity || '',
        uptime: Math.max(0, Math.min(100, signingInfo ? uptimeFromWindow : uptimeIn100)),
        missedBlocks: signingInfo ? missedInFullWindow : missedBlocksIn100,
        signedBlocks: signingInfo ? signedInFullWindow : signedBlocksIn100,
        missedBlocksIn100: missedBlocksIn100,
        signedBlocksTotal: signedInFullWindow,
        signingWindow: signedBlocksWindow,
        maxMissedBlocks: maxMissedBlocks,
        blockSignatures: blockSignatures,
        jailed: validator.jailed || false,
        jailedUntil: jailedUntil,
        tombstoned: signingInfo?.tombstoned || false,
        willBeJailed: signingInfo ? (willBeJailed && !validator.jailed) : false,
        status: validator.status || 'BOND_STATUS_UNBONDED',
        votingPower: validator.tokens || '0'
      });
    });
    
    // Sort by status then voting power
    uptimeData.sort((a: any, b: any) => {
      if (a.status === 'BOND_STATUS_BONDED' && b.status !== 'BOND_STATUS_BONDED') return -1;
      if (a.status !== 'BOND_STATUS_BONDED' && b.status === 'BOND_STATUS_BONDED') return 1;
      return parseFloat(b.votingPower) - parseFloat(a.votingPower);
    });

    uptimeData.forEach((validator, index) => {
      validator.rank = index + 1;
    });

    // Cache result
    setCache(cacheKey, uptimeData);
    console.log('[Uptime API] Cache stored');

    res.json(uptimeData);

  } catch (error) {
    console.error('Error fetching uptime:', error);
    res.status(500).json({ error: 'Failed to fetch uptime data' });
  }
});

export default router;
