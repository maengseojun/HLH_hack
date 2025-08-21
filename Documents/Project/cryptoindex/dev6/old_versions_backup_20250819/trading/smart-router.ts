// lib/trading/smart-router.ts
/**
 * 하이브리드 스마트 라우터 - HybridTradingSystem_Architecture_0801.md 구현
 * 
 * 핵심 원칙: "유저에게 가장 낮은 가격과 편의성 제공"
 * - 시장가 주문: AMM vs 오더북 실시간 비교 → 최적 경로 자동 선택
 * - 동적 라우팅: 주문 처리 중 AMM ↔ 오더북 실시간 전환
 * - 가격 동기화: 시스템이 자동으로 가격 일관성 유지
 */

import { getMockAMM, MockAMM } from './mock-amm';
import { MatchingEngine } from '@/lib/orderbook/matching-engine';

export interface Order {
  id: string;
  userId: string;
  pair: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  amount: string;
  price: string;
  remaining: string;
  status: 'active' | 'filled' | 'cancelled';
  timestamp: number;
}

export interface Fill {
  id: string;
  orderId: string;
  price: string;
  amount: string;
  side: 'buy' | 'sell';
  source: 'AMM' | 'Orderbook';
  timestamp: number;
}

export interface RoutingResult {
  fills: Fill[];
  totalFilled: string;
  averagePrice: string;
  routing: Array<{
    source: 'AMM' | 'Orderbook';
    amount: string;
    price: string;
    priceImpact?: number;
  }>;
  gasEstimate?: string;
}

export class HybridSmartRouter {
  private static instance: HybridSmartRouter;
  private amm: MockAMM;
  private matchingEngine: MatchingEngine;

  private constructor() {
    this.amm = getMockAMM();
    this.matchingEngine = MatchingEngine.getInstance();
  }

  static getInstance(): HybridSmartRouter {
    if (!HybridSmartRouter.instance) {
      HybridSmartRouter.instance = new HybridSmartRouter();
    }
    return HybridSmartRouter.instance;
  }

  /**
   * 하이브리드 주문 처리 - 문서 120-161라인 로직 구현
   */
  async processHybridOrder(order: Order): Promise<RoutingResult> {
    console.log(`🔄 Processing hybrid order:`, {
      id: order.id,
      side: order.side,
      type: order.type,
      amount: order.amount,
      price: order.price
    });

    if (order.type === 'limit') {
      return await this.processLimitOrder(order);
    } else {
      return await this.processMarketOrder(order);
    }
  }

