// app/api/trading/v1/tokens/hypercore-link/retry/route.ts
// ⚠️ DEPRECATED: HyperCore token linking retry is not supported
// This service uses HyperEVM Native only
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/trading/v1/tokens/hypercore-link/retry
 * Retry failed token linking
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: {
      code: 'ENDPOINT_DEPRECATED',
      message: 'HyperCore token linking retry is deprecated. This service uses HyperEVM Native only.'
    }
  }, { status: 410 }); // 410 Gone
}