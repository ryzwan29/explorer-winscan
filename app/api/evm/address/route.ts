import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chainName = searchParams.get('chain');
    const address = searchParams.get('address');

    if (!chainName || !address) {
      return NextResponse.json(
        { error: 'Chain and address parameters required' },
        { status: 400 }
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
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

    // Fetch balance
    const balanceResponse = await fetch(evmRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1
      })
    });

    const balanceData = await balanceResponse.json();

    // Fetch transaction count
    const txCountResponse = await fetch(evmRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionCount',
        params: [address, 'latest'],
        id: 2
      })
    });

    const txCountData = await txCountResponse.json();

    // Fetch latest block number
    const latestBlockResponse = await fetch(evmRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 3
      })
    });

    const latestBlockData = await latestBlockResponse.json();
    const latestBlock = parseInt(latestBlockData.result, 16);

    // Scan recent 200 blocks for transactions
    const transactions = [];
    let blocksScanned = 0;

    for (let i = 0; i < 200 && transactions.length < 20; i++) {
      const blockNum = latestBlock - i;
      const blockHex = '0x' + blockNum.toString(16);
      blocksScanned++;

      const blockResponse = await fetch(evmRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBlockByNumber',
          params: [blockHex, true],
          id: 4
        })
      });

      const blockData = await blockResponse.json();

      if (blockData.result && blockData.result.transactions) {
        for (const tx of blockData.result.transactions) {
          const isFromAddress = tx.from.toLowerCase() === address.toLowerCase();
          const isToAddress = tx.to && tx.to.toLowerCase() === address.toLowerCase();

          if (isFromAddress || isToAddress) {
            transactions.push({
              hash: tx.hash,
              blockNumber: parseInt(tx.blockNumber, 16),
              from: tx.from,
              to: tx.to || null,
              value: BigInt(tx.value).toString(),
              timestamp: parseInt(blockData.result.timestamp, 16),
              direction: isFromAddress ? 'OUT' : 'IN'
            });

            if (transactions.length >= 20) break;
          }
        }
      }
    }

    console.log(`[Address API] Scanned ${blocksScanned} blocks, found ${transactions.length} transactions`);

    const result = {
      address: address,
      balance: BigInt(balanceData.result).toString(),
      transactionCount: parseInt(txCountData.result, 16),
      transactions: transactions.sort((a, b) => b.blockNumber - a.blockNumber)
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching EVM address:', error);
    return NextResponse.json(
      { error: 'Failed to fetch address details' },
      { status: 500 }
    );
  }
}
