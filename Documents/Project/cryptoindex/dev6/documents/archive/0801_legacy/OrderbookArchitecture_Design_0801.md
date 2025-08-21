# 🚀 HyperIndex 오프체인 오더북 아키텍처 설계
*작성일: 2025-08-01*

## 📋 문서 개요
HyperIndex 하이브리드 거래 시스템의 고성능 오프체인 오더북 매칭 엔진 설계 및 구현 방안

---

## 🎯 성능 요구사항

### **핵심 성능 지표**
```typescript
interface PerformanceRequirements {
  latency: "<10ms 주문 매칭";
  throughput: "10,000+ orders/second";
  sorting: "Price-Time Priority 실시간 정렬";
  updates: "밀리초 단위 실시간 브로드캐스트";
  concurrency: "수천명 동시 거래";
  uptime: "99.9% 가용성";
}
```

### **기존 PostgreSQL/Supabase 한계**
```typescript
interface PostgreSQLLimitations {
  diskBased: "디스크 I/O로 인한 지연 (100-500ms)";
  complexQueries: "복잡한 ORDER BY 쿼리로 인한 성능 저하";
  connectionPool: "동시 연결 수 제한 (~100 connections)";
  realtime: "실시간 업데이트 속도 부족";
  
  verdict: "❌ 고주파 거래에 부적합";
}
```

---

## 🏗️ 하이브리드 아키텍처 설계

### **Redis (Hot Data Layer) + PostgreSQL (Cold Data Layer)**

```typescript
interface HybridArchitecture {
  redis: {
    role: "실시간 오더북 + 고속 매칭";
    dataStructures: {
      sortedSets: "가격별 주문 자동 정렬 (ZADD/ZRANGE)";
      hashMaps: "주문 상세 정보 저장 (HSET/HGET)";
      pubSub: "실시간 업데이트 브로드캐스트";
      streams: "주문 이벤트 스트림 처리";
    };
    performance: {
      latency: "<5ms";
      throughput: "100,000+ ops/sec";
      memory: "In-Memory 초고속 처리";
    };
  };
  
  postgresql: {
    role: "영구 저장 + 분석 + 사용자 관리";
    responsibilities: {
      orderHistory: "모든 주문 영구 기록";
      tradeHistory: "체결 내역 저장";
      userManagement: "사용자 정보 및 잔고";
      analytics: "거래 통계 및 분석";
    };
    performance: {
      latency: "50-200ms (배치 처리)";
      consistency: "ACID 보장";
      storage: "무제한 영구 저장";
    };
  };
}
```

---

## 📊 데이터 구조 설계

### **1. Redis 데이터 구조**

#### **오더북 구조**
```typescript
// 매수 주문 (Bids) - 높은 가격 우선
const bidsStructure = {
  key: "orderbook:HYPERINDEX-USDC:bids",
  type: "Sorted Set",
  score: "price * 1e8", // 가격을 score로 사용
  member: "orderId",
  example: [
    { score: 100600, member: "order_124" }, // $1.00600
    { score: 100500, member: "order_123" }  // $1.00500
  ]
};

// 매도 주문 (Asks) - 낮은 가격 우선
const asksStructure = {
  key: "orderbook:HYPERINDEX-USDC:asks", 
  type: "Sorted Set",
  score: "price * 1e8",
  member: "orderId",
  example: [
    { score: 101000, member: "order_125" }, // $1.01000
    { score: 101100, member: "order_126" }  // $1.01100
  ]
};

// 주문 상세 정보
const orderDetailStructure = {
  key: "order:{orderId}",
  type: "Hash",
  fields: {
    userId: "user_456",
    pair: "HYPERINDEX-USDC",
    side: "buy", // or "sell"
    type: "limit", // or "market"
    price: "1.00500",
    amount: "1000.0",
    filledAmount: "0.0",
    status: "active", // active, filled, cancelled
    createdAt: "1701234567890",
    updatedAt: "1701234567890"
  }
};
```

