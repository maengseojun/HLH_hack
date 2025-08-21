// lib/utils/performance-simulator.ts
/**
 * 🚀 고성능 주문 시뮬레이터 유틸리티
 * 
 * 기능:
 * - 워커 풀을 이용한 병렬 처리
 * - 메모리 효율적인 배치 처리
 * - 실시간 성능 모니터링
 * - 적응적 배치 크기 조정
 */

import { EventEmitter } from 'events';

export interface OrderTemplate {
  pair: string;
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: string;
  price?: string;
}

export interface SimulationMetrics {
  timestamp: number;
  completedOrders: number;
  successfulOrders: number;
  failedOrders: number;
  currentTPS: number;
  averageResponseTime: number;
  memoryUsage: number;
  errors: Record<string, number>;
}

export interface WorkerResult {
  orderId: string;
  success: boolean;
  responseTime: number;
  error?: string;
  timestamp: number;
}

export class PerformanceSimulator extends EventEmitter {
  private activeWorkers: Set<Worker> = new Set();
  private completedOrders = 0;
  private successfulOrders = 0;
  private failedOrders = 0;
  private startTime = 0;
  private responseTimes: number[] = [];
  private errors: Record<string, number> = {};
  private isRunning = false;

  // 적응적 배치 크기 조정
  private currentBatchSize: number;
  private targetTPS: number;
  private lastTPSCheck = 0;
  private lastCompletedCount = 0;

  constructor(initialBatchSize = 50, targetTPS = 900) {
    super();
    this.currentBatchSize = initialBatchSize;
    this.targetTPS = targetTPS;
  }

