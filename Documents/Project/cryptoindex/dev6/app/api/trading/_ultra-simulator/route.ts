// app/api/trading/ultra-simulator/route.ts
/**
 * 🚀 Ultra-High Performance Trading Simulator
 * 목표: 15,000+ TPS
 * 
 * 최적화된 구조:
 * 1. Ultra-Fast Router 사용
 * 2. High-Performance Orderbook 활용  
 * 3. 배치 처리 최적화
 * 4. 실시간 성능 모니터링
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractPrivyAuthFromRequest } from '@/lib/middleware/privy-auth';
import { UltraFastRouter } from '@/lib/trading/ultra-fast-router';

interface UltraSimulationConfig {
  totalOrders: number;
  ordersPerSecond: number;
  batchSize: number;
  orderTypes: {
    market: number;
    limit: number;
  };
  sides: {
    buy: number;
    sell: number;
  };
  amountRange: {
    min: number;
    max: number;
  };
  priceRange: {
    min: number;
    max: number;
  };
  useUltraRouter: boolean;
  patternMode?: 'uniform' | 'realistic' | 'burst';
  burstIntensity?: number;
}

interface UltraSimulationStats {
  totalOrders: number;
  completedOrders: number;
  successfulOrders: number;
  failedOrders: number;
  totalTrades: number;
  averageResponseTime: number;
  actualTPS: number;
  peakTPS: number;
  startTime: number;
  endTime?: number;
  errors: Record<string, number>;
  routingStats: {
    orderbookRoutes: number;
    ammRoutes: number;
    hybridRoutes: number;
  };
}

/**
 * POST /api/trading/ultra-simulator - 초고성능 시뮬레이션
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await extractPrivyAuthFromRequest(request);
    if (!authResult.authenticated) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const config: UltraSimulationConfig = await request.json();
    
    // 설정 검증
    if (!validateUltraConfig(config)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid ultra simulation configuration'
      }, { status: 400 });
    }

    console.log('🚀 Starting ULTRA simulation:', {
      totalOrders: config.totalOrders,
      targetTPS: config.ordersPerSecond,
      batchSize: config.batchSize,
      useUltraRouter: config.useUltraRouter
    });

    // Ultra 시뮬레이션 실행
    const results = await runUltraSimulation(config, authResult.user?.id || 'ultra-user');
    
    return NextResponse.json({
      success: true,
      simulationId: `ultra-sim-${Date.now()}`,
      results: results,
      message: '🚀 Ultra-high performance simulation completed!'
    });

  } catch (_error) {
    console.error('❌ Ultra simulation error:', _error);
    return NextResponse.json({
      success: false,
      error: 'Ultra simulation failed'
    }, { status: 500 });
  }
}

/**
 * Ultra 설정 검증
 */
function validateUltraConfig(config: UltraSimulationConfig): boolean {
  if (!config.totalOrders || config.totalOrders <= 0) return false;
  if (!config.ordersPerSecond || config.ordersPerSecond <= 0) return false;
  if (!config.batchSize || config.batchSize <= 0) return false;
  if (config.orderTypes.market + config.orderTypes.limit !== 1) return false;
  if (config.sides.buy + config.sides.sell !== 1) return false;
  return true;
}

/**
 * 🚀 Ultra 시뮬레이션 실행
 */