#### **실시간 업데이트 시스템**
```typescript
// Pub/Sub 채널
const pubSubChannels = {
  orderbook: "updates:HYPERINDEX-USDC:orderbook",
  trades: "updates:HYPERINDEX-USDC:trades",
  userOrders: "updates:user:{userId}:orders"
};

// 메시지 구조
interface OrderbookUpdate {
  type: "orderAdded" | "orderRemoved" | "orderMatched";
  timestamp: number;
  data: {
    orderId: string;
    price: number;
    amount: number;
    side: "buy" | "sell";
  };
}

interface TradeUpdate {
  type: "trade";
  timestamp: number;
  data: {
    tradeId: string;
    price: number;
    amount: number;
    buyOrderId: string;
    sellOrderId: string;
  };
}
```

### **2. PostgreSQL 스키마**

```sql
-- 주문 이력 테이블
CREATE TABLE order_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    pair TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    order_type TEXT NOT NULL CHECK (order_type IN ('market', 'limit')),
    price DECIMAL(20,8),
    amount DECIMAL(20,8) NOT NULL,
    filled_amount DECIMAL(20,8) DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('active', 'filled', 'cancelled', 'partial')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    redis_order_id TEXT UNIQUE -- Redis의 orderId와 매핑
);

-- 체결 기록 테이블
CREATE TABLE trade_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pair TEXT NOT NULL,
    buyer_order_id UUID REFERENCES order_history(id),
    seller_order_id UUID REFERENCES order_history(id),
    price DECIMAL(20,8) NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    buyer_fee DECIMAL(20,8) DEFAULT 0,
    seller_fee DECIMAL(20,8) DEFAULT 0,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 사용자 잔고 테이블 (기존 Supabase와 통합)
CREATE TABLE user_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    token_symbol TEXT NOT NULL,
    available_balance DECIMAL(20,8) DEFAULT 0,
    locked_balance DECIMAL(20,8) DEFAULT 0, -- 주문 중인 잔고
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, token_symbol)
);

-- 성능 최적화 인덱스
CREATE INDEX idx_order_history_pair_status ON order_history(pair, status) WHERE status = 'active';
CREATE INDEX idx_order_history_user_active ON order_history(user_id, status) WHERE status = 'active';
CREATE INDEX idx_trade_history_pair_time ON trade_history(pair, executed_at DESC);
CREATE INDEX idx_user_balances_user ON user_balances(user_id);

-- 트리거: 주문 상태 변경 시 업데이트 시간 자동 갱신
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_order_history_modtime 
    BEFORE UPDATE ON order_history 
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
```

---

## ⚡ 매칭 엔진 알고리즘

### **Price-Time Priority 매칭**
```typescript
class OrderMatchingEngine {
  async processOrder(newOrder: Order): Promise<MatchResult[]> {
    const matches: MatchResult[] = [];
    
    if (newOrder.type === 'market') {
      return await this.processMarketOrder(newOrder);
    } else {
      return await this.processLimitOrder(newOrder);
    }
  }
  
  private async processLimitOrder(order: Order): Promise<MatchResult[]> {
    const matches: MatchResult[] = [];
    const oppositeSide = order.side === 'buy' ? 'asks' : 'bids';
    const key = `orderbook:${order.pair}:${oppositeSide}`;
    
    // 매칭 가능한 주문들 조회
    const matchableOrders = await this.getMatchableOrders(key, order);
    
    for (const matchOrder of matchableOrders) {
      if (order.remainingAmount <= 0) break;
      
      const matchAmount = Math.min(order.remainingAmount, matchOrder.amount);
      const matchPrice = matchOrder.price;
      
      // 매칭 실행
      const match = await this.executeTrade(order, matchOrder, matchAmount, matchPrice);
      matches.push(match);
      
      // Redis에서 주문 업데이트
      await this.updateOrderInRedis(order);
      await this.updateOrderInRedis(matchOrder);
      
      // 실시간 업데이트 브로드캐스트
      await this.broadcastUpdate(match);
    }
    
    // 미체결 부분이 있으면 오더북에 추가
    if (order.remainingAmount > 0) {
      await this.addToOrderbook(order);
    }
    
    return matches;
  }
  
  private async getMatchableOrders(key: string, order: Order): Promise<Order[]> {
    // Redis Sorted Set에서 매칭 가능한 주문들 조회
    const orderIds = order.side === 'buy' 
      ? await redis.zrangebyscore(key, 0, order.price * 1e8) // 더 낮은 매도가
      : await redis.zrevrangebyscore(key, '+inf', order.price * 1e8); // 더 높은 매수가
    
    const orders = [];
    for (const orderId of orderIds) {
      const orderData = await redis.hgetall(`order:${orderId}`);
      orders.push(this.parseOrder(orderData));
    }
    
    return orders;
  }
}
```

