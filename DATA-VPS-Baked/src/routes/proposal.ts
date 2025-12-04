import express, { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { cache } from '../index';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const chainName = req.query.chain as string;
    const proposalId = req.query.id as string;

    if (!chainName || !proposalId) {
      return res.status(400).json({ error: 'Missing chain or id parameter' });
    }

    const cacheKey = `proposal_${chainName}_${proposalId}`;
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
    const apiUrl = chainData.api?.[0]?.address;

    if (!apiUrl) {
      return res.status(500).json({ error: 'No API URL configured' });
    }

    // Fetch proposal details - Try v1 first, fallback to v1beta1
    let proposal;
    let apiVersion = 'v1';
    
    try {
      const proposalResponse = await axios.get(
        `${apiUrl}/cosmos/gov/v1/proposals/${proposalId}`,
        { timeout: 10000 }
      );
      proposal = proposalResponse.data.proposal;
    } catch (err) {
      // Fallback to v1beta1
      try {
        const proposalResponse = await axios.get(
          `${apiUrl}/cosmos/gov/v1beta1/proposals/${proposalId}`,
          { timeout: 10000 }
        );
        proposal = proposalResponse.data.proposal;
        apiVersion = 'v1beta1';
      } catch (err2) {
        throw new Error('Proposal not found in both v1 and v1beta1 endpoints');
      }
    }

    // Fetch tally if not in proposal
    let tally = proposal.final_tally_result || { yes: '0', no: '0', abstain: '0', no_with_veto: '0' };
    
    // If proposal is in voting period, get current tally
    if (proposal.status === 'PROPOSAL_STATUS_VOTING_PERIOD' || proposal.status === '2') {
      try {
        const tallyResponse = await axios.get(
          `${apiUrl}/cosmos/gov/${apiVersion}/proposals/${proposalId}/tally`,
          { timeout: 5000 }
        );
        tally = tallyResponse.data.tally;
      } catch (e) {
        console.log('Could not fetch tally, using final tally');
      }
    }

    // Fetch votes (recent 20)
    let votes: any[] = [];
    try {
      const votesResponse = await axios.get(
        `${apiUrl}/cosmos/gov/${apiVersion}/proposals/${proposalId}/votes`,
        { 
          params: { 'pagination.limit': 20 },
          timeout: 5000 
        }
      );
      votes = votesResponse.data.votes || [];
    } catch (e) {
      console.log('Could not fetch votes');
    }

    // Extract title and description based on API version
    let title = 'Unknown';
    let description = 'No description available';
    let type = 'Unknown';
    
    if (apiVersion === 'v1') {
      // Gov v1 format
      title = proposal.title || proposal.metadata || 'Unknown';
      description = proposal.summary || proposal.metadata || 'No description available';
      
      // Get type from messages
      if (proposal.messages && proposal.messages.length > 0) {
        type = proposal.messages[0]['@type']?.split('.').pop() || 'Unknown';
      }
    } else {
      // Gov v1beta1 format
      title = proposal.content?.title || 'Unknown';
      description = proposal.content?.description || 'No description available';
      type = proposal.content?.['@type']?.split('.').pop() || 'Unknown';
    }

    // Format response
    const formattedProposal = {
      id: proposal.proposal_id || proposal.id || proposalId,
      title: title,
      description: description,
      status: proposal.status,
      type: type,
      submitTime: proposal.submit_time,
      depositEndTime: proposal.deposit_end_time,
      votingStartTime: proposal.voting_start_time,
      votingEndTime: proposal.voting_end_time,
      totalDeposit: proposal.total_deposit || [],
      tally: {
        yes: tally.yes || tally.yes_count || '0',
        no: tally.no || tally.no_count || '0',
        abstain: tally.abstain || tally.abstain_count || '0',
        veto: tally.no_with_veto || tally.no_with_veto_count || '0'
      },
      votes: votes.map(v => ({
        voter: v.voter,
        option: v.option || v.options?.[0]?.option || 'VOTE_OPTION_UNSPECIFIED',
        weight: v.options?.[0]?.weight || '1'
      })),
      messages: proposal.messages || (proposal.content ? [proposal.content] : [])
    };

    cache.set(cacheKey, formattedProposal, 30);
    res.json(formattedProposal);
  } catch (error: any) {
    console.error('Proposal error:', error.message);
    res.status(404).json({ error: 'Proposal not found' });
  }
});

export default router;
