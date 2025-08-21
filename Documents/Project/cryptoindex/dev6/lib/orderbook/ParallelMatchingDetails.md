# Parallel Matching Engine 상세 분석

## 1. 샤딩 전략

### A. 페어 기반 샤딩
```
전체 거래 페어를 CPU 코어 수만큼 분할

Shard 0: ETH/USDC, BTC/USDC, MATIC/USDC
Shard 1: ETH/BTC, USDC/DAI, LINK/USDC  
Shard 2: UNI/USDC, AAVE/USDC, SNX/USDC
...
Shard 7: 나머지 페어들

각 샤드는 독립적인 Worker Thread에서 실행
```

### B. 일관성 해시 알고리즘
```typescript
function getShardForPair(pair: string): number {
  let hash = 0;
  for (let i = 0; i < pair.length; i++) {
    hash = ((hash << 5) - hash) + pair.charCodeAt(i);
  }
  return Math.abs(hash) % SHARD_COUNT;
}

// 예시:
ETH/USDC → hash: 12345 → 12345 % 8 = Shard 5
BTC/USDC → hash: 67890 → 67890 % 8 = Shard 2
```

## 2. Worker Thread 구조

### A. 메인 스레드 (Coordinator)
```
역할:
- 주문 수신 및 라우팅
- 샤드별 작업 분배  
- 결과 수집 및 응답
- 로드 밸런싱
- 장애 복구
```

### B. 워커 스레드 (Matcher)  
```
역할:
- 실제 주문 매칭 수행
- 오더북 상태 관리
- 거래 생성 및 검증
- 성능 메트릭 수집
```

## 3. 성능 최적화 기법

### A. 배치 처리
```
단일 주문: 1개씩 처리 → 높은 오버헤드
배치 처리: 100개씩 묶어서 처리 → 오버헤드 감소

성능 향상: 3-5배
```

### B. 파이프라이닝
```
Stage 1: 주문 검증 (Shard A)
Stage 2: 매칭 수행 (Shard B)  
Stage 3: 결과 저장 (Shard C)

동시에 3단계가 병렬 실행
```

### C. 메모리 지역성
```
같은 페어의 주문들을 같은 샤드에서 처리
→ 캐시 히트율 증가
→ 메모리 접근 속도 향상
```