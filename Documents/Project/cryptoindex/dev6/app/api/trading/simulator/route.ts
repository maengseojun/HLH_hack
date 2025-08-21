// app/api/trading/simulator/route.ts
/**
 * 🚀 대량 주문 시뮬레이터 - 초당 900개+ 주문 성능 테스트
 * 
 * 기능:
 * - 배치 주문 생성 (동시 처리)
 * - 성능 측정 (TPS, 지연시간, 성공률)
 * - 다양한 주문 패턴 (마켓/리밋, 매수/매도)
 * - 실시간 진행 상황 모니터링
 * - 🎯 리얼리스틱 타이밍: 각 주문마다 미묘한 시차 (0.01~0.2ms)
 * - 🎯 스태거링: 배치 내 주문들의 점진적 시작
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractPrivyAuthFromRequest } from '@/lib/middleware/privy-auth';

interface SimulationConfig {
  totalOrders: number;        // 총 주문 수
  ordersPerSecond: number;    // 초당 주문 수 (목표: 900+)
  batchSize: number;          // 배치 크기 (동시 처리할 주문 수)
  orderTypes: {               // 주문 타입 비율
    market: number;           // 마켓 주문 비율 (0-1)
    limit: number;            // 리밋 주문 비율 (0-1)
  };
  sides: {                    // 매수/매도 비율
    buy: number;              // 매수 주문 비율 (0-1)  
    sell: number;             // 매도 주문 비율 (0-1)
  };
  amountRange: {              // 주문 수량 범위
    min: number;
    max: number;
  };
  priceRange: {               // 가격 범위 (리밋 주문용)
    min: number;
    max: number;
  };
  useV2Router: boolean;       // V2 라우터 사용 여부
  patternMode?: 'uniform' | 'realistic' | 'burst'; // 주문 패턴 모드
  burstIntensity?: number;    // 버스트 강도 (1-10)
}

interface SimulationResult {
  orderId: string;
  success: boolean;
  responseTime: number;       // 응답 시간 (ms)
  error?: string;
  orderDetails?: any;
}

interface SimulationStats {
  totalOrders: number;
  completedOrders: number;
  successfulOrders: number;
  failedOrders: number;
  averageResponseTime: number;
  actualTPS: number;
  startTime: number;
  endTime?: number;
  errors: Record<string, number>;
}

/**
 * POST /api/trading/simulator - 대량 주문 시뮬레이션 시작
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인 (개발 환경에서는 자동 통과)
    const authResult = await extractPrivyAuthFromRequest(request);
    if (!authResult.authenticated) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const config: SimulationConfig = await request.json();
    
    // 설정 검증
    if (!validateConfig(config)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid simulation configuration'
      }, { status: 400 });
    }

    console.log('🚀 Starting mass order simulation:', {
      totalOrders: config.totalOrders,
      targetTPS: config.ordersPerSecond,
      batchSize: config.batchSize,
      useV2Router: config.useV2Router
    });

    // 시뮬레이션 실행
    const results = await runSimulation(config, authResult.user?.id || 'test-user');
    
    return NextResponse.json({
      success: true,
      simulationId: `sim-${Date.now()}`,
      results: results
    });

  } catch (_error) {
    console.error('❌ Simulation error:', _error);
    return NextResponse.json({
      success: false,
      error: 'Simulation failed'
    }, { status: 500 });
  }
}

/**
 * 설정 검증
 */
function validateConfig(config: SimulationConfig): boolean {
  if (!config.totalOrders || config.totalOrders <= 0) return false;
  if (!config.ordersPerSecond || config.ordersPerSecond <= 0) return false;
  if (!config.batchSize || config.batchSize <= 0) return false;
  if (config.orderTypes.market + config.orderTypes.limit !== 1) return false;
  if (config.sides.buy + config.sides.sell !== 1) return false;
  return true;
}

/**
 * 🚀 다양한 주문 패턴 생성
 */
