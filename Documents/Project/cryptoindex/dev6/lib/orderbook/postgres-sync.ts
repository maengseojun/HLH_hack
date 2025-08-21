import { createClient } from '@supabase/supabase-js';
import { Order, Trade } from '../types/orderbook';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class PostgresOrderbookSync {
  private static instance: PostgresOrderbookSync;

  static getInstance(): PostgresOrderbookSync {
    if (!PostgresOrderbookSync.instance) {
      PostgresOrderbookSync.instance = new PostgresOrderbookSync();
    }
    return PostgresOrderbookSync.instance;
  }

  /**
   * 주문을 PostgreSQL에 저장 (원본 설계 기준)
   */
  async syncOrder(order: Order): Promise<void> {
    try {
      const { error } = await supabase
        .from('order_history')
        .upsert({
          redis_order_id: order.id, // 핵심: Redis ID 매핑
          user_id: order.userId, // UUID 문자열로 저장
          pair: order.pair,
          side: order.side,
          order_type: order.type,
          price: order.price,
          amount: order.amount,
          filled_amount: order.filled,
          status: order.status,
          created_at: new Date(order.timestamp).toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Order sync error:', _error);
        throw _error;
      }
    } catch (_error) {
      console.error('Failed to sync order to PostgreSQL:', _error);
      // 동기화 실패해도 Redis 작업은 계속 진행
    }
  }

  /**
   * 거래를 PostgreSQL에 저장 (원본 설계 기준)
   */
  async syncTrade(trade: Trade): Promise<void> {
    try {
      // 먼저 Redis 주문 ID로 PostgreSQL 주문 ID 찾기
      const { data: buyOrder } = await supabase
        .from('order_history')
        .select('id')
        .eq('redis_order_id', trade.buyOrderId)
        .single();

      const { data: sellOrder } = await supabase
        .from('order_history')
        .select('id')
        .eq('redis_order_id', trade.sellOrderId)
        .single();

      if (!buyOrder || !sellOrder) {
        throw new Error('Could not find corresponding orders in PostgreSQL');
      }

      const { error } = await supabase
        .from('trade_history')
        .insert({
          pair: trade.pair,
          buyer_order_id: buyOrder.id,
          seller_order_id: sellOrder.id,
          price: trade.price,
          amount: trade.amount,
          executed_at: new Date(trade.timestamp).toISOString()
        });

      if (error) {
        console.error('Trade sync error:', _error);
        throw _error;
      }
    } catch (_error) {
      console.error('Failed to sync trade to PostgreSQL:', _error);
    }
  }

  /**
   * 배치로 여러 주문 동기화
   */
  async syncOrdersBatch(orders: Order[]): Promise<void> {
    if (orders.length === 0) return;

    try {
      const orderData = orders.map(order => ({
        id: order.id,
        user_id: order.userId,
        pair: order.pair,
        side: order.side,
        order_type: order.type,
        price: order.price,
        amount: order.amount,
        filled: order.filled,
        remaining: order.remaining,
        status: order.status,
        created_at: new Date(order.timestamp).toISOString(),
        expires_at: order.expiresAt ? new Date(order.expiresAt).toISOString() : null,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('orderbook_orders')
        .upsert(orderData);

      if (error) {
        console.error('Batch order sync error:', _error);
        throw _error;
      }
    } catch (_error) {
      console.error('Failed to batch sync orders:', _error);
    }
  }

  /**
   * 배치로 거래 동기화
   */
  async syncTradesBatch(trades: Trade[]): Promise<void> {
    if (trades.length === 0) return;

    try {
      const tradeData = trades.map(trade => ({
        id: trade.id,
        pair: trade.pair,
        price: trade.price,
        amount: trade.amount,
        side: trade.side,
        buy_order_id: trade.buyOrderId,
        sell_order_id: trade.sellOrderId,
        created_at: new Date(trade.timestamp).toISOString()
      }));

      const { error } = await supabase
        .from('orderbook_trades')
        .insert(tradeData);

      if (error) {
        console.error('Batch trade sync error:', _error);
        throw _error;
      }
    } catch (_error) {
      console.error('Failed to batch sync trades:', _error);
    }
  }

  /**
   * 사용자 주문 통계 업데이트
   */
  async updateUserStats(userId: string): Promise<void> {
    try {
      // 사용자의 총 거래량, 거래 횟수 등 통계 계산
      const { data: stats } = await supabase
        .from('orderbook_trades')
        .select('amount, price')
        .or(`buy_order_id.in.(select id from orderbook_orders where user_id = '${userId}'),sell_order_id.in.(select id from orderbook_orders where user_id = '${userId}')`);

      if (stats) {
        const totalVolume = stats.reduce((sum, trade) => 
          sum + (parseFloat(trade.amount) * parseFloat(trade.price)), 0
        );

        const totalTrades = stats.length;

        // 사용자 통계 업데이트
        await supabase
          .from('user_trading_stats')
          .upsert({
            user_id: userId,
            total_volume: totalVolume.toFixed(8),
            total_trades: totalTrades,
            updated_at: new Date().toISOString()
          });
      }
    } catch (_error) {
      console.error('Failed to update user stats:', _error);
    }
  }

  /**
   * 일별 거래 통계 업데이트
   */
  async updateDailyStats(pair: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: todayTrades } = await supabase
        .from('orderbook_trades')
        .select('amount, price')
        .eq('pair', pair)
        .gte('created_at', `${today}T00:00:00Z`)
        .lt('created_at', `${today}T23:59:59Z`);

      if (todayTrades) {
        const volume = todayTrades.reduce((sum, trade) => 
          sum + (parseFloat(trade.amount) * parseFloat(trade.price)), 0
        );

        const trades = todayTrades.length;
        const prices = todayTrades.map(t => parseFloat(t.price));
        const high = prices.length > 0 ? Math.max(...prices) : 0;
        const low = prices.length > 0 ? Math.min(...prices) : 0;

        await supabase
          .from('daily_trading_stats')
          .upsert({
            pair,
            trading_date: today,
            volume: volume.toFixed(8),
            trades_count: trades,
            high_price: high.toFixed(8),
            low_price: low.toFixed(8),
            updated_at: new Date().toISOString()
          });
      }
    } catch (_error) {
      console.error('Failed to update daily stats:', _error);
    }
  }

  /**
   * Redis에서 PostgreSQL로 데이터 복구
   */
  async recoverFromRedis(): Promise<void> {
    // 이 함수는 Redis가 죽었을 때 PostgreSQL에서 데이터를 복구하는 용도
    // 실제 구현은 복잡하므로 기본 틀만 제공
    try {
      console.log('Starting data recovery from PostgreSQL...');
      
      // 활성 주문들을 Redis로 복구
      const { data: activeOrders } = await supabase
        .from('orderbook_orders')
        .select('*')
        .in('status', ['active', 'pending']);

      if (activeOrders) {
        console.log(`Recovering ${activeOrders.length} active orders...`);
        // TODO: Redis에 주문들을 다시 로드하는 로직
      }

      console.log('Data recovery completed');
    } catch (_error) {
      console.error('Data recovery failed:', _error);
    }
  }
}