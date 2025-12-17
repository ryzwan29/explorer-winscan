import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * PRC20 Transfer API
 * Handles transferring PRC20 tokens between addresses
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      chain, 
      tokenContract,
      fromAddress,
      toAddress, 
      amount,
      memo
    } = body;

    // Validate required fields
    if (!chain || !tokenContract || !fromAddress || !toAddress || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: chain, tokenContract, fromAddress, toAddress, amount' },
        { status: 400 }
      );
    }

    // Only support paxi-mainnet
    if (chain !== 'paxi-mainnet') {
      return NextResponse.json(
        { error: 'Only paxi-mainnet is supported' },
        { status: 400 }
      );
    }

    // Validate address formats
    if (!fromAddress.startsWith('paxi1') || !toAddress.startsWith('paxi1')) {
      return NextResponse.json(
        { error: 'Invalid Paxi address format' },
        { status: 400 }
      );
    }

    // Validate contract address
    if (!tokenContract.startsWith('paxi1')) {
      return NextResponse.json(
        { error: 'Invalid contract address format' },
        { status: 400 }
      );
    }

    // Backend API endpoints with load balancing
    const backendUrls = [
      'https://ssl.winsnip.xyz/api/prc20/transfer',
      'https://ssl2.winsnip.xyz/api/prc20/transfer'
    ];

    let lastError: any = null;

    // Try each backend endpoint
    for (const backendUrl of backendUrls) {
      try {
        console.log(`[PRC20 Transfer] Attempting ${backendUrl}`);
        
        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            chain,
            tokenContract,
            fromAddress,
            toAddress,
            amount,
            memo
          }),
          signal: AbortSignal.timeout(30000) // 30s timeout
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`[PRC20 Transfer] ✓ Success with ${backendUrl}`);
          
          return NextResponse.json(data, {
            headers: {
              'Cache-Control': 'no-store, must-revalidate',
            }
          });
        }

        lastError = await response.text();
        console.log(`[PRC20 Transfer] ✗ Failed ${backendUrl}: ${response.status} ${lastError}`);
      } catch (error: any) {
        lastError = error;
        console.log(`[PRC20 Transfer] ✗ Error ${backendUrl}: ${error.message}`);
        continue;
      }
    }

    // All endpoints failed
    return NextResponse.json(
      { 
        error: 'PRC20 transfer service unavailable. Please try again later.',
        details: lastError?.message || 'Unknown error'
      },
      { status: 503 }
    );

  } catch (error: any) {
    console.error('[PRC20 Transfer] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get transfer estimate/fee
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get('chain') || 'paxi-mainnet';
    const tokenContract = searchParams.get('tokenContract');
    const amount = searchParams.get('amount');

    if (!tokenContract || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters: tokenContract, amount' },
        { status: 400 }
      );
    }

    // Backend API endpoints
    const backendUrls = [
      'https://ssl.winsnip.xyz/api/prc20/transfer/estimate',
      'https://ssl2.winsnip.xyz/api/prc20/transfer/estimate'
    ];

    let lastError: any = null;

    for (const backendUrl of backendUrls) {
      try {
        const url = `${backendUrl}?chain=${chain}&tokenContract=${tokenContract}&amount=${amount}`;
        
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json(data, {
            headers: {
              'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
            }
          });
        }

        lastError = await response.text();
      } catch (error: any) {
        lastError = error;
        continue;
      }
    }

    // Return default estimate if backend unavailable
    return NextResponse.json({
      estimatedFee: '0.002',
      estimatedFeeUSD: '0.01',
      gasLimit: '200000',
      note: 'Estimated values - backend unavailable'
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60'
      }
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
