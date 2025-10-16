# 🎓 HyperIndex 완전 정복 가이드
## 초보자를 위한 1-2일 집중 학습 로드맵

> **"이 문서 하나면 누구에게든 HyperIndex를 설명할 수 있습니다"**
> 
> 작성일: 2025년 10월 4일  
> 대상: 프로그래밍 기초는 있지만 DeFi/블록체인 초보인 개발자  
> 학습 시간: 총 16시간 (2일 × 8시간)

---

## 📖 목차

### 🌅 Day 1: 기초부터 구조까지
- [0시간: 시작하기 전에](#0시간-시작하기-전에)
- [1-2시간: DeFi와 블록체인 기본 개념](#1-2시간-defi와-블록체인-기본-개념)
- [2-4시간: HyperIndex 아키텍처 이해](#2-4시간-hyperindex-아키텍처-이해)
- [4-6시간: 기술 스택 완전 분석](#4-6시간-기술-스택-완전-분석)
- [6-8시간: 환경 설정 실습](#6-8시간-환경-설정-실습)

### 🌆 Day 2: 실전 개발과 운영
- [8-10시간: Backend 개발 실습](#8-10시간-backend-개발-실습)
- [10-12시간: Smart Contract 분석](#10-12시간-smart-contract-분석)
- [12-14시간: Docker 운영 마스터](#12-14시간-docker-운영-마스터)
- [14-16시간: 팀원 온보딩 준비](#14-16시간-팀원-온보딩-준비)

### 📚 부록
- [용어 사전](#용어-사전)
- [자주 묻는 질문](#자주-묻는-질문)
- [추가 학습 자료](#추가-학습-자료)

---

## 0시간: 시작하기 전에

### ✅ 필수 사전 지식
- [ ] JavaScript/TypeScript 기본 문법
- [ ] Git 기본 명령어 (clone, commit, push)
- [ ] 터미널(CLI) 기본 사용법
- [ ] JSON 데이터 형식 이해

### 📦 필요한 소프트웨어
```bash
# Node.js 22 이상
node --version  # v22.x.x 이상

# Docker Desktop
docker --version  # 20.x.x 이상
docker compose version  # v2.x.x 이상

# 코드 에디터 (VS Code 권장)
code --version
```

### 🎯 학습 목표
이 가이드를 끝내면 다음을 할 수 있습니다:
- ✅ HyperIndex의 전체 구조를 누구에게든 설명
- ✅ 새로운 Backend API 엔드포인트 개발
- ✅ Docker를 이용한 개발/프로덕션 환경 구축
- ✅ Smart Contract와 Backend의 통신 방식 이해
- ✅ 팀원 온보딩 문서 작성

---

## 1-2시간: DeFi와 블록체인 기본 개념

### 🏦 전통 금융 vs DeFi

#### 전통 금융 시스템
```
사용자 → 은행(중개자) → 거래 처리 → 수수료 발생
         ↓
      신뢰 필요
      느린 처리
      높은 수수료
```

#### DeFi (Decentralized Finance)
```
사용자 → Smart Contract(자동화된 코드) → 거래 처리 → 최소 수수료
         ↓
      코드 = 신뢰
      빠른 처리
      투명한 규칙
```

**비유**: 은행 대신 자동판매기를 쓰는 것과 같습니다!

---

### 🔄 AMM (Automated Market Maker) 쉽게 이해하기

#### 전통 거래소의 문제
```
매수자: "비트코인 1개 5천만원에 살게요!"
매도자: "아무도 안 팔면?"
        ↓
     거래 실패 😢
```

#### AMM의 해결책
```
유동성 풀 (Liquidity Pool)
┌─────────────────────────┐
│  토큰 A: 100개          │
│  토큰 B: 100개          │
│                         │
│  가격 = A/B = 1:1      │
└─────────────────────────┘

사용자가 토큰 A를 10개 넣으면?
→ 수식(x * y = k)으로 자동 계산
→ 토큰 B를 9개 받음
→ 새로운 가격: 110/91 = 1.21:1
```

**핵심 공식**: `x * y = k` (상수 곱)
- x = 풀의 토큰 A 수량
- y = 풀의 토큰 B 수량  
- k = 상수 (항상 일정)

**비유**: 시소를 생각하세요! 한쪽이 무거워지면 다른 쪽이 올라가듯이, 한 토큰이 많아지면 가격이 변합니다.

---

### 📊 Index Token: 블록체인 펀드

#### 전통 주식 펀드
```
투자자 → 펀드 매니저 → 여러 주식 매수 → 수익 배분
         (수수료 2-3%)
         (중간 과정 불투명)
```

#### Index Token
```
투자자 → Index Token 구매 → 자동으로 여러 토큰 보유 → 실시간 가치 반영
         (수수료 0.1%)
         (모든 과정 투명)
```

**예시**:
```typescript
// "AI 관련 코인 Index"
const aiIndex = {
  tokens: [
    { name: "TOKEN_A", weight: 40% },
    { name: "TOKEN_B", weight: 30% },
    { name: "TOKEN_C", weight: 30% }
  ],
  totalValue: "$100,000"
}

// 사용자가 $1,000 투자하면?
// → Index Token 10개 발행
// → 자동으로 A(40%), B(30%), C(30%) 비율로 구매
```

**Redemption(상환)**: Index Token을 돌려주고 실제 토큰들을 받는 것
- 비유: 쿠폰북을 반납하고 실제 상품권을 받는 것

---

### 🚀 HyperCore & HyperLiquid 생태계

#### HyperLiquid란?
- **목표**: "세상에서 가장 빠른 DeFi 플랫폼"
- **특징**: 초당 10만 건 이상의 거래 처리
- **비유**: 고속도로 vs 일반 도로

#### HyperCore란?
- **역할**: HyperLiquid의 핵심 블록체인 레이어
- **특징**: EVM 호환 + 네이티브 통합
- **비유**: 자동차(Smart Contract)가 달리는 도로

#### Precompile이란?
```
일반 Smart Contract
작성 → 컴파일 → 배포 → 실행 (느림)

Precompile
미리 컴파일됨 → 바로 실행 (빠름)
```

**비유**: 음식을 주문할 때
- 일반: 주문하면 요리 시작 (느림)
- Precompile: 이미 만들어진 음식 (빠름)

#### CoreWriter의 역할
```solidity
// 0x3333...3333 주소에 미리 배포된 특별한 컨트랙트
ICoreWriter constant CORE_WRITER = 
    ICoreWriter(0x3333333333333333333333333333333333333333);

// HyperCore에 직접 명령 전달
CORE_WRITER.sendRawAction(data);
```

**비유**: 대통령 직통 전화! 일반 경로를 거치지 않고 바로 전달

---

### 🎓 체크포인트 1: 기본 개념 이해도 테스트

다음 질문에 대답할 수 있나요?

1. **AMM에서 가격은 어떻게 결정되나요?**
   <details>
   <summary>정답 보기</summary>
   유동성 풀의 토큰 비율에 따라 자동으로 결정됩니다. x * y = k 공식을 사용하며, 한 토큰이 많아지면 그 토큰의 가격이 내려갑니다.
   </details>

2. **Index Token의 장점 3가지는?**
   <details>
   <summary>정답 보기</summary>
   
   - 여러 자산을 한 번에 투자 (분산 투자)
   - 낮은 수수료
   - 투명한 운영 (블록체인에 기록)
   </details>

3. **CoreWriter가 왜 필요한가요?**
   <details>
   <summary>정답 보기</summary>
   HyperCore의 네이티브 기능에 빠르게 접근하기 위해서입니다. 일반 컨트랙트보다 훨씬 빠른 실행 속도를 제공합니다.
   </details>

---

## 2-4시간: HyperIndex 아키텍처 이해

### 🏗️ 전체 시스템 구조도

```
┌─────────────────────────────────────────────────────────┐
│                      사용자 (User)                       │
│                      웹 브라우저                         │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTPS
                   ▼
┌─────────────────────────────────────────────────────────┐
│                  Frontend (Next.js 15)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │  UI      │  │  Privy   │  │  ethers.js/viem      │  │
│  │  컴포넌트 │  │  월렛    │  │  블록체인 통신        │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
│  Port: 3000                                              │
└───────────┬─────────────────────────────┬───────────────┘
            │ REST API                    │ JSON-RPC
            │                             │
            ▼                             ▼
┌────────────────────────┐    ┌──────────────────────────┐
│  Backend (Express.js)  │    │  Smart Contracts         │
│  ┌──────────────────┐  │    │  ┌────────────────────┐  │
│  │  API Routes     │  │    │  │  AMM (Uniswap V2)  │  │
│  │  /api/trading   │  │    │  │  - Factory         │  │
│  │  /api/portfolio │  │    │  │  - Pair            │  │
│  │  /api/health    │  │    │  │  - Router          │  │
│  └──────────────────┘  │    │  └────────────────────┘  │
│  ┌──────────────────┐  │    │  ┌────────────────────┐  │
│  │  Services       │  │    │  │  Index Tokens      │  │
│  │  - HyperCore    │  │    │  │  - IndexToken      │  │
│  │  - AMM          │  │    │  │  - Factory         │  │
│  │  - Cache        │  │    │  │  - Redemption      │  │
│  └──────────────────┘  │    │  └────────────────────┘  │
│  Port: 3001            │    │  ┌────────────────────┐  │
└───────────┬────────────┘    │  │  HyperCore         │  │
            │                 │  │  - CoreWriter      │  │
            ▼                 │  │  - L1Reader        │  │
┌────────────────────────┐    │  └────────────────────┘  │
│  Redis (Cache)         │    └──────────┬───────────────┘
│  - API 응답 캐싱        │               │
│  - 세션 저장           │               ▼
│  Port: 6379            │    ┌──────────────────────────┐
└────────────────────────┘    │  HyperCore Blockchain     │
                              │  - 초고속 거래 처리       │
                              │  - L1 상태 관리           │
                              └──────────────────────────┘
```

---

### 🔄 데이터 흐름: 토큰 스왑 예제

사용자가 "Token A 10개를 Token B로 교환"을 요청하면?

#### Step 1: Frontend (사용자 인터페이스)
```typescript
// 사용자가 버튼 클릭
function handleSwap() {
  // 1. Privy로 월렛 연결 확인
  if (!walletConnected) {
    showError("먼저 월렛을 연결해주세요");
    return;
  }

  // 2. 스왑 파라미터 준비
  const swapParams = {
    tokenA: "0xAAA...",
    tokenB: "0xBBB...",
    amountIn: "10000000000000000000", // 10 토큰 (18 decimals)
    minAmountOut: "9000000000000000000" // 최소 9 토큰 받기
  };

  // 3. Smart Contract 호출
  const tx = await routerContract.swapExactTokensForTokens(
    swapParams.amountIn,
    swapParams.minAmountOut,
    [swapParams.tokenA, swapParams.tokenB],
    userAddress,
    deadline
  );

  // 4. 트랜잭션 대기
  await tx.wait();
}
```

#### Step 2: Smart Contract (자동 실행)
```solidity
// HyperIndexRouter.sol
function swapExactTokensForTokens(
    uint amountIn,
    uint amountOutMin,
    address[] calldata path,
    address to,
    uint deadline
) external returns (uint[] memory amounts) {
    // 1. 가격 계산 (x * y = k 공식)
    amounts = getAmountsOut(amountIn, path);
    
    // 2. 슬리피지 체크
    require(amounts[amounts.length - 1] >= amountOutMin, "Too much slippage");
    
    // 3. 토큰 전송
    TransferHelper.safeTransferFrom(
        path[0], msg.sender, pairAddress, amounts[0]
    );
    
    // 4. 스왑 실행
    _swap(amounts, path, to);
    
    return amounts;
}
```

#### Step 3: HyperCore (블록체인 기록)
```solidity
// HyperCoreActions.sol
function notifySwap(bytes calldata swapData) external {
    // HyperCore L1에 거래 기록
    CORE_WRITER.sendRawAction(swapData);
    
    emit SwapExecuted(msg.sender, swapData);
}
```

#### Step 4: Backend (상태 업데이트)
```typescript
// backend/src/services/amm.ts
async function updateSwapCache(txHash: string) {
  // 1. 트랜잭션 결과 조회
  const receipt = await provider.getTransactionReceipt(txHash);
  
  // 2. 최신 풀 상태 조회
  const pairData = await pairContract.getReserves();
  
  // 3. Redis에 캐싱 (60초)
  await redis.setex(
    `pair:${pairAddress}`,
    60,
    JSON.stringify({
      reserve0: pairData.reserve0.toString(),
      reserve1: pairData.reserve1.toString(),
      timestamp: Date.now()
    })
  );
  
  return receipt;
}
```

#### Step 5: Frontend (결과 표시)
```typescript
// 스왑 완료 후
function showSuccess(receipt) {
  toast.success(`
    ✅ 스왑 성공!
    받은 토큰: ${formatAmount(receipt.amountOut)} Token B
    트랜잭션: ${receipt.hash}
  `);
  
  // 잔액 업데이트
  await refreshBalances();
}
```

**전체 소요 시간**: 약 2-5초

---

### 📦 프로젝트 구조 실제 분석

```
HI/
├── 📱 frontend/              # 사용자가 보는 화면
│   ├── src/
│   │   ├── app/             # Next.js 15 App Router
│   │   ├── components/      # 재사용 가능한 UI 컴포넌트
│   │   ├── lib/             # 유틸리티 함수
│   │   └── hooks/           # 커스텀 React Hooks
│   ├── Dockerfile           # 프론트엔드 컨테이너 설정
│   └── package.json         # pnpm 의존성
│
├── 🔧 backend/              # API 서버
│   ├── src/
│   │   ├── routes/          # API 엔드포인트
│   │   ├── services/        # 비즈니스 로직
│   │   ├── middleware/      # 요청 처리 파이프라인
│   │   └── types/           # TypeScript 타입
│   ├── Dockerfile           # 백엔드 컨테이너 설정
│   └── package.json         # npm 의존성
│
├── 📝 contracts/            # 스마트 컨트랙트
│   ├── hypercore/           # HyperCore 통합
│   │   ├── HyperCoreActions.sol
│   │   └── HyperL1Reader.sol
│   ├── amm/                 # AMM 시스템
│   │   ├── HyperIndexFactory.sol
│   │   ├── HyperIndexPair.sol
│   │   └── HyperIndexRouter.sol
│   └── tokens/              # Index Token 시스템
│       ├── IndexToken.sol
│       ├── IndexTokenFactory.sol
│       └── RedemptionManager.sol
│
├── 🐳 docker/               # Docker 설정
│   ├── nginx/               # 리버스 프록시 (예정)
│   └── redis/               # Redis 설정
│
├── 📚 docs/                 # 프로젝트 문서
│   ├── api/                 # API 문서
│   ├── contracts/           # 컨트랙트 문서
│   └── setup/               # 설정 가이드
│
├── 🧪 tests/                # 테스트 코드
│   ├── api/                 # API 테스트
│   ├── contracts/           # 컨트랙트 테스트
│   └── e2e/                 # E2E 테스트
│
├── 🛠️ scripts/              # 자동화 스크립트
│   ├── deploy/              # 배포 스크립트
│   └── setup/               # 초기 설정 스크립트
│
├── docker-compose.yml       # 서비스 오케스트레이션
├── docker-dev.sh            # 개발 편의 스크립트
├── .env.example             # 환경변수 템플릿
└── package.json             # 워크스페이스 설정
```

---

### 🎓 체크포인트 2: 아키텍처 이해도 테스트

다음 질문에 대답할 수 있나요?

1. **토큰 스왑 시 각 레이어의 역할은?**
   <details>
   <summary>정답 보기</summary>
   
   - Frontend: 사용자 입력 받고 Smart Contract 호출
   - Smart Contract: AMM 로직으로 가격 계산 및 토큰 전송
   - HyperCore: 블록체인에 트랜잭션 기록
   - Backend: 결과 모니터링 및 캐싱
   </details>

2. **Redis는 왜 필요한가요?**
   <details>
   <summary>정답 보기</summary>
   
   - HyperLiquid API 호출 비용 절감
   - 자주 조회하는 데이터(풀 상태, 가격 등)를 빠르게 제공
   - 서버 부하 감소
   </details>

3. **Monorepo의 장점은?**
   <details>
   <summary>정답 보기</summary>
   
   - 하나의 저장소에서 전체 코드 관리
   - Frontend와 Backend의 타입 공유 가능
   - 일관된 버전 관리
   </details>

---

## 4-6시간: 기술 스택 완전 분석

### 🌐 Next.js 15 완전 정복

#### Next.js가 뭔가요?
React로 웹사이트를 만들 때 필요한 모든 기능을 제공하는 프레임워크입니다.

**비유**: React = 레고 블록, Next.js = 레고 + 설명서 + 완성 키트

#### App Router vs Pages Router
```
Pages Router (구버전)
pages/
├── index.tsx        → /
├── about.tsx        → /about
└── blog/
    └── [id].tsx     → /blog/:id

App Router (Next.js 13+, 우리가 사용)
app/
├── page.tsx         → /
├── about/
│   └── page.tsx     → /about
└── blog/
    └── [id]/
        └── page.tsx → /blog/:id
```

**장점**:
- 폴더 = URL 경로 (더 직관적)
- 레이아웃 중첩 가능
- Server Components 지원

#### Server Components vs Client Components

```tsx
// ✅ Server Component (기본)
// 'use client' 없음 → 서버에서 렌더링
export default async function ProductList() {
  // 서버에서 직접 DB 접근 가능!
  const products = await db.products.findMany();
  
  return (
    <div>
      {products.map(p => <ProductCard key={p.id} {...p} />)}
    </div>
  );
}

// ✅ Client Component
// 'use client' 있음 → 브라우저에서 렌더링
'use client'

import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);
  
  // ❌ 서버 전용 API 사용 불가
  // ✅ 브라우저 API 사용 가능
  
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

**언제 뭘 써야 하나요?**
```
Server Component: 데이터 조회, SEO 중요한 페이지
Client Component: 상호작용(클릭, 입력), 실시간 업데이트
```

#### 실제 사용 예시
```tsx
// app/dashboard/page.tsx (Server Component)
export default async function Dashboard() {
  // 서버에서 데이터 가져오기
  const portfolioData = await getPortfolio();
  
  return (
    <div>
      <h1>내 포트폴리오</h1>
      {/* Client Component 사용 */}
      <TradingWidget data={portfolioData} />
    </div>
  );
}

// components/TradingWidget.tsx (Client Component)
'use client'

export function TradingWidget({ data }) {
  const [amount, setAmount] = useState('');
  
  const handleTrade = async () => {
    // API 호출
    await fetch('/api/trade', { 
      method: 'POST', 
      body: JSON.stringify({ amount }) 
    });
  };
  
  return (
    <div>
      <input 
        value={amount} 
        onChange={(e) => setAmount(e.target.value)} 
      />
      <button onClick={handleTrade}>거래하기</button>
    </div>
  );
}
```

---

### 🔧 Express.js 완전 정복

#### Express.js가 뭔가요?
Node.js로 API 서버를 만들 때 사용하는 프레임워크입니다.

**비유**: 전화 교환원처럼 요청을 받아서 적절한 곳으로 연결해줍니다.

#### 미들웨어 체인 이해하기
```typescript
// backend/src/index.ts
import express from 'express';

const app = express();

// 1. 보안 헤더 추가
app.use(helmet());

// 2. CORS 설정
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// 3. JSON 파싱
app.use(express.json());

// 4. 로깅
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next(); // 다음 미들웨어로
});

// 5. 속도 제한
app.use(rateLimit({
  windowMs: 60000, // 1분
  max: 100 // 최대 100 요청
}));

// 6. 라우트
app.use('/api/v1', apiRoutes);

// 7. 에러 핸들링
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
```

**미들웨어 순서가 중요합니다!**
```
요청 → helmet → CORS → JSON 파싱 → 로깅 → 속도 제한 → 라우트 → 에러 핸들링
```

#### 라우터 구조 설계
```typescript
// backend/src/routes/index.ts
import { Router } from 'express';
import tradingRoutes from './trading';
import portfolioRoutes from './portfolio';
import ammRoutes from './amm';

const router = Router();

router.use('/trading', tradingRoutes);
router.use('/portfolio', portfolioRoutes);
router.use('/amm', ammRoutes);

export default router;

// backend/src/routes/trading.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validateSwap } from '../middleware/validation';
import * as tradingController from '../controllers/trading';

const router = Router();

// POST /api/v1/trading/swap
router.post(
  '/swap',
  authMiddleware,      // 1. 인증 확인
  validateSwap,        // 2. 입력 검증
  tradingController.executeSwap  // 3. 실행
);

export default router;
```

#### 서비스 레이어 패턴
```typescript
// backend/src/controllers/trading.ts
export async function executeSwap(req, res) {
  try {
    const result = await tradingService.swap(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

// backend/src/services/trading.ts
export class TradingService {
  constructor(
    private cacheService: CacheService,
    private hypercoreService: HyperCoreService
  ) {}
  
  async swap(params: SwapParams) {
    // 1. 캐시 확인
    const cachedPrice = await this.cacheService.getPrice(params.pair);
    
    // 2. HyperCore API 호출
    const result = await this.hypercoreService.executeSwap(params);
    
    // 3. 캐시 업데이트
    await this.cacheService.setPrice(params.pair, result.newPrice);
    
    return result;
  }
}
```

**왜 이렇게 나누나요?**
```
Controller: 요청/응답 처리 (HTTP 레이어)
Service: 비즈니스 로직 (재사용 가능)
```

---

### 💾 Redis 완전 정복

#### Redis가 뭔가요?
초고속 메모리 데이터베이스입니다.

**비유**: 
- 일반 데이터베이스 = 창고 (느리지만 많이 저장)
- Redis = 책상 서랍 (빠르지만 적게 저장)

#### Key-Value 저장소 이해
```typescript
// Redis는 간단한 구조
const redis = new Redis();

// 저장 (SET)
await redis.set('user:1:name', 'Alice');

// 조회 (GET)
const name = await redis.get('user:1:name'); // 'Alice'

// 만료 시간 설정 (SETEX)
await redis.setex('session:abc123', 3600, 'user_data'); // 1시간 후 삭제
```

#### 실전 캐싱 전략
```typescript
// backend/src/services/cache.ts
export class CacheService {
  constructor(private redis: Redis) {}
  
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = 60
  ): Promise<T> {
    // 1. 캐시 확인
    const cached = await this.redis.get(key);
    if (cached) {
      console.log(`✅ Cache HIT: ${key}`);
      return JSON.parse(cached);
    }
    
    // 2. 캐시 미스 → 실제 데이터 조회
    console.log(`❌ Cache MISS: ${key}`);
    const data = await fetchFn();
    
    // 3. 캐시에 저장
    await this.redis.setex(key, ttl, JSON.stringify(data));
    
    return data;
  }
}

// 사용 예시
const pairData = await cacheService.getOrFetch(
  `pair:${pairAddress}`,
  async () => {
    // HyperLiquid API 호출 (비용 발생)
    return await hyperliquid.getPairData(pairAddress);
  },
  60 // 60초 캐싱
);
```

**캐싱 전략**:
```
짧은 TTL (10-60초): 자주 변하는 데이터 (가격, 풀 상태)
긴 TTL (1시간-1일): 거의 안 변하는 데이터 (토큰 정보)
```

---

### 🐳 Docker 완전 정복

#### Docker가 뭔가요?
애플리케이션을 컨테이너로 패키징하는 기술입니다.

**비유**: 이삿짐 박스!
```
일반 개발:
"내 컴퓨터에서는 되는데요?" 😅

Docker 사용:
박스(컨테이너)를 옮기면 어디서든 똑같이 작동! 📦
```

#### Dockerfile 이해하기
```dockerfile
# backend/Dockerfile

# 1. 베이스 이미지 (Node.js 22)
FROM node:22-alpine AS base
WORKDIR /app

# 2. 의존성 설치 단계
FROM base AS dependencies
COPY package*.json ./
RUN npm ci --only=production

# 3. 빌드 단계
FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 4. 프로덕션 이미지
FROM base AS production
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

EXPOSE 3001
CMD ["node", "dist/index.js"]
```

**왜 여러 단계로 나누나요?**
```
멀티 스테이지 빌드:
개발 도구 포함 (큼) → 빌드 → 실행 파일만 복사 (작음)

결과: 이미지 크기 90% 감소! 🚀
```

#### docker-compose.yml 이해하기
```yaml
version: '3.8'

services:
  # Redis 서비스
  redis:
    image: redis:7-alpine  # Docker Hub에서 가져오기
    ports:
      - "6379:6379"        # 호스트:컨테이너
    volumes:
      - redis_data:/data   # 데이터 영속성
    networks:
      - hlh-network        # 네트워크 연결
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      
  # Backend 서비스
  backend:
    build: ./backend       # Dockerfile로 빌드
    ports:
      - "3001:3001"
    depends_on:
      redis:
        condition: service_healthy  # Redis 먼저 실행
    environment:
      - REDIS_HOST=redis   # 서비스 이름으로 접근!
      
  # Frontend 서비스
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  redis_data:              # 영속적 데이터 저장

networks:
  hlh-network:             # 컨테이너 간 통신
```

**핵심 개념**:
```
Service: 실행할 컨테이너
Volume: 데이터를 컨테이너 외부에 저장
Network: 컨테이너끼리 통신할 수 있는 네트워크
```

---

### 🎓 체크포인트 3: 기술 스택 이해도 테스트

다음 질문에 대답할 수 있나요?

1. **Server Component와 Client Component의 차이는?**
   <details>
   <summary>정답 보기</summary>
   
   - Server Component: 서버에서 렌더링, DB 접근 가능, useState 불가
   - Client Component: 브라우저에서 렌더링, 상호작용 가능, API 호출 필요
   </details>

2. **Express.js 미들웨어는 어떤 순서로 실행되나요?**
   <details>
   <summary>정답 보기</summary>
   
   코드에 작성된 순서대로 실행됩니다. app.use()를 호출한 순서가 중요합니다.
   보통: 보안 → CORS → 파싱 → 로깅 → 인증 → 라우팅 → 에러 핸들링
   </details>

3. **Docker 멀티 스테이지 빌드의 장점은?**
   <details>
   <summary>정답 보기</summary>
   
   - 최종 이미지 크기 감소 (개발 도구 제외)
   - 보안 향상 (불필요한 패키지 미포함)
   - 빌드 속도 향상 (캐싱 활용)
   </details>

---

## 6-8시간: 환경 설정 실습

이제 직접 손으로 만져봅시다! 🙌

### 📝 환경 변수 완벽 이해

#### .env 파일이 뭔가요?
설정값을 코드와 분리해서 저장하는 파일입니다.

**왜 분리하나요?**
```
❌ 코드에 직접 작성
const API_KEY = "abc123secret";  // GitHub에 올라감 → 위험!

✅ .env 파일 사용
// .env (Git에 올리지 않음)
API_KEY=abc123secret

// 코드
const API_KEY = process.env.API_KEY;  // 안전!
```

#### 실전 .env 작성하기

```bash
# 1. 예제 파일 복사
cp .env.example .env

# 2. 텍스트 에디터로 열기
code .env  # 또는 nano .env
```

```bash
# 🔐 Authentication & Database
# =============================================================================

# Privy 설정 (https://privy.io에서 발급)
NEXT_PUBLIC_PRIVY_APP_ID=clp123456789abc
PRIVY_APP_SECRET=1234567890abcdef  
PRIVY_VERIFICATION_KEY=-----BEGIN PUBLIC KEY-----...

# 💡 Privy란? 
# → 월렛 연결과 인증을 쉽게 해주는 서비스
# → 회원가입 필요: https://privy.io
# → 앱 생성 후 App ID와 Secret 복사

# Supabase 설정 (https://supabase.com에서 발급)
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...  
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# 💡 Supabase란?
# → Firebase 같은 백엔드 서비스 (데이터베이스, 인증 등)
# → 무료 플랜으로 시작 가능
# → 프로젝트 생성 후 Settings > API에서 키 복사

# =============================================================================
# 🔗 HyperCore Integration
# =============================================================================

# 테스트넷 사용 (무료)
HYPERCORE_RPC_URL=https://testnet.hypercore.hyperliquid.xyz
CORE_WRITER_PRIVATE_KEY=0x0000...여기에_테스트_지갑_프라이빗_키

# 💡 테스트 지갑 만들기:
# 1. MetaMask 설치
# 2. 새 계정 생성 (테스트용!)
# 3. 프라이빗 키 내보내기
# ⚠️ 절대 메인넷 지갑 사용 금지!

HYPERVM_TESTNET_RPC=https://rpc.hyperliquid-testnet.xyz/evm
HYPERLIQUID_API_URL=https://api.testnet.hyperliquid.xyz

# =============================================================================
# 💾 Redis Configuration
# =============================================================================

# Docker를 쓰면 자동 설정됨
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=hyperindex_secure_password

# 💡 비밀번호 변경 권장:
# → openssl rand -base64 32
# → 출력된 값을 REDIS_PASSWORD에 복사

CACHE_TTL_SECONDS=60  # 캐시 유지 시간 (초)

# =============================================================================
# 🚀 Development Settings
# =============================================================================

NODE_ENV=development  # production으로 변경 시 프로덕션 모드
LOG_LEVEL=info        # debug, info, warn, error

FRONTEND_PORT=3000
BACKEND_PORT=3001

# =============================================================================
# 🛡️ Security
# =============================================================================

# JWT 비밀키 (랜덤 생성 권장)
JWT_SECRET=your_super_secret_key_here

# 💡 JWT 비밀키 생성:
# → node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### 환경변수 적용 확인하기

```bash
# Backend에서 확인
node -e "require('dotenv').config(); console.log(process.env.REDIS_HOST)"
# 출력: redis

# Frontend에서 확인 (Next.js는 NEXT_PUBLIC_ 필요)
# app/test/page.tsx
export default function TestPage() {
  return <div>{process.env.NEXT_PUBLIC_PRIVY_APP_ID}</div>
}
```

---

### 🚀 Docker 환경 실행하기

#### 1단계: Docker Desktop 실행 확인
```bash
# Docker가 실행 중인지 확인
docker ps
# 오류 나면 Docker Desktop 실행

# Docker Compose 버전 확인
docker compose version
# v2.0.0 이상이어야 함
```

#### 2단계: 개발 환경 시작
```bash
# 프로젝트 루트 디렉토리에서
cd /Users/maengseojun/Documents/Project/HyperIndex/HI

# 개발 환경 시작
./docker-dev.sh dev

# 출력 예시:
# [+] Building 2.3s (10/10) FINISHED
# [+] Running 3/3
#  ✔ Container hlh-redis     Started
#  ✔ Container hlh-backend   Started  
#  ✔ Container hlh-frontend  Started
```

**`docker-dev.sh`가 뭔가요?**
```bash
# docker-dev.sh 내부 (간략화)
case $1 in
  "dev")
    docker compose up --build
    ;;
  "stop")
    docker compose down
    ;;
  "logs")
    docker compose logs -f
    ;;
esac
```

#### 3단계: 서비스 상태 확인
```bash
# 실행 중인 컨테이너 확인
docker ps

# 출력 예시:
# CONTAINER ID   IMAGE          STATUS         PORTS
# abc123def      hlh-frontend   Up 2 minutes   0.0.0.0:3000->3000/tcp
# def456ghi      hlh-backend    Up 2 minutes   0.0.0.0:3001->3001/tcp
# ghi789jkl      hlh-redis      Up 2 minutes   0.0.0.0:6379->6379/tcp
```

#### 4단계: 각 서비스 접속 테스트

**Frontend 확인**:
```bash
# 브라우저에서
http://localhost:3000

# 또는 터미널에서
curl http://localhost:3000
```

**Backend 확인**:
```bash
# Health check 엔드포인트
curl http://localhost:3001/api/v1/health

# 예상 출력:
# {"status":"ok","timestamp":"2025-10-04T..."}
```

**Redis 확인**:
```bash
# Redis 컨테이너 접속
docker exec -it hlh-redis redis-cli

# Redis CLI 명령어 테스트
127.0.0.1:6379> PING
PONG

127.0.0.1:6379> SET test "Hello Redis"
OK

127.0.0.1:6379> GET test
"Hello Redis"

127.0.0.1:6379> EXIT
```

---

### 🔍 로그 확인 및 디버깅

#### 실시간 로그 보기
```bash
# 모든 서비스 로그
docker compose logs -f

# 특정 서비스만 보기
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f redis

# 최근 100줄만 보기
docker compose logs --tail=100 backend
```

#### 컨테이너 내부 접속하기
```bash
# Backend 컨테이너 접속
docker exec -it hlh-backend sh

# 내부에서 명령 실행 가능
ls -la
cat package.json
npm --version

# 종료
exit
```

#### 일반적인 문제 해결

**문제 1: 포트가 이미 사용 중**
```bash
# 에러 메시지:
# Error: bind: address already in use

# 해결방법:
# 1. 사용 중인 프로세스 찾기
lsof -i :3000  # Frontend 포트
lsof -i :3001  # Backend 포트

# 2. 프로세스 종료
kill -9 <PID>

# 3. Docker 재시작
./docker-dev.sh dev
```

**문제 2: Redis 연결 실패**
```bash
# 에러 메시지:
# Error: connect ECONNREFUSED redis:6379

# 해결방법:
# 1. Redis 상태 확인
docker ps | grep redis

# 2. Redis 로그 확인
docker compose logs redis

# 3. Redis 재시작
docker compose restart redis

# 4. Health check
docker exec hlh-redis redis-cli ping
```

**문제 3: 환경변수가 인식 안 됨**
```bash
# 확인 방법:
docker compose exec backend env | grep REDIS

# 출력이 없으면:
# 1. .env 파일 위치 확인 (프로젝트 루트)
# 2. 파일 권한 확인
ls -la .env

# 3. 컨테이너 재시작 (환경변수는 시작 시에만 로드)
docker compose down
./docker-dev.sh dev
```

---

### 🎓 체크포인트 4: 환경 설정 실습 완료

다음을 모두 완료했나요?

- [ ] .env 파일 작성 완료
- [ ] Docker Desktop 실행 중
- [ ] `docker compose up` 성공
- [ ] Frontend http://localhost:3000 접속 가능
- [ ] Backend http://localhost:3001/api/v1/health 응답 확인
- [ ] Redis PING 응답 확인
- [ ] 로그를 보고 이해할 수 있음

**축하합니다! Day 1 완료! 🎉**

내일은 실제 코드를 작성하고 분석하는 시간입니다.

---

## 8-10시간: Backend 개발 실습

이제 실제 코드를 작성해봅시다!

### 📁 Backend 프로젝트 구조 세팅

```bash
cd backend

# 필요한 디렉토리 생성
mkdir -p src/{routes,services,middleware,types,utils,config}

# 기본 파일 생성
touch src/index.ts
touch src/routes/index.ts
touch src/routes/health.ts
touch src/services/cache.ts
touch src/middleware/auth.ts
touch src/types/index.ts
```

---

### 🚀 기본 Express 서버 작성

#### src/index.ts
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import routes from './routes';

// 환경변수 로드
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어 설정
app.use(helmet());  // 보안 헤더
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());  // JSON 파싱

// 요청 로깅
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 라우트
app.use('/api/v1', routes);

// 404 처리
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.url} not found`
  });
});

// 에러 핸들링
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔗 http://localhost:${PORT}`);
});
```

---

### 🏥 Health Check API 작성

#### src/routes/health.ts
```typescript
import { Router } from 'express';
import Redis from 'ioredis';

const router = Router();

// Redis 클라이언트 생성
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
});

/**
 * GET /api/v1/health
 * 서버 상태 확인
 */
router.get('/', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      redis: 'unknown',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
      }
    }
  };

  try {
    // Redis 연결 확인
    await redis.ping();
    health.services.redis = 'connected';
  } catch (error) {
    health.services.redis = 'disconnected';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;
```

#### src/routes/index.ts
```typescript
import { Router } from 'express';
import healthRoutes from './health';

const router = Router();

router.use('/health', healthRoutes);

// 루트 경로
router.get('/', (req, res) => {
  res.json({
    message: 'HyperIndex API v1',
    version: '1.0.0',
    endpoints: {
      health: '/api/v1/health',
      trading: '/api/v1/trading (coming soon)',
      portfolio: '/api/v1/portfolio (coming soon)'
    }
  });
});

export default router;
```

---

### 💾 Redis 캐싱 서비스 작성

#### src/services/cache.ts
```typescript
import Redis from 'ioredis';

export class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis connected');
    });

    this.redis.on('error', (err) => {
      console.error('❌ Redis error:', err);
    });
  }

  /**
   * 캐시에서 데이터 가져오기
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (!data) return null;

      return JSON.parse(data) as T;
    } catch (error) {
      console.error(`Cache GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * 캐시에 데이터 저장
   */
  async set(key: string, value: any, ttl: number = 60): Promise<void> {
    try {
      await this.redis.setex(
        key,
        ttl,
        JSON.stringify(value)
      );
    } catch (error) {
      console.error(`Cache SET error for key ${key}:`, error);
    }
  }

  /**
   * 캐시에서 데이터 삭제
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error(`Cache DELETE error for key ${key}:`, error);
    }
  }

  /**
   * 캐시 또는 Fetch 패턴
   * 캐시에 있으면 반환, 없으면 fetchFn 실행 후 캐싱
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = 60
  ): Promise<T> {
    // 1. 캐시 확인
    const cached = await this.get<T>(key);
    if (cached !== null) {
      console.log(`✅ Cache HIT: ${key}`);
      return cached;
    }

    // 2. 캐시 미스 → 데이터 가져오기
    console.log(`❌ Cache MISS: ${key}`);
    const data = await fetchFn();

    // 3. 캐시에 저장
    await this.set(key, data, ttl);

    return data;
  }

  /**
   * 패턴으로 키 삭제 (예: "user:*" 모든 사용자 캐시 삭제)
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`🗑️ Deleted ${keys.length} keys matching ${pattern}`);
      }
    } catch (error) {
      console.error(`Cache DELETE PATTERN error for ${pattern}:`, error);
    }
  }

  /**
   * 연결 종료
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

// Singleton 패턴
export const cacheService = new CacheService();
```

---

### 🧪 캐싱 테스트 API 작성

#### src/routes/cache-test.ts
```typescript
import { Router } from 'express';
import { cacheService } from '../services/cache';

const router = Router();

/**
 * GET /api/v1/cache-test
 * 캐싱 동작 테스트
 */
router.get('/', async (req, res) => {
  const key = 'test:random-number';

  try {
    // getOrFetch 사용
    const number = await cacheService.getOrFetch(
      key,
      async () => {
        // 무거운 작업 시뮬레이션
        console.log('💤 Expensive operation...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return Math.random();
      },
      30 // 30초 캐싱
    );

    res.json({
      message: '첫 요청은 2초, 이후는 즉시 응답됩니다 (30초간)',
      number,
      cached: await cacheService.get(key) !== null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/cache-test
 * 캐시 삭제
 */
router.delete('/', async (req, res) => {
  await cacheService.delete('test:random-number');
  res.json({ message: 'Cache cleared' });
});

export default router;
```

#### src/routes/index.ts (업데이트)
```typescript
import { Router } from 'express';
import healthRoutes from './health';
import cacheTestRoutes from './cache-test';

const router = Router();

router.use('/health', healthRoutes);
router.use('/cache-test', cacheTestRoutes);

router.get('/', (req, res) => {
  res.json({
    message: 'HyperIndex API v1',
    version: '1.0.0',
    endpoints: {
      health: '/api/v1/health',
      cacheTest: '/api/v1/cache-test'
    }
  });
});

export default router;
```

---

### 🧪 실습: API 테스트하기

```bash
# 1. 서버가 실행 중인지 확인
curl http://localhost:3001/api/v1/health

# 2. 캐싱 테스트 (첫 요청 - 느림)
time curl http://localhost:3001/api/v1/cache-test
# 약 2초 소요

# 3. 캐싱 테스트 (두번째 요청 - 빠름)
time curl http://localhost:3001/api/v1/cache-test
# 즉시 응답 (캐시에서 가져옴)

# 4. 캐시 삭제
curl -X DELETE http://localhost:3001/api/v1/cache-test

# 5. 다시 요청하면 또 느려짐
time curl http://localhost:3001/api/v1/cache-test
```

---

### 🎓 체크포인트 5: Backend 개발 실습 완료

다음을 완료했나요?

- [ ] Express 서버 기본 구조 이해
- [ ] 미들웨어 체인 작동 방식 이해
- [ ] Health Check API 작성
- [ ] Redis 캐싱 서비스 구현
- [ ] getOrFetch 패턴 이해
- [ ] API 테스트 성공

---

## 10-12시간: Smart Contract 분석

블록체인 코드를 읽어봅시다!

### 📝 Solidity 기초 빠르게 복습

#### Solidity가 뭔가요?
이더리움과 호환 블록체인의 스마트 컨트랙트 언어입니다.

**JavaScript와 비교**:
```javascript
// JavaScript
function add(a, b) {
  return a + b;
}

// Solidity
function add(uint256 a, uint256 b) public pure returns (uint256) {
    return a + b;
}
```

**주요 차이점**:
```solidity
// 1. 타입 명시 필수
uint256 number;      // 부호 없는 256비트 정수
address wallet;      // 이더리움 주소
bool isActive;       // 불리언

// 2. 가시성 지정자
public    // 누구나 호출 가능
external  // 외부에서만 호출 가능
internal  // 컨트랙트 내부만
private   // 현재 컨트랙트만

// 3. 상태 변경 여부
view      // 상태를 읽기만 함
pure      // 상태에 접근 안 함 (계산만)
payable   // 이더를 받을 수 있음
```

---

### 🔗 HyperCoreActions.sol 분석

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// HyperCore의 핵심 인터페이스 정의
interface ICoreWriter {
    function sendRawAction(bytes calldata data) external;
}

/**
 * HyperCore와 통신하는 컨트랙트
 * 
 * 💡 핵심 개념:
 * - Precompile: 미리 컴파일된 특수 컨트랙트
 * - 0x3333...3333 주소에 배포되어 있음
 * - HyperCore L1에 직접 데이터 전송 가능
 */
contract HyperCoreActions {
    // Precompiled 컨트랙트 주소 (고정)
    ICoreWriter constant CORE_WRITER = 
        ICoreWriter(0x3333333333333333333333333333333333333333);

    // 이벤트: 액션 전송 기록
    event ActionSent(address indexed sender, bytes data);

    /**
     * HyperCore L1에 액션 전송
     * 
     * @param data 인코딩된 액션 데이터
     * 
     * 예시 사용:
     * bytes memory actionData = abi.encode("SWAP", tokenA, tokenB, amount);
     * sendAction(actionData);
     */
    function sendAction(bytes calldata data) external {
        // CoreWriter 호출
        CORE_WRITER.sendRawAction(data);
        
        // 이벤트 발생 (로그 기록)
        emit ActionSent(msg.sender, data);
    }

    /**
     * 배치 액션 전송
     * 여러 액션을 한 번에 처리
     */
    function sendBatchActions(bytes[] calldata actions) external {
        for (uint i = 0; i < actions.length; i++) {
            CORE_WRITER.sendRawAction(actions[i]);
            emit ActionSent(msg.sender, actions[i]);
        }
    }
}
```

**비유로 이해하기**:
```
일반 컨트랙트 → HyperCore
┌─────────┐     ┌─────────┐     ┌──────────┐
│  우편  │  →  │  우체국  │  →  │ HyperCore│
└─────────┘     └─────────┘     └──────────┘
              (느림)

HyperCoreActions → HyperCore
┌─────────┐                     ┌──────────┐
│  전화  │  ──────────────────→ │ HyperCore│
└─────────┘                     └──────────┘
              (빠름)
```

---

### 🏭 HyperIndexPair.sol (AMM) 핵심 분석

#### x * y = k 공식 실전 이해

```solidity
/**
 * Uniswap V2 스타일 유동성 풀
 * 
 * 💡 핵심: x * y = k (상수 곱 공식)
 */
contract HyperIndexPair is ERC20Upgradeable {
    uint112 private reserve0;  // 토큰 0의 수량
    uint112 private reserve1;  // 토큰 1의 수량
    
    /**
     * 스왑 가능 여부 및 받을 수 있는 양 계산
     * 
     * 예시:
     * reserve0 = 1000, reserve1 = 2000 (k = 2,000,000)
     * 10 토큰0 입금 → 받을 수 있는 토큰1은?
     * 
     * (1000 + 10) * (2000 - amountOut) = 2,000,000
     * amountOut = 2000 - (2,000,000 / 1010) = ~19.8
     */
    function getAmountOut(
        uint amountIn,
        uint reserveIn,
        uint reserveOut
    ) public pure returns (uint amountOut) {
        require(amountIn > 0, 'Insufficient input amount');
        require(reserveIn > 0 && reserveOut > 0, 'Insufficient liquidity');
        
        // 수수료 0.3% 적용
        uint amountInWithFee = amountIn * 997;  // 1000 - 3 = 997
        uint numerator = amountInWithFee * reserveOut;
        uint denominator = (reserveIn * 1000) + amountInWithFee;
        
        amountOut = numerator / denominator;
    }
    
    /**
     * 스왑 실행
     */
    function swap(
        uint amount0Out,
        uint amount1Out,
        address to
    ) external {
        // 1. 유동성 확인
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        require(amount0Out < _reserve0 && amount1Out < _reserve1);
        
        // 2. 토큰 전송
        if (amount0Out > 0) _safeTransfer(token0, to, amount0Out);
        if (amount1Out > 0) _safeTransfer(token1, to, amount1Out);
        
        // 3. 새로운 잔액 확인
        uint balance0 = IERC20(token0).balanceOf(address(this));
        uint balance1 = IERC20(token1).balanceOf(address(this));
        
        // 4. 입금된 양 계산
        uint amount0In = balance0 > _reserve0 - amount0Out 
            ? balance0 - (_reserve0 - amount0Out) 
            : 0;
        uint amount1In = balance1 > _reserve1 - amount1Out 
            ? balance1 - (_reserve1 - amount1Out) 
            : 0;
        
        // 5. x * y >= k 검증 (수수료 포함)
        uint balance0Adjusted = balance0 * 1000 - amount0In * 3;
        uint balance1Adjusted = balance1 * 1000 - amount1In * 3;
        require(
            balance0Adjusted * balance1Adjusted >= 
            uint(_reserve0) * uint(_reserve1) * (1000 ** 2),
            "K must not decrease"
        );
        
        // 6. 예비량 업데이트
        _update(balance0, balance1);
    }
}
```

---

### 💡 JavaScript로 AMM 시뮬레이션

```javascript
// AMM 로직을 JavaScript로 이해하기
class SimpleAMM {
  constructor(reserve0, reserve1) {
    this.reserve0 = reserve0;
    this.reserve1 = reserve1;
    this.k = reserve0 * reserve1; // 상수
    this.fee = 0.003; // 0.3%
  }

  // 받을 수 있는 토큰 계산
  getAmountOut(amountIn, isToken0) {
    const amountInWithFee = amountIn * (1 - this.fee);

    if (isToken0) {
      // Token0 입금 → Token1 받기
      const newReserve0 = this.reserve0 + amountInWithFee;
      const newReserve1 = this.k / newReserve0;
      return this.reserve1 - newReserve1;
    } else {
      // Token1 입금 → Token0 받기
      const newReserve1 = this.reserve1 + amountInWithFee;
      const newReserve0 = this.k / newReserve1;
      return this.reserve0 - newReserve0;
    }
  }

  // 현재 가격 (1 토큰당)
  getPrice(isToken0ToToken1) {
    if (isToken0ToToken1) {
      return this.reserve1 / this.reserve0;
    } else {
      return this.reserve0 / this.reserve1;
    }
  }

  // 스왑 실행
  swap(amountIn, isToken0) {
    const amountOut = this.getAmountOut(amountIn, isToken0);
    
    if (isToken0) {
      this.reserve0 += amountIn * (1 - this.fee);
      this.reserve1 -= amountOut;
    } else {
      this.reserve1 += amountIn * (1 - this.fee);
      this.reserve0 -= amountOut;
    }

    console.log(`✅ Swapped ${amountIn} → ${amountOut.toFixed(2)}`);
    console.log(`📊 New price: ${this.getPrice(true).toFixed(4)}`);
    
    return amountOut;
  }
}

// 사용 예시
const pool = new SimpleAMM(1000, 2000); // 1000 Token0, 2000 Token1

console.log("초기 상태:");
console.log(`Reserve0: ${pool.reserve0}, Reserve1: ${pool.reserve1}`);
console.log(`Price (Token0 → Token1): ${pool.getPrice(true)}`); // 2.0

console.log("\n10 Token0 스왑:");
const received = pool.swap(10, true);
console.log(`받은 Token1: ${received.toFixed(2)}`); // ~19.76

console.log("\n스왑 후:");
console.log(`Reserve0: ${pool.reserve0.toFixed(2)}, Reserve1: ${pool.reserve1.toFixed(2)}`);
console.log(`새 가격: ${pool.getPrice(true).toFixed(4)}`); // ~2.02 (가격 상승!)
```

---

### 🎓 체크포인트 6: Smart Contract 분석 완료

다음을 이해했나요?

- [ ] Solidity 기본 문법
- [ ] HyperCoreActions의 역할
- [ ] Precompile이 왜 빠른지
- [ ] AMM의 x * y = k 공식
- [ ] 유동성 공급과 LP 토큰
- [ ] 스왑 수수료 계산 방식
- [ ] JavaScript로 AMM 시뮬레이션

---

## 12-14시간: Docker 운영 마스터

### 🐳 docker-compose.yml 상세 분석

```yaml
version: '3.8'

services:
  # Redis: 캐싱 & 세션 저장소
  redis:
    image: redis:7-alpine              # Alpine = 경량 리눅스 (5MB)
    container_name: hlh-redis
    restart: unless-stopped            # 오류 시 자동 재시작
    
    ports:
      - "${REDIS_PORT:-6379}:6379"     # ${변수:-기본값}
    
    volumes:
      - redis_data:/data               # 영속성 데이터
      - ./docker/redis/redis.conf:/etc/redis/redis.conf:ro
    
    networks:
      - hlh-network
    
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  # Backend: Express API 서버
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    
    container_name: hlh-backend
    restart: unless-stopped
    
    ports:
      - "${BACKEND_PORT:-3001}:3001"
    
    environment:
      REDIS_HOST: redis              # 서비스 이름으로 접근!
      REDIS_PORT: 6379
    
    volumes:
      - ./logs/backend:/app/logs
      - ./backend/src:/app/src:ro    # 개발용 hot reload
    
    depends_on:
      redis:
        condition: service_healthy   # Redis healthy 후 시작
    
    networks:
      - hlh-network

  # Frontend: Next.js 애플리케이션
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    
    container_name: hlh-frontend
    restart: unless-stopped
    
    ports:
      - "${FRONTEND_PORT:-3000}:3000"
    
    environment:
      NEXT_PUBLIC_API_URL: http://backend:3001/v1
    
    depends_on:
      - backend
    
    networks:
      - hlh-network

volumes:
  redis_data:
    driver: local

networks:
  hlh-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.25.0.0/16
```

---

### 📊 프로덕션 배포 전략

#### docker-compose.prod.yml 작성
```yaml
version: '3.8'

services:
  redis:
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 512mb
    deploy:
      resources:
        limits:
          memory: 512M

  backend:
    build:
      target: production
    restart: always
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  frontend:
    build:
      target: production
    restart: always

  # Nginx 리버스 프록시 추가
  nginx:
    image: nginx:alpine
    container_name: hlh-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - frontend
      - backend
    networks:
      - hlh-network
```

---

### 🔧 유용한 Docker 명령어 모음

```bash
# ============================================
# 개발 환경 관리
# ============================================

# 모든 서비스 시작
docker compose up -d

# 특정 서비스만 시작
docker compose up -d backend

# 로그 실시간 확인
docker compose logs -f

# 특정 서비스 로그
docker compose logs -f backend

# 컨테이너 재시작
docker compose restart backend

# 모든 서비스 중지
docker compose down

# 볼륨까지 삭제 (데이터 초기화)
docker compose down -v

# ============================================
# 디버깅
# ============================================

# 컨테이너 접속
docker compose exec backend sh

# 컨테이너 상태 확인
docker compose ps

# 리소스 사용량
docker stats

# 네트워크 확인
docker network inspect hlh-network

# ============================================
# 정리
# ============================================

# 사용하지 않는 이미지/컨테이너 삭제
docker system prune -a

# 볼륨 정리
docker volume prune
```

---

### 🎓 체크포인트 7: Docker 운영 마스터 완료

다음을 할 수 있나요?

- [ ] docker-compose.yml 전체 이해
- [ ] 환경변수 동적 설정 이해
- [ ] healthcheck 작동 방식 이해
- [ ] 개발/프로덕션 환경 분리
- [ ] 컨테이너 네트워크 이해
- [ ] 로그 및 모니터링

---

## 14-16시간: 팀원 온보딩 준비

마지막 단계! 배운 것을 정리하고 문서화합시다.

### 📝 Quick Start 가이드

이 파일을 `docs/QUICK_START.md`로 저장:

```markdown
# 🚀 HyperIndex 빠른 시작

## 1. 사전 준비 (5분)

### 필수 소프트웨어
- Node.js 22+
- Docker Desktop  
- Git

### 계정 생성
- Privy (https://privy.io)
- Supabase (https://supabase.com)

## 2. 프로젝트 설정 (10분)

```bash
# 프로젝트 클론
git clone <repository-url>
cd HI

# 환경변수 설정
cp .env.example .env
# .env 파일 편집 필요

# Docker 실행
./docker-dev.sh dev
```

## 3. 접속 확인

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api/v1/health
- Redis: docker exec -it hlh-redis redis-cli

## 4. 개발 시작

### Backend API 추가
```typescript
// src/routes/my-feature.ts
import { Router } from 'express';
const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'Hello!' });
});

export default router;
```

### 자주 사용하는 명령어
```bash
# 로그 확인
docker compose logs -f backend

# 서비스 재시작
docker compose restart backend

# 캐시 초기화
docker compose down -v && ./docker-dev.sh dev
```
```

---

### 📖 트러블슈팅 가이드

`docs/TROUBLESHOOTING.md`:

```markdown
# 🆘 트러블슈팅 가이드

## 일반적인 문제들

### 1. 포트 충돌
```bash
# 증상
Error: bind: address already in use

# 해결
lsof -i :3000
kill -9 <PID>
./docker-dev.sh dev
```

### 2. Redis 연결 실패
```bash
# 증상
Error: connect ECONNREFUSED redis:6379

# 해결
docker compose restart redis
docker exec hlh-redis redis-cli ping
```

### 3. 환경변수 미인식
```bash
# 증상
undefined가 출력됨

# 해결
1. .env 파일 위치 확인 (프로젝트 루트)
2. 컨테이너 재시작
docker compose down && ./docker-dev.sh dev
```

### 4. Docker 이미지 빌드 실패
```bash
# 해결
docker compose build --no-cache
docker system prune -a
```

## 도움 요청

문제가 해결되지 않으면:
1. `docker compose logs` 로그 확인
2. GitHub Issues에 로그와 함께 문의
3. 팀 채널에 질문
```

---

### 🎯 최종 학습 체크리스트

#### Day 1 복습
- [ ] DeFi와 AMM 개념 이해
- [ ] HyperCore와 Precompile 이해
- [ ] 전체 아키텍처 파악
- [ ] 기술 스택별 역할 이해
- [ ] Docker 환경 구축 완료

#### Day 2 복습
- [ ] Backend API 개발 가능
- [ ] Redis 캐싱 구현 가능
- [ ] Smart Contract 코드 읽기 가능
- [ ] Docker 명령어 숙달
- [ ] 팀원 온보딩 문서 작성 완료

---

## 용어 사전

### A
- **AMM (Automated Market Maker)**: 자동화된 시장 조성자. 알고리즘으로 가격을 결정하는 거래 시스템
- **API (Application Programming Interface)**: 프로그램 간 통신 인터페이스

### C
- **Container**: 애플리케이션과 환경을 패키징한 격리된 단위
- **CoreWriter**: HyperCore의 Precompile 컨트랙트

### D
- **DeFi (Decentralized Finance)**: 탈중앙화 금융
- **Docker**: 컨테이너 기반 가상화 플랫폼

### I
- **Index Token**: 여러 자산을 추적하는 토큰화된 펀드

### L
- **LP Token (Liquidity Provider Token)**: 유동성 공급 증명 토큰

### P
- **Precompile**: 미리 컴파일된 특수 스마트 컨트랙트

### R
- **Redis**: 인메모리 키-값 데이터베이스
- **Redemption**: Index Token을 실제 자산으로 교환

### S
- **Smart Contract**: 블록체인에서 자동 실행되는 계약 코드
- **Slippage**: 예상 가격과 실제 체결 가격의 차이

---

## 자주 묻는 질문

**Q: Docker를 꼭 써야 하나요?**
A: 로컬에서 npm run dev로도 가능하지만, Docker를 쓰면 팀원 간 환경이 일치하여 "내 컴퓨터에서는 되는데요?" 문제를 방지할 수 있습니다.

**Q: Redis는 왜 필요한가요?**
A: HyperLiquid API 호출 비용을 절감하고, 자주 조회하는 데이터를 빠르게 제공하기 위함입니다.

**Q: Next.js Server Component는 언제 쓰나요?**
A: 데이터 조회만 하고 상호작용이 없는 경우 Server Component를 사용합니다.

**Q: Precompile이 정확히 뭔가요?**
A: 미리 컴파일되어 특정 주소에 배포된 특수 컨트랙트로, 일반 컨트랙트보다 빠릅니다.

---

## 추가 학습 자료

### 공식 문서
- [Next.js 문서](https://nextjs.org/docs)
- [Express.js 가이드](https://expressjs.com/)
- [Docker 문서](https://docs.docker.com/)
- [Redis 문서](https://redis.io/documentation)
- [Solidity 문서](https://docs.soliditylang.org/)

### HyperCore 관련
- HyperLiquid 개발자 문서 (프로젝트 내)
- HyperCore Precompile 가이드 (프로젝트 내)

### 추천 학습 경로
1. JavaScript/TypeScript 심화
2. React/Next.js 마스터
3. Solidity 기초부터
4. Docker & Kubernetes
5. DeFi 프로토콜 연구

---

## 🎉 축하합니다!

**16시간의 학습을 완료하셨습니다!**

이제 여러분은:
- ✅ HyperIndex의 전체 구조를 설명할 수 있습니다
- ✅ Backend API를 개발할 수 있습니다
- ✅ Smart Contract를 읽고 이해할 수 있습니다
- ✅ Docker로 환경을 구축할 수 있습니다
- ✅ 팀원을 온보딩할 수 있습니다

### 다음 단계
1. 실제 기능 개발 시작
2. 테스트 코드 작성 학습
3. CI/CD 파이프라인 구축
4. 프로덕션 배포 경험

**Keep Learning! Keep Building! 🚀**

---

*이 문서에 대한 피드백이나 질문은 팀 채널 또는 GitHub Issues로 남겨주세요.*
