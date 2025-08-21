// app/api/trading/v1/tokens/spot-test/route.ts
// ⚠️ DEPRECATED: HyperCore spot trading test is not supported
// This service uses HyperEVM Native only
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/trading/v1/tokens/spot-test
 * Test spot trading functionality for a token
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: {
      code: 'ENDPOINT_DEPRECATED',
      message: 'HyperCore spot trading test is deprecated. This service uses HyperEVM Native only.'
    }
  }, { status: 410 }); // 410 Gone
}