// app/api/trading/v1/balance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePrivyAuth } from '@/lib/middleware/privy-auth';
import { PortfolioService } from '@/lib/trading/portfolio-service';
import { z } from 'zod';

const QuerySchema = z.object({
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
});

/**
 * GET /api/trading/v1/balance - Get user balances
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if ('status' in authResult) {
      return authResult;
    }

    const { user } = authResult;
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const queryData = Object.fromEntries(searchParams);
    const validationResult = QuerySchema.safeParse(queryData);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid query parameters',
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const { tokenAddress, walletAddress } = validationResult.data;

    // Get balances
    const portfolioService = PortfolioService.getInstance();
    const balances = await portfolioService.getUserBalances(user.id, walletAddress);

    // Filter by token if specified
    const filteredBalances = tokenAddress 
      ? balances.filter(b => b.tokenAddress.toLowerCase() === tokenAddress.toLowerCase())
      : balances;

    // Format response
    const formattedBalances = filteredBalances.map(balance => ({
      tokenAddress: balance.tokenAddress,
      available: balance.available,
      locked: balance.locked,
      total: balance.total
    }));

    return NextResponse.json({
      success: true,
      balances: formattedBalances
    });

  } catch (_error) {
    console.error('❌ Get balance error:', _error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}