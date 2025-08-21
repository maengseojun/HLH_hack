# 🔄 HyperIndex 하이브리드 거래 시스템 아키텍처
*작성일: 2025-08-01*

## 📋 문서 개요
HyperEVM 기반 밈코인 인덱스 토큰을 위한 하이브리드 탈중앙화 거래 시스템의 상세 설계 및 구현 방안

---

## 🎯 프로젝트 목표

### **핵심 목표**
- HyperEVM 네트워크에서 인덱스 토큰을 위한 하이브리드 거래 시스템 구축
- AMM의 깊은 유동성과 오프체인 오더북의 CEX 수준 UX 결합
- Dutch Auction 비용 없이 즉시 거래 가능한 플랫폼

### **핵심 가치**
```typescript
interface CoreValue {
  noDutchAuction: "HyperCore 진입 비용 회피";
  hybridTrading: "AMM + Orderbook 최적 조합";
  externalTracking: "실제 토큰 보유 없이 가격만 추적";
  cexUX: "중앙거래소 수준의 사용자 경험";
}
```

---

## 🏗️ 시스템 아키텍처

### **1. 온체인 모듈 (HyperEVM)**
```typescript
interface OnChainModules {
  // 인덱스 토큰 컨트랙트 -> 이 부분은 다른 팀원이 수정 필요. (우리 담당 아님, 다만 ERC-20인거까지는 확정.)
  indexToken: {
    standard: "ERC-20";
    priceCalculation: "Chainlink 오라클 기반 NAV";
    components: ["DOGE", "PEPE", "SHIB", "JINDOGE"];
  };
  
  // AMM 컨트랙트
  amm: {
    type: "Uniswap V2 변형 (향후 V3 확장 가능)";
    pair: "HYPERINDEX/USDC";
    features: ["자동 스왑", "LP 제공", "수수료 분배"];
    twap: "V3 스타일 TWAP 오라클 제공";
  };
  
  // 스마트 라우터
  router: {
    purpose: "최적 가격 경로 탐색";
    logic: "오더북 우선 → AMM 보조";
    gasOptimization: "배치 처리 지원";
  };
}
```

### **2. 오프체인 모듈**
```typescript
interface OffChainModules {
  // 오더북 서버
  orderbook: {
    database: "Redis/PostgreSQL 하이브리드";
    matching: "Price-Time Priority";
    performance: "<10ms 매칭 속도";
  };
  
  // 모니터링 봇
  monitoringBot: {
    function: "AMM 가격 실시간 감시";
    trigger: "지정가 도달 시 오더북-유저주문 매칭 실행";
    frequency: "블록별 체크 (1초 or 그 이하하)";
  };
  
  // 실행 봇
  executionBot: {
    function: "오프체인 매칭 → 온체인 정산";
    batching: "가스 효율을 위한 배치 처리";
    metatx: "사용자 대신 트랜잭션 실행";
  };
}
```

---

## 💡 핵심 로직: 스마트 라우터 작동 방식

### **핵심 원칙: "유저에게 가장 낮은 가격과 편의성 제공"**

### **주문 유형별 처리 로직**
```typescript
interface OrderProcessingLogic {
  // 지정가(Limit) 주문
  limitOrder: {
    기본동작: "오더북에 등록";
    예외케이스: {
      condition: "limit 가격이 AMM 시장가보다 불리한 경우";
      option1: "주문 거부 (추천)";
      option2: "시장가로 즉시 체결";
    };
    구조적제약: "AMM보다 좋은 가격은 시스템이 자동 차단";
  };
  
  // 시장가(Market) 주문
  marketOrder: {
    원칙: "항상 최저가 제공";
    우선순위: {
      1: "현재 최적 가격 확인 (AMM vs 오더북)";
      2: "AMM이 더 유리 → AMM 실행";
      3: "AMM = 오더북 → 오더북 우선 소진";
      4: "오더북 소진 후 → AMM으로 전환"
      5: "AMM = 오더북으로 다시 가격이 변동하면 다시 오더북으로 전환"
      6: "주문 모두 Fill 될때까지 과정 반복";
    };
  };
}
```

