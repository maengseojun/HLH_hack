import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface HybridTrade {
  id: string;
  pair: string;
  price: string;
  amount: string;
  side: 'buy' | 'sell';
  source: 'AMM' | 'Orderbook';
  timestamp: number;
  orderId?: string;
}

// GET /api/trading/v1/trades - 하이브리드 거래 내역 조회 (AMM + Orderbook)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pair = searchParams.get('pair') || 'HYPERINDEX-USDC';
    const limit = parseInt(searchParams.get('limit') || '50');

    if (limit > 200) {
      return NextResponse.json(
        { success: false, error: 'Limit cannot exceed 200' },
        { status: 400 }
      );
    }

    console.log(`📊 Fetching hybrid trades for ${pair}, limit: ${limit}`);

    // 1. 오더북 거래 내역 조회 (Redis에서)
    let orderbookTrades: HybridTrade[] = [];
    try {
      const { UltraPerformanceOrderbook } = await import('@/lib/orderbook/ultra-performance-orderbook');
      const matchingEngine = UltraPerformanceOrderbook.getInstance();
      const recentTrades = await matchingEngine.getRecentTrades(pair, Math.floor(limit * 0.7));
      
      orderbookTrades = recentTrades.map(trade => ({
        id: trade.id,
        pair: trade.pair,
        price: trade.price,
        amount: trade.amount,
        side: trade.side,
        source: 'Orderbook' as const,
        timestamp: trade.timestamp,
        orderId: trade.buyOrderId !== 'amm' ? trade.buyOrderId : trade.sellOrderId
      }));

      console.log(`📖 Found ${orderbookTrades.length} orderbook trades`);
    } catch (_error) {
      console.warn('Failed to fetch orderbook trades:', error);
    }

    // 2. AMM 거래 내역 조회 (order_history에서 routing 정보 포함된 것들)
    let ammTrades: HybridTrade[] = [];
    try {
      const { data: orderHistory, error } = await supabase
        .from('order_history')
        .select('*')
        .eq('pair', pair)
        .not('filled_amount', 'eq', '0')
        .order('created_at', { ascending: false })
        .limit(Math.floor(limit * 0.5));

      if (!error && orderHistory) {
        // AMM으로 처리된 주문들을 거래 내역으로 변환
        ammTrades = orderHistory
          .filter(order => parseFloat(order.filled_amount || '0') > 0)
          .map(order => {
            // 실제로는 routing 정보를 확인해야 하지만, 일단 시뮬레이션
            const isAMMTrade = order.order_type === 'market'; // 시장가는 대부분 AMM
            
            return {
              id: `amm-${order.id}`,
              pair: order.pair,
              price: order.price || '1.0000',
              amount: order.filled_amount || order.amount,
              side: order.side as 'buy' | 'sell',
              source: isAMMTrade ? 'AMM' as const : 'Orderbook' as const,
              timestamp: new Date(order.created_at).getTime(),
              orderId: order.id
            };
          });

        console.log(`🏦 Found ${ammTrades.length} potential AMM trades from order history`);
      }
    } catch (_error) {
      console.warn('Failed to fetch AMM trades:', error);
    }

    // 3. 모든 거래 합치기 및 시간순 정렬
    const allTrades = [...orderbookTrades, ...ammTrades]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    // 4. 거래량 및 가격 통계 계산
    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const trades24h = allTrades.filter(trade => trade.timestamp > last24h);
    
    const volume24h = trades24h.reduce((sum, trade) => 
      sum + parseFloat(trade.amount), 0
    );

    const prices = trades24h.map(trade => parseFloat(trade.price));
    const high24h = prices.length > 0 ? Math.max(...prices) : 0;
    const low24h = prices.length > 0 ? Math.min(...prices) : 0;
    const lastPrice = allTrades.length > 0 ? allTrades[0].price : '0';

    // 5. 소스별 통계
    const ammTradeCount = allTrades.filter(t => t.source === 'AMM').length;
    const orderbookTradeCount = allTrades.filter(t => t.source === 'Orderbook').length;

    console.log(`✅ Returning ${allTrades.length} trades (AMM: ${ammTradeCount}, Orderbook: ${orderbookTradeCount})`);

    return NextResponse.json({
      success: true,
      trades: allTrades,
      total: allTrades.length,
      pair,
      stats: {
        volume24h: volume24h.toFixed(2),
        high24h: high24h.toFixed(4),
        low24h: low24h.toFixed(4),
        lastPrice,
        trades24h: trades24h.length,
        ammTrades: ammTradeCount,
        orderbookTrades: orderbookTradeCount
      },
      lastUpdate: Date.now()
    });

  } catch (_error) {
    console.error('❌ Hybrid trades fetch error:', _error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}