---

## 🔄 데이터 동기화 전략

### **Redis → PostgreSQL 동기화**
```typescript
interface SyncStrategy {
  realtime: {
    method: "Redis Streams + Consumer Groups";
    trigger: "주요 이벤트 발생 시 즉시";
    events: ["orderCreated", "orderMatched", "orderCancelled"];
    latency: "<100ms";
  };
  
  batch: {
    method: "정기 배치 동기화";
    schedule: "매 10초마다 실행";
    purpose: "데이터 일관성 보장";
    recovery: "Redis 재시작 시 복구";
  };
  
  backup: {
    method: "PostgreSQL을 Source of Truth로 유지";
    schedule: "매일 Redis 데이터 재구축";
    purpose: "장애 복구 및 데이터 무결성";
  };
}

// Redis Streams를 이용한 이벤트 처리
class EventSyncProcessor {
  async processOrderEvent(event: OrderEvent) {
    // Redis에 이벤트 기록
    await redis.xadd('order-events', '*', 
      'type', event.type,
      'orderId', event.orderId,
      'data', JSON.stringify(event.data)
    );
    
    // PostgreSQL 동기화
    await this.syncToPostgreSQL(event);
  }
  
  async syncToPostgreSQL(event: OrderEvent) {
    switch(event.type) {
      case 'orderCreated':
        await db.query(`
          INSERT INTO order_history (redis_order_id, user_id, pair, side, ...)
          VALUES ($1, $2, $3, $4, ...)
        `, [event.orderId, ...event.data]);
        break;
        
      case 'orderMatched':
        await db.query(`
          INSERT INTO trade_history (buyer_order_id, seller_order_id, ...)
          VALUES ($1, $2, ...)
        `, [...event.data]);
        break;
    }
  }
}
```

---

## 🌐 실시간 WebSocket 아키텍처

### **클라이언트 연결 관리**
```typescript
interface WebSocketArchitecture {
  connectionPool: {
    structure: "Redis Pub/Sub + WebSocket Manager";
    scaling: "수평 확장 가능 (멀티 서버)";
    channels: {
      orderbook: "실시간 오더북 변경사항";
      trades: "체결 내역";
      userOrders: "사용자별 주문 상태";
      prices: "실시간 가격 정보";
    };
  };
  
  messageFormat: {
    orderbook: {
      type: "orderbook_update";
      pair: "HYPERINDEX-USDC";
      bids: [["1.00500", "1000"], ["1.00400", "500"]];
      asks: [["1.01000", "800"], ["1.01100", "300"]];
    };
    
    trade: {
      type: "trade";
      pair: "HYPERINDEX-USDC";
      price: "1.00750";
      amount: "250";
      timestamp: 1701234567890;
    };
  };
}

// WebSocket 서버 구현
class WebSocketServer {
  private clients = new Map<string, WebSocket>();
  private subscriptions = new Map<string, Set<string>>();
  
  async handleConnection(ws: WebSocket, userId: string) {
    this.clients.set(userId, ws);
    
    // Redis Pub/Sub 구독
    await this.subscribeToUpdates(userId);
  }
  
  private async subscribeToUpdates(userId: string) {
    // 전체 오더북 업데이트 구독
    pubSubClient.subscribe('updates:HYPERINDEX-USDC:orderbook', (message) => {
      this.broadcastToSubscribers('orderbook', message);
    });
    
    // 사용자별 주문 업데이트 구독
    pubSubClient.subscribe(`updates:user:${userId}:orders`, (message) => {
      this.sendToClient(userId, message);
    });
  }
}
```

---

## 📈 성능 최적화 전략