### **시장가 주문 상세 처리**
```typescript
async processMarketOrder(order: MarketOrder) {
  let remainingAmount = order.amount;
  const fills: Fill[] = [];
  
  while (remainingAmount > 0) {
    // 1. 현재 AMM 가격과 오더북 최우선 호가 비교
    const ammPrice = await amm.getSpotPrice();
    const bestOrderbookPrice = await orderbook.getBestPrice(order.side);
    
    // 2. 가격 비교 및 실행 결정
    if (!bestOrderbookPrice || ammPrice < bestOrderbookPrice) {
      // 시나리오 1: AMM이 더 유리한 경우
      // AMM으로 처리하되, 다음 오더북 호가와 같아질 때까지만
      const nextOrderbookPrice = await orderbook.getNextPrice(order.side);
      const ammExecuteAmount = calculateAmountUntilPrice(ammPrice, nextOrderbookPrice);
      
      const executeAmount = Math.min(remainingAmount, ammExecuteAmount);
      const fill = await amm.swap(executeAmount);
      fills.push(fill);
      
      remainingAmount -= executeAmount;
      
    } else if (ammPrice === bestOrderbookPrice) {
      // 시나리오 2: AMM = 오더북 가격인 경우
      // 오더북 우선 처리 (해당 가격대 모두 소진)
      const orderbookAmount = await orderbook.getAmountAtPrice(bestOrderbookPrice);
      const executeAmount = Math.min(remainingAmount, orderbookAmount);
      
      const fill = await orderbook.executeTrade(bestOrderbookPrice, executeAmount);
      fills.push(fill);
      
      remainingAmount -= executeAmount;
      
    } else {
      // 이론적으로 발생하지 않음 
      console.error("Price anomaly detected");
      break;
    }
  }
  
  return fills;
}
```

### **지정가 주문 처리**
```typescript
async processLimitOrder(order: LimitOrder) {
  const ammPrice = await amm.getSpotPrice();
  
  // 매수 지정가가 AMM보다 높거나, 매도 지정가가 AMM보다 낮은 경우
  if (order.side === 'buy' && order.price > ammPrice ||
      order.side === 'sell' && order.price < ammPrice) {
    
    // 옵션 1: 주문 거부 (권장)
    throw new Error("Limit price crosses market price. Place market order instead.");
    
    // 옵션 2: 시장가로 전환 실행 (대안)
    // return await processMarketOrder({ ...order, type: 'market' });
  }
  
  // 정상적인 지정가: 오더북에 등록
  await orderbook.addOrder(order);
  
  // AMM 가격 모니터링 (지정가 도달 시 체결 - AMM에다가 처리하는 게 아니고, 사용자의 호가(지정가)에 시장가격이 도달할 시, 들어온 주문에 대해서 오프체인 즉시 체결이 되고, 그 즉시 온체인으로 거래가 이루어짐.)
  monitoringBot.watch(order);
}
```

### **가격 동기화 메커니즘**
```typescript
interface PriceSynchronization {
  principle: "시스템이 자동으로 가격 일관성 유지";
  
  mechanism: {
    systemEnforcement: "AMM보다 유리한 오더북 주문 자동 차단";
    result: "오더북 가격 ≥ AMM 가격 (항상)";
  };
  
  execution: {
    ammCheaper: "AMM 실행 → 가격 상승 → 오더북과 일치";
    orderbookCheaperThanAmm: "불가능 (시스템이 차단)";
    pricesEqual: "오더북 우선 소진 → AMM으로 전환";
  };
  
  whyNoArbitrage: "차익거래 기회가 애초에 생성되지 않음";
}

---

## 🔄 주요 거래 시나리오

### **시나리오 1: 시장가 매수 - AMM이 유리한 경우**
```typescript
interface MarketBuyScenario1 {
  initial: {
    ammPrice: "1.0000 USDC";
    orderbook: {
      asks: [
        { price: "1.0100", amount: "500" },  // 가장 낮은 매도호가
        { price: "1.0200", amount: "600" }
      ]
    };
    orderSize: "2500 INDEX 매수";
  };
  
