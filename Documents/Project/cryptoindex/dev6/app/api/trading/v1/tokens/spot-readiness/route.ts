// app/api/trading/v1/tokens/spot-readiness/route.ts
// ⚠️ DEPRECATED: HyperCore spot trading readiness is not supported
// This service uses HyperEVM Native only
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/trading/v1/tokens/spot-readiness
 * Get spot trading readiness report for all tokens
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: {
      code: 'ENDPOINT_DEPRECATED',
      message: 'HyperCore spot trading readiness is deprecated. This service uses HyperEVM Native only.'
    }
  }, { status: 410 }); // 410 Gone
}