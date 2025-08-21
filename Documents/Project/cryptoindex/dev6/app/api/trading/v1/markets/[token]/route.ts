// app/api/trading/v1/markets/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePrivyAuth } from '@/lib/middleware/privy-auth';
import { createClient } from '@supabase/supabase-js';
import { HyperVMAMM } from '@/lib/blockchain/hypervm-amm';
import { UltraPerformanceOrderbook } from '@/lib/orderbook/ultra-performance-orderbook';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/trading/v1/markets/[token] - Get specific market data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if ('status' in authResult) {
      return authResult;
    }

    const tokenIdentifier = params.token;
    const { searchParams } = new URL(request.url);
    const includeOrderBook = searchParams.get('includeOrderBook') === 'true';
    const orderBookDepth = parseInt(searchParams.get('depth') || '20');

    // Find token by address or symbol
    let query = supabase
      .from('index_tokens')
      .select('*')
      .eq('is_active', true);

    // Check if it's an address or symbol
    if (tokenIdentifier.startsWith('0x')) {
      query = query.eq('token_address', tokenIdentifier);
    } else {
      query = query.eq('symbol', tokenIdentifier.toUpperCase());
    }

    const { data: token, error } = await query.single();

    if (error || !token) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Token not found'
        },
        { status: 404 }
      );
    }

    // Get market data from HyperVM AMM
    const hyperVMAMM = HyperVMAMM.getInstance();
    const currentPrice = await hyperVMAMM.getSpotPrice(`${token.symbol}-USDC`);
    const marketData = {
      price: currentPrice,
      change24h: '0', // TODO: Calculate from historical data
      volume24h: '0', // TODO: Get from trade history
      high24h: currentPrice,
      low24h: currentPrice,
      lastUpdated: Date.now()
    };

    // Build response
    const response: any = {
      success: true,
      market: {
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
        createdAt: token.created_at,
        isTradeable: token.is_tradeable
      }
    };

    // Include order book if requested
    if (includeOrderBook) {
      try {
        const orderbook = UltraPerformanceOrderbook.getInstance();
        const orderBookData = await orderbook.getOrderbook(`${token.symbol}-USDC`, orderBookDepth);
        const orderBook = {
          bids: orderBookData.bids,
          asks: orderBookData.asks,
          timestamp: Date.now()
        };
        response.market.orderBook = orderBook;
      } catch (_error) {
        console.error(`❌ Failed to get order book for ${token.symbol}:`, _error);
        response.market.orderBook = {
          bids: [],
          asks: [],
          timestamp: Date.now(),
          error: 'Failed to load order book'
        };
      }
    }

    // Get recent price history
    try {
      const { data: priceHistory } = await supabase
        .from('market_data_history')
        .select('price, created_at')
        .eq('token_address', token.token_address)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true })
        .limit(100);

      if (priceHistory && priceHistory.length > 0) {
        response.market.priceHistory = priceHistory.map(p => ({
          price: p.price,
          timestamp: new Date(p.created_at).getTime()
        }));
      }
    } catch (_error) {
      console.error(`❌ Failed to get price history for ${token.symbol}:`, _error);
    }

    // Get recent trades
    try {
      const { data: recentTrades } = await supabase
        .from('trade_history')
        .select('side, amount, price, created_at')
        .eq('token_address', token.token_address)
        .order('created_at', { ascending: false })
        .limit(50);

      if (recentTrades && recentTrades.length > 0) {
        response.market.recentTrades = recentTrades.map(trade => ({
          side: trade.side,
          amount: trade.amount,
          price: trade.price,
          timestamp: new Date(trade.created_at).getTime()
        }));
      }
    } catch (_error) {
      console.error(`❌ Failed to get recent trades for ${token.symbol}:`, _error);
    }

    return NextResponse.json(response);

  } catch (_error) {
    console.error('❌ Get market data error:', _error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}