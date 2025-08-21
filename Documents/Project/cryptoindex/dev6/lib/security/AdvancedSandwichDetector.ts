/**
 * 고급 Sandwich Attack 탐지기
 * 스나이퍼, TP/SL, 진짜 샌드위치 공격을 정확히 구분
 */

interface OrderWithContext {
  orderId: string;
  userId: string;
  timestamp: number;
  pair: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
  linkedOrderId?: string;      // TP/SL 연결 주문
  parentOrderId?: string;       // 원본 주문 ID
  isTPOrder?: boolean;          // Take Profit 주문
  isSLOrder?: boolean;          // Stop Loss 주문
  metadata?: {
    source: string;             // 'web', 'api', 'bot'
    deviceId?: string;
    apiKey?: string;
  };
}

interface AttackPattern {
  type: 'sandwich' | 'frontrun' | 'sniper' | 'tp_sl' | 'legitimate';
  confidence: number;
  evidence: string[];
  recommendation: 'block' | 'allow' | 'monitor';
}

export class AdvancedSandwichDetector {
  // 사용자별 주문 관계 맵
  private orderRelationships = new Map<string, Set<string>>();
  
  // 사용자별 거래 패턴
  private userPatterns = new Map<string, {
    avgBuySellGap: number;      // 평균 매수-매도 간격
    tpSlUsageRate: number;       // TP/SL 사용 비율
    profitTakeRatio: number;     // 평균 이익 실현 비율
    quickFlipCount: number;      // 빠른 매도 횟수
    legitimateFlips: number;     // 정상 매도 횟수
  }>();
  
  /**
   * 메인 탐지 함수 - 여러 요소를 종합 분석
   */
  analyzeOrderPattern(
    orders: OrderWithContext[],
    targetOrder?: OrderWithContext  // 샌드위치 대상 주문
  ): AttackPattern {
    
    // 1. TP/SL 주문 체크 (가장 먼저)
    const tpSlResult = this.checkTPSLOrders(orders);
    if (tpSlResult.type === 'tp_sl') {
      return tpSlResult;
    }
    
    // 2. 스나이퍼 패턴 체크
    const sniperResult = this.checkSniperPattern(orders);
    if (sniperResult.confidence > 0.7) {
      return sniperResult;
    }
    
    // 3. 진짜 샌드위치 공격 체크
    const sandwichResult = this.checkRealSandwich(orders, targetOrder);
    if (sandwichResult.confidence > 0.8) {
      return sandwichResult;
    }
    
    // 4. 정상 거래로 판단
    return {
      type: 'legitimate',
      confidence: 0.9,
      evidence: ['Normal trading pattern detected'],
      recommendation: 'allow'
    };
  }
  
  /**
   * TP/SL 주문 감지
   */
  private checkTPSLOrders(orders: OrderWithContext[]): AttackPattern {
    const evidence: string[] = [];
    
    for (const order of orders) {
      // 명시적 TP/SL 플래그 체크
      if (order.isTPOrder || order.isSLOrder) {
        evidence.push(`Order ${order.orderId} is TP/SL order`);
        return {
          type: 'tp_sl',
          confidence: 1.0,
          evidence,
          recommendation: 'allow'
        };
      }
      
      // 연결된 주문 체크
      if (order.linkedOrderId || order.parentOrderId) {
        evidence.push(`Order ${order.orderId} is linked to ${order.linkedOrderId || order.parentOrderId}`);
        
        // 연결 관계 저장
        const userId = order.userId;
        if (!this.orderRelationships.has(userId)) {
          this.orderRelationships.set(userId, new Set());
        }
        this.orderRelationships.get(userId)!.add(order.orderId);
        
        return {
          type: 'tp_sl',
          confidence: 0.95,
          evidence,
          recommendation: 'allow'
        };
      }
      
      // 가격 기반 TP/SL 추론
      if (orders.length >= 2) {
        const [buyOrder, sellOrder] = orders;
        
        if (buyOrder.side === 'buy' && sellOrder.side === 'sell') {
          const priceGap = (sellOrder.price - buyOrder.price) / buyOrder.price;
          
          // 일반적인 TP 범위 (1-10%)
          if (priceGap > 0.01 && priceGap < 0.1) {
            evidence.push(`Likely TP order: ${priceGap * 100}% profit target`);
            
            // Stop 주문 타입 체크
            if (sellOrder.orderType === 'stop' || sellOrder.orderType === 'stop_limit') {
              return {
                type: 'tp_sl',
                confidence: 0.9,
                evidence,
                recommendation: 'allow'
              };
            }
          }
          
          // 일반적인 SL 범위 (-1% ~ -5%)
          if (priceGap < 0 && priceGap > -0.05) {
            evidence.push(`Likely SL order: ${Math.abs(priceGap * 100)}% stop loss`);
            return {
              type: 'tp_sl',
              confidence: 0.85,
              evidence,
              recommendation: 'allow'
            };
          }
        }
      }
    }
    
    return {
      type: 'legitimate',
      confidence: 0,
      evidence: [],
      recommendation: 'allow'
    };
  }
  