function generateOrderPattern(config: SimulationConfig): Array<{
  delay: number;
  burstSize: number;
  intensity: 'low' | 'medium' | 'high';
}> {
  const patternMode = config.patternMode || 'realistic';
  const burstIntensity = config.burstIntensity || 5;
  
  if (patternMode === 'uniform') {
    // 균등 분산 패턴
    return generateUniformPattern(config);
  } else if (patternMode === 'burst') {
    // 집중 버스트 패턴
    return generateBurstPattern(config, burstIntensity);
  } else {
    // 현실적 패턴 (기본)
    return generateRealisticPattern(config, burstIntensity);
  }
}

/**
 * 균등 분산 패턴 (기존 방식)
 */
function generateUniformPattern(config: SimulationConfig): Array<{
  delay: number;
  burstSize: number;
  intensity: 'low' | 'medium' | 'high';
}> {
  const patterns = [];
  const totalBatches = Math.ceil(config.totalOrders / config.batchSize);
  const intervalTime = (1000 / config.ordersPerSecond) * config.batchSize;
  
  for (let i = 0; i < totalBatches; i++) {
    const remainingOrders = config.totalOrders - (i * config.batchSize);
    const batchSize = Math.min(config.batchSize, remainingOrders);
    
    patterns.push({
      delay: i * intervalTime,
      burstSize: batchSize,
      intensity: 'medium' as const
    });
  }
  
  return patterns;
}

/**
 * 집중 버스트 패턴
 */
function generateBurstPattern(config: SimulationConfig, intensity: number): Array<{
  delay: number;
  burstSize: number;
  intensity: 'low' | 'medium' | 'high';
}> {
  const patterns = [];
  let remainingOrders = config.totalOrders;
  let currentTime = 0;
  
  // 강도에 따른 버스트 크기 조정
  const maxBurstSize = Math.floor(config.batchSize * (intensity / 5) * 2); // 2~4x batch size
  
  while (remainingOrders > 0) {
    // 큰 버스트
    const burstSize = Math.min(
      remainingOrders,
      Math.floor(Math.random() * maxBurstSize) + config.batchSize
    );
    
    patterns.push({
      delay: currentTime,
      burstSize,
      intensity: 'high' as const
    });
    
    remainingOrders -= burstSize;
    currentTime += Math.random() * 200 + 50; // 50~250ms 간격
  }
  
  return patterns;
}

/**
 * 현실적 패턴 (실제 거래소와 유사)
 */
function generateRealisticPattern(config: SimulationConfig, intensity: number): Array<{
  delay: number;
  burstSize: number;
  intensity: 'low' | 'medium' | 'high';
}> {
  const patterns = [];
  let remainingOrders = config.totalOrders;
  let currentTime = 0;
  
  // 강도에 따른 패턴 조정
  const intensityMultiplier = intensity / 5; // 0.2 ~ 2.0
  
  while (remainingOrders > 0) {
    // 1. 버스트 구간 (짧은 시간에 많은 주문)
    const burstSize = Math.min(
      remainingOrders, 
      Math.floor(Math.random() * config.batchSize * 2 * intensityMultiplier) + config.batchSize
    );
    const burstDuration = (burstSize / config.ordersPerSecond) * 1000 * 0.4; // 40% 시간에 집중
    
    patterns.push({
      delay: currentTime,
      burstSize,
      intensity: 'high' as const
    });
    
    remainingOrders -= burstSize;
    currentTime += burstDuration;
    
    if (remainingOrders <= 0) break;
    
    // 2. 보통 구간
    const mediumSize = Math.min(
      remainingOrders,
      Math.floor(Math.random() * config.batchSize * intensityMultiplier) + 1
    );
    const mediumDuration = (mediumSize / config.ordersPerSecond) * 1000 * 1.2;
    
    patterns.push({
      delay: currentTime,
      burstSize: mediumSize,
      intensity: 'medium' as const
    });
    
    remainingOrders -= mediumSize;
    currentTime += mediumDuration;
    
    if (remainingOrders <= 0) break;
    
    // 3. 조용한 구간 (적은 주문) - 강도가 높을수록 짧아짐
    const quietSize = Math.min(
      remainingOrders,
      Math.floor(Math.random() * config.batchSize * 0.3) + 1
    );
    const quietDuration = (quietSize / config.ordersPerSecond) * 1000 * (3 - intensityMultiplier); // 강도 반비례
    
    patterns.push({
      delay: currentTime,
      burstSize: quietSize,
      intensity: 'low' as const
    });
    
    remainingOrders -= quietSize;
    currentTime += quietDuration;
  }
  
  return patterns;
}

