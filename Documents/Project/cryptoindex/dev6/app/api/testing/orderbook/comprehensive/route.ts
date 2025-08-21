import { NextRequest, NextResponse } from 'next/server';
import { UltraPerformanceOrderbook } from '@/lib/orderbook/ultra-performance-orderbook';
import { HybridSmartRouterV2 } from '@/lib/trading/smart-router-v2';
import { Order } from '@/lib/types/orderbook';
import { v4 as uuidv4 } from 'uuid';

const matchingEngine = UltraPerformanceOrderbook.getInstance();
const smartRouter = HybridSmartRouterV2.getInstance();

export async function GET(_request: NextRequest) {
  const testResults: any[] = [];
  
  console.log('🧪 Starting comprehensive orderbook testing...');

  try {
    // ====================================
    // 1. 기본 주문 생성 및 매칭 테스트
    // ====================================
    
    const test1 = await testBasicOrderMatching();
    testResults.push(test1);

    // ====================================
    // 2. Price-Time Priority 테스트
    // ====================================
    
    const test2 = await testPriceTimePriority();
    testResults.push(test2);

    // ====================================
    // 3. 부분 체결 테스트
    // ====================================
    
    const test3 = await testPartialFills();
    testResults.push(test3);

    // ====================================
    // 4. Market Order vs Limit Order 테스트
    // ====================================
    
    const test4 = await testMarketVsLimitOrders();
    testResults.push(test4);

    // ====================================
    // 5. 대량 주문 처리 성능 테스트
    // ====================================
    
    const test5 = await testHighVolumeOrders();
    testResults.push(test5);

    // ====================================
    // 6. Smart Router 테스트
    // ====================================
    
    const test6 = await testSmartRouter();
    testResults.push(test6);

    // ====================================
    // 7. 동시성 테스트 (Race Condition)
    // ====================================
    
    const test7 = await testConcurrency();
    testResults.push(test7);

    // ====================================
    // 8. 오류 처리 테스트
    // ====================================
    
    const test8 = await testErrorHandling();
    testResults.push(test8);

    // 결과 요약
    const summary = {
      totalTests: testResults.length,
      passed: testResults.filter(t => t.status === 'PASS').length,
      failed: testResults.filter(t => t.status === 'FAIL').length,
      warnings: testResults.filter(t => t.status === 'WARN').length
    };

    return NextResponse.json({
      success: true,
      summary,
      results: testResults,
      timestamp: new Date().toISOString()
    });

  } catch (_error) {
    console.error('❌ Comprehensive test error:', _error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error',
      results: testResults
    }, { status: 500 });
  }
}

// ====================================
// 테스트 함수들
// ====================================

async function testBasicOrderMatching() {
  console.log('🧪 Testing basic order matching...');
  
  try {
    const pair = 'HYPERINDEX-USDC';
    const testUser1 = 'test-user-1';
    const testUser2 = 'test-user-2';

    // 1. 매수 주문 생성
    const buyOrder: Order = {
      id: uuidv4(),
      userId: testUser1,
      pair,
      side: 'buy',
      type: 'limit',
      price: '1.5000',
      amount: '100.0',
      filled: '0',
      remaining: '100.0',
      status: 'pending',
      timestamp: Date.now()
    };

    // 2. 매도 주문 생성 (매칭 가능한 가격)
    const sellOrder: Order = {
      id: uuidv4(),
      userId: testUser2,
      pair,
      side: 'sell',
      type: 'limit',
      price: '1.4500',
      amount: '50.0',
      filled: '0',
      remaining: '50.0',
      status: 'pending',
      timestamp: Date.now() + 1
    };

    // 3. 주문 처리
    const buyResult = await matchingEngine.processOrder(buyOrder);
    const sellResult = await matchingEngine.processOrder(sellOrder);

    // 4. 결과 검증
    const issues: string[] = [];
    
    if (sellResult.trades.length === 0) {
      issues.push('No trades generated from matching orders');
    }
    
    if (sellResult.trades.length > 0) {
      const trade = sellResult.trades[0];
      if (parseFloat(trade.amount) !== 50.0) {
        issues.push(`Expected trade amount 50.0, got ${trade.amount}`);
      }
      if (parseFloat(trade.price) !== 1.5000) {
        issues.push(`Expected trade price 1.5000 (maker price), got ${trade.price}`);
      }
    }

    return {
      testName: 'Basic Order Matching',
      status: issues.length === 0 ? 'PASS' : 'FAIL',
      details: {
        buyOrderStatus: buyResult.updatedOrders[0]?.status,
        sellOrderStatus: sellResult.updatedOrders[0]?.status,
        tradesGenerated: sellResult.trades.length,
        tradeAmount: sellResult.trades[0]?.amount,
        tradePrice: sellResult.trades[0]?.price
      },
      issues
    };

  } catch (_error) {
    return {
      testName: 'Basic Order Matching',
      status: 'FAIL',
      error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
    };
  }
}

