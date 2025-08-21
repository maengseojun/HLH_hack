// app/api/trading/v1/tokens/link/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePrivyAuth } from '@/lib/middleware/privy-auth';
import { TokenLinkingService } from '@/lib/trading/token-linking-service';
import { z } from 'zod';

const LinkTokenSchema = z.object({
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
  symbol: z.string().min(1).max(20, 'Symbol must be 1-20 characters'),
  name: z.string().max(100, 'Name must be less than 100 characters').optional(),
  decimals: z.number().int().min(0).max(18, 'Decimals must be 0-18').optional(),
  hypercoreAssetIndex: z.number().int().min(1000, 'Asset index must be >= 1000').optional(),
  evmExtraWeiDecimals: z.number().int().min(0).max(18, 'Extra decimals must be 0-18').optional(),
  forceRelink: z.boolean().optional(),
  metadata: z.object({
    totalSupply: z.string().optional(),
    creator: z.string().optional(),
    description: z.string().max(500).optional()
  }).optional()
});

/**
 * POST /api/trading/v1/tokens/link - Request token linking to HyperCore
 * ⚠️ DEPRECATED: HyperCore integration disabled - using HyperEVM Native
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: {
      code: 'ENDPOINT_DEPRECATED',
      message: 'HyperCore token linking is deprecated. This service uses HyperEVM Native with direct ERC-20 deployment.'
    }
  }, { status: 410 }); // 410 Gone
}

/**
 * GET /api/trading/v1/tokens/link - Get all token linking statuses
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: {
      code: 'ENDPOINT_DEPRECATED',
      message: 'HyperCore token linking is deprecated. This service uses HyperEVM Native with direct ERC-20 deployment.'
    }
  }, { status: 410 }); // 410 Gone
}