/**
 * 시뮬레이션 실행 - 현실적 패턴 버전
 */
async function runSimulation(config: SimulationConfig, userId: string): Promise<SimulationStats> {
  const stats: SimulationStats = {
    totalOrders: config.totalOrders,
    completedOrders: 0,
    successfulOrders: 0,
    failedOrders: 0,
    averageResponseTime: 0,
    actualTPS: 0,
    startTime: Date.now(),
    errors: {}
  };

  const results: SimulationResult[] = [];
  
  // 🎯 다양한 주문 패턴 생성
  const orderPatterns = generateOrderPattern(config);
  
  console.log(`📊 ${config.patternMode || 'realistic'} simulation starting:`, {
    patternMode: config.patternMode || 'realistic',
    burstIntensity: config.burstIntensity || 5,
    totalPatterns: orderPatterns.length,
    estimatedDuration: `${(config.totalOrders / config.ordersPerSecond).toFixed(2)}s`,
    patternPreview: orderPatterns.slice(0, 3).map(p => `${p.burstSize} orders (${p.intensity})`)
  });

  let orderIndex = 0;
  
  // 패턴별 주문 실행
  for (const pattern of orderPatterns) {
    console.log(`🎯 Executing pattern: ${pattern.burstSize} orders at ${pattern.intensity} intensity`);
    
    const patternPromises: Promise<SimulationResult>[] = [];
    
    // 패턴 내 주문들을 현실적 타이밍으로 분산
    for (let i = 0; i < pattern.burstSize; i++) {
      const order = generateOrder(config, userId, orderIndex++);
      
      // 현실적 지연 계산
      let microDelay = 0;
      if (pattern.intensity === 'high') {
        // 버스트: 0~2ms 랜덤 지연
        microDelay = Math.random() * 2;
      } else if (pattern.intensity === 'medium') {
        // 보통: 0~10ms 랜덤 지연  
        microDelay = Math.random() * 10;
      } else {
        // 조용: 0~50ms 랜덤 지연
        microDelay = Math.random() * 50;
      }
      
      // 각 주문을 미세하게 다른 시점에 실행
      patternPromises.push(
        new Promise(resolve => 
          setTimeout(() => resolve(executeOrder(order, config.useV2Router)), microDelay)
        )
      );
    }
    
    // 패턴 내 모든 주문 동시 실행
    const patternResults = await Promise.allSettled(patternPromises);
    
    // 결과 수집
    for (const result of patternResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          orderId: `failed-${Date.now()}-${Math.random()}`,
          success: false,
          responseTime: 0,
          error: result.reason?.message || 'Unknown error'
        });
      }
    }
    
    stats.completedOrders += pattern.burstSize;
    
    // 진행 상황 로그
    const currentTPS = stats.completedOrders / ((Date.now() - stats.startTime) / 1000);
    console.log(`📈 Pattern completed: ${stats.completedOrders}/${config.totalOrders} orders (${currentTPS.toFixed(1)} TPS)`);
    
    // 패턴 간 자연스러운 간격 (실제 시장과 유사)
    const patternGap = Math.random() * 100 + 10; // 10~110ms 랜덤 간격
    if (orderIndex < config.totalOrders) {
      await new Promise(resolve => setTimeout(resolve, patternGap));
    }
  }

  // 최종 통계 계산
  stats.endTime = Date.now();
  stats.successfulOrders = results.filter(r => r.success).length;
  stats.failedOrders = results.filter(r => !r.success).length;
  
  const responseTimes = results.filter(r => r.success).map(r => r.responseTime);
  stats.averageResponseTime = responseTimes.length > 0 
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
    : 0;
    
  stats.actualTPS = stats.completedOrders / ((stats.endTime - stats.startTime) / 1000);

  // 에러 분류
  results.filter(r => !r.success).forEach(r => {
    const errorType = r.error || 'Unknown error';
    stats.errors[errorType] = (stats.errors[errorType] || 0) + 1;
  });

  console.log(`🎉 ${config.patternMode || 'realistic'} simulation completed:`, {
    patternMode: config.patternMode || 'realistic',
    burstIntensity: config.burstIntensity || 5,
    duration: `${((stats.endTime - stats.startTime) / 1000).toFixed(2)}s`,
    actualTPS: stats.actualTPS.toFixed(1),
    successRate: `${((stats.successfulOrders / stats.totalOrders) * 100).toFixed(1)}%`,
    avgResponseTime: `${stats.averageResponseTime.toFixed(2)}ms`,
    patterns: orderPatterns.length
  });

  return stats;
}

