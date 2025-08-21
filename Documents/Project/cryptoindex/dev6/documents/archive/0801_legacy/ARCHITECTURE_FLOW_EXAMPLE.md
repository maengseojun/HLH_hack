# 🔄 HyperIndex 오더북 데이터 플로우 실제 예시

## 📋 시나리오: 사용자가 매수 주문을 넣는 경우

### **1단계: 주문 생성 (즉시 Redis)**
```typescript
// 사용자가 "HYPERINDEX-USDC 페어에서 1.5000 가격으로 100개 매수" 주문
const newOrder: Order = {
  id: "order_12345",
  userId: "user_456", 
  pair: "HYPERINDEX-USDC",
  side: "buy",
  type: "limit",
  price: "1.5000",
  amount: "100.0",
  remaining: "100.0",
  status: "active"
};

// ✅ Redis에 즉시 저장
await redis.zadd("orderbook:HYPERINDEX-USDC:bids", 150000, "order_12345");
await redis.hset("order:order_12345", newOrder);

// ⏱️ PostgreSQL에 비동기 저장 (백그라운드)
await postgresSync.syncOrder(newOrder); // 실패해도 Redis 작업은 계속
```

### **2단계: 실시간 매칭 (Redis에서만)**
```typescript
// Redis에서 매칭 가능한 매도 주문 찾기
const matchableAsks = await redis.zrangebyscore(
  "orderbook:HYPERINDEX-USDC:asks", 
  0, 150000  // 1.5000 이하 매도가
);

// 매칭된 경우
if (matchableAsks.length > 0) {
  // ✅ Redis에서 즉시 거래 처리
  const trade = await executeTradeInRedis(newOrder, matchableAsks[0]);
  
  // ✅ Redis Pub/Sub로 실시간 브로드캐스트
  await redis.publish("updates:HYPERINDEX-USDC:trades", JSON.stringify(trade));
  
  // ⏱️ PostgreSQL에 비동기 저장
  await postgresSync.syncTrade(trade);
}
```

### **3단계: 실시간 업데이트 (Redis → WebSocket)**
```typescript
// Redis Pub/Sub 구독자가 메시지 받음
redisPubSub.on('message', (channel, message) => {
  if (channel === 'updates:HYPERINDEX-USDC:trades') {
    // 모든 연결된 WebSocket 클라이언트에게 즉시 전송
    webSocketServer.broadcast({
      type: 'trade',
      data: JSON.parse(message)
    });
  }
});
```

## 🏃‍♂️ 성능 비교

### **Redis 실시간 처리**
```typescript
const redisPerformance = {
  "주문 추가": "<1ms",
  "매칭 처리": "<5ms", 
  "오더북 조회": "<1ms",
  "실시간 업데이트": "<10ms"
};
```

### **PostgreSQL 백그라운드 동기화**
```typescript
const postgresPerformance = {
  "주문 저장": "50-200ms (비동기)",
  "거래 기록": "100-300ms (비동기)",
  "히스토리 조회": "200-500ms",
  "통계 분석": "1-5초"
};
```

## 🔄 실제 데이터 상태 비교

### **Redis (실시간 상태)**
```bash
# 현재 활성 오더북
127.0.0.1:6379> ZRANGE orderbook:HYPERINDEX-USDC:bids 0 -1 WITHSCORES
1) "order_12345"
2) "150000"
3) "order_12346" 
4) "149500"

# 주문 상세
127.0.0.1:6379> HGETALL order:order_12345
1) "userId"
2) "user_456"
3) "status"
4) "active"
5) "remaining"
6) "75.0"  # 부분 체결 후
```

### **PostgreSQL (영구 기록)**
```sql
-- 주문 히스토리
SELECT * FROM order_history WHERE redis_order_id = 'order_12345';
/*
id                  | redis_order_id | status | filled_amount | created_at
abc-def-123         | order_12345    | active | 25.0         | 2025-08-01 10:30:00
*/

-- 체결 기록
SELECT * FROM trade_history WHERE pair = 'HYPERINDEX-USDC' ORDER BY executed_at DESC LIMIT 5;
/*
buyer_order_id | seller_order_id | price  | amount | executed_at
abc-def-123    | xyz-789-456     | 1.4800 | 25.0   | 2025-08-01 10:30:01
*/
```

## 💡 핵심 설계 철학

### **Redis = "현재 상태"**
- 지금 당장 거래 가능한 주문들
- 실시간 매칭과 체결
- 밀리초 단위 응답속도
- 메모리 기반 초고속

### **PostgreSQL = "과거 기록"**  
- 모든 주문/거래의 영구 히스토리
- 사용자 통계와 분석
- ACID 보장으로 데이터 무결성
- 디스크 기반 대용량 저장

## 🔥 장점

1. **초고속 거래**: Redis로 <10ms 매칭
2. **데이터 안전성**: PostgreSQL로 영구 보존
3. **확장성**: Redis 클러스터로 수평 확장
4. **분석 가능**: PostgreSQL로 복잡한 쿼리
5. **장애 복구**: PostgreSQL에서 Redis 재구축 가능

## ⚠️ 주의사항

1. **동기화 지연**: Redis와 PostgreSQL 간 몇 초 차이 가능
2. **Redis 장애시**: PostgreSQL에서 오더북 재구축 필요
3. **데이터 일관성**: 배치 동기화로 최종 일관성 보장
4. **메모리 관리**: Redis 메모리 부족시 LRU 정책 적용

이것이 현재 구현된 **하이브리드 아키텍처**의 정확한 동작 방식입니다! 🚀