import { NextRequest, NextResponse } from 'next/server';
import { extractPrivyAuthFromRequest } from '@/lib/middleware/privy-auth';
import { AsyncDBWriter } from '@/lib/utils/async-db-writer';

const asyncDBWriter = AsyncDBWriter.getInstance();

/**
 * V2 주문 이력을 비동기 큐에 추가 (즉시 반환)
 */
function queueOrderHistory(order: any, routingResult: any, userId: string) {
  try {
    const filledAmount = parseFloat(routingResult.totalFilled);
    const status = filledAmount >= parseFloat(order.amount) * 0.99 ? 'filled' : 'partial';
    
    // 주문 이력을 큐에 추가 (즉시 반환)
    asyncDBWriter.queueOrderHistory({
      user_id: userId,
      pair: order.pair,
      side: order.side,
      order_type: order.type,
      price: order.type === 'limit' ? parseFloat(order.price) : (routingResult.averagePrice ? parseFloat(routingResult.averagePrice) : null),
      amount: parseFloat(order.amount),
      filled_amount: parseFloat(routingResult.totalFilled),
      status: status,
      redis_order_id: order.id
    });

    // 거래 이력들을 큐에 추가
    if (routingResult.fills && routingResult.fills.length > 0) {
      routingResult.fills.forEach((fill: any) => {
        asyncDBWriter.queueTradeHistory({
          id: crypto.randomUUID(),
          pair: order.pair,
          buyer_order_id: order.side === 'buy' ? order.id : (fill.source === 'AMM' ? 'amm' : null),
          seller_order_id: order.side === 'sell' ? order.id : (fill.source === 'AMM' ? 'amm' : null),
          price: parseFloat(fill.price),
          amount: parseFloat(fill.amount),
          side: order.side,
          source: fill.source || 'unknown',
          buyer_fee: 0,
          seller_fee: 0,
          price_impact: fill.priceImpact || null,
          amm_reserves_before: fill.ammReservesBefore || null,
          amm_reserves_after: fill.ammReservesAfter || null,
          redis_trade_id: fill.id || null
        });
      });
    }

    console.log(`⚡ Queued order ${order.id} and ${routingResult.fills?.length || 0} trades for async DB write`);

  } catch (_error) {
    console.error('❌ Error queuing order history:', _error);
    // 큐 추가 실패는 주문 처리에 영향을 주지 않음
  }
}

// POST /api/trading/v2/orders - V2 하이브리드 주문 처리
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await extractPrivyAuthFromRequest(request);
    if (!authResult.authenticated) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const user = authResult.user!;
    const body = await request.json();

    // 요청 데이터 검증
    const { pair, type, side, amount, price } = body;

    if (!pair || !type || !side || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (type === 'limit' && !price) {
      return NextResponse.json(
        { success: false, error: 'Price is required for limit orders' },
        { status: 400 }
      );
    }

    console.log('🚀 V2 ORDER PROCESSING:', { 
      pair: pair || 'HYPERINDEX-USDC', 
      type, 
      side, 
      amount, 
      price 
    });

    // V2 HybridSmartRouter 사용
    const { HybridSmartRouterV2 } = await import('@/lib/trading/smart-router-v2');
    const smartRouterV2 = HybridSmartRouterV2.getInstance();
    
    // V2 주문 객체 생성 - UUID 생성
    const orderId = crypto.randomUUID();
    const orderV2 = {
      id: orderId,
      userId: user.id,
      pair: pair || 'HYPERINDEX-USDC',
      side: side as 'buy' | 'sell',
      type: type as 'market' | 'limit',
      amount: amount.toString(),
      price: price ? price.toString() : '0',
      remaining: amount.toString(),
      status: 'active' as const,
      timestamp: Date.now()
    };

    // V2 하이브리드 라우팅 실행
    const routingResult = await smartRouterV2.processHybridOrder(orderV2);

    // PostgreSQL에 주문 이력 비동기 큐에 추가 (즉시 반환)
    queueOrderHistory(orderV2, routingResult, user.id);

    console.log('✅ V2 ORDER COMPLETED:', {
      orderId: orderV2.id,
      totalFilled: routingResult.totalFilled,
      averagePrice: routingResult.averagePrice,
      executionStats: routingResult.executionStats
    });

    return NextResponse.json({
      success: true,
      order: {
        id: orderV2.id,
        pair: orderV2.pair,
        side: orderV2.side,
        type: orderV2.type,
        amount: orderV2.amount,
        price: orderV2.price,
        status: parseFloat(routingResult.totalFilled) > 0 ? 'filled' : 'partial',
        timestamp: orderV2.timestamp
      },
      routing: routingResult,
      executionStats: routingResult.executionStats,
      fills: routingResult.fills,
      summary: {
        totalFilled: routingResult.totalFilled,
        averagePrice: routingResult.averagePrice,
        totalChunks: routingResult.executionStats.totalChunks,
        ammChunks: routingResult.executionStats.ammChunks,
        orderbookChunks: routingResult.executionStats.orderbookChunks,
        iterations: routingResult.executionStats.iterations
      }
    });

  } catch (_error) {
    console.error('❌ V2 Order processing error:', _error);
    
    // 에러 타입별 처리
    let errorMessage = 'Internal server error';
    let statusCode = 500;

    if (error instanceof Error) {
      if ((_error as Error)?.message || String(_error).includes('Limit price crosses market price')) {
        errorMessage = (_error as Error)?.message || String(_error);
        statusCode = 400;
      } else if ((_error as Error)?.message || String(_error).includes('Authentication')) {
        errorMessage = 'Authentication failed';
        statusCode = 401;
      } else {
        errorMessage = (_error as Error)?.message || String(_error);
      }
    }

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: statusCode }
    );
  }
}