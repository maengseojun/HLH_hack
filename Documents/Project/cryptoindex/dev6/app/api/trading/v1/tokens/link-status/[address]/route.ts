// app/api/trading/v1/tokens/link-status/[address]/route.ts
// ⚠️ DEPRECATED: HyperCore token linking status is not supported
// This service uses HyperEVM Native only
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/trading/v1/tokens/link-status/[address] - Get token linking status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  return NextResponse.json({
    success: false,
    error: {
      code: 'ENDPOINT_DEPRECATED',
      message: 'HyperCore token linking status is deprecated. This service uses HyperEVM Native only.'
    }
  }, { status: 410 }); // 410 Gone
}

export async function POST(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  return NextResponse.json({
    success: false,
    error: {
      code: 'ENDPOINT_DEPRECATED',
      message: 'HyperCore token linking retry is deprecated. This service uses HyperEVM Native only.'
    }
  }, { status: 410 }); // 410 Gone
}