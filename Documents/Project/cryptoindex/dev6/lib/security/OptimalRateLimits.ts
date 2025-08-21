/**
 * HyperIndex 최적화된 Rate Limiting 설정
 * dYdX와 Vertex의 장점 결합
 */

export interface RateLimitConfig {
  // 사용자 타입별 차등 제한
  userTiers: {
    retail: UserLimits;
    pro: UserLimits;
    marketMaker: UserLimits;
    vip: UserLimits;
  };
  
  // 글로벌 제한
  global: {
    maxOrdersPerBlock: number;
    maxOrdersPerMarket: number;
    maxOpenOrdersPerUser: number;
  };
}

interface UserLimits {
  ordersPerSecond: number;
  ordersPerMinute: number;
  ordersPerHour: number;
  maxOpenOrders: number;
  maxBatchSize: number;
  weightLimit: number;
}

export class OptimalRateLimits {
  private config: RateLimitConfig = {
    userTiers: {
      // 일반 사용자 (대부분의 트레이더)
      retail: {
        ordersPerSecond: 10,      // 초당 10개
        ordersPerMinute: 100,      // 분당 100개
        ordersPerHour: 2000,       // 시간당 2000개
        maxOpenOrders: 50,         // 최대 50개 오픈
        maxBatchSize: 5,           // 배치당 5개
        weightLimit: 100           // 가중치 100
      },
      
      // 프로 트레이더 (초단타, 스나이퍼)
      pro: {
        ordersPerSecond: 50,       // 초당 50개
        ordersPerMinute: 500,      // 분당 500개
        ordersPerHour: 10000,      // 시간당 10000개
        maxOpenOrders: 200,        // 최대 200개 오픈
        maxBatchSize: 20,          // 배치당 20개
        weightLimit: 500           // 가중치 500
      },
      
      // 마켓 메이커 (유동성 공급자)
      marketMaker: {
        ordersPerSecond: 100,      // 초당 100개
        ordersPerMinute: 2000,     // 분당 2000개
        ordersPerHour: 50000,      // 시간당 50000개
        maxOpenOrders: 1000,       // 최대 1000개 오픈
        maxBatchSize: 50,          // 배치당 50개
        weightLimit: 2000          // 가중치 2000
      },
      
      // VIP/기관 (커스텀)
      vip: {
        ordersPerSecond: 200,      // 초당 200개
        ordersPerMinute: 5000,     // 분당 5000개
        ordersPerHour: 100000,     // 시간당 100000개
        maxOpenOrders: 5000,       // 최대 5000개 오픈
        maxBatchSize: 100,         // 배치당 100개
        weightLimit: 10000         // 가중치 10000
      }
    },
    
    global: {
      maxOrdersPerBlock: 10000,    // 블록당 최대 10000개
      maxOrdersPerMarket: 50000,   // 시장당 최대 50000개
      maxOpenOrdersPerUser: 5000   // 사용자당 최대 5000개
    }
  };
  
  /**
   * 사용자 타입 자동 분류
   */
  classifyUser(userStats: {
    totalTrades: number;
    avgHoldTime: number;
    totalVolume: number;
    accountAge: number;
  }): keyof RateLimitConfig['userTiers'] {
    // 마켓 메이커 조건
    if (userStats.totalVolume > 10000000 && // $10M 이상 거래량
        userStats.avgHoldTime < 60000 &&     // 평균 1분 이하 보유
        userStats.totalTrades > 10000) {       // 1만개 이상 거래
      return 'marketMaker';
    }
    
    // 프로 트레이더 조건
    if (userStats.totalTrades > 1000 &&      // 1000개 이상 거래
        userStats.avgHoldTime < 300000) {    // 평균 5분 이하 보유
      return 'pro';
    }
    
    // VIP는 수동 승인
    // 기본은 retail
    return 'retail';
  }
  
  /**
   * 동적 Rate Limit 조정
   */
  adjustLimits(
    currentTPS: number,
    systemLoad: number
  ): void {
    // 시스템 부하가 높으면 제한 강화
    if (systemLoad > 0.8) {
      Object.keys(this.config.userTiers).forEach(tier => {
        this.config.userTiers[tier].ordersPerSecond *= 0.5;
      });
    }
    
    // 시스템 여유시 제한 완화
    if (systemLoad < 0.3) {
      Object.keys(this.config.userTiers).forEach(tier => {
        this.config.userTiers[tier].ordersPerSecond *= 1.2;
      });
    }
  }
  
  /**
   * 밈코인 스나이퍼 특별 처리
   */
  handleMemecoinSniper(userId: string): UserLimits {
    // 밈코인 런치 시 한시적 제한 완화
    return {
      ordersPerSecond: 100,      // 초당 100개 (런치 시)
      ordersPerMinute: 1000,     // 분당 1000개
      ordersPerHour: 5000,       // 시간당 5000개
      maxOpenOrders: 10,         // 오픈 주문은 적게
      maxBatchSize: 5,           // 배치 크기 제한
      weightLimit: 1000          // 가중치 1000
    };
  }
}