  /**
   * 스나이퍼 패턴 감지 (정교화)
   */
  private checkSniperPattern(orders: OrderWithContext[]): AttackPattern {
    if (orders.length < 2) {
      return { type: 'legitimate', confidence: 0, evidence: [], recommendation: 'allow' };
    }
    
    const evidence: string[] = [];
    let confidence = 0;
    
    const [firstOrder, secondOrder] = orders;
    const timeGap = secondOrder.timestamp - firstOrder.timestamp;
    
    // 스나이퍼 특징 1: 매우 빠른 Buy → Sell
    if (firstOrder.side === 'buy' && secondOrder.side === 'sell' && timeGap < 5000) {
      confidence += 0.3;
      evidence.push(`Quick flip detected: ${timeGap}ms`);
      
      // 스나이퍼 특징 2: 높은 수익률 목표
      const profitTarget = (secondOrder.price - firstOrder.price) / firstOrder.price;
      if (profitTarget > 0.2) { // 20% 이상
        confidence += 0.3;
        evidence.push(`High profit target: ${profitTarget * 100}%`);
      }
      
      // 스나이퍼 특징 3: 마켓 주문 사용
      if (firstOrder.orderType === 'market') {
        confidence += 0.2;
        evidence.push('Market order used for entry');
      }
      
      // 스나이퍼 특징 4: 새로운 토큰/페어
      if (this.isNewToken(firstOrder.pair)) {
        confidence += 0.2;
        evidence.push('Trading new token/pair');
      }
      
      // 하지만 TP/SL이면 스나이퍼 아님
      if (secondOrder.linkedOrderId === firstOrder.orderId) {
        confidence = 0;
        evidence.push('Orders are linked (TP/SL)');
      }
    }
    
    return {
      type: confidence > 0.7 ? 'sniper' : 'legitimate',
      confidence,
      evidence,
      recommendation: confidence > 0.7 ? 'monitor' : 'allow'  // 스나이퍼는 차단하지 않고 모니터링
    };
  }
  
