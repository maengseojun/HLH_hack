// app/api/trading/v1/market/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePrivyAuth } from '@/lib/middleware/privy-auth';
import { UltraPerformanceOrderbook } from '@/lib/orderbook/ultra-performance-orderbook';
import { HyperVMAMM } from '@/lib/blockchain/hypervm-amm';
import { z } from 'zod';

const QuerySchema = z.object({
  pair: z.string().default('HYPERINDEX-USDC'),
  includeAMM: z.string().transform(val => val === 'true').default('true'),
  includeOrderbook: z.string().transform(val => val === 'true').default('true')
});

/**
 * GET /api/trading/v1/market - Get hybrid market data (AMM + Orderbook)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication for testing
    const authResult = await requirePrivyAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
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

    const { pair, includeAMM, includeOrderbook } = validationResult.data;

    console.log(`🔍 Market data request - Pair: ${pair}, AMM: ${includeAMM}, Orderbook: ${includeOrderbook}`);

    const matchingEngine = UltraPerformanceOrderbook.getInstance();
    const amm = new HyperVMAMM('wss://testnet.hyperliquid.xyz', {
      router: process.env.HYPEREVM_ROUTER_ADDRESS || '',
      factory: process.env.HYPEREVM_FACTORY_ADDRESS || '',
      hyperIndex: process.env.NEXT_PUBLIC_HYPERINDEX_TOKEN_ADDRESS || '',
      usdc: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || '',
      pair: process.env.HYPERINDEX_USDC_PAIR_ADDRESS || ''
    });

    // Collect market data
    const marketData: any = {
      pair,
      timestamp: Date.now()
    };

    // 1. AMM Data
    if (includeAMM) {
      try {
        const ammPrice = await matchingEngine.getAMMPrice(pair);
        if (ammPrice) {
          marketData.amm = {
            spotPrice: ammPrice.spotPrice,
            poolInfo: {
              reserveA: ammPrice.poolInfo.reserveA,
              reserveB: ammPrice.poolInfo.reserveB,
              tvl: ammPrice.poolInfo.tvl,
              volume24h: ammPrice.poolInfo.volume24h,
              fee: ammPrice.poolInfo.fee
            },
            priceImpact: {
              // Show price impact for different trade sizes
              buy100: amm.calculateSwapOutput(pair, 'buy', 100),
              buy1000: amm.calculateSwapOutput(pair, 'buy', 1000),
              sell100: amm.calculateSwapOutput(pair, 'sell', 100),
              sell1000: amm.calculateSwapOutput(pair, 'sell', 1000)
            }
          };
        } else {
          marketData.amm = null;
        }
      } catch (_error) {
        console.warn('Failed to get AMM data:', error);
        marketData.amm = { error: 'AMM data unavailable' };
      }
    }

    // 2. Orderbook Data
    if (includeOrderbook) {
      try {
        const orderbook = await matchingEngine.getOrderbook(pair, 10);
        const stats = await matchingEngine.getMarketStats(pair);
        
        marketData.orderbook = {
          bids: orderbook.bids,
          asks: orderbook.asks,
          spread: orderbook.bids.length > 0 && orderbook.asks.length > 0 
            ? parseFloat(orderbook.asks[0].price) - parseFloat(orderbook.bids[0].price)
            : null,
          stats: stats || {
            lastPrice: null,
            volume24h: '0',
            trades24h: 0
          }
        };
      } catch (_error) {
        console.warn('Failed to get orderbook data:', error);
        marketData.orderbook = { error: 'Orderbook data unavailable' };
      }
    }

    // 3. Hybrid Analysis
    if (includeAMM && includeOrderbook) {
      try {
        const hybridStats = await matchingEngine.getHybridMarketStats(pair);
        marketData.hybrid = {
          bestBuyPrice: hybridStats.routing?.bestBuyPrice,
          bestSellPrice: hybridStats.routing?.bestSellPrice,
          recommendation: {
            // Trading recommendations based on price comparison
            forBuying: marketData.amm?.spotPrice < (marketData.orderbook?.asks?.[0]?.price || Infinity) 
              ? 'AMM' : 'Orderbook',
            forSelling: marketData.amm?.spotPrice > (marketData.orderbook?.bids?.[0]?.price || 0)
              ? 'AMM' : 'Orderbook'
          }
        };
      } catch (_error) {
        console.warn('Failed to get hybrid analysis:', error);
        marketData.hybrid = { error: 'Hybrid analysis unavailable' };
      }
    }

    return NextResponse.json({
      success: true,
      data: marketData
    });

  } catch (_error) {
    console.error('❌ Market data error:', _error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trading/v1/market/simulate - Simulate AMM trades
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePrivyAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { pair = 'HYPERINDEX-USDC', side, amount } = body;

    if (!side || !amount) {
      return NextResponse.json(
        {
          success: false,
          error: 'Side and amount are required'
        },
        { status: 400 }
      );
    }

    const amm = new HyperVMAMM('wss://testnet.hyperliquid.xyz', {
      router: process.env.HYPEREVM_ROUTER_ADDRESS || '',
      factory: process.env.HYPEREVM_FACTORY_ADDRESS || '',
      hyperIndex: process.env.NEXT_PUBLIC_HYPERINDEX_TOKEN_ADDRESS || '',
      usdc: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || '',
      pair: process.env.HYPERINDEX_USDC_PAIR_ADDRESS || ''
    });
    
    // Simulate trade without executing
    const simulation = amm.calculateSwapOutput(pair, side, parseFloat(amount));
    const currentPrice = amm.getSpotPrice(pair);
    
    return NextResponse.json({
      success: true,
      simulation: {
        pair,
        side,
        inputAmount: parseFloat(amount),
        outputAmount: simulation.outputAmount,
        effectivePrice: simulation.effectivePrice,
        priceImpact: simulation.priceImpact,
        currentAMMPrice: currentPrice,
        estimatedNewPrice: side === 'buy' 
          ? amm.getPriceAfterSwap(pair, side, parseFloat(amount))
          : amm.getPriceAfterSwap(pair, side, parseFloat(amount))
      }
    });

  } catch (_error) {
    console.error('❌ Market simulation error:', _error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Simulation failed',
        message: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
      },
      { status: 500 }
    );
  }
}