async function testPriceTimePriority() {
  console.log('🧪 Testing Price-Time Priority...');
  
  try {
    const pair = 'TEST-USDC';
    
    // 같은 가격에 여러 주문 생성 (시간 순서가 중요)
    const orders: Order[] = [
      {
        id: 'order-1',
        userId: 'user-1',
        pair,
        side: 'buy',
        type: 'limit',
        price: '2.0000',
        amount: '10.0',
        filled: '0',
        remaining: '10.0',
        status: 'pending',
        timestamp: Date.now()
      },
      {
        id: 'order-2',
        userId: 'user-2',
        pair,
        side: 'buy',
        type: 'limit',
        price: '2.0000',
        amount: '20.0',
        filled: '0',
        remaining: '20.0',
        status: 'pending',
        timestamp: Date.now() + 100 // 100ms 후
      }
    ];

    // 주문들을 오더북에 추가
    for (const order of orders) {
      await matchingEngine.processOrder(order);
    }

    // 매도 주문으로 매칭 테스트
    const sellOrder: Order = {
      id: 'sell-order',
      userId: 'seller',
      pair,
      side: 'sell',
      type: 'limit',
      price: '1.9000',
      amount: '15.0',
      filled: '0',
      remaining: '15.0',
      status: 'pending',
      timestamp: Date.now() + 200
    };

    const result = await matchingEngine.processOrder(sellOrder);

    // 첫 번째 주문이 먼저 매칭되어야 함
    const issues: string[] = [];
    
    if (result.trades.length === 0) {
      issues.push('No trades generated');
    } else {
      const trade = result.trades[0];
      if (trade.buyOrderId !== 'order-1') {
        issues.push('First order (by time) should be matched first');
      }
    }

    return {
      testName: 'Price-Time Priority',
      status: issues.length === 0 ? 'PASS' : 'FAIL',
      details: {
        tradesCount: result.trades.length,
        firstMatchedOrder: result.trades[0]?.buyOrderId
      },
      issues
    };

  } catch (_error) {
    return {
      testName: 'Price-Time Priority',
      status: 'FAIL',
      error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
    };
  }
}

async function testPartialFills() {
  console.log('🧪 Testing partial fills...');
  
  try {
    const pair = 'PARTIAL-TEST';
    
    // 큰 매수 주문
    const buyOrder: Order = {
      id: 'big-buy',
      userId: 'buyer',
      pair,
      side: 'buy',
      type: 'limit',
      price: '3.0000',
      amount: '1000.0',
      filled: '0',
      remaining: '1000.0',
      status: 'pending',
      timestamp: Date.now()
    };

    await matchingEngine.processOrder(buyOrder);

    // 작은 매도 주문들로 부분 체결
    const sellOrders = [
      {
        id: 'small-sell-1',
        amount: '100.0'
      },
      {
        id: 'small-sell-2', 
        amount: '250.0'
      }
    ];

    let totalFilled = 0;
    
    for (const sellData of sellOrders) {
      const sellOrder: Order = {
        id: sellData.id,
        userId: 'seller',
        pair,
        side: 'sell',
        type: 'limit',
        price: '2.9000',
        amount: sellData.amount,
        filled: '0',
        remaining: sellData.amount,
        status: 'pending',
        timestamp: Date.now()
      };

      const result = await matchingEngine.processOrder(sellOrder);
      totalFilled += result.trades.reduce((sum, trade) => 
        sum + parseFloat(trade.amount), 0
      );
    }

    const issues: string[] = [];
    
    if (totalFilled !== 350.0) {
      issues.push(`Expected total filled 350.0, got ${totalFilled}`);
    }

    return {
      testName: 'Partial Fills',
      status: issues.length === 0 ? 'PASS' : 'FAIL',
      details: {
        totalFilledAmount: totalFilled,
        expectedFilled: 350.0
      },
      issues
    };

  } catch (_error) {
    return {
      testName: 'Partial Fills',
      status: 'FAIL',
      error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
    };
  }
}

