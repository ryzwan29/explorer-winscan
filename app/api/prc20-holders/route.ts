import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contract = searchParams.get('contract');

    if (!contract) {
      return NextResponse.json({ error: 'Contract address required' }, { status: 400 });
    }

    const lcdUrls = [
      'https://api-paxi.winnode.xyz',
      'https://mainnet-lcd.paxinet.io',
      'https://api-paxi-m.maouam.xyz',
      'https://ssl2.winsnip.xyz'
    ];

    // Fetch all accounts with pagination
    // NOTE: LCD API limits responses to ~30 accounts per query regardless of limit parameter
    let totalAccounts = 0;
    let hasMore = true;
    let nextKey: string | undefined = undefined;
    let maxPages = 500; // With ~30 per page, this gives us up to 15,000 holders
    
    for (const lcdUrl of lcdUrls) {
      try {
        for (let page = 0; page < maxPages && hasMore; page++) {
          const query: any = { all_accounts: { limit: 100 } };
          if (nextKey) {
            query.all_accounts.start_after = nextKey;
          }
          
          const queryBase64 = Buffer.from(JSON.stringify(query)).toString('base64');
          const url = `${lcdUrl}/cosmwasm/wasm/v1/contract/${contract}/smart/${queryBase64}`;

          const res = await fetch(url, { 
            signal: AbortSignal.timeout(5000),
            headers: { 'Accept': 'application/json' }
          });

          if (res.ok) {
            const data = await res.json();
            const accounts = data.data?.accounts || [];
            totalAccounts += accounts.length;
            
            // LCD API returns ~30 accounts max per query
            // If we get less than 30, we've reached the end
            if (accounts.length < 30) {
              hasMore = false;
            } else {
              nextKey = accounts[accounts.length - 1];
            }
          } else {
            break;
          }
        }
        
        if (totalAccounts > 0) {
          return NextResponse.json({ 
            contract,
            count: totalAccounts 
          }, {
            headers: {
              'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
            }
          });
        }
      } catch (error) {
        continue;
      }
    }
    
    return NextResponse.json({ contract, count: 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
