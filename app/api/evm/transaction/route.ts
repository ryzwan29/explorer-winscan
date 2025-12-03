import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chainName = searchParams.get('chain');
    const txHash = searchParams.get('hash');

    if (!chainName || !txHash) {
      return NextResponse.json(
        { error: 'Chain and hash parameters required' },
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

    // Fetch transaction
    const txResponse = await fetch(evmRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionByHash',
        params: [txHash],
        id: 1
      })
    });

    const txData = await txResponse.json();

    if (!txData.result) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Fetch transaction receipt
    const receiptResponse = await fetch(evmRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txHash],
        id: 2
      })
    });

    const receiptData = await receiptResponse.json();

    if (!receiptData.result) {
      return NextResponse.json(
        { error: 'Transaction receipt not found' },
        { status: 404 }
      );
    }

    // Fetch block
    const blockResponse = await fetch(evmRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBlockByNumber',
        params: [txData.result.blockNumber, false],
        id: 3
      })
    });

    const blockData = await blockResponse.json();

    const tx = txData.result;
    const receipt = receiptData.result;
    const block = blockData.result;

    const result = {
      hash: tx.hash,
      blockNumber: parseInt(tx.blockNumber, 16),
      blockHash: tx.blockHash,
      timestamp: parseInt(block.timestamp, 16),
      from: tx.from,
      to: tx.to,
      value: BigInt(tx.value).toString(),
      gasPrice: BigInt(tx.gasPrice || '0x0').toString(),
      gasUsed: BigInt(receipt.gasUsed).toString(),
      gasLimit: BigInt(tx.gas).toString(),
      nonce: parseInt(tx.nonce, 16),
      transactionIndex: parseInt(tx.transactionIndex, 16),
      status: parseInt(receipt.status, 16),
      input: tx.input
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching EVM transaction:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction' },
      { status: 500 }
    );
  }
}
