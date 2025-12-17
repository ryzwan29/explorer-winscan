import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * PRC20 Swap API
 * Handles swapping between PAXI native token and PRC20 tokens
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      chain, 
      fromToken, 
      toToken, 
      amount, 
      address, 
      slippage = 0.5 
    } = body;

    // Validate required fields
    if (!chain || !fromToken || !toToken || !amount || !address) {
      return NextResponse.json(
        { error: 'Missing required fields: chain, fromToken, toToken, amount, address' },
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

    // Validate address format
    if (!address.startsWith('paxi1')) {
      return NextResponse.json(
        { error: 'Invalid Paxi address format' },
        { status: 400 }
      );
    }

    // Backend API endpoints with load balancing
    const backendUrls = [
      'https://ssl.winsnip.xyz/api/prc20/swap',
      'https://ssl2.winsnip.xyz/api/prc20/swap'
    ];

    let lastError: any = null;

    // Try each backend endpoint
    for (const backendUrl of backendUrls) {
      try {
        console.log(`[PRC20 Swap] Attempting ${backendUrl}`);
        
        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            chain,
            fromToken,
            toToken,
            amount,
            address,
            slippage
          }),
          signal: AbortSignal.timeout(30000) // 30s timeout
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`[PRC20 Swap] ✓ Success with ${backendUrl}`);
          
          return NextResponse.json(data, {
            headers: {
              'Cache-Control': 'no-store, must-revalidate',
            }
          });
        }

        lastError = await response.text();
        console.log(`[PRC20 Swap] ✗ Failed ${backendUrl}: ${response.status} ${lastError}`);
      } catch (error: any) {
        lastError = error;
        console.log(`[PRC20 Swap] ✗ Error ${backendUrl}: ${error.message}`);
        continue;
      }
    }

    // All endpoints failed
    return NextResponse.json(
      { 
        error: 'PRC20 swap service unavailable. Please try again later.',
        details: lastError?.message || 'Unknown error'
      },
      { status: 503 }
    );

  } catch (error: any) {
    console.error('[PRC20 Swap] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get swap quote/estimate
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get('chain') || 'paxi-mainnet';
    const fromToken = searchParams.get('fromToken');
    const toToken = searchParams.get('toToken');
    const amount = searchParams.get('amount');

    if (!fromToken || !toToken || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters: fromToken, toToken, amount' },
        { status: 400 }
      );
    }

    // Backend API endpoints
    const backendUrls = [
      'https://ssl.winsnip.xyz/api/prc20/swap/quote',
      'https://ssl2.winsnip.xyz/api/prc20/swap/quote'
    ];

    let lastError: any = null;

    for (const backendUrl of backendUrls) {
      try {
        const url = `${backendUrl}?chain=${chain}&fromToken=${fromToken}&toToken=${toToken}&amount=${amount}`;
        
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json(data, {
            headers: {
              'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30'
            }
          });
        }

        lastError = await response.text();
      } catch (error: any) {
        lastError = error;
        continue;
      }
    }

    return NextResponse.json(
      { error: 'Quote service unavailable', details: lastError?.message },
      { status: 503 }
    );

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