  execution: {
    step1: {
      action: "AMM이 더 싸므로 AMM 실행";
      ammSwap: "1000개 매수";
      priceImpact: "AMM 가격 1.0000 → 1.0100 상승";
      reason: "AMM 가격이 가장 낮은 다음음 오더북 호가와 같아질 때까지"
    };
    step2: {
      action: "이제부터는 오더북 호가로 처리";
      orderbookTrade: "500개 매수";
      priceImpact: "오더북 호가를 처리한 것이기 때문에, 오더북 호가만 소진되고 AMM기준 Market Price는 아직도 1.0100";
    };
    step3: {
      action: "남은 물량 AMM 처리";
      ammSwap: "300개 매수";
      priceImpact: "AMM가격이 다음 오더북 호가와 같아질 때까지 계속해서 AMM으로 처리, AMM가격이 1.0200이 되었음.";
    };
    step4: {
      action: "이제부터는 오더북 호가로 처리";
      ammSwap: "600개 매수";
      priceImpact: "A오더북 호가 처리한거니까, AMM Price Impact 없음. 그대로 Market Price는 1.0200 유지, 오더북의 호가는 소진되었음";
    };
    step5: {
      action: "남은 물량 AMM 처리";
      ammSwap: "100개 매수";
      priceImpact: "AMM가격이 다음 오더북 호가와 같아질 때까지 계속해서 AMM으로 처리리";
    };
  };
  
  result: {
    averagePrice: "~1.0050 USDC";
    routing: "100% AMM";
  };
}
```

### **시나리오 2: 시장가 매수 - AMM과 오더북 가격이 같은 경우**
```typescript
interface MarketBuyScenario2 {
  initial: {
    ammPrice: "1.0100 USDC";
    orderbook: {
      asks: [
        { price: "1.0100", amount: "500" },  // AMM과 동일
        { price: "1.0200", amount: "300" }
      ]
    };
    orderSize: "2500 INDEX 매수";
  };
  
  execution: {
    step1: {
      action: "오더북 우선 소진";
      orderbookTrade: "500개 @ 1.0100";
      reason: "AMM = 오더북일 때는 오더북 우선"
    };
    step2: {
      action: "남은 물량 AMM 처리";
      ammSwap: "500개 매수";
      priceImpact: "AMM 가격 1.0100 → 1.0200 상승";
    };
  };
  
  result: {
    averagePrice: "~1.0150 USDC";
    routing: "50% 오더북, 50% AMM";
  };
}
```

### **시나리오 3: 지정가 주문 처리**
```typescript
interface LimitOrderScenarios {
  // 정상적인 지정가 매수
  normalBuyLimit: {
    order: { type: "limit", side: "buy", price: "0.9900", amount: "1000" };
    ammPrice: "1.0000";
    action: "오더북에 등록 (AMM보다 낮은 가격이므로 정상)";
  };
  
  // 비정상적인 지정가 매수 (AMM보다 높은 가격)
  abnormalBuyLimit: {
    order: { type: "limit", side: "buy", price: "1.0100", amount: "1000" };
    ammPrice: "1.0000";
    option1: "주문 거부 - '시장가보다 높은 매수 지정가입니다'";
    option2: "시장가로 즉시 체결 @ 1.0000";
  };
  
  // 정상적인 지정가 매도
  normalSellLimit: {
    order: { type: "limit", side: "sell", price: "1.0100", amount: "1000" };
    ammPrice: "1.0000";
    action: "오더북에 등록 (AMM보다 높은 가격이므로 정상)";
  };
}
```

---

## 📊 개발 로드맵

### **Phase 1: 온체인 유동성 시스템 (2-3주)**
```typescript
interface Phase1Tasks {
  week1: {
    "인덱스 토큰 컨트랙트": "ERC-20 + Oracle 통합";
    "기본 AMM 구현": "Uniswap V2 포크";
    "USDC 페어 생성": "초기 유동성 제공";
  };
  
  week2: {
    "LP 토큰 시스템": "유동성 공급자 보상";
    "TWAP 오라클": "가격 조작 방지";
    "가스 최적화": "배치 스왑 지원";
  };
}
```

### **Phase 2: 오프체인 주문 시스템 (3-4주)**
```typescript
interface Phase2Tasks {
  week3_4: {
    "오더북 데이터베이스": "Redis + PostgreSQL";
    "매칭 엔진": "Price-Time Priority";
    "WebSocket 서버": "실시간 업데이트";
  };
  
  week5_6: {
    "모니터링 봇": "블록별 가격 체크";
    "실행 봇": "메타트랜잭션 처리";
    "오류 처리": "실패 복구 메커니즘";
  };
}
```

### **Phase 3: UI/UX 및 통합 (2-3주)**
```typescript
interface Phase3Tasks {
  frontend: {
    "거래 인터페이스": "CEX 스타일 UI";
    "실시간 차트": "TradingView 통합";
    "오더북 시각화": "Depth Chart";
  };
  
