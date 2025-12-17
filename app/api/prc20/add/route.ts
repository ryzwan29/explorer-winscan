import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      address,
      name,
      symbol,
      decimals,
      totalSupply,
      logoUrl,
      website,
      description,
      verified,
      chainId
    } = body;

    // Validation
    if (!address || !name || !symbol || decimals === undefined || !totalSupply) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // TODO: Add to database
    // For now, simulate success
    console.log('Adding PRC20 token:', body);

    return NextResponse.json({
      success: true,
      message: 'Token added successfully',
      token: {
        address,
        name,
        symbol,
        decimals: parseInt(decimals),
        totalSupply,
        logoUrl,
        website,
        description,
        verified: verified || false,
        chainId,
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error adding PRC20 token:', error);
    return NextResponse.json(
      { error: 'Failed to add token' },
      { status: 500 }
    );
  }
}
