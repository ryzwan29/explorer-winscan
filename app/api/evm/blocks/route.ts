import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain');

    if (!chain) {
      return NextResponse.json({ error: 'Chain parameter required' }, { status: 400 });
    }

    // Load chain config
    const fs = await import('fs');
    const path = await import('path');
    const chainFilePath = path.join(process.cwd(), 'Chains', `${chain}.json`);
    
    if (!fs.existsSync(chainFilePath)) {
      return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
    }

    const chainConfig = JSON.parse(fs.readFileSync(chainFilePath, 'utf-8'));
    
    // Get EVM RPC endpoint
    const evmRpc = chainConfig.evm_rpc?.[0]?.address;
    if (!evmRpc) {
      return NextResponse.json({ error: 'Chain does not support EVM' }, { status: 400 });
    }

    // Fetch latest block number
    const blockNumberRes = await fetch(evmRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    });

    const blockNumberData = await blockNumberRes.json();
    const latestBlockHex = blockNumberData.result;
    const latestBlock = parseInt(latestBlockHex, 16);

    // Fetch recent blocks
    const blocks: any[] = [];
    const blocksToFetch = 100;

    for (let i = 0; i < blocksToFetch; i++) {
      const blockNum = latestBlock - i;
      const blockHex = '0x' + blockNum.toString(16);

      const blockRes = await fetch(evmRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBlockByNumber',
          params: [blockHex, false],
          id: 1
        })
      });

      const blockData = await blockRes.json();
      const block = blockData.result;

      if (block) {
        blocks.push({
          number: parseInt(block.number, 16),
          hash: block.hash,
          timestamp: parseInt(block.timestamp, 16),
          transactions: block.transactions || [],
          miner: block.miner,
          gasUsed: parseInt(block.gasUsed, 16).toString(),
          gasLimit: parseInt(block.gasLimit, 16).toString()
        });
      }
    }

    return NextResponse.json({
      blocks,
      source: 'evm-rpc'
    });

  } catch (error: any) {
    console.error('[EVM Blocks API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch EVM blocks', blocks: [] },
      { status: 500 }
    );
  }
}