/**
 * 주문 생성
 */
function generateOrder(config: SimulationConfig, userId: string, orderIndex: number) {
  const isMarketOrder = Math.random() < config.orderTypes.market;
  const isBuyOrder = Math.random() < config.sides.buy;
  
  const amount = (Math.random() * (config.amountRange.max - config.amountRange.min) + config.amountRange.min).toFixed(2);
  const price = isMarketOrder ? undefined : (Math.random() * (config.priceRange.max - config.priceRange.min) + config.priceRange.min).toFixed(4);

  // 🎯 리얼리스틱 타이밍: 각 주문의 생성 시점을 미묘하게 다르게
  const now = Date.now();
  const microTimingOffset = Math.random() * 0.1; // 0~0.1밀리초 오프셋

  return {
    id: `sim-${orderIndex}-${now}-${Math.random().toString(36).substring(7)}`,
    userId,
    pair: 'HYPERINDEX-USDC',
    type: isMarketOrder ? 'market' : 'limit',
    side: isBuyOrder ? 'buy' : 'sell',
    amount,
    price: price || '0',
    timestamp: now + microTimingOffset // 미묘한 타이밍 차이
  };
}

/**
 * 주문 실행
 */
async function executeOrder(order: any, useV2Router: boolean): Promise<SimulationResult> {
  const startTime = Date.now();
  
  try {
    // 🎯 리얼리스틱 타이밍: 각 주문마다 미묘한 지연 (0-0.2ms)
    const randomDelay = Math.random() * 0.2; // 0~0.2밀리초 랜덤 지연
    await new Promise(resolve => setTimeout(resolve, randomDelay));
    
    const apiEndpoint = useV2Router ? '/api/trading/v2/orders' : '/api/trading/v1/orders';
    
    const response = await fetch(`http://localhost:3000${apiEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev-token' // 개발 환경용
      },
      body: JSON.stringify({
        pair: order.pair,
        type: order.type,
        side: order.side,
        amount: order.amount,
        price: order.price
      })
    });

    const responseTime = Date.now() - startTime;
    const result = await response.json();

    if (response.ok && result.success) {
      return {
        orderId: order.id,
        success: true,
        responseTime,
        orderDetails: result.order
      };
    } else {
      return {
        orderId: order.id,
        success: false,
        responseTime,
        error: result.error || 'API error'
      };
    }

  } catch (_error) {
    return {
      orderId: order.id,
      success: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Network error'
    };
  }
}

/**
 * GET /api/trading/simulator - 기본 설정 반환
 */
export async function GET() {
  const defaultConfig: SimulationConfig = {
    totalOrders: 1000,
    ordersPerSecond: 900,
    batchSize: 50,
    orderTypes: {
      market: 0.7,
      limit: 0.3
    },
    sides: {
      buy: 0.5,
      sell: 0.5
    },
    amountRange: {
      min: 1,
      max: 1000
    },
    priceRange: {
      min: 0.5,
      max: 1.5
    },
    useV2Router: true,
    patternMode: 'realistic',
    burstIntensity: 7
  };

  return NextResponse.json({
    success: true,
    defaultConfig,
    description: 'Mass order simulator for performance testing',
    endpoints: {
      start: 'POST /api/trading/simulator',
      config: 'GET /api/trading/simulator'
    }
  });
}