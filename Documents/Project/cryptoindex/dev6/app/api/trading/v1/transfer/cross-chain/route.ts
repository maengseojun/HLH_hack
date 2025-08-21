// app/api/trading/v1/transfer/cross-chain/route.ts
// ⚠️ DEPRECATED: Cross-chain transfers with HyperCore are not supported
// This service uses HyperEVM Native only
import { NextRequest, NextResponse } from 'next/server';
import { requirePrivyAuth } from '@/lib/middleware/privy-auth';
import { CrossChainBalanceService } from '@/lib/trading/cross-chain-balance-service';
import { WebSocketManager } from '@/lib/trading/websocket-manager';
import { z } from 'zod';

const TransferSchema = z.object({
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
  amount: z.string().regex(/^\d+\.?\d*$/, 'Invalid amount format'),
  direction: z.enum(['to_hypercore', 'to_evm'], {
    errorMap: () => ({ message: 'Direction must be to_hypercore or to_evm' })
  })
});

/**
 * POST /api/trading/v1/transfer/cross-chain - Transfer tokens between chains
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: {
      code: 'ENDPOINT_DEPRECATED',
      message: 'Cross-chain transfers with HyperCore are not supported. This service uses HyperEVM Native only.'
    }
  }, { status: 410 }); // 410 Gone
}

/**
 * GET /api/trading/v1/transfer/cross-chain - Get optimization suggestions
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: {
      code: 'ENDPOINT_DEPRECATED',
      message: 'Cross-chain balance optimization with HyperCore is not supported. This service uses HyperEVM Native only.'
    }
  }, { status: 410 }); // 410 Gone
}