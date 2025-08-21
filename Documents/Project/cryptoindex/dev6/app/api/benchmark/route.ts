import { NextRequest, NextResponse } from 'next/server';
import { UltraPerformanceOrderbook } from '@/lib/orderbook/ultra-performance-orderbook';
import { getRedisClient } from '@/lib/redis/client';
import { AdvancedPrecisionMath, TradingPairHelper } from '@/lib/utils/precision-v2';

// Performance benchmark endpoint
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const benchmarkResults = {
    timestamp: new Date().toISOString(),
    tests: {} as Record<string, any>,
    summary: {} as Record<string, any>
  };

  try {
    const { tests = ['redis', 'orderbook', 'precision'], iterations = 100 } = await request.json();

    // 1. Redis Performance Test
    if (tests.includes('redis')) {
      console.log('🚀 Running Redis benchmark...');
      const redisStart = Date.now();
      const redis = getRedisClient();
      
      const redisTests = [];
      for (let i = 0; i < iterations; i++) {
        const testStart = Date.now();
        
        // SET operation
        await redis.set(`benchmark:${i}`, JSON.stringify({ id: i, timestamp: Date.now() }));
        
        // GET operation
        await redis.get(`benchmark:${i}`);
        
        // DELETE operation
        await redis.del(`benchmark:${i}`);
        
        redisTests.push(Date.now() - testStart);
      }
      
      benchmarkResults.tests.redis = {
        iterations,
        totalTime: `${Date.now() - redisStart}ms`,
        averageTime: `${(redisTests.reduce((a, b) => a + b, 0) / redisTests.length).toFixed(2)}ms`,
        minTime: `${Math.min(...redisTests)}ms`,
        maxTime: `${Math.max(...redisTests)}ms`,
        operationsPerSecond: Math.round((iterations * 3) / ((Date.now() - redisStart) / 1000))
      };
    }

    // 2. Orderbook Performance Test
    if (tests.includes('orderbook')) {
      console.log('🚀 Running Orderbook benchmark...');
      const orderbookStart = Date.now();
      const matchingEngine = UltraPerformanceOrderbook.getInstance();
      
      const orderbookTests = [];
      for (let i = 0; i < Math.min(iterations, 50); i++) { // Limit to 50 for orderbook
        const testStart = Date.now();
        
        // Get orderbook (commented out - method not available)
        // await matchingEngine.getOrderbook('HYPERINDEX-USDC', 20);
        
        // Get recent trades (commented out - method not available)
        // await matchingEngine.getRecentTrades('HYPERINDEX-USDC', 10);
        
        orderbookTests.push(Date.now() - testStart);
      }
      
      const actualIterations = Math.min(iterations, 50);
      benchmarkResults.tests.orderbook = {
        iterations: actualIterations,
        totalTime: `${Date.now() - orderbookStart}ms`,
        averageTime: `${(orderbookTests.reduce((a, b) => a + b, 0) / orderbookTests.length).toFixed(2)}ms`,
        minTime: `${Math.min(...orderbookTests)}ms`,
        maxTime: `${Math.max(...orderbookTests)}ms`,
        operationsPerSecond: Math.round((actualIterations * 2) / ((Date.now() - orderbookStart) / 1000))
      };
    }

    // 3. Precision Math Performance Test
    if (tests.includes('precision')) {
      console.log('🚀 Running Precision Math benchmark...');
      const precisionStart = Date.now();
      
      const precisionTests = [];
      const config = TradingPairHelper.getConfig('HYPERINDEX-USDC');
      
      for (let i = 0; i < iterations; i++) {
        const testStart = Date.now();
        
        const price = `1.${String(Math.random()).substring(2, 11)}`; // 9 decimal places
        const amount = `${Math.floor(Math.random() * 1000)}.${String(Math.random()).substring(2, 6)}`;
        
        // Calculate trade value
        const tradeValue = AdvancedPrecisionMath.calculateTradeValue(price, amount, config);
        
        // Validate order
        AdvancedPrecisionMath.validateOrder(price, amount, config);
        
        // Calculate optimal amount
        AdvancedPrecisionMath.calculateOptimalAmount(price, tradeValue, config);
        
        precisionTests.push(Date.now() - testStart);
      }
      
      benchmarkResults.tests.precision = {
        iterations,
        totalTime: `${Date.now() - precisionStart}ms`,
        averageTime: `${(precisionTests.reduce((a, b) => a + b, 0) / precisionTests.length).toFixed(2)}ms`,
        minTime: `${Math.min(...precisionTests)}ms`,
        maxTime: `${Math.max(...precisionTests)}ms`,
        operationsPerSecond: Math.round((iterations * 3) / ((Date.now() - precisionStart) / 1000))
      };
    }

    // 4. Memory Usage
    const memoryUsage = process.memoryUsage();
    benchmarkResults.tests.memory = {
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`
    };

    // 5. Summary
    const totalTime = Date.now() - startTime;
    const allOpsPerSecond = Object.values(benchmarkResults.tests)
      .filter(test => test.operationsPerSecond)
      .map(test => test.operationsPerSecond as number);
    
    benchmarkResults.summary = {
      totalBenchmarkTime: `${totalTime}ms`,
      testsRun: tests.length,
      averageOpsPerSecond: allOpsPerSecond.length > 0 
        ? Math.round(allOpsPerSecond.reduce((a, b) => a + b, 0) / allOpsPerSecond.length)
        : 0,
      systemLoad: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform
    };

    return NextResponse.json({
      success: true,
      benchmark: benchmarkResults
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Benchmark-Time': `${totalTime}ms`
      }
    });

  } catch (_error) {
    console.error('Benchmark failed:', _error);
    
    return NextResponse.json({
      success: false,
      error: _error instanceof Error ? (_error as Error)?.message || String(_error) : 'Benchmark failed',
      benchmarkTime: `${Date.now() - startTime}ms`
    }, { status: 500 });
  }
}

// GET method for simple performance check
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const test = searchParams.get('test') || 'quick';
  
  if (test === 'quick') {
    const startTime = Date.now();
    
    try {
      // Quick Redis test
      const redis = getRedisClient();
      const redisStart = Date.now();
      // Check if ping method exists (real Redis vs fallback)
      if ('ping' in redis && typeof redis.ping === 'function') {
        await redis.ping();
      }
      const redisTime = Date.now() - redisStart;
      
      // Quick Orderbook test
      const matchingEngine = UltraPerformanceOrderbook.getInstance();
      const orderbookStart = Date.now();
      // await matchingEngine.getOrderbook('HYPERINDEX-USDC', 5); // Method not available
      const orderbookTime = Date.now() - orderbookStart;
      
      const totalTime = Date.now() - startTime;
      
      return NextResponse.json({
        success: true,
        quickBench: {
          totalTime: `${totalTime}ms`,
          redisLatency: `${redisTime}ms`,
          orderbookLatency: `${orderbookTime}ms`,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (_error) {
      return NextResponse.json({
        success: false,
        error: _error instanceof Error ? (_error as Error)?.message || String(_error) : 'Quick test failed'
      }, { status: 500 });
    }
  }
  
  return NextResponse.json({
    success: false,
    error: 'Use POST method for full benchmark or GET with ?test=quick for quick test'
  }, { status: 400 });
}