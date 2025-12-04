import express, { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { cache } from '../index';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const chainName = req.query.chain as string;
    const address = req.query.address as string;

    if (!chainName || !address) {
      return res.status(400).json({ error: 'Missing chain or address parameter' });
    }

    const cacheKey = `validator_${chainName}_${address}`;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Read chain config
    const chainsDir = process.env.CHAINS_DIR || path.join(__dirname, '../../chains');
    const chainFilePath = path.join(chainsDir, `${chainName}.json`);
    
    if (!fs.existsSync(chainFilePath)) {
      return res.status(404).json({ error: 'Chain not found' });
    }

    const chainData = JSON.parse(fs.readFileSync(chainFilePath, 'utf-8'));
    const apiUrl = chainData.api?.[0]?.address;

    if (!apiUrl) {
      return res.status(500).json({ error: 'No API URL configured' });
    }

    // Fetch validator details and pool info in parallel
    const [validatorResponse, poolResponse] = await Promise.all([
      axios.get(
        `${apiUrl}/cosmos/staking/v1beta1/validators/${address}`,
        { timeout: 8000 }
      ),
      axios.get(
        `${apiUrl}/cosmos/staking/v1beta1/pool`,
        { timeout: 8000 }
      ).catch(() => null) // Don't fail if pool endpoint unavailable
    ]);

    const v = validatorResponse.data.validator;
    
    // Calculate voting power percentage
    let votingPowerPercentage = '0';
    if (poolResponse?.data?.pool?.bonded_tokens) {
      const totalBonded = parseFloat(poolResponse.data.pool.bonded_tokens);
      const validatorTokens = parseFloat(v.tokens);
      votingPowerPercentage = ((validatorTokens / totalBonded) * 100).toString();
    }

    const validatorDetail = {
      address: v.operator_address,
      moniker: v.description.moniker,
      identity: v.description.identity || undefined,
      website: v.description.website || undefined,
      details: v.description.details || undefined,
      votingPower: v.tokens,
      votingPowerPercentage: votingPowerPercentage,
      tokens: v.tokens,
      commission: v.commission.commission_rates.rate,
      maxCommission: v.commission.commission_rates.max_rate,
      maxChangeRate: v.commission.commission_rates.max_change_rate,
      status: v.status,
      jailed: v.jailed,
      unbondingHeight: v.unbonding_height,
      unbondingTime: v.unbonding_time,
    };

    // Cache for 30s
    cache.set(cacheKey, validatorDetail, 30);

    res.json(validatorDetail);
  } catch (error: any) {
    console.error('Validator detail error:', error.message);
    res.status(500).json({ error: 'Failed to fetch validator' });
  }
});

export default router;
