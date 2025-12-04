import express, { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { cache } from '../index';
import { getCombinedEndpoints } from '../utils/publicEndpoints';
const router = express.Router();
router.get('/', async (req: Request, res: Response) => {
  try {
    const chainName = req.query.chain as string;
    const address = req.query.address as string;
    if (!chainName || !address) {
      return res.status(400).json({ error: 'Missing chain or address parameter' });
    }
    const cacheKey = `account_${chainName}_${address}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    const chainsDir = process.env.CHAINS_DIR || path.join(__dirname, '../../chains');
    let chainFilePath = path.join(chainsDir, `${chainName}.json`);
    if (!fs.existsSync(chainFilePath)) {
      const files = fs.readdirSync(chainsDir).filter(f => f.endsWith('.json'));
      const chainLower = chainName.toLowerCase();
      let match = files.find(f => f.toLowerCase() === `${chainLower}.json`);
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
    
    // Combine chain endpoints with public fallback endpoints
    const apiEndpoints = getCombinedEndpoints(chainData.api, chainName, chainData.chain_id, 'api');
    const rpcEndpoints = getCombinedEndpoints(chainData.rpc, chainName, chainData.chain_id, 'rpc');
    
    const apiUrl = apiEndpoints[0]?.address;
    const rpcUrl = rpcEndpoints[0]?.address;
    if (!apiUrl) {
      return res.status(500).json({ error: 'No API URL configured' });
    }
    // Try multiple transaction query formats (different chains support different queries)
    const tryFetchTransactions = async () => {
      if (rpcEndpoints.length === 0) return Promise.reject(new Error('No RPC URLs'));
      
      const queries = [
        `message.sender='${address}'`,
        `tx.height>0 AND (transfer.sender='${address}' OR message.sender='${address}')`,
        `transfer.sender='${address}'`,
        `transfer.recipient='${address}'`
      ];
      
      // Try all RPC endpoints with all query formats (load balancing)
      for (const rpcEndpoint of rpcEndpoints) {
        const rpcUrl = rpcEndpoint.address;
        for (const query of queries) {
          try {
            const response = await axios.get(
              `${rpcUrl}/tx_search?query="${query}"&order_by="desc"&per_page=10`,
              { timeout: 8000, headers: { 'Accept': 'application/json' } }
            );
            if (response.data?.result?.txs && response.data.result.txs.length > 0) {
              console.log(`[Accounts] Success with RPC ${rpcUrl}`);
              return response;
            }
          } catch (err: any) {
            console.log(`[Accounts] RPC ${rpcUrl} failed:`, err.message);
            continue;
          }
        }
      }
      return Promise.reject(new Error('No transactions found'));
    };

    const [balanceRes, delegationsRes, validatorsRes, txRes] = await Promise.allSettled([
      axios.get(`${apiUrl}/cosmos/bank/v1beta1/balances/${address}`, { timeout: 5000 }),
      axios.get(`${apiUrl}/cosmos/staking/v1beta1/delegations/${address}`, { timeout: 5000 }),
      axios.get(`${apiUrl}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=300`, { timeout: 5000 }),
      tryFetchTransactions()
    ]);
    const validatorMap = new Map();
    if (validatorsRes.status === 'fulfilled' && validatorsRes.value?.data?.validators) {
      validatorsRes.value.data.validators.forEach((v: any) => {
        validatorMap.set(v.operator_address, {
          moniker: v.description?.moniker || 'Unknown',
          identity: v.description?.identity,
          operatorAddress: v.operator_address
        });
      });
    }
    
    let delegations = [];
    if (delegationsRes.status === 'fulfilled' && delegationsRes.value?.data?.delegation_responses) {
      delegations = delegationsRes.value.data.delegation_responses.map((d: any) => {
        const validatorAddr = d.delegation?.validator_address;
        return {
          validator: validatorAddr,
          amount: d.balance?.amount || '0',
          validatorInfo: validatorMap.get(validatorAddr)
        };
      });
    }
    
    let transactions: any[] = [];
    if (txRes.status === 'fulfilled' && txRes.value?.data?.result?.txs) {
      const txs = txRes.value.data.result.txs;
      const heights = Array.from(new Set(txs.map((tx: any) => tx.height))).slice(0, 10) as string[];
      const blockTimestamps: { [key: string]: string } = {};
      if (rpcUrl) {
        await Promise.allSettled(
          heights.map(async (height: string) => {
            try {
              const blockResp = await axios.get(`${rpcUrl}/block?height=${height}`, { timeout: 3000 });
              if (blockResp.data?.result?.block?.header?.time) {
                blockTimestamps[height] = blockResp.data.result.block.header.time;
              }
            } catch (err) {
            }
          })
        );
      }
      transactions = txs.map((tx: any) => {
        let msgType = 'Unknown';
        const messageEvents = tx.tx_result?.events?.filter((e: any) => e.type === 'message') || [];
        for (const event of messageEvents) {
          const actionAttr = event.attributes?.find((attr: any) => attr.key === 'action');
          if (actionAttr && actionAttr.value) {
            msgType = actionAttr.value.split('.').pop() || 'Unknown';
            break;
          }
        }
        const typeMap: { [key: string]: string } = {
          'MsgSend': 'Send',
          'MsgDelegate': 'Delegate',
          'MsgUndelegate': 'Undelegate',
          'MsgBeginRedelegate': 'Redelegate',
          'MsgWithdrawDelegatorReward': 'Withdraw Reward',
          'MsgWithdrawValidatorCommission': 'Withdraw Commission',
          'MsgVote': 'Vote',
          'MsgDeposit': 'Deposit',
          'MsgSubmitProposal': 'Submit Proposal',
          'MsgCreateValidator': 'Create Validator',
          'MsgEditValidator': 'Edit Validator',
        };
        const success = (tx.tx_result?.code || 0) === 0;
        return {
          hash: tx.hash,
          height: parseInt(tx.height) || 0,
          type: typeMap[msgType] || msgType,
          time: blockTimestamps[tx.height] || new Date().toISOString(),
          result: success ? 'Success' : 'Failed',
        };
      });
    }
    
    const account = {
      address,
      balances: balanceRes.status === 'fulfilled' && balanceRes.value?.data?.balances 
        ? balanceRes.value.data.balances 
        : [],
      delegations,
      transactions: transactions || []
    };
    
    cache.set(cacheKey, account, 30);
    res.json(account);
  } catch (error: any) {
    console.error('Account error:', error.message);
    
    // Return more detailed error message
    const errorMessage = error.message.includes('timeout') || error.code === 'ECONNABORTED'
      ? 'RPC endpoint timeout. The blockchain node is not responding.'
      : error.message.includes('429') || error.message.includes('Too Many Requests')
      ? 'Rate limit exceeded. Too many requests to the RPC endpoint.'
      : error.message.includes('503') || error.message.includes('Service Unavailable')
      ? 'RPC service temporarily unavailable. Please try again later.'
      : 'Failed to fetch account data. Please check the address and try again.';
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});
export default router;
