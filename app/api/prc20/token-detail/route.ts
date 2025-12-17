import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    // TODO: Query contract for token details
    // For now, return mock data
    const mockTokenDetail = {
      name: 'Example Token',
      symbol: 'EXT',
      decimals: 18,
      totalSupply: '1000000',
      contractAddress: address
    };

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return NextResponse.json({
      success: true,
      token: mockTokenDetail
    });

  } catch (error) {
    console.error('Error fetching token details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token details' },
      { status: 500 }
    );
  }
}
