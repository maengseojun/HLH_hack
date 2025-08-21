// lib/utils/async-db-writer.ts
/**
 * 🚀 비동기 DB 배치 라이터
 * 실제 거래소처럼 주문 처리와 DB 저장을 분리
 * 백그라운드에서 배치로 DB에 저장하여 성능 최적화
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PendingOrderRecord {
  user_id: string;
  pair: string;
  side: string;
  order_type: string;
  price: number | null;
  amount: number;
  filled_amount: number;
  status: string;
  redis_order_id: string;
  created_at?: Date;
}

interface PendingTradeRecord {
  id: string;
  pair: string;
  buyer_order_id: string | null;
  seller_order_id: string | null;
  price: number;
  amount: number;
  side: string;
  source: string;
  buyer_fee?: number;
  seller_fee?: number;
  price_impact?: number | null;
  amm_reserves_before?: any;
  amm_reserves_after?: any;
  redis_trade_id?: string | null;
  executed_at?: Date;
}

export class AsyncDBWriter {
  private static instance: AsyncDBWriter;
  private orderQueue: PendingOrderRecord[] = [];
  private tradeQueue: PendingTradeRecord[] = [];
  private isProcessing = false;
  private batchSize = 100; // 배치 크기
  private flushInterval = 1000; // 1초마다 플러시
  private maxQueueSize = 10000; // 최대 큐 크기

  private constructor() {
    // 주기적으로 배치 처리
    setInterval(() => {
      this.flushBatches();
    }, this.flushInterval);
  }

  static getInstance(): AsyncDBWriter {
    if (!AsyncDBWriter.instance) {
      AsyncDBWriter.instance = new AsyncDBWriter();
    }
    return AsyncDBWriter.instance;
  }

  /**
   * 주문 이력을 큐에 추가 (즉시 반환)
   */
  queueOrderHistory(orderData: PendingOrderRecord): void {
    if (this.orderQueue.length >= this.maxQueueSize) {
      console.warn('⚠️ Order queue full, forcing flush');
      this.flushBatches();
    }
    
    this.orderQueue.push({
      ...orderData,
      created_at: new Date()
    });
    
    console.log(`📝 Queued order: ${orderData.redis_order_id} (Queue: ${this.orderQueue.length})`);
  }

  /**
   * 거래 이력을 큐에 추가 (즉시 반환)
   */
  queueTradeHistory(tradeData: PendingTradeRecord): void {
    if (this.tradeQueue.length >= this.maxQueueSize) {
      console.warn('⚠️ Trade queue full, forcing flush');
      this.flushBatches();
    }
    
    this.tradeQueue.push({
      ...tradeData,
      executed_at: new Date()
    });
    
    console.log(`📊 Queued trade: ${tradeData.id} (Queue: ${this.tradeQueue.length})`);
  }

  /**
   * 배치 플러시 (백그라운드 처리)
   */
  private async flushBatches(): Promise<void> {
    if (this.isProcessing) return;
    if (this.orderQueue.length === 0 && this.tradeQueue.length === 0) return;

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // 현재 큐 복사 후 초기화
      const ordersToProcess = [...this.orderQueue];
      const tradesToProcess = [...this.tradeQueue];
      this.orderQueue = [];
      this.tradeQueue = [];

      console.log(`🚀 Flushing batches: ${ordersToProcess.length} orders, ${tradesToProcess.length} trades`);

      // 주문 배치 처리
      if (ordersToProcess.length > 0) {
        await this.batchInsertOrders(ordersToProcess);
      }

      // 거래 배치 처리
      if (tradesToProcess.length > 0) {
        await this.batchInsertTrades(tradesToProcess);
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Batch flush completed in ${duration}ms`);

    } catch (_error) {
      console.error('❌ Batch flush error:', _error);
      // 실패한 경우 큐에 다시 추가하지 않음 (성능 우선)
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 주문 배치 삽입
   */
  private async batchInsertOrders(orders: PendingOrderRecord[]): Promise<void> {
    try {
      // PostgreSQL의 배치 insert 사용
      const { error } = await supabase
        .from('order_history')
        .insert(orders);

      if (error) {
        console.error('❌ Batch order insert failed:', error);
        throw error;
      }

      console.log(`✅ Batch inserted ${orders.length} orders`);
    } catch (_error) {
      console.error('❌ Order batch insert error:', _error);
      throw _error;
    }
  }

  /**
   * 거래 배치 삽입
   */
  private async batchInsertTrades(trades: PendingTradeRecord[]): Promise<void> {
    try {
      // PostgreSQL의 배치 insert 사용
      const { error } = await supabase
        .from('trade_history')
        .insert(trades);

      if (error) {
        console.error('❌ Batch trade insert failed:', error);
        throw error;
      }

      console.log(`✅ Batch inserted ${trades.length} trades`);
    } catch (_error) {
      console.error('❌ Trade batch insert error:', _error);
      throw _error;
    }
  }

  /**
   * 강제 플러시 (테스트용)
   */
  async forceFlush(): Promise<void> {
    await this.flushBatches();
  }

  /**
   * 큐 상태 조회
   */
  getQueueStatus() {
    return {
      orderQueue: this.orderQueue.length,
      tradeQueue: this.tradeQueue.length,
      isProcessing: this.isProcessing
    };
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: {
    batchSize?: number;
    flushInterval?: number;
    maxQueueSize?: number;
  }) {
    if (config.batchSize) this.batchSize = config.batchSize;
    if (config.flushInterval) this.flushInterval = config.flushInterval;
    if (config.maxQueueSize) this.maxQueueSize = config.maxQueueSize;
    
    console.log('⚙️ AsyncDBWriter config updated:', {
      batchSize: this.batchSize,
      flushInterval: this.flushInterval,
      maxQueueSize: this.maxQueueSize
    });
  }
}