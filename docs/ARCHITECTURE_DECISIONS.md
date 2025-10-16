# 🏗️ HyperIndex 아키텍처 설계 결정 (Architecture Decision Records)

> **"왜 이렇게 만들었나요?"**  
> 각 컴포넌트의 역할과 선택 이유를 구체적으로 설명합니다.

---

## 📋 목차

1. [레이어별 역할 및 책임](#레이어별-역할-및-책임)
2. [Redis - 왜 필요한가?](#redis---왜-필요한가)
3. [Backend API Routes - 왜 필요한가?](#backend-api-routes---왜-필요한가)
4. [기술 선택의 이유](#기술-선택의-이유)
5. [실전 시나리오로 이해하기](#실전-시나리오로-이해하기)

---

## 레이어별 역할 및 책임

### 🎨 Frontend (Next.js 15) - "사용자 접점"

**역할**: 사용자와 직접 상호작용하는 UI 레이어

#### 왜 Next.js인가?
```
문제: React만으로는 부족한 것들
- SEO (검색 엔진 최적화) 어려움
- 초기 로딩 속도 느림
- 이미지 최적화 수동 작업
- 라우팅 복잡함

해결: Next.js 채택
✅ 서버 사이드 렌더링 (SSR) → SEO 좋음
✅ 정적 사이트 생성 (SSG) → 빠른 로딩
✅ 자동 이미지 최적화
✅ 파일 기반 라우팅 → 직관적
✅ API Routes (우리는 안 씀, Backend 따로 분리)
```

#### 구체적인 역할
```typescript
// 1. 사용자 입력 받기
function SwapForm() {
  const [amount, setAmount] = useState('');
  
  return (
    <input 
      value={amount}
      onChange={(e) => setAmount(e.target.value)}
      placeholder="스왑할 금액"
    />
  );
}

// 2. 월렛 연결 관리 (Privy)
function WalletConnect() {
  const { login, user } = usePrivy();
  
  return (
    <button onClick={login}>
      {user ? `연결됨: ${user.wallet.address}` : '월렛 연결'}
    </button>
  );
}

// 3. 블록체인 직접 통신 (ethers.js)
async function executeSwap() {
  const contract = new ethers.Contract(ROUTER_ADDRESS, ABI, signer);
  const tx = await contract.swapExactTokensForTokens(...);
  await tx.wait(); // 블록체인 확인 대기
}

// 4. Backend API 호출
async function getPortfolio() {
  const response = await fetch('/api/v1/portfolio/0x1234...');
  const data = await response.json();
  return data;
}
```

**핵심 포인트**:
- 사용자가 보는 **모든 것**은 Frontend에서 렌더링
- 월렛 연결, 트랜잭션 서명은 **브라우저에서만** 가능
- 민감한 로직(가격 계산 등)은 Backend에 위임

---

### 🔧 Backend (Express.js) - "비즈니스 로직 처리"

**역할**: Frontend와 블록체인 사이의 중간 레이어

#### ❓ 왜 Backend가 필요한가?

**문제 상황**: Frontend만으로는 할 수 없는 것들
```javascript
// ❌ Frontend에서 이렇게 하면 안 되는 이유

// 1. HyperLiquid API 직접 호출 (Frontend에서)
async function getPriceFromAPI() {
  const response = await fetch('https://api.hyperliquid.xyz/info', {
    headers: {
      'API-KEY': 'secret_key_12345' // ❌ 노출됨!
    }
  });
}
// 문제: API 키가 브라우저에 노출됨 → 악용 가능

// 2. 복잡한 계산 (Frontend에서)
function calculateOptimalRoute(tokenA, tokenB) {
  // 10,000개 풀을 순회하며 최적 경로 찾기
  for (let i = 0; i < 10000; i++) {
    // 복잡한 계산...
  }
}
// 문제: 사용자 브라우저가 느려짐

// 3. 데이터베이스 접근 (Frontend에서)
const db = await connectDatabase(); // ❌ 불가능!
// 문제: 보안상 브라우저에서 직접 DB 접근 불가
```

**해결**: Backend 서버 도입
```typescript
// ✅ Backend에서 안전하게 처리

// 1. API 키 보호
// backend/src/services/hyperliquid.ts
export class HyperLiquidService {
  private apiKey = process.env.HYPERLIQUID_API_KEY; // 환경변수 (안전)
  
  async getPrice(pair: string) {
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      headers: { 'API-KEY': this.apiKey }
    });
    return response.json();
  }
}

// 2. 무거운 계산 서버에서 처리
async function findBestRoute(tokenA: string, tokenB: string) {
  // 서버 CPU로 계산
  const routes = await calculateAllPossibleRoutes(tokenA, tokenB);
  return routes.sort((a, b) => b.outputAmount - a.outputAmount)[0];
}

// 3. 데이터베이스 안전하게 접근
async function getUserTransactions(address: string) {
  const transactions = await db.query(
    'SELECT * FROM transactions WHERE user_address = $1',
    [address]
  );
  return transactions;
}
```

#### 📍 API Routes의 구체적 역할

**API Routes = "메뉴판"**

음식점 비유:
```
사용자(Frontend) → 웨이터(API Routes) → 주방(Services) → 재료창고(Database/Cache)

메뉴판(API Routes):
- /api/v1/trading/swap     → "스왑 주세요"
- /api/v1/portfolio        → "내 자산 보여주세요"
- /api/v1/amm/pairs        → "거래 가능한 페어 목록 주세요"
```

**실제 코드로 보는 역할**:
```typescript
// backend/src/routes/trading.ts
import { Router } from 'express';

const router = Router();

// 1️⃣ 엔드포인트 정의 (URL 매핑)
router.post('/swap', 
  authMiddleware,        // 2️⃣ 인증 확인
  validateSwap,          // 3️⃣ 입력 검증
  executeSwapController  // 4️⃣ 실제 처리
);

export default router;
```

**각 단계의 역할**:
```typescript
// 2️⃣ authMiddleware - "신분증 확인"
function authMiddleware(req, res, next) {
  const token = req.headers.authorization;
  
  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }
  
  try {
    const user = verifyJWT(token);
    req.user = user; // 다음 단계로 전달
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// 3️⃣ validateSwap - "주문 확인"
function validateSwap(req, res, next) {
  const { tokenIn, tokenOut, amountIn } = req.body;
  
  if (!tokenIn || !tokenOut || !amountIn) {
    return res.status(400).json({ 
      error: 'Missing required fields' 
    });
  }
  
  if (amountIn <= 0) {
    return res.status(400).json({ 
      error: 'Amount must be positive' 
    });
  }
  
  next(); // 검증 통과!
}

// 4️⃣ executeSwapController - "주문 처리"
async function executeSwapController(req, res) {
  try {
    const result = await tradingService.executeSwap(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
```

#### 🔄 Backend Services - "실제 일하는 곳"

**Services = Controller와 데이터 사이의 비즈니스 로직**

```typescript
// backend/src/services/trading.ts
export class TradingService {
  constructor(
    private cache: CacheService,
    private hypercore: HyperCoreService,
    private db: Database
  ) {}
  
  async executeSwap(params: SwapParams) {
    // 1. 캐시에서 최신 가격 확인
    let price = await this.cache.getPrice(params.pair);
    
    // 2. 캐시 미스면 HyperLiquid API 호출
    if (!price) {
      price = await this.hypercore.getPrice(params.pair);
      await this.cache.setPrice(params.pair, price, 60);
    }
    
    // 3. 슬리피지 계산
    const slippage = calculateSlippage(params.amountIn, price);
    if (slippage > params.maxSlippage) {
      throw new Error('Slippage too high');
    }
    
    // 4. 트랜잭션 기록 (나중에 조회 가능하게)
    await this.db.saveTransaction({
      user: params.user,
      type: 'swap',
      status: 'pending',
      ...params
    });
    
    return { price, slippage, txHash: '0x...' };
  }
}
```

**왜 Controller와 Service를 분리하나?**
```
❌ 분리 안 하면:
- Controller가 너무 비대해짐
- 같은 로직을 여러 곳에서 중복 작성
- 테스트 어려움

✅ 분리하면:
- Controller: HTTP 요청/응답만 처리
- Service: 재사용 가능한 비즈니스 로직
- 테스트하기 쉬움
```

---

### 💾 Redis - "초고속 메모리 캐시"

#### ❓ 왜 Redis가 필요한가?

**문제 상황**: API 호출이 너무 느리고 비싸다

```typescript
// ❌ Redis 없이 매번 API 호출
async function getPrice(pair: string) {
  // HyperLiquid API 호출 (200ms 소요)
  const price = await fetch('https://api.hyperliquid.xyz/...');
  return price;
}

// 사용자가 페이지를 리프레시할 때마다:
// 1초에 5번 → 5번 API 호출 → 1초 대기 😱
// 100명이 동시 접속 → 500번 API 호출 → 서버 과부하 💥
```

**해결**: Redis 캐싱
```typescript
// ✅ Redis로 캐싱
async function getPrice(pair: string) {
  // 1. 먼저 Redis 확인 (1ms 소요)
  const cached = await redis.get(`price:${pair}`);
  if (cached) {
    console.log('✅ 캐시 HIT - 초고속!');
    return JSON.parse(cached);
  }
  
  // 2. 캐시 미스면 API 호출 (200ms)
  console.log('❌ 캐시 MISS - API 호출');
  const price = await fetch('https://api.hyperliquid.xyz/...');
  
  // 3. Redis에 저장 (60초간 유효)
  await redis.setex(`price:${pair}`, 60, JSON.stringify(price));
  
  return price;
}

// 이제 1초에 5번 리프레시해도:
// 첫 요청: 200ms (API 호출)
// 나머지 4번: 1ms (Redis에서 가져옴) → 총 204ms ⚡
```

#### 🎯 Redis의 구체적 사용 사례

**1. 가격 데이터 캐싱**
```typescript
// 10초마다 업데이트되는 가격
await redis.setex('price:ETH-USDC', 10, JSON.stringify({
  price: 2500.00,
  timestamp: Date.now()
}));
```

**2. 풀 상태 캐싱**
```typescript
// 1분마다 업데이트되는 유동성 풀 정보
await redis.setex('pool:0xpair123', 60, JSON.stringify({
  reserve0: '100000000000000000000',
  reserve1: '250000000000',
  tvl: '500000.00'
}));
```

**3. 세션 관리**
```typescript
// 사용자 로그인 상태 (24시간)
await redis.setex('session:jwt:abc123', 86400, JSON.stringify({
  userId: 'user123',
  address: '0x1234...',
  loginTime: Date.now()
}));
```

**4. Rate Limiting (요청 제한)**
```typescript
// 1분에 100번만 허용
async function checkRateLimit(userId: string) {
  const key = `ratelimit:${userId}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, 60); // 1분 후 리셋
  }
  
  if (count > 100) {
    throw new Error('Too many requests');
  }
}
```

#### 📊 Redis vs Database 비교

```
상황: 사용자 포트폴리오 조회

┌─────────────────┬──────────────┬───────────────┐
│                 │  PostgreSQL  │     Redis     │
├─────────────────┼──────────────┼───────────────┤
│ 응답 속도       │   50-200ms   │    1-5ms      │
│ 데이터 영속성   │      ✅      │  ❌ (TTL 만료)│
│ 복잡한 쿼리     │      ✅      │      ❌       │
│ 비용            │     높음     │     낮음      │
│ 용도            │  영구 저장   │   임시 캐싱   │
└─────────────────┴──────────────┴───────────────┘

전략:
- 자주 조회, 자주 변함: Redis (가격, 풀 상태)
- 가끔 조회, 영구 보관: Database (거래 내역, 사용자 정보)
```

#### 🔄 실전 캐싱 전략

```typescript
class CacheService {
  // 계층적 캐싱 전략
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    // 1️⃣ L1 Cache: Redis 확인
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // 2️⃣ Cache Miss: 실제 데이터 가져오기
    const data = await fetchFn();
    
    // 3️⃣ Redis에 저장
    await this.redis.setex(key, ttl, JSON.stringify(data));
    
    return data;
  }
}

// 사용 예시
const pairData = await cache.getOrFetch(
  'pool:ETH-USDC',
  async () => {
    // 블록체인에서 직접 조회 (느림)
    return await pairContract.getReserves();
  },
  60 // 60초 캐싱
);
```

---

### 🔗 Smart Contracts - "탈중앙화 로직"

**역할**: 블록체인에서 실행되는 신뢰할 수 있는 코드

#### ❓ 왜 Backend가 아닌 Smart Contract인가?

```
Backend 서버의 문제:
❌ 중앙화됨 (서버 다운되면 서비스 중단)
❌ 신뢰 필요 (운영자를 믿어야 함)
❌ 데이터 조작 가능

Smart Contract의 장점:
✅ 탈중앙화 (블록체인에서 실행)
✅ 신뢰 불필요 (코드가 곧 법)
✅ 데이터 불변성 (변조 불가능)
✅ 투명성 (모든 거래 기록 공개)
```

#### 🎯 각 Contract의 역할

**1. AMM (Automated Market Maker)**
```solidity
// HyperIndexPair.sol
contract HyperIndexPair {
    uint112 reserve0;  // ETH: 100개
    uint112 reserve1;  // USDC: 250,000개
    
    // 스왑 실행 (Backend가 아닌 블록체인에서!)
    function swap(uint amount0Out, uint amount1Out) external {
        // x * y = k 검증
        require(
            reserve0 * reserve1 >= k,
            "Insufficient liquidity"
        );
        
        // 토큰 전송 (블록체인이 보장)
        token0.transfer(msg.sender, amount0Out);
        
        // 상태 업데이트
        reserve0 -= amount0Out;
    }
}
```

**왜 Backend가 아닌 Contract로?**
```typescript
// ❌ Backend에서 스왑 처리하면:
async function swap(from, to, amount) {
  // 1. DB에서 잔액 확인
  const balance = await db.getBalance(from);
  
  // 2. 잔액 차감
  await db.updateBalance(from, balance - amount);
  await db.updateBalance(to, balance + amount);
}
// 문제: 
// - DB 관리자가 잔액 조작 가능 😱
// - 서버 해킹되면 모든 자금 위험 💀
// - 서버 다운되면 거래 불가 ⛔

// ✅ Smart Contract로 하면:
// - 블록체인이 잔액 보장
// - 코드 공개 → 투명성
// - 탈중앙화 → 항상 작동
```

**2. HyperCore Integration**
```solidity
contract HyperCoreActions {
    ICoreWriter constant CORE_WRITER = 
        ICoreWriter(0x3333333333333333333333333333333333333333);
    
    function sendAction(bytes calldata data) external {
        // HyperCore L1에 직접 전송 (초고속)
        CORE_WRITER.sendRawAction(data);
    }
}
```

**왜 일반 Contract가 아닌 Precompile인가?**
```
일반 Contract:
  Solidity 작성 → 컴파일 → 배포 → 실행 (느림)
  처리 속도: 100ms

Precompile (CoreWriter):
  미리 컴파일됨 → 바로 실행 (빠름)
  처리 속도: 10ms ⚡
  
비유: 즉석 요리 vs 즉석 식품
```

---

## 기술 선택의 이유

### 📊 의사결정 매트릭스

#### Frontend: React vs Next.js vs Vue

```
요구사항:
✅ SEO 필요 (검색 노출)
✅ 빠른 초기 로딩
✅ 월렛 연동
✅ 복잡한 상태 관리

┌──────────┬─────────┬──────────┬──────────┐
│          │  React  │ Next.js  │   Vue    │
├──────────┼─────────┼──────────┼──────────┤
│ SEO      │    ❌   │    ✅    │    ✅    │
│ SSR      │  수동   │   자동   │   수동   │
│ 생태계   │  풍부   │   풍부   │   보통   │
│ 학습곡선 │  중간   │   중간   │   쉬움   │
│ Web3     │    ✅   │    ✅    │    ⚠️   │
└──────────┴─────────┴──────────┴──────────┘

결정: Next.js 15
이유: SSR, SEO, Web3 생태계 모두 충족
```

#### Backend: Next.js API Routes vs Express

```
요구사항:
✅ Redis 연동
✅ 복잡한 미들웨어
✅ WebSocket 지원 (향후)
✅ 마이크로서비스 확장

┌──────────────┬────────────┬──────────────┐
│              │  Next API  │   Express    │
├──────────────┼────────────┼──────────────┤
│ 간단한 API   │     ✅     │      ✅      │
│ 복잡한 로직  │     ⚠️     │      ✅      │
│ 미들웨어     │    제한적  │     풍부     │
│ WebSocket    │     ❌     │      ✅      │
│ 독립 배포    │     ❌     │      ✅      │
└──────────────┴────────────┴──────────────┘

결정: Express.js 분리
이유: 
- Backend 로직이 복잡함 (HyperCore 통합)
- Frontend와 독립적으로 스케일링
- 풍부한 미들웨어 생태계
```

#### Cache: In-Memory vs Redis vs Memcached

```
요구사항:
✅ 초고속 응답
✅ 여러 서버 간 공유
✅ 영속성 옵션
✅ 복잡한 데이터 구조

┌──────────────┬────────────┬──────────┬──────────────┐
│              │ In-Memory  │  Redis   │  Memcached   │
├──────────────┼────────────┼──────────┼──────────────┤
│ 속도         │   최고     │   매우빠름│    매우빠름  │
│ 공유         │     ❌     │    ✅    │      ✅      │
│ 영속성       │     ❌     │    ✅    │      ❌      │
│ 데이터구조   │   간단     │   풍부   │     간단     │
│ 인기도       │     -      │    ✅    │      ⚠️     │
└──────────────┴────────────┴──────────┴──────────────┘

결정: Redis
이유:
- Docker 환경에서 여러 컨테이너 공유
- String, Hash, List 등 다양한 자료구조
- 영속성 옵션 (재시작 시 데이터 보존)
```

---

## 실전 시나리오로 이해하기

### 🎬 시나리오 1: 사용자가 ETH를 USDC로 스왑

**전체 흐름 (각 레이어의 역할)**

```
1️⃣ Frontend (Next.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
사용자: "10 ETH를 USDC로 바꾸고 싶어요"

// app/trading/page.tsx
function TradingPage() {
  const [amount, setAmount] = useState('10');
  
  const handleSwap = async () => {
    // 1-1. 먼저 견적 조회 (Backend API)
    const quote = await fetch('/api/v1/trading/quote?tokenIn=ETH&amountIn=10');
    // → Backend로 요청 전달
    
    // 1-2. 사용자에게 확인
    if (confirm(`${quote.amountOut} USDC를 받습니다. 진행할까요?`)) {
      // 1-3. 실제 스왑 (Smart Contract 직접 호출)
      const tx = await routerContract.swapExactTokensForTokens(...);
      await tx.wait();
      
      // 1-4. 완료 후 Backend에 기록
      await fetch('/api/v1/trading/history', {
        method: 'POST',
        body: JSON.stringify({ txHash: tx.hash })
      });
    }
  };
}
```

```
2️⃣ Backend (Express.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
요청: GET /api/v1/trading/quote?tokenIn=ETH&amountIn=10

// routes/trading.ts
router.get('/quote', async (req, res) => {
  // 2-1. 입력 검증
  if (!req.query.tokenIn || !req.query.amountIn) {
    return res.status(400).json({ error: 'Missing params' });
  }
  
  // 2-2. Service 호출
  const quote = await tradingService.getQuote(req.query);
  
  // 2-3. 응답
  res.json({ success: true, data: quote });
});

// services/trading.ts
async getQuote(params) {
  // 2-4. Redis 캐시 확인
  const cacheKey = `quote:${params.tokenIn}-${params.tokenOut}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached); // 캐시 HIT (1ms)
  }
  
  // 2-5. 캐시 MISS → 블록체인 조회
  const reserves = await pairContract.getReserves();
  const amountOut = calculateAmountOut(params.amountIn, reserves);
  
  // 2-6. Redis에 캐싱 (60초)
  await redis.setex(cacheKey, 60, JSON.stringify({ amountOut }));
  
  return { amountOut };
}
```

```
3️⃣ Redis (Cache)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
상태: 메모리에 저장된 데이터

{
  "quote:ETH-USDC": {
    "value": "{\"amountOut\":\"24500\"}",
    "ttl": 45  // 45초 남음
  },
  "pool:0xpair123:reserves": {
    "value": "{\"reserve0\":\"100\",\"reserve1\":\"250000\"}",
    "ttl": 30
  },
  "session:jwt:abc123": {
    "value": "{\"userId\":\"user123\"}",
    "ttl": 86340  // 23시간 59분 남음
  }
}

동작:
- GET 요청 → 1ms 내 응답 ⚡
- SETEX 요청 → TTL 만료 시 자동 삭제
- 메모리만 사용 → 디스크 I/O 없음 (빠름)
```

```
4️⃣ Smart Contract (Blockchain)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
트랜잭션: swapExactTokensForTokens(10 ETH)

// HyperIndexRouter.sol
function swapExactTokensForTokens(...) external {
  // 4-1. 슬리피지 확인
  require(amountOut >= minAmountOut, "Slippage too high");
  
  // 4-2. Pair Contract 호출
  HyperIndexPair(pair).swap(0, amountOut, msg.sender);
}

// HyperIndexPair.sol
function swap(uint amount0Out, uint amount1Out) external {
  // 4-3. x * y = k 검증
  require(reserve0 * reserve1 >= k, "K");
  
  // 4-4. 토큰 전송 (블록체인이 보장)
  IERC20(token1).transfer(msg.sender, amount1Out);
  
  // 4-5. HyperCore L1에 기록
  CORE_WRITER.sendRawAction(abi.encode("SWAP", ...));
  
  // 4-6. 예비량 업데이트
  reserve0 += 10 ether;
  reserve1 -= amount1Out;
}
```

```
5️⃣ HyperCore (Blockchain L1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
상태: 최종 기록

Block #1234567
├─ Transaction: 0xabcd1234...
│  ├─ From: 0x사용자주소
│  ├─ To: HyperIndexRouter
│  ├─ Action: SWAP
│  ├─ Amount In: 10 ETH
│  ├─ Amount Out: 24,520 USDC
│  └─ Status: ✅ Confirmed
│
└─ State Changes:
   ├─ Pair Reserve0: 100 → 110 ETH
   ├─ Pair Reserve1: 250,000 → 225,480 USDC
   └─ User Balance: +24,520 USDC

특징:
- 불변성 (영원히 기록)
- 투명성 (누구나 검증 가능)
- 탈중앙화 (노드들이 분산 저장)
```

**각 레이어가 하는 일 요약**:
```
Frontend:  사용자 입력 → 예쁘게 표시
Backend:   빠른 조회 → 캐싱 → API 보호
Redis:     자주 쓰는 데이터 → 초고속 제공
Contract:  신뢰할 수 있는 로직 → 탈중앙화
HyperCore: 최종 기록 → 영구 보존
```

---

### 🎬 시나리오 2: 1000명이 동시 접속

**Redis 없이:**
```
1000명 → 동시에 가격 조회

각 요청마다:
- HyperLiquid API 호출 (200ms)
- 블록체인 RPC 호출 (300ms)

총 부하:
- API: 1000 * 200ms = 200초 분량 😱
- RPC: 1000 * 300ms = 300초 분량 💀
- 서버 과부하로 다운 ⛔

결과: 서비스 중단 ❌
```

**Redis 사용:**
```
1000명 → 동시에 가격 조회

첫 번째 요청:
- API 호출 (200ms)
- Redis에 캐싱

나머지 999번 요청:
- Redis에서 가져옴 (1ms * 999 = 1초)

총 부하:
- API: 200ms (1번만!)
- Redis: 1초
- 서버: 정상 작동 ✅

결과: 서비스 안정적 🚀
```

---

## 핵심 요약

### 🎯 각 레이어의 존재 이유

```
┌─────────────┬─────────────────┬──────────────────┐
│   레이어    │     주요 역할   │   왜 필요한가?   │
├─────────────┼─────────────────┼──────────────────┤
│ Frontend    │ UI/UX          │ 사용자 접점      │
│ Backend     │ 비즈니스 로직   │ 보안, 성능, 유연성│
│ Redis       │ 캐싱           │ 속도, 비용 절감  │
│ Contract    │ 탈중앙화 로직   │ 신뢰, 투명성     │
│ HyperCore   │ 최종 기록       │ 불변성, 보안     │
└─────────────┴─────────────────┴──────────────────┘
```

### 💡 설계 원칙

**1. 관심사의 분리 (Separation of Concerns)**
```
Frontend: 보여주기만 (UI)
Backend: 생각하기만 (Logic)
Database: 기억하기만 (Data)
```

**2. 단일 책임 원칙 (Single Responsibility)**
```
각 컴포넌트는 한 가지 일만 잘함:
- Redis: 캐싱만
- API Routes: 라우팅만
- Services: 비즈니스 로직만
```

**3. 느슨한 결합 (Loose Coupling)**
```
각 레이어는 독립적:
- Frontend 교체 가능 (React → Vue)
- Backend 교체 가능 (Express → Fastify)
- Cache 교체 가능 (Redis → Memcached)
```

---

## 🤔 자주 묻는 질문

**Q1: Backend 없이 Frontend에서 직접 블록체인 호출하면 안 되나요?**

A: 가능하지만 비효율적입니다.
```
Frontend만 사용:
❌ 매번 블록체인 조회 → 느림
❌ API 키 노출 → 위험
❌ 복잡한 계산 → 브라우저 느려짐

Frontend + Backend:
✅ 캐싱으로 빠름
✅ API 키 안전
✅ 서버에서 계산
```

**Q2: Redis 대신 Database에 캐싱하면 안 되나요?**

A: 가능하지만 느립니다.
```
PostgreSQL 캐싱:
- 응답 시간: 50-100ms
- 디스크 I/O 발생

Redis 캐싱:
- 응답 시간: 1-5ms
- 메모리만 사용 (10-100배 빠름)
```

**Q3: 모든 로직을 Smart Contract에 넣으면 안 되나요?**

A: 비효율적입니다.
```
Contract에 모든 것:
❌ 가스비 비싸짐
❌ 블록체인 느림
❌ 수정 어려움

적절한 분리:
✅ 신뢰 필요한 것만 Contract (스왑, 전송)
✅ 조회는 Backend (가격, 통계)
✅ 캐싱은 Redis (자주 조회하는 것)
```

---

**이제 왜 이런 구조로 만들었는지 이해되셨나요?** 🎯

더 궁금한 부분이 있으면 언제든 질문해주세요!
