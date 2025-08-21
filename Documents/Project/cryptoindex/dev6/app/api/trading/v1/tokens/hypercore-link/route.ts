// app/api/trading/v1/tokens/hypercore-link/route.ts
// ⚠️ DEPRECATED: HyperCore is not used in this service
// This endpoint is disabled as we use HyperEVM Native instead of HyperCore
import { NextRequest, NextResponse } from 'next/server';
import TokenLinkingService from '@/lib/trading/token-linking-service';

/**
 * POST /api/trading/v1/tokens/hypercore-link
 * Link ERC-20 token to HyperCore for spot trading
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: {
      code: 'ENDPOINT_DEPRECATED',
      message: 'HyperCore integration is deprecated. This service uses HyperEVM Native instead.'
    }
  }, { status: 410 }); // 410 Gone
}

export async function GET() {
  return NextResponse.json({
    success: false,
    error: {
      code: 'ENDPOINT_DEPRECATED', 
      message: 'HyperCore integration is deprecated. This service uses HyperEVM Native instead.'
    }
  }, { status: 410 }); // 410 Gone
}