async function runUltraSimulation(config: UltraSimulationConfig, userId: string): Promise<UltraSimulationStats> {
  const stats: UltraSimulationStats = {
    totalOrders: config.totalOrders,
    completedOrders: 0,
    successfulOrders: 0,
    failedOrders: 0,
    totalTrades: 0,
    averageResponseTime: 0,
    actualTPS: 0,
    peakTPS: 0,
    startTime: Date.now(),
    errors: {},
    routingStats: {
      orderbookRoutes: 0,
      ammRoutes: 0,
      hybridRoutes: 0
    }
  };

  // Ultra-Fast Router 초기화
  const ultraRouter = UltraFastRouter.getInstance();
  
  console.log(`📊 Ultra simulation parameters:`, {
    totalOrders: config.totalOrders,
    targetTPS: config.ordersPerSecond,
    estimatedDuration: `${(config.totalOrders / config.ordersPerSecond).toFixed(2)}s`,
    batchSize: config.batchSize
  });

  // 🔥 배치 단위로 초고속 처리
  const ULTRA_BATCH_SIZE = Math.min(config.batchSize * 4, 500); // 최대 500개씩 배치
  const totalBatches = Math.ceil(config.totalOrders / ULTRA_BATCH_SIZE);
  
  let orderIndex = 0;
  const allResponseTimes: number[] = [];
  
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStartTime = Date.now();
    const currentBatchSize = Math.min(ULTRA_BATCH_SIZE, config.totalOrders - orderIndex);
    
    // 배치용 주문들 생성
    const batchOrders = [];
    for (let i = 0; i < currentBatchSize; i++) {
      const order = generateUltraOrder(config, userId, orderIndex++);
      batchOrders.push(order);
    }
    
    console.log(`🚀 Processing ultra-batch ${batchIndex + 1}/${totalBatches}: ${currentBatchSize} orders`);
    
    try {
      // 🔥 Ultra-Fast Router로 배치 처리
      const batchResult = await ultraRouter.processBatchOrdersUltra(batchOrders);
      
      // 통계 업데이트
      stats.completedOrders += batchResult.batchStats.totalOrders;
      stats.successfulOrders += batchResult.batchStats.successfulOrders;
      stats.failedOrders += batchResult.batchStats.failedOrders;
      
      // 거래 수 집계
      const batchTrades = batchResult.results.reduce((sum, result) => 
        sum + result.fills.length, 0
      );
      stats.totalTrades += batchTrades;
      
      // 라우팅 통계 업데이트
      batchResult.results.forEach(result => {
        const orderbookFills = result.executionStats.orderbookFills;
        const ammFills = result.executionStats.ammFills;
        
        if (orderbookFills > 0 && ammFills > 0) {
          stats.routingStats.hybridRoutes++;
        } else if (orderbookFills > 0) {
          stats.routingStats.orderbookRoutes++;
        } else if (ammFills > 0) {
          stats.routingStats.ammRoutes++;
        }
      });
      
      // 응답 시간 기록
      const batchLatency = batchResult.batchStats.totalLatency;
      allResponseTimes.push(batchLatency);
      
      // 실시간 TPS 업데이트
      const currentTPS = batchResult.batchStats.averageTPS;
      stats.peakTPS = Math.max(stats.peakTPS, currentTPS);
      
      console.log(`✅ Ultra-batch ${batchIndex + 1} completed:`, {
        successful: batchResult.batchStats.successfulOrders,
        failed: batchResult.batchStats.failedOrders,
        trades: batchTrades,
        tps: currentTPS.toFixed(1),
        latency: `${batchLatency}ms`
      });
      
    } catch (_error) {
      console.error(`❌ Ultra-batch ${batchIndex + 1} failed:`, _error);
      
      // 에러 통계 업데이트
      const errorType = error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error';
      stats.errors[errorType] = (stats.errors[errorType] || 0) + currentBatchSize;
      stats.failedOrders += currentBatchSize;
      stats.completedOrders += currentBatchSize;
    }
    
    // 진행 상황 로그
    const progressTPS = stats.completedOrders / ((Date.now() - stats.startTime) / 1000);
    console.log(`📈 Ultra progress: ${stats.completedOrders}/${config.totalOrders} orders (${progressTPS.toFixed(1)} TPS)`);
    
    // 배치 간 최소 간격 (시스템 부하 방지)
    const batchDuration = Date.now() - batchStartTime;
    const minBatchInterval = (ULTRA_BATCH_SIZE / config.ordersPerSecond) * 1000;
    const remainingDelay = Math.max(0, minBatchInterval - batchDuration);
    
    if (remainingDelay > 0 && batchIndex < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, remainingDelay));
    }
  }

  // 최종 통계 계산
  stats.endTime = Date.now();
  stats.averageResponseTime = allResponseTimes.length > 0 
    ? allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length 
    : 0;
  stats.actualTPS = stats.completedOrders / ((stats.endTime - stats.startTime) / 1000);

  console.log('🎉 ULTRA simulation completed:', {
    duration: `${((stats.endTime - stats.startTime) / 1000).toFixed(2)}s`,
    actualTPS: stats.actualTPS.toFixed(1),
    peakTPS: stats.peakTPS.toFixed(1),
    successRate: `${((stats.successfulOrders / stats.totalOrders) * 100).toFixed(1)}%`,
    totalTrades: stats.totalTrades,
    avgResponseTime: `${stats.averageResponseTime.toFixed(2)}ms`,
    routingBreakdown: stats.routingStats
  });

  return stats;
}

/**
 * Ultra 주문 생성
 */
function generateUltraOrder(config: UltraSimulationConfig, userId: string, orderIndex: number) {
  const isMarketOrder = Math.random() < config.orderTypes.market;
  const isBuyOrder = Math.random() < config.sides.buy;
  
  const amount = (Math.random() * (config.amountRange.max - config.amountRange.min) + config.amountRange.min).toFixed(2);
  const price = isMarketOrder ? '0' : (Math.random() * (config.priceRange.max - config.priceRange.min) + config.priceRange.min).toFixed(4);

  // 고성능을 위한 간소화된 ID 생성
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(7);

  return {
    id: `ultra-${orderIndex}-${timestamp}-${randomSuffix}`,
    userId,
    pair: 'HYPERINDEX-USDC',
    type: isMarketOrder ? 'market' : 'limit',
    side: isBuyOrder ? 'buy' : 'sell',
    amount,
    price,
    timestamp: timestamp + (Math.random() * 0.1) // 미세한 타이밍 차이
  };
}

/**
 * GET /api/trading/ultra-simulator - Ultra 기본 설정
 */
export async function GET() {
  const defaultConfig: UltraSimulationConfig = {
    totalOrders: 5000, // Ultra 기본값 증가
    ordersPerSecond: 2000, // 2K TPS 목표
    batchSize: 100,
    orderTypes: {
      market: 0.8, // 시장가 비율 증가
      limit: 0.2
    },
    sides: {
      buy: 0.5,
      sell: 0.5
    },
    amountRange: {
      min: 1,
      max: 500 // 적당한 크기
    },
    priceRange: {
      min: 0.8,
      max: 1.2
    },
    useUltraRouter: true,
    patternMode: 'burst',
    burstIntensity: 8
  };

  return NextResponse.json({
    success: true,
    defaultConfig,
    description: 'Ultra-high performance trading simulator (15K+ TPS target)',
    features: [
      '🚀 Ultra-Fast Router with Lua Scripts',
      '⚡ High-Performance Orderbook',
      '🔄 Batch Processing Optimization', 
      '📊 Real-time Performance Monitoring',
      '💾 Async Database Operations'
    ],
    endpoints: {
      start: 'POST /api/trading/ultra-simulator',
      config: 'GET /api/trading/ultra-simulator'
    }
  });
}