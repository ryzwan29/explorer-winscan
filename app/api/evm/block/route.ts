import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chainName = searchParams.get('chain');
    const blockNumber = searchParams.get('blockNumber');

    if (!chainName || !blockNumber) {
      return NextResponse.json(
        { error: 'Chain and blockNumber parameters required' },
        { status: 400 }
      );
    }

    // Fetch chain data
    const chainsResponse = await fetch('https://ssl.winsnip.xyz/api/chains');
    const chains = await chainsResponse.json();
    
    const chain = chains.find((c: any) => 
      c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName
    );

    if (!chain || !chain.evm_rpc || chain.evm_rpc.length === 0) {
      return NextResponse.json(
        { error: 'EVM RPC not available for this chain' },
        { status: 400 }
      );
    }

    const evmRpc = chain.evm_rpc[0].address;

    // Convert block number to hex
    const blockHex = '0x' + parseInt(blockNumber).toString(16);

    // Fetch block details with full transaction objects
    const blockResponse = await fetch(evmRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBlockByNumber',
        params: [blockHex, true],
        id: 1
      })
    });

    const blockData = await blockResponse.json();

    if (!blockData.result) {
      return NextResponse.json(
        { error: 'Block not found' },
        { status: 404 }
      );
    }

    const block = blockData.result;

    const result = {
      number: parseInt(block.number, 16),
      hash: block.hash,
      parentHash: block.parentHash,
      timestamp: parseInt(block.timestamp, 16),
      miner: block.miner,
      gasUsed: BigInt(block.gasUsed).toString(),
      gasLimit: BigInt(block.gasLimit).toString(),
      baseFeePerGas: block.baseFeePerGas ? BigInt(block.baseFeePerGas).toString() : '0',
      transactionCount: block.transactions.length,
      transactions: block.transactions.map((tx: any) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to || null,
        value: BigInt(tx.value).toString(),
        gasPrice: BigInt(tx.gasPrice || '0x0').toString(),
        gas: BigInt(tx.gas).toString()
      }))
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching EVM block:', error);
    return NextResponse.json(
      { error: 'Failed to fetch block details' },
      { status: 500 }
    );
  }
}
