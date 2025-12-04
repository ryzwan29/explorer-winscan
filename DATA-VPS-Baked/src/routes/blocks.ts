import express, { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { bech32 } from 'bech32';
import { cache } from '../index';
import { fetchRpcWithLoadBalancer, fetchRestWithLoadBalancer } from '../utils/loadBalancer';
import { getCombinedEndpoints } from '../utils/publicEndpoints';
import { optimisticCache, prefetch, CacheTier } from '../utils/smartCache';
const router = express.Router();
function convertConsensusToOperator(consensusAddress: string, validatorPrefix: string): string {
  try {
    const decoded = bech32.decode(consensusAddress);
    const encoded = bech32.encode(validatorPrefix, decoded.words);
    return encoded;
  } catch (error) {
    return '';
  }
}
router.get('/', async (req: Request, res: Response) => {
  try {
    const chainName = req.query.chain as string || 'lumera-mainnet';
    const cacheKey = `blocks_${chainName}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    const chainsDir = process.env.CHAINS_DIR || path.join(__dirname, '../../chains');
    const chainFilePath = path.join(chainsDir, `${chainName}.json`);
    if (!fs.existsSync(chainFilePath)) {
      return res.status(404).json({ error: 'Chain not found' });
    }
    const chainData = JSON.parse(fs.readFileSync(chainFilePath, 'utf-8'));
    
    // Combine chain endpoints with public fallback endpoints
    const rpcEndpoints = getCombinedEndpoints(chainData.rpc, chainName, chainData.chain_id, 'rpc');
    const apiEndpoints = getCombinedEndpoints(chainData.api, chainName, chainData.chain_id, 'api');
    
    const validatorPrefix = chainData.bech32_prefix + 'valoper';
    if (rpcEndpoints.length === 0) {
      return res.status(500).json({ error: 'No RPC URL configured' });
    }
    
    // Use load balancer for RPC requests (PingPub strategy) with optimistic cache
    const latestData = await optimisticCache(
      `blocks_latest_${chainName}`,
      () => fetchRpcWithLoadBalancer(rpcEndpoints, 'blockchain', undefined, undefined, chainName),
      CacheTier.INSTANT
    );
    const latestHeight = parseInt(latestData.result.last_height);

    // Prefetch next 20 blocks in background for instant next page load
    for (let i = 20; i < 40; i++) {
      const height = latestHeight - i;
      if (height >= 1) {
        prefetch(
          `block_${chainName}_${height}`,
          () => fetchRpcWithLoadBalancer(rpcEndpoints, 'block', { height }, undefined, chainName),
          CacheTier.INSTANT
        );
      }
    }

    const blockPromises = [];
    for (let i = 0; i < 20; i++) {
      const height = latestHeight - i;
      blockPromises.push(
        optimisticCache(
          `block_${chainName}_${height}`,
          () => fetchRpcWithLoadBalancer(rpcEndpoints, 'block', { height }, undefined, chainName),
          CacheTier.INSTANT
        ).catch(() => null)
      );
    }
    const blockResponses = await Promise.all(blockPromises);
    let validatorMap: Map<string, any> = new Map();
    if (apiEndpoints.length > 0) {
      try {
        const validatorsData = await fetchRestWithLoadBalancer(
          apiEndpoints,
          '/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=200',
          undefined,
          chainName
        );
        validatorsData.validators?.forEach((v: any) => {
          validatorMap.set(v.consensus_pubkey.key, {
            moniker: v.description.moniker,
            operatorAddress: v.operator_address,
          });
        });
      } catch (e) {
        console.error('Failed to fetch validators for block proposers');
      }
    }
    const blocks = blockResponses
      .filter(r => r !== null)
      .map((r: any) => {
        const blockData = r.result;
        const proposerAddressBase64 = blockData.block.header.proposer_address;
        let validatorInfo = validatorMap.get(blockData.block.header.proposer_address);
        return {
          height: blockData.block.header.height,
          hash: blockData.block_id.hash,
          time: blockData.block.header.time,
          proposer: proposerAddressBase64,
          txs: blockData.block.data.txs?.length || 0,
          validator: validatorInfo,
        };
      });
    cache.set(cacheKey, blocks, 10);
    res.json(blocks);
  } catch (error: any) {
    console.error('Blocks error:', error.message);
    res.status(500).json({ error: 'Failed to fetch blocks' });
  }
});
router.get('/:height', async (req: Request, res: Response) => {
  try {
    const chainName = req.query.chain as string || 'lumera-mainnet';
    const height = req.params.height;
    const cacheKey = `block_${chainName}_${height}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    const chainsDir = process.env.CHAINS_DIR || path.join(__dirname, '../../chains');
    const chainFilePath = path.join(chainsDir, `${chainName}.json`);
    if (!fs.existsSync(chainFilePath)) {
      return res.status(404).json({ error: 'Chain not found' });
    }
    const chainData = JSON.parse(fs.readFileSync(chainFilePath, 'utf-8'));
    const rpcUrl = chainData.rpc?.[0]?.address;
    const apiUrl = chainData.api?.[0]?.address;
    if (!rpcUrl) {
      return res.status(500).json({ error: 'No RPC URL configured' });
    }
    const blockResponse = await axios.get(`${rpcUrl}/block?height=${height}`, { timeout: 8000 });
    const blockData = blockResponse.data.result;
    let proposerMoniker = 'Unknown';
    let proposerIdentity: string | undefined;
    let proposerAddress: string | undefined;
    if (apiUrl) {
      try {
        const validatorsResponse = await axios.get(
          `${apiUrl}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=200`,
          { timeout: 8000 }
        );
        const validator = validatorsResponse.data.validators?.find((v: any) => 
          v.consensus_pubkey.key === blockData.block.header.proposer_address
        );
        if (validator) {
          proposerMoniker = validator.description.moniker;
          proposerIdentity = validator.description.identity;
          proposerAddress = validator.operator_address;
        }
      } catch (e) {
        console.error('Failed to fetch proposer info');
      }
    }
    const transactions = [];
    if (blockData.block.data.txs && blockData.block.data.txs.length > 0) {
      try {
        const txResponse = await axios.get(
          `${apiUrl}/cosmos/tx/v1beta1/txs?events=tx.height=${height}`,
          { timeout: 8000 }
        );
        const txs = txResponse.data.tx_responses || [];
        transactions.push(...txs.map((tx: any) => ({
          hash: tx.txhash,
          type: tx.tx?.body?.messages?.[0]?.['@type']?.split('.').pop() || 'Transaction',
          result: tx.code === 0 ? 'Success' : 'Failed',
        })));
      } catch (e) {
        console.error('Failed to fetch tx details');
      }
    }
    const block = {
      height: blockData.block.header.height,
      hash: blockData.block_id.hash,
      time: blockData.block.header.time,
      txs: blockData.block.data.txs?.length || 0,
      proposer: blockData.block.header.proposer_address,
      proposerMoniker,
      proposerIdentity,
      proposerAddress,
      gasUsed: 'N/A',
      gasWanted: 'N/A',
      transactions,
    };
    cache.set(cacheKey, block, 60);
    res.json(block);
  } catch (error: any) {
    console.error('Block detail error:', error.message);
    res.status(500).json({ error: 'Failed to fetch block details' });
  }
});
export default router;