### **Redis 최적화**
```typescript
interface RedisOptimization {
  configuration: {
    maxMemory: "8GB"; // 오더북 데이터용
    evictionPolicy: "allkeys-lru"; // 메모리 부족 시 LRU 제거
    persistance: "AOF + RDB"; // 데이터 영속성
    clustering: "Redis Cluster (확장성)";
  };
  
  dataStructureOptimization: {
    sortedSets: "가격별 자동 정렬 O(log N)";
    hashMaps: "주문 조회 O(1)";
    compression: "Hash 값 압축으로 메모리 절약";
    expiration: "완료된 주문 자동 정리";
  };
  
  networkOptimization: {
    pipelining: "여러 명령어 일괄 전송";
    luaScripts: "Atomic 연산으로 일관성 보장";
    connectionPooling: "연결 재사용";
  };
}
```

### **PostgreSQL 최적화**
```typescript
interface PostgreSQLOptimization {
  indexing: {
    btree: "일반적인 조회용";
    partial: "활성 주문만 인덱싱";
    composite: "복합 컬럼 인덱스";
  };
  
  partitioning: {
    timeBasedPartitioning: "월별 파티션으로 성능 향상";
    archiving: "오래된 데이터 아카이브";
  };
  
  connectionPooling: {
    pgBouncer: "연결 풀 관리";
    readReplicas: "읽기 전용 복제본";
  };
}
```

---

## 🛡️ 장애 복구 및 고가용성

### **장애 시나리오 대응**
```typescript
interface DisasterRecovery {
  redisFailure: {
    detection: "Health Check (매 5초)";
    fallback: "PostgreSQL에서 오더북 재구성";
    recovery: "Redis 재시작 후 데이터 복원";
    downtime: "<30초";
  };
  
  postgresqlFailure: {
    detection: "Connection Pool 모니터링";
    fallback: "Redis 데이터로 계속 서비스";
    risk: "새로운 주문 히스토리 손실 가능성";
    recovery: "마스터-슬레이브 복제";
  };
  
  networkPartition: {
    detection: "Cross-Region Health Check";
    strategy: "Multi-Region Redis Cluster";
    consistency: "Eventually Consistent";
  };
}
```

---

## 📊 모니터링 및 메트릭

### **핵심 성능 지표**
```typescript
interface MonitoringMetrics {
  latency: {
    orderProcessing: "주문 처리 시간 (목표: <10ms)";
    matchingSpeed: "매칭 속도 (목표: <5ms)";
    wsLatency: "WebSocket 업데이트 지연";
  };
  
  throughput: {
    ordersPerSecond: "초당 처리 주문 수";
    tradesPerSecond: "초당 체결 건수";
    wsMessagesPerSecond: "WebSocket 메시지 처리량";
  };
  
  system: {
    redisMemoryUsage: "Redis 메모리 사용률";
    postgresqlConnections: "PostgreSQL 연결 수";
    errorRate: "에러 발생률";
  };
}
```

---

## 🚀 구현 로드맵

### **Phase 1: 기반 인프라 (1주)**
- [ ] Redis 클러스터 설정
- [ ] PostgreSQL 스키마 구성
- [ ] 기본 연결 및 헬스체크

### **Phase 2: 핵심 매칭 엔진 (2주)**
- [ ] 오더북 데이터 구조 구현
- [ ] Price-Time Priority 매칭 알고리즘
- [ ] Redis ↔ PostgreSQL 동기화

### **Phase 3: 실시간 시스템 (1주)**
- [ ] WebSocket 서버 구현
- [ ] Pub/Sub 실시간 업데이트
- [ ] 클라이언트 구독 관리

### **Phase 4: 최적화 및 모니터링 (1주)**
- [ ] 성능 최적화
- [ ] 모니터링 대시보드
- [ ] 로드 테스트

---

## 💡 결론

**하이브리드 Redis + PostgreSQL 아키텍처**는 다음을 제공합니다:

✅ **초고성능**: <10ms 매칭 속도  
✅ **고가용성**: 99.9% 업타임  
✅ **확장성**: 수평 확장 가능  
✅ **일관성**: ACID 보장 영구 저장  
✅ **실시간**: 밀리초 단위 업데이트  

이는 CEX 수준의 거래 경험을 DEX에서 구현하는 핵심 기술입니다.

---

*다음 단계: 전체 아키텍처 구체화 및 Redis 설정 가이드*