  integration: {
    "스마트 라우터": "최적 경로 알고리즘";
    "세션 시스템": "Privy 기반 gasless";
    "성능 최적화": "캐싱 및 압축";
  };
}
```

---

## 🎯 기술적 구현 상세

### **1. 인덱스 토큰 컨트랙트**
```solidity
contract HyperIndexToken is ERC20 {
    struct Component {
        address priceFeed;  // Chainlink oracle
        uint256 weight;     // Basis points (e.g., 3000 = 30%)
    }
    
    mapping(string => Component) public components;
    
    function calculateNAV() public view returns (uint256) {
        uint256 totalValue = 0;
        
        // DOGE: 30%, PEPE: 25%, SHIB: 20%, Others: 25%
        totalValue += getPrice("DOGE") * components["DOGE"].weight;
        totalValue += getPrice("PEPE") * components["PEPE"].weight;
        totalValue += getPrice("SHIB") * components["SHIB"].weight;
        
        return totalValue / 10000; // Normalize by basis points
    }
}
```

### **2. AMM 스마트 컨트랙트**
```solidity
contract HyperIndexAMM {
    // Uniswap V2 스타일 with V3 TWAP
    uint256 public reserve0; // HYPERINDEX
    uint256 public reserve1; // USDC
    
    // TWAP variables
    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;
    uint32 public blockTimestampLast;
    
    function swap(uint256 amountIn, address tokenIn) external {
        require(amountIn > 0, "Invalid amount");
        
        // Calculate output with fee
        uint256 amountOut = getAmountOut(amountIn, tokenIn);
        
        // Update reserves
        updateReserves();
        
        // Update TWAP
        updateTWAP();
        
        // Transfer tokens
        transferTokens(amountOut);
    }
}
```

### **3. 오더북 매칭 엔진**
```typescript
class OrderBookEngine {
  private bids: PriorityQueue<Order>;
  private asks: PriorityQueue<Order>;
  
  async matchOrder(incomingOrder: Order): Promise<Fill[]> {
    const fills: Fill[] = [];
    const oppositeSide = incomingOrder.side === 'buy' ? this.asks : this.bids;
    
    while (!oppositeSide.isEmpty() && incomingOrder.remainingAmount > 0) {
      const bestOrder = oppositeSide.peek();
      
      if (!this.canMatch(incomingOrder, bestOrder)) break;
      
      const fillAmount = Math.min(
        incomingOrder.remainingAmount,
        bestOrder.remainingAmount
      );
      
      fills.push(await this.executeFill(incomingOrder, bestOrder, fillAmount));
    }
    
    return fills;
  }
}
```

---

## 📈 성과 측정 지표

### **시스템 KPI**
```typescript
interface SystemKPIs {
  performance: {
    orderLatency: "<100ms";
    matchingSpeed: "<10ms";
    gasEfficiency: "30% AMM 대비 절감";
  };
  
  liquidity: {
    tvl: "$1M+ (목표)";
    dailyVolume: "$500K+ (목표)";
    slippage: "<0.5% for $10K trades";
  };
  
  userExperience: {
    orderTypes: ["Market", "Limit", "Stop", "TP/SL"];
    fillRate: ">95%";
    uptime: "99.9%";
  };
}
```

---

## 🔒 보안 고려사항

### **스마트 컨트랙트 보안**
- Reentrancy 방지
- Oracle 조작 방지 (TWAP 사용)
- Overflow/Underflow 체크
- Emergency pause 기능

### **오프체인 보안**
- 서명 검증 시스템
- Rate limiting
- DDoS 방어
- 주문 무결성 검증

---

## 💡 차별화 포인트

### **vs 순수 AMM (Uniswap)**
- ✅ 지정가 주문 지원
- ✅ 슬리피지 최소화
- ✅ CEX 수준 거래 경험

### **vs 순수 오더북 (dYdX)**
- ✅ 24/7 유동성 보장
- ✅ 간편한 스왑 기능
- ✅ LP 수익 기회

### **vs HyperCore 직접 사용**
- ✅ Dutch Auction 비용 없음
- ✅ 즉시 배포 가능
- ✅ 완전한 컨트롤

---

## 🚀 결론

HyperIndex 하이브리드 거래 시스템은:
- **비용 효율적**: Dutch Auction 없이 즉시 거래
- **사용자 친화적**: AMM의 간편함 + 오더북의 정밀함
- **확장 가능**: 추후 Aggregator 통합 가능
- **현실적**: 8-12주 내 완전 구현 가능

**"Best of Both Worlds" - AMM과 오더북의 장점만을 결합한 차세대 DEX**