import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

const API_URL = process.env.API_URL || 'https://ssl.winsnip.xyz';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain');

    if (!chain) {
      return NextResponse.json({ error: 'Chain parameter required' }, { status: 400 });
    }

    const backendUrl = `${API_URL}/api/relayers?chain=${chain}`;
    console.log('[Relayers API] Fetching from backend:', backendUrl);
    
    const response = await fetch(backendUrl, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      console.error('[Relayers API] Backend error:', response.status);
      return NextResponse.json(
        { relayers: [], total: 0, source: 'none' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate'
      }
    });

  } catch (error: any) {
    console.error('[Relayers API] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch relayers', details: error.message, relayers: [], total: 0 },
      { status: 500 }
    );
  }
}
