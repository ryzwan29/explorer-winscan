import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    // TODO: Delete from database
    // For now, simulate success
    console.log('Deleting PRC20 token:', address);

    return NextResponse.json({
      success: true,
      message: 'Token deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting PRC20 token:', error);
    return NextResponse.json(
      { error: 'Failed to delete token' },
      { status: 500 }
    );
  }
}
