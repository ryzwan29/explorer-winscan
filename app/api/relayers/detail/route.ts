import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ssl.winsnip.xyz';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain');
    const relayerId = searchParams.get('relayerId');

    if (!chain || !relayerId) {
      return NextResponse.json(
        { error: 'Missing chain or relayerId parameter' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/api/relayers/detail?chain=${encodeURIComponent(chain)}&relayerId=${encodeURIComponent(relayerId)}`,
      {
        next: { revalidate: 60 }, // Cache for 60 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('Error fetching relayer details:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch relayer details',
        chainId: request.nextUrl.searchParams.get('relayerId'),
        chainName: request.nextUrl.searchParams.get('relayerId'),
        logo: null,
        channels: []
      },
      { status: 500 }
    );
  }
}