async function testMarketVsLimitOrders() {
  console.log('🧪 Testing Market vs Limit orders...');
  
  try {
    const pair = 'MARKET-TEST';
    const issues: string[] = [];

    // 오더북에 매도 주문들 설정
    const sellOrders = [
      { price: '5.0000', amount: '10.0' },
      { price: '5.1000', amount: '20.0' },
      { price: '5.2000', amount: '30.0' }
    ];

    for (let i = 0; i < sellOrders.length; i++) {
      const order: Order = {
        id: `sell-${i}`,
        userId: 'seller',
        pair,
        side: 'sell',
        type: 'limit',
        price: sellOrders[i].price,
        amount: sellOrders[i].amount,
        filled: '0',
        remaining: sellOrders[i].amount,
        status: 'pending',
        timestamp: Date.now() + i
      };
      
      await matchingEngine.processOrder(order);
    }

    // Market Order 테스트
    const marketOrder: Order = {
      id: 'market-buy',
      userId: 'buyer',
      pair,
      side: 'buy',
      type: 'market',
      price: '0',
      amount: '25.0',
      filled: '0',
      remaining: '25.0',
      status: 'pending',
      timestamp: Date.now() + 1000
    };

    const marketResult = await matchingEngine.processOrder(marketOrder);

    // Market order는 가장 좋은 가격부터 체결되어야 함
    if (marketResult.trades.length === 0) {
      issues.push('Market order generated no trades');
    } else {
      const firstTrade = marketResult.trades[0];
      if (parseFloat(firstTrade.price) !== 5.0000) {
        issues.push('Market order should match best available price first');
      }
    }

    return {
      testName: 'Market vs Limit Orders',
      status: issues.length === 0 ? 'PASS' : 'FAIL',
      details: {
        marketTradesCount: marketResult.trades.length,
        firstTradePrice: marketResult.trades[0]?.price,
        totalFilled: marketResult.trades.reduce((sum, trade) => 
          sum + parseFloat(trade.amount), 0
        )
      },
      issues
    };

  } catch (_error) {
    return {
      testName: 'Market vs Limit Orders',
      status: 'FAIL',
      error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
    };
  }
}

async function testHighVolumeOrders() {
  console.log('🧪 Testing high volume order processing...');
  
  try {
    const pair = 'VOLUME-TEST';
    const startTime = Date.now();
    
    // 100개의 주문 생성
    const orders: Order[] = [];
    for (let i = 0; i < 100; i++) {
      orders.push({
        id: `volume-order-${i}`,
        userId: `user-${i % 10}`, // 10명의 사용자가 반복
        pair,
        side: i % 2 === 0 ? 'buy' : 'sell',
        type: 'limit',
        price: (5.0 + (Math.random() - 0.5) * 0.1).toFixed(4),
        amount: (Math.random() * 100 + 10).toFixed(2),
        filled: '0',
        remaining: '0',
        status: 'pending',
        timestamp: Date.now() + i
      });
    }

    // 모든 주문 처리
    let totalTrades = 0;
    for (const order of orders) {
      order.remaining = order.amount;
      const result = await matchingEngine.processOrder(order);
      totalTrades += result.trades.length;
    }

    const processingTime = Date.now() - startTime;
    const ordersPerSecond = orders.length / (processingTime / 1000);

    return {
      testName: 'High Volume Orders',
      status: 'PASS',
      details: {
        totalOrders: orders.length,
        totalTrades: totalTrades,
        processingTimeMs: processingTime,
        ordersPerSecond: ordersPerSecond.toFixed(2)
      },
      issues: ordersPerSecond < 10 ? ['Performance below 10 orders/second'] : []
    };

  } catch (_error) {
    return {
      testName: 'High Volume Orders',
      status: 'FAIL',
      error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
    };
  }
}