  /**
   * 진짜 샌드위치 공격 감지
   */
  private checkRealSandwich(
    orders: OrderWithContext[],
    targetOrder?: OrderWithContext
  ): AttackPattern {
    if (orders.length < 2 || !targetOrder) {
      return { type: 'legitimate', confidence: 0, evidence: [], recommendation: 'allow' };
    }
    
    const evidence: string[] = [];
    let confidence = 0;
    
    // 샌드위치 필수 조건: 공격자의 Buy → 희생자 Buy → 공격자의 Sell
    const attackerOrders = orders.filter(o => o.userId === orders[0].userId);
    
    if (attackerOrders.length >= 2) {
      const [attackBuy, attackSell] = attackerOrders;
      
      // 조건 1: 같은 페어
      if (attackBuy.pair === targetOrder.pair && attackSell.pair === targetOrder.pair) {
        confidence += 0.2;
        evidence.push('Same pair trading');
        
        // 조건 2: Buy → Sell 패턴
        if (attackBuy.side === 'buy' && attackSell.side === 'sell') {
          confidence += 0.2;
          evidence.push('Buy-Sell pattern detected');
          
          // 조건 3: 타이밍 (희생자 주문 전후)
          if (attackBuy.timestamp < targetOrder.timestamp && 
              targetOrder.timestamp < attackSell.timestamp) {
            confidence += 0.3;
            evidence.push('Sandwiching timing confirmed');
            
            // 조건 4: 비슷한 수량 (90% 이상 일치)
            const amountRatio = Math.min(attackBuy.amount, attackSell.amount) / 
                               Math.max(attackBuy.amount, attackSell.amount);
            if (amountRatio > 0.9) {
              confidence += 0.2;
              evidence.push(`Similar amounts: ${amountRatio}`);
            }
            
            // 조건 5: 가격 조작 의도
            const priceImpact = (attackSell.price - attackBuy.price) / attackBuy.price;
            if (priceImpact > 0.001 && priceImpact < 0.05) { // 0.1% ~ 5%
              confidence += 0.1;
              evidence.push(`Price impact: ${priceImpact * 100}%`);
            }
            
            // 조건 6: 봇/API 사용
            if (attackBuy.metadata?.source === 'api' || attackBuy.metadata?.source === 'bot') {
              confidence += 0.1;
              evidence.push('Bot/API detected');
            }
          }
        }
      }
    }
    
    // TP/SL로 오인 방지
    if (this.areOrdersLinked(orders[0], orders[1])) {
      confidence = 0;
      evidence.push('Orders are TP/SL pair');
    }
    
    return {
      type: confidence > 0.8 ? 'sandwich' : 'legitimate',
      confidence,
      evidence,
      recommendation: confidence > 0.8 ? 'block' : 'allow'
    };
  }
  
  /**
   * 새로운 토큰 체크 (스나이퍼 판단용)
   */
  private isNewToken(pair: string): boolean {
    // 실제로는 토큰 생성 시간을 체크
    // 여기서는 간단히 구현
    const knownPairs = ['ETH/USDC', 'BTC/USDC', 'MATIC/USDC'];
    return !knownPairs.includes(pair);
  }
  
  /**
   * 주문 연결 관계 체크
   */
  private areOrdersLinked(order1: OrderWithContext, order2: OrderWithContext): boolean {
    // 직접 연결
    if (order1.linkedOrderId === order2.orderId || 
        order2.linkedOrderId === order1.orderId) {
      return true;
    }
    
    // 같은 부모
    if (order1.parentOrderId && order1.parentOrderId === order2.parentOrderId) {
      return true;
    }
    
    // 시간 간격과 가격으로 추론
    const timeGap = Math.abs(order1.timestamp - order2.timestamp);
    if (timeGap < 100 && order1.userId === order2.userId) { // 100ms 이내 같은 유저
      // TP/SL 가격 범위 체크
      const priceRatio = order2.price / order1.price;
      if (priceRatio > 1.001 && priceRatio < 1.1) { // TP 범위
        return true;
      }
      if (priceRatio > 0.9 && priceRatio < 0.999) { // SL 범위
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 사용자 패턴 학습 및 업데이트
   */
  updateUserPattern(userId: string, trades: any[]): void {
    const pattern = this.userPatterns.get(userId) || {
      avgBuySellGap: 0,
      tpSlUsageRate: 0,
      profitTakeRatio: 0,
      quickFlipCount: 0,
      legitimateFlips: 0
    };
    
    // 패턴 분석 및 업데이트
    for (let i = 0; i < trades.length - 1; i++) {
      if (trades[i].side === 'buy' && trades[i + 1].side === 'sell') {
        const gap = trades[i + 1].timestamp - trades[i].timestamp;
        
        if (gap < 5000) { // 5초 이내
          pattern.quickFlipCount++;
        } else {
          pattern.legitimateFlips++;
        }
        
        // 이동평균 업데이트
        pattern.avgBuySellGap = (pattern.avgBuySellGap * 0.9) + (gap * 0.1);
      }
    }
    
    this.userPatterns.set(userId, pattern);
  }
}