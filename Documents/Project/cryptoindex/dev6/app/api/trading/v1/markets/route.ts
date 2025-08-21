// app/api/trading/v1/markets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePrivyAuth } from '@/lib/middleware/privy-auth';
import { createClient } from '@supabase/supabase-js';
import { HyperVMAMM } from '@/lib/blockchain/hypervm-amm';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/trading/v1/markets - Get all available trading markets
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if ('status' in authResult) {
      return authResult;
    }

    // Get all tradeable index tokens
    const { data: tokens, error } = await supabase
      .from('index_tokens')
      .select('*')
      .eq('is_active', true)
      .eq('is_tradeable', true)
      .order('symbol');

    if (error) {
      throw _error;
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({
        success: true,
        markets: []
      });
    }

    // Get market data for each token
    const hyperVMAMM = HyperVMAMM.getInstance();
    const marketsData = await Promise.all(
      tokens.map(async (token) => {
        try {
          // Get AMM price and calculate market data
          const currentPrice = await hyperVMAMM.getSpotPrice(`${token.symbol}-USDC`);
          const marketData = {
            price: currentPrice,
            change24h: '0', // TODO: Calculate from historical data
            volume24h: '0', // TODO: Get from trade history
            high24h: currentPrice,
            low24h: currentPrice,
            lastUpdated: Date.now()
          };
          
          return {
            tokenAddress: token.token_address,
            symbol: token.symbol,
            name: token.name,
            description: token.description,
            price: marketData.price,
            change24h: marketData.change24h,
            volume24h: marketData.volume24h,
            high24h: marketData.high24h,
            low24h: marketData.low24h,
            navPerToken: token.nav_per_token || '0',
            totalSupply: token.total_supply || '0',
            components: token.components,
            lastUpdated: marketData.lastUpdated,
            createdAt: token.created_at
          };
        } catch (_error) {
          console.error(`❌ Failed to get market data for ${token.symbol}:`, _error);
          return {
            tokenAddress: token.token_address,
            symbol: token.symbol,
            name: token.name,
            description: token.description,
            price: '0',
            change24h: '0',
            volume24h: '0',
            high24h: '0',
            low24h: '0',
            navPerToken: token.nav_per_token || '0',
            totalSupply: token.total_supply || '0',
            components: token.components,
            lastUpdated: Date.now(),
            createdAt: token.created_at,
            error: 'Failed to load market data'
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      markets: marketsData
    });

  } catch (_error) {
    console.error('❌ Get markets error:', _error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}