  /**
   * 시장가 주문 처리 - 문서 120-161라인 알고리즘
   * AMM vs 오더북 실시간 비교하여 최적 가격으로 체결
   */
  private async processMarketOrder(order: Order): Promise<RoutingResult> {
    let remainingAmount = parseFloat(order.amount);
    const fills: Fill[] = [];
    const routing: RoutingResult['routing'] = [];

    console.log(`🎯 Market order processing started - Amount: ${remainingAmount}`);

    while (remainingAmount > 0.001) { // 최소 단위
      // 1. 현재 AMM 가격과 오더북 최우선 호가 비교
      const ammPrice = this.amm.getSpotPrice(order.pair);
      const bestOrderbookPrice = await this.getBestOrderbookPrice(order.pair, order.side);

      console.log(`📊 Price comparison - AMM: ${ammPrice}, Orderbook: ${bestOrderbookPrice || 'N/A'}, Remaining: ${remainingAmount}`);

      // 2. 가격 비교 및 실행 결정 (문서 130-157라인)
      if (!bestOrderbookPrice) {
        // 오더북 호가가 없는 경우 → 전체 AMM 처리
        console.log(`🏦 No orderbook, executing full amount on AMM`);
        const ammResult = await this.executeAMMUntilOrderbookPrice(order, remainingAmount, null);
        
        if (ammResult.actualInputAmount > 0) {
          const fill = await this.createAMMFill(order, ammResult);
          fills.push(fill);
          routing.push({
            source: 'AMM',
            amount: ammResult.actualInputAmount.toString(),
            price: fill.price,
            priceImpact: ammResult.priceImpact
          });
          
          remainingAmount -= ammResult.actualInputAmount;
          console.log(`✅ AMM full execution: ${ammResult.actualInputAmount}, remaining: ${remainingAmount}`);
        }
        break; // 더 이상 처리할 것 없음

      } else if (this.isAMMBetter(ammPrice, bestOrderbookPrice, order.side)) {
        // 시나리오 1: AMM이 더 유리한 경우 - 오더북 가격까지만 처리
        console.log(`🏦 AMM is better, executing until orderbook price: ${bestOrderbookPrice}`);
        const ammResult = await this.executeAMMUntilOrderbookPrice(order, remainingAmount, bestOrderbookPrice);
        
        if (ammResult.actualInputAmount > 0) {
          const fill = await this.createAMMFill(order, ammResult);
          fills.push(fill);
          routing.push({
            source: 'AMM',
            amount: ammResult.actualInputAmount.toString(),
            price: fill.price,
            priceImpact: ammResult.priceImpact
          });
          
          remainingAmount -= ammResult.actualInputAmount;
          console.log(`✅ AMM partial execution: ${ammResult.actualInputAmount}, remaining: ${remainingAmount}, hit limit: ${ammResult.hitPriceLimit}`);
        } else {
          console.log(`⚠️ AMM cannot execute anymore, switching to orderbook`);
        }
        
        // AMM에서 처리 완료 후, 남은 물량은 다음 루프에서 오더북으로 처리
        continue;

      } else {
        // 시나리오 2: 오더북이 더 유리하거나 같은 경우 → 오더북 처리
        console.log(`📖 Orderbook is better, executing at price: ${bestOrderbookPrice}`);
        const executeAmount = await this.executeOrderbookAtPrice(order, remainingAmount, bestOrderbookPrice);
        
        if (executeAmount > 0) {
          const fill = await this.executeOrderbookTrade(order, executeAmount, bestOrderbookPrice);
          fills.push(fill);
          routing.push({
            source: 'Orderbook',
            amount: executeAmount.toString(),
            price: fill.price
          });
          
          remainingAmount -= executeAmount;
          console.log(`✅ Orderbook execution: ${executeAmount}, remaining: ${remainingAmount}`);
        } else {
          // 오더북 소진됨, AMM으로 전환
          console.log(`🔄 Orderbook exhausted at price ${bestOrderbookPrice}, continuing with AMM`);
        }
        
        continue; // 다음 루프에서 다시 가격 비교
      }
    }

    // 결과 계산
    const totalFilled = fills.reduce((sum, fill) => sum + parseFloat(fill.amount), 0);
    const weightedPriceSum = fills.reduce((sum, fill) => 
      sum + (parseFloat(fill.price) * parseFloat(fill.amount)), 0
    );
    const averagePrice = totalFilled > 0 ? weightedPriceSum / totalFilled : 0;

    console.log(`🎉 Market order completed:`, {
      totalFilled,
      averagePrice,
      fills: fills.length,
      routingSources: routing.map(r => r.source)
    });

    return {
      fills,
      totalFilled: totalFilled.toString(),
      averagePrice: averagePrice.toString(),
      routing
    };
  }

  /**
   * 지정가 주문 처리 - 문서 166-185라인 로직
   */
  private async processLimitOrder(order: Order): Promise<RoutingResult> {
    const ammPrice = this.amm.getSpotPrice(order.pair);
    const limitPrice = parseFloat(order.price);

    console.log(`📝 Limit order validation - AMM: ${ammPrice}, Limit: ${limitPrice}, Side: ${order.side}`);

    // AMM 가격 검증 (문서 170-178라인)
    if ((order.side === 'buy' && limitPrice > ammPrice) ||
        (order.side === 'sell' && limitPrice < ammPrice)) {
      throw new Error(`Limit price crosses market price. Place market order instead.`);
    }

    // 정상적인 지정가: 오더북에 등록
    console.log(`✅ Valid limit order - registering to orderbook`);
    
    // 실제로는 오더북에 등록하지만, 테스트를 위해 즉시 매칭 시도
    const matchResult = await this.matchingEngine.processOrder(order);
    
    const fills: Fill[] = matchResult.trades.map(trade => ({
      id: trade.id,
      orderId: order.id,
      price: trade.price,
      amount: trade.amount,
      side: order.side,
      source: 'Orderbook' as const,
      timestamp: trade.timestamp
    }));

    const totalFilled = fills.reduce((sum, fill) => sum + parseFloat(fill.amount), 0);
    const averagePrice = fills.length > 0 ? parseFloat(fills[0].price) : parseFloat(order.price);

    return {
      fills,
      totalFilled: totalFilled.toString(),
      averagePrice: averagePrice.toString(),
      routing: [{
        source: 'Orderbook',
        amount: totalFilled.toString(),
        price: averagePrice.toString()
      }]
    };
  }

