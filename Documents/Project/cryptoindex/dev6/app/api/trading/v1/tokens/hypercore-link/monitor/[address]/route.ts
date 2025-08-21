// app/api/trading/v1/tokens/hypercore-link/monitor/[address]/route.ts
// ⚠️ DEPRECATED: HyperCore token linking monitoring is not supported
// This service uses HyperEVM Native only
import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: {
    address: string;
  };
}

/**
 * GET /api/trading/v1/tokens/hypercore-link/monitor/[address]
 * Monitor token linking progress
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return NextResponse.json({
    success: false,
    error: {
      code: 'ENDPOINT_DEPRECATED',
      message: 'HyperCore token linking monitoring is deprecated. This service uses HyperEVM Native only.'
    }
  }, { status: 410 }); // 410 Gone
}