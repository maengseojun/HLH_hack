/**
 * 개선된 Sandwich Attack 탐지기
 * 밈코인 스나이퍼와 초단타 트레이더를 구분
 */

interface OrderContext {
  userId: string;
  timestamp: number;
  pair: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  userHistory?: UserTradingHistory;
}

interface UserTradingHistory {
  avgHoldTime: number;  // 평균 보유 시간
  tradeCount: number;   // 총 거래 횟수
  profitRate: number;   // 수익률
  isWhitelisted: boolean; // 화이트리스트 (마켓메이커 등)
}

export class ImprovedSandwichDetector {
  // 사용자별 거래 패턴 저장
  private userPatterns = new Map<string, UserTradingHistory>();
  
  /**
   * 개선된 Sandwich 탐지 알고리즘
   */
  detectSandwich(orders: OrderContext[]): {
    isSandwich: boolean;
    confidence: number;
    reason?: string;
  } {
    // 1. 화이트리스트 체크 (마켓메이커, 봇 등)
    const user = orders[0].userId;
    const userHistory = this.userPatterns.get(user);
    
    if (userHistory?.isWhitelisted) {
      return { isSandwich: false, confidence: 0, reason: 'whitelisted' };
    }
    
    // 2. 패턴 분석 (연속된 3개 주문)
    if (orders.length < 3) {
      return { isSandwich: false, confidence: 0 };
    }
    
    const [order1, order2, order3] = orders;
    
    // 3. 시간 간격 체크 (너무 빠르면 의심)
    const timeGap1 = order2.timestamp - order1.timestamp;
    const timeGap2 = order3.timestamp - order2.timestamp;
    
    // 밈코인 스나이퍼는 보통 한 방향으로만 거래
    const isSniper = 
      order1.side === order2.side && 
      order2.side === order3.side &&
      timeGap1 < 1000; // 1초 이내 같은 방향
    
    if (isSniper) {
      return { 
        isSandwich: false, 
        confidence: 0.2, 
        reason: 'likely_sniper' 
      };
    }
    
    // 4. Sandwich 패턴 체크 (Buy-Target-Sell)
    const isSandwichPattern = 
      order1.side === 'buy' &&
      order3.side === 'sell' &&
      order1.pair === order3.pair &&
      Math.abs(order1.amount - order3.amount) < order1.amount * 0.1 && // 비슷한 수량
      timeGap1 < 500 && // 0.5초 이내
      timeGap2 < 500;
    
    if (!isSandwichPattern) {
      return { isSandwich: false, confidence: 0 };
    }
    
    // 5. 추가 검증 (가격 영향도)
    const priceImpact = Math.abs(order3.price - order1.price) / order1.price;
    
    // 6. 신뢰도 계산
    let confidence = 0.5; // 기본 신뢰도
    
    if (timeGap1 < 100) confidence += 0.2; // 매우 빠른 실행
    if (priceImpact > 0.01) confidence += 0.2; // 1% 이상 가격 영향
    if (userHistory && userHistory.avgHoldTime < 60000) confidence += 0.1; // 평균 1분 이하 보유
    
    // 7. 초단타 트레이더 구분
    if (userHistory) {
      // 초단타지만 정상적인 패턴
      if (userHistory.tradeCount > 1000 && // 많은 거래
          userHistory.profitRate < 0.5 && // 적당한 수익률
          userHistory.avgHoldTime > 5000) { // 5초 이상 보유
        confidence *= 0.5; // 신뢰도 낮춤
      }
    }
    
    return {
      isSandwich: confidence > 0.7,
      confidence,
      reason: confidence > 0.7 ? 'sandwich_detected' : 'normal_trading'
    };
  }
  
  /**
   * 사용자 거래 패턴 학습
   */
  updateUserPattern(userId: string, trade: any): void {
    const existing = this.userPatterns.get(userId) || {
      avgHoldTime: 0,
      tradeCount: 0,
      profitRate: 0,
      isWhitelisted: false
    };
    
    // 이동평균으로 업데이트
    existing.tradeCount++;
    existing.avgHoldTime = (existing.avgHoldTime * (existing.tradeCount - 1) + trade.holdTime) / existing.tradeCount;
    
    this.userPatterns.set(userId, existing);
  }
}