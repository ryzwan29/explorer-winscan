import express, { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { cache } from '../index';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const chainName = req.query.chain as string || 'lumera-mainnet';
    const cacheKey = `validators_${chainName}`;

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

    // Fetch all validator statuses in parallel
    const [bondedResponse, unbondedResponse, unbondingResponse] = await Promise.all([
      axios.get(`${apiUrl}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=300`, { timeout: 8000 }),
      axios.get(`${apiUrl}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_UNBONDED&pagination.limit=100`, { timeout: 8000 }),
      axios.get(`${apiUrl}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_UNBONDING&pagination.limit=100`, { timeout: 8000 })
    ]);

    const allValidators = [
      ...(bondedResponse.data.validators || []),
      ...(unbondedResponse.data.validators || []),
      ...(unbondingResponse.data.validators || []),
    ];

    const validators = allValidators.map((v: any) => ({
      address: v.operator_address,
      moniker: v.description.moniker,
      identity: v.description.identity || undefined,
      votingPower: v.tokens,
      commission: v.commission.commission_rates.rate,
      status: v.status,
      jailed: v.jailed,
    }));

    // Sort: active by voting power desc
    validators.sort((a: any, b: any) => {
      const aActive = a.status === 'BOND_STATUS_BONDED' && !a.jailed;
      const bActive = b.status === 'BOND_STATUS_BONDED' && !b.jailed;
      
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      if (aActive && bActive) return parseInt(b.votingPower) - parseInt(a.votingPower);
      return 0;
    });

    // Cache result
    cache.set(cacheKey, validators, parseInt(process.env.CACHE_TTL_VALIDATORS || '30'));

    res.json(validators);
  } catch (error: any) {
    console.error('Validators error:', error.message);
    res.status(500).json({ error: 'Failed to fetch validators' });
  }
});

export default router;
