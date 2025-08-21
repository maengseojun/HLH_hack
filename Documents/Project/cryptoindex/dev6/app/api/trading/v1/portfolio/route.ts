// app/api/trading/v1/portfolio/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePrivyAuth } from '@/lib/middleware/privy-auth';
import { PortfolioService } from '@/lib/trading/portfolio-service';
import { z } from 'zod';

const QuerySchema = z.object({
  includeBalances: z.string().transform(val => val === 'true').optional(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
});

/**
 * GET /api/trading/v1/portfolio - Get user's portfolio
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

    const { includeBalances, walletAddress } = validationResult.data;

    // Get portfolio data
    const portfolioService = PortfolioService.getInstance();
    const portfolio = await portfolioService.getPortfolio(user.id, walletAddress);

    // Format response
    const response: any = {
      success: true,
      portfolio: {
        summary: {
          totalValue: portfolio.totalValue,
          totalPnL: portfolio.totalPnL,
          pnL24h: portfolio.pnL24h,
          positionCount: portfolio.positions.length
        },
        positions: portfolio.positions.map(position => ({
          tokenAddress: position.tokenAddress,
          symbol: position.symbol,
          name: position.name,
          amount: position.amount,
          averagePrice: position.averagePrice,
          currentPrice: position.currentPrice,
          marketValue: position.marketValue,
          unrealizedPnL: position.unrealizedPnL,
          pnLPercentage: position.pnLPercentage,
          allocation: position.allocation
        }))
      }
    };

    // Include balances if requested
    if (includeBalances) {
      response.portfolio.balances = portfolio.balances.map(balance => ({
        tokenAddress: balance.tokenAddress,
        available: balance.available,
        locked: balance.locked,
        total: balance.total
      }));
    }

    return NextResponse.json(response);

  } catch (_error) {
    console.error('❌ Get portfolio error:', _error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}