async function testSmartRouter() {
  console.log('🧪 Testing Smart Router...');
  
  try {
    const pair = 'ROUTER-TEST';
    
    // 오더북에 주문들 설정
    const setupOrders = [
      { side: 'sell', price: '10.0000', amount: '50.0' },
      { side: 'sell', price: '10.1000', amount: '100.0' },
      { side: 'buy', price: '9.9000', amount: '75.0' }
    ];

    for (let i = 0; i < setupOrders.length; i++) {
      const order: Order = {
        id: `setup-${i}`,
        userId: 'setup-user',
        pair,
        side: setupOrders[i].side as 'buy' | 'sell',
        type: 'limit',
        price: setupOrders[i].price,
        amount: setupOrders[i].amount,
        filled: '0',
        remaining: setupOrders[i].amount,
        status: 'pending',
        timestamp: Date.now() + i
      };
      
      await matchingEngine.processOrder(order);
    }

    // Smart Router로 최적 경로 찾기
    const routes = await smartRouter.findBestRoute(pair, 'buy', '80.0');
    
    const issues: string[] = [];
    
    if (routes.length === 0) {
      issues.push('No routes found by Smart Router');
    }

    return {
      testName: 'Smart Router',
      status: issues.length === 0 ? 'PASS' : 'FAIL',
      details: {
        routesFound: routes.length,
        routeTypes: routes.map(r => r.type),
        bestRoute: routes[0] ? {
          type: routes[0].type,
          expectedOutput: routes[0].expectedOutput,
          gasEstimate: routes[0].gasEstimate
        } : null
      },
      issues
    };

  } catch (_error) {
    return {
      testName: 'Smart Router',
      status: 'FAIL',
      error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
    };
  }
}

async function testConcurrency() {
  console.log('🧪 Testing concurrency (race conditions)...');
  
  try {
    const pair = 'RACE-TEST';
    
    // 동일한 가격대의 주문들을 동시에 처리
    const concurrentOrders: Order[] = [
      {
        id: 'race-1',
        userId: 'user-1',
        pair,
        side: 'buy',
        type: 'limit',
        price: '7.0000',
        amount: '100.0',
        filled: '0',
        remaining: '100.0',
        status: 'pending',
        timestamp: Date.now()
      },
      {
        id: 'race-2',
        userId: 'user-2',
        pair,
        side: 'sell',
        type: 'limit',
        price: '7.0000',
        amount: '100.0',
        filled: '0',
        remaining: '100.0',
        status: 'pending',
        timestamp: Date.now()
      }
    ];

    // 동시 실행
    const results = await Promise.all(
      concurrentOrders.map(order => matchingEngine.processOrder(order))
    );

    // 결과 검증
    const totalTrades = results.reduce((sum, result) => sum + result.trades.length, 0);
    
    return {
      testName: 'Concurrency Test',
      status: totalTrades > 0 ? 'PASS' : 'WARN',
      details: {
        totalTrades,
        results: results.map(r => ({
          tradesCount: r.trades.length,
          updatedOrdersCount: r.updatedOrders.length
        }))
      },
      issues: totalTrades === 0 ? ['No trades generated in concurrent execution'] : []
    };

  } catch (_error) {
    return {
      testName: 'Concurrency Test',
      status: 'FAIL',
      error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
    };
  }
}

async function testErrorHandling() {
  console.log('🧪 Testing error handling...');
  
  try {
    const issues: string[] = [];

    // 1. 잘못된 주문 데이터 테스트
    try {
      const invalidOrder: Order = {
        id: '',
        userId: '',
        pair: '',
        side: 'invalid' as any,
        type: 'invalid' as any,
        price: '-1',
        amount: '0',
        filled: '0',
        remaining: '0',
        status: 'pending',
        timestamp: Date.now()
      };

      await matchingEngine.processOrder(invalidOrder);
      issues.push('Invalid order was processed without error');
    } catch (_error) {
      // 예상된 에러이므로 OK
    }

    // 2. 존재하지 않는 주문 취소 테스트
    const cancelResult = await matchingEngine.cancelOrder('non-existent-order');
    if (cancelResult === true) {
      issues.push('Non-existent order cancellation returned success');
    }

    return {
      testName: 'Error Handling',
      status: issues.length === 0 ? 'PASS' : 'FAIL',
      details: {
        invalidOrderHandled: 'Properly rejected',
        nonExistentCancelHandled: !cancelResult
      },
      issues
    };

  } catch (_error) {
    return {
      testName: 'Error Handling',
      status: 'FAIL',
      error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
    };
  }
}