  /**
   * 시뮬레이션 시작
   */
  async startSimulation(
    totalOrders: number,
    orderGenerator: () => OrderTemplate,
    apiEndpoint: string
  ): Promise<void> {
    if (this.isRunning) {
      throw new Error('Simulation is already running');
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.resetCounters();

    this.emit('started', { totalOrders, targetTPS: this.targetTPS });

    try {
      await this.executeOrdersInBatches(totalOrders, orderGenerator, apiEndpoint);
    } finally {
      this.isRunning = false;
      this.cleanupWorkers();
      this.emit('completed', this.getFinalStats());
    }
  }

  /**
   * 배치 단위로 주문 실행
   */
  private async executeOrdersInBatches(
    totalOrders: number,
    orderGenerator: () => OrderTemplate,
    apiEndpoint: string
  ): Promise<void> {
    const totalBatches = Math.ceil(totalOrders / this.currentBatchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStartTime = Date.now();
      const remainingOrders = totalOrders - (batchIndex * this.currentBatchSize);
      const batchSize = Math.min(this.currentBatchSize, remainingOrders);

      // 배치 생성 및 실행
      const batch = this.generateOrderBatch(batchSize, orderGenerator);
      const results = await this.executeBatch(batch, apiEndpoint);

      // 결과 처리
      this.processBatchResults(results);

      // 진행 상황 이벤트 발송
      this.emit('progress', {
        batchIndex: batchIndex + 1,
        totalBatches,
        completedOrders: this.completedOrders,
        totalOrders,
        currentMetrics: this.getCurrentMetrics()
      });

      // TPS 기반 적응적 배치 크기 조정
      this.adjustBatchSize();

      // 배치 간 지연 계산 및 적용
      const batchDuration = Date.now() - batchStartTime;
      await this.applyBatchDelay(batchDuration);

      // 중단 요청 확인
      if (!this.isRunning) {
        break;
      }
    }
  }

  /**
   * 주문 배치 생성
   */
  private generateOrderBatch(batchSize: number, orderGenerator: () => OrderTemplate): OrderTemplate[] {
    const batch: OrderTemplate[] = [];
    for (let i = 0; i < batchSize; i++) {
      batch.push(orderGenerator());
    }
    return batch;
  }

  /**
   * 배치 실행 (병렬 처리)
   */
  private async executeBatch(batch: OrderTemplate[], apiEndpoint: string): Promise<WorkerResult[]> {
    const promises = batch.map((order, index) => 
      this.executeOrderWithWorker(order, apiEndpoint, index)
    );

    const results = await Promise.allSettled(promises);
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          orderId: `failed-${Date.now()}-${index}`,
          success: false,
          responseTime: 0,
          error: result.reason?.message || 'Unknown error',
          timestamp: Date.now()
        };
      }
    });
  }

  /**
   * 워커를 사용한 개별 주문 실행
   */
  private async executeOrderWithWorker(
    order: OrderTemplate, 
    apiEndpoint: string, 
    orderIndex: number
  ): Promise<WorkerResult> {
    const startTime = Date.now();

    try {
      // 실제 API 호출 (워커 대신 직접 호출 - 브라우저 환경)
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dev-token'
        },
        body: JSON.stringify(order)
      });

      const responseTime = Date.now() - startTime;
      const result = await response.json();

      return {
        orderId: `order-${orderIndex}-${startTime}`,
        success: response.ok && result.success,
        responseTime,
        error: result.success ? undefined : (result.error || 'API error'),
        timestamp: Date.now()
      };

    } catch (_error) {
      return {
        orderId: `order-${orderIndex}-${startTime}`,
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Network error',
        timestamp: Date.now()
      };
    }
  }

  /**
   * 배치 결과 처리
   */
  private processBatchResults(results: WorkerResult[]): void {
    for (const result of results) {
      this.completedOrders++;

      if (result.success) {
        this.successfulOrders++;
        this.responseTimes.push(result.responseTime);
        
        // 응답 시간 배열 크기 제한 (메모리 효율성)
        if (this.responseTimes.length > 10000) {
          this.responseTimes = this.responseTimes.slice(-5000);
        }
      } else {
        this.failedOrders++;
        const errorType = result.error || 'Unknown error';
        this.errors[errorType] = (this.errors[errorType] || 0) + 1;
      }
    }
  }

  /**
   * TPS 기반 적응적 배치 크기 조정
   */
  private adjustBatchSize(): void {
    const now = Date.now();
    
    // 1초마다 TPS 체크
    if (now - this.lastTPSCheck >= 1000) {
      const currentTPS = this.getCurrentTPS();
      const tpsRatio = currentTPS / this.targetTPS;

      if (tpsRatio < 0.8) {
        // TPS가 목표의 80% 미만이면 배치 크기 증가
        this.currentBatchSize = Math.min(200, Math.floor(this.currentBatchSize * 1.2));
      } else if (tpsRatio > 1.2) {
        // TPS가 목표의 120% 초과면 배치 크기 감소
        this.currentBatchSize = Math.max(10, Math.floor(this.currentBatchSize * 0.8));
      }

      this.lastTPSCheck = now;
      this.lastCompletedCount = this.completedOrders;

      this.emit('batchSizeAdjusted', {
        newBatchSize: this.currentBatchSize,
        currentTPS,
        targetTPS: this.targetTPS
      });
    }
  }

  /**
   * 배치 간 지연 적용
   */
  private async applyBatchDelay(batchDuration: number): Promise<void> {
    const targetBatchDuration = (this.currentBatchSize / this.targetTPS) * 1000;
    const remainingDelay = Math.max(0, targetBatchDuration - batchDuration);
    
    if (remainingDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingDelay));
    }
  }

  /**
   * 현재 TPS 계산
   */
  private getCurrentTPS(): number {
    const elapsed = (Date.now() - this.startTime) / 1000;
    return elapsed > 0 ? this.completedOrders / elapsed : 0;
  }

  /**
   * 현재 메트릭 조회
   */
  private getCurrentMetrics(): SimulationMetrics {
    const averageResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
      : 0;

    return {
      timestamp: Date.now(),
      completedOrders: this.completedOrders,
      successfulOrders: this.successfulOrders,
      failedOrders: this.failedOrders,
      currentTPS: this.getCurrentTPS(),
      averageResponseTime,
      memoryUsage: this.getMemoryUsage(),
      errors: { ...this.errors }
    };
  }

  /**
   * 최종 통계 조회
   */
  private getFinalStats() {
    const duration = (Date.now() - this.startTime) / 1000;
    const finalTPS = duration > 0 ? this.completedOrders / duration : 0;
    
    return {
      ...this.getCurrentMetrics(),
      duration,
      finalTPS,
      successRate: this.completedOrders > 0 ? (this.successfulOrders / this.completedOrders) : 0
    };
  }

  /**
   * 메모리 사용량 조회 (근사치)
   */
  private getMemoryUsage(): number {
    // 브라우저 환경에서는 정확한 메모리 사용량을 얻기 어려움
    // 대략적인 추정치 반환
    return this.responseTimes.length * 8 + // 8 bytes per number
           Object.keys(this.errors).length * 50 + // ~50 bytes per error entry
           this.activeWorkers.size * 1000; // ~1KB per worker estimate
  }

  /**
   * 카운터 초기화
   */
  private resetCounters(): void {
    this.completedOrders = 0;
    this.successfulOrders = 0;
    this.failedOrders = 0;
    this.responseTimes = [];
    this.errors = {};
    this.lastTPSCheck = 0;
    this.lastCompletedCount = 0;
  }

  /**
   * 워커 정리
   */
  private cleanupWorkers(): void {
    for (const worker of this.activeWorkers) {
      worker.terminate();
    }
    this.activeWorkers.clear();
  }

  /**
   * 시뮬레이션 중단
   */
  stop(): void {
    this.isRunning = false;
    this.emit('stopped');
  }

  /**
   * 현재 상태 조회
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentBatchSize: this.currentBatchSize,
      targetTPS: this.targetTPS,
      metrics: this.getCurrentMetrics()
    };
  }
}