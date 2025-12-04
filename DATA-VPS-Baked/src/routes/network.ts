import express, { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { cache } from '../index';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const chainName = req.query.chain as string || 'lumera-mainnet';
    const cacheKey = `network_${chainName}`;

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
    const rpcUrl = chainData.rpc?.[0]?.address;

    if (!rpcUrl) {
      return res.status(500).json({ error: 'No RPC URL configured' });
    }

    // Fetch network info
    const [statusResponse, netInfoResponse] = await Promise.all([
      axios.get(`${rpcUrl}/status`, { timeout: 8000 }),
      axios.get(`${rpcUrl}/net_info`, { timeout: 8000 })
    ]);

    const status = statusResponse.data.result;
    const netInfo = netInfoResponse.data.result;

    const networkData = {
      chainId: status.node_info.network,
      latestBlockHeight: status.sync_info.latest_block_height,
      latestBlockTime: status.sync_info.latest_block_time,
      totalPeers: parseInt(netInfo.n_peers),
      inboundPeers: netInfo.peers.filter((p: any) => !p.is_outbound).length,
      outboundPeers: netInfo.peers.filter((p: any) => p.is_outbound).length,
    };

    // Cache for 20s
    cache.set(cacheKey, networkData, 20);

    res.json(networkData);
  } catch (error: any) {
    console.error('Network error:', error.message);
    res.status(500).json({ error: 'Failed to fetch network info' });
  }
});

export default router;