  /**
   * AMM이 오더북보다 유리한지 확인
   */
  private isAMMBetter(ammPrice: number, orderbookPrice: number, side: 'buy' | 'sell'): boolean {
    if (side === 'buy') {
      return ammPrice < orderbookPrice; // 매수시 AMM이 더 싸면 유리
    } else {
      return ammPrice > orderbookPrice; // 매도시 AMM이 더 비싸면 유리
    }
  }

  /**
   * 오더북 최우선 호가 조회
   */
  private async getBestOrderbookPrice(pair: string, side: 'buy' | 'sell'): Promise<number | null> {
    try {
      const orderbook = await this.matchingEngine.getOrderbook(pair, 1);
      
      if (side === 'buy') {
        // 매수시 가장 낮은 매도호가 (asks)
        return orderbook.asks.length > 0 ? parseFloat(orderbook.asks[0].price) : null;
      } else {
        // 매도시 가장 높은 매수호가 (bids)
        return orderbook.bids.length > 0 ? parseFloat(orderbook.bids[0].price) : null;
      }
    } catch (error) {
      console.error('Failed to get orderbook price:', error);
      return null;
    }
  }

  /**
   * 🔥 CRITICAL: AMM을 오더북 가격까지만 실행하는 새로운 메서드
   */
  private async executeAMMUntilOrderbookPrice(
    order: Order, 
    maxAmount: number, 
    orderbookPrice: number | null
  ): Promise<{
    actualInputAmount: number;
    outputAmount: number;
    effectivePrice: number;
    priceImpact: number;
    newSpotPrice: number;
    hitPriceLimit: boolean;
    reservesBefore: any;
    reservesAfter: any;
  }> {
    if (!orderbookPrice) {
      // 오더북 호가가 없으면 전체 수량 AMM으로 처리 (제한 없음)
      const limitedAmount = Math.min(maxAmount, 10000); // 최대 10K 제한
      return this.amm.executeSwapUntilPrice(order.pair, order.side, limitedAmount, 0); // 가격 제한 없음
    }

    // 🎯 핵심: 오더북 가격까지만 AMM 실행
    console.log(`🎯 AMM will execute until orderbook price: ${orderbookPrice}`);
    return this.amm.executeSwapUntilPrice(order.pair, order.side, maxAmount, orderbookPrice);
  }

  /**
   * AMM 스왑 결과로부터 Fill 객체 생성
   */
  private async createAMMFill(order: Order, ammResult: any): Promise<Fill> {
    const fill: Fill = {
      id: `amm-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      orderId: order.id,
      price: ammResult.effectivePrice.toString(),
      amount: ammResult.actualInputAmount.toString(),
      side: order.side,
      source: 'AMM',
      timestamp: Date.now()
    };

    // Redis와 PostgreSQL에 저장
    await this.recordAMMTrade(fill, ammResult);
    
    return fill;
  }

  /**
   * AMM 거래를 Redis와 PostgreSQL에 기록
   */
  private async recordAMMTrade(fill: Fill, ammResult: any): Promise<void> {
    try {
      // 1. Redis 저장
      await this.matchingEngine.recordTrade({
        id: fill.id,
        pair: fill.orderId.includes('HYPERINDEX') ? 'HYPERINDEX-USDC' : 'HYPERINDEX-USDC',
        price: fill.price,
        amount: fill.amount,
        side: fill.side,
        buyOrderId: 'amm',
        sellOrderId: 'amm',
        timestamp: fill.timestamp
      });

      // 2. PostgreSQL 저장
      await this.saveTradeToDatabase(fill, ammResult);
      
      console.log(`💾 AMM trade recorded: ${fill.id}`);
    } catch (error) {
      console.warn('Failed to record AMM trade:', error);
    }
  }

  /**
   * 특정 가격에서 오더북 수량 확인 및 실행
   */
  private async executeOrderbookAtPrice(
    order: Order,
    remainingAmount: number, 
    price: number
  ): Promise<number> {
    try {
      const orderbook = await this.matchingEngine.getOrderbook(order.pair, 10);
      const levels = order.side === 'buy' ? orderbook.asks : orderbook.bids;
      
      // 해당 가격의 총 수량 계산
      const availableAmount = levels
        .filter(level => Math.abs(parseFloat(level.price) - price) < 0.0001)
        .reduce((sum, level) => sum + parseFloat(level.amount), 0);
      
      return Math.min(remainingAmount, availableAmount);
    } catch (error) {
      console.error('Failed to calculate orderbook execution amount:', error);
      return 0;
    }
  }

  /**
   * 거래 내역을 PostgreSQL에 영구 저장
   */
  private async saveTradeToDatabase(fill: Fill, swapResult?: any): Promise<void> {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const tradeData = {
      pair: 'HYPERINDEX-USDC', // 현재는 하나의 페어만 지원
      price: parseFloat(fill.price),
      amount: parseFloat(fill.amount),
      side: fill.side,
      source: fill.source,
      buyer_order_id: fill.source === 'AMM' ? 'amm' : fill.orderId,
      seller_order_id: fill.source === 'AMM' ? 'amm' : fill.orderId,
      buyer_fee: 0,
      seller_fee: 0,
      redis_trade_id: fill.id,
      executed_at: new Date(fill.timestamp).toISOString()
    };

    // AMM 관련 추가 정보
    if (fill.source === 'AMM' && swapResult) {
      Object.assign(tradeData, {
        price_impact: swapResult.priceImpact || 0,
        amm_reserves_before: swapResult.reservesBefore || null,
        amm_reserves_after: swapResult.reservesAfter || null
      });
    }

    const { error } = await supabase
      .from('trade_history')
      .insert(tradeData);

    if (error) {
      throw new Error(`Database insert failed: ${error.message}`);
    }
  }

  /**
   * 오더북 거래 실행 - 실제로 매칭엔진으로 Market 주문 전송
   */
  private async executeOrderbookTrade(order: Order, amount: number, price: number): Promise<Fill> {
    try {
      // 🔥 핵심: 남은 물량으로 새로운 Market 주문을 오더북에 전송
      const orderbookOrder: Order = {
        id: `ob-market-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        userId: order.userId,
        pair: order.pair,
        side: order.side,
        type: 'market', // Market 주문으로 오더북에 전송
        amount: amount.toString(),
        price: price.toString(),
        remaining: amount.toString(),
        status: 'active',
        timestamp: Date.now()
      };

      console.log(`📖 Sending market order to orderbook:`, orderbookOrder);

      // 매칭엔진으로 주문 전송
      const matchResult = await this.matchingEngine.processOrder(orderbookOrder);
      
      if (matchResult.trades.length > 0) {
        // 체결된 첫 번째 거래를 Fill로 변환
        const trade = matchResult.trades[0];
        const fill: Fill = {
          id: trade.id,
          orderId: order.id, // 원본 주문 ID 유지
          price: trade.price,
          amount: trade.amount,
          side: order.side,
          source: 'Orderbook',
          timestamp: trade.timestamp
        };

        console.log(`✅ Orderbook trade executed:`, fill);
        return fill;
      } else {
        // 체결되지 않은 경우 (이론상 발생하지 않아야 함)
        console.warn(`⚠️ No orderbook trades executed for amount: ${amount}`);
        return {
          id: `ob-failed-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          orderId: order.id,
          price: price.toString(),
          amount: "0", // 체결 안됨
          side: order.side,
          source: 'Orderbook',
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.error(`❌ Orderbook trade execution failed:`, error);
      
      // 에러 발생 시 빈 Fill 반환
      return {
        id: `ob-error-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        orderId: order.id,
        price: price.toString(),
        amount: "0",
        side: order.side,
        source: 'Orderbook',
        timestamp: Date.now()
      };
    }
  }

  /**
   * 가격 영향 계산
   */
  private calculatePriceImpact(amount: number, pair: string): number {
    try {
      const simulation = this.amm.calculateSwapOutput(pair, 'buy', amount);
      return simulation.priceImpact;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 최적 거래 경로 추천
   */
  async getOptimalRoute(pair: string, side: 'buy' | 'sell', amount: string): Promise<{
    recommended: 'AMM' | 'Orderbook' | 'Hybrid';
    ammPrice: number;
    orderbookPrice: number | null;
    priceImpact: number;
    estimatedGas: string;
  }> {
    const ammPrice = this.amm.getSpotPrice(pair);
    const orderbookPrice = await this.getBestOrderbookPrice(pair, side);
    const amountNum = parseFloat(amount);
    const priceImpact = this.calculatePriceImpact(amountNum, pair);

    let recommended: 'AMM' | 'Orderbook' | 'Hybrid' = 'AMM';

    if (orderbookPrice) {
      if (this.isAMMBetter(ammPrice, orderbookPrice, side)) {
        recommended = priceImpact > 0.05 ? 'Hybrid' : 'AMM';
      } else {
        recommended = 'Orderbook';
      }
    }

    return {
      recommended,
      ammPrice,
      orderbookPrice,
      priceImpact,
      estimatedGas: '0.001' // 가스 추정값
    };
  }
}
