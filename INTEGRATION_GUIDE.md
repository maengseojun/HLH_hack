# 🚀 HyperIndex (HI) 통합 프로젝트 가이드

> **dev6 + hlh 완전 통합 - 최적의 HyperCore 기반 거래 플랫폼**

## 🎯 **통합 개요**

HI는 기존 dev6와 hlh 프로젝트의 최고 요소들을 결합한 완전 통합 프로젝트입니다.

### **🔄 통합 전략**
- **dev6**: 완성된 AMM, IndexToken, Redemption 시스템 ✅
- **hlh**: HyperCore 네이티브 통합, Docker 구조 ✅
- **HI**: 두 프로젝트의 시너지 효과 극대화 🚀

---

## 📁 **프로젝트 구조**

```
HI/                                # 통합 루트
├── 🔧 backend/                    # Express API 서버 (hlh 구조)
│   ├── src/
│   │   ├── routes/               # API 라우트
│   │   ├── services/             # 비즈니스 로직
│   │   │   ├── hypercore.ts      # HyperCore 통합
│   │   │   ├── amm.ts            # dev6 AMM 로직
│   │   │   ├── indexToken.ts     # dev6 토큰 관리
│   │   │   └── redemption.ts     # dev6 상환 시스템
│   │   ├── corewriter/           # HyperCore 액션
│   │   └── middleware/           # 인증, 레이트 리미팅
│   ├── package.json              # Node.js dependencies
│   └── Dockerfile                # Multi-stage build
├── 🌐 frontend/                   # Next.js 15 프론트엔드
│   ├── src/
│   │   ├── app/                  # App Router (dev6 기반)
│   │   ├── components/           # UI 컴포넌트 (dev6)
│   │   └── lib/                  # 클라이언트 로직
│   ├── package.json              # pnpm dependencies
│   └── Dockerfile                # Next.js optimized
├── 📝 contracts/                  # 스마트 컨트랙트 통합
│   ├── hypercore/               # HyperCore 통합
│   │   ├── HyperCoreActions.sol  # CoreWriter 인터페이스
│   │   └── HyperL1Reader.sol     # Precompile 읽기
│   ├── amm/                     # AMM 시스템 (dev6)
│   │   ├── HyperIndexFactory.sol
│   │   ├── HyperIndexPair.sol
│   │   └── HyperIndexRouter.sol
│   ├── tokens/                  # 토큰 관리 (dev6)
│   │   ├── IndexToken.sol
│   │   ├── IndexTokenFactory.sol
│   │   └── RedemptionManager.sol
│   └── governance/              # DAO 거버넌스
├── 🐳 docker/                     # Docker 설정 (hlh 구조)
├── 📚 docs/                       # 통합 문서
├── 🧪 tests/                      # E2E 테스트
├── .env.example                  # 통합 환경변수
├── docker-compose.yml            # 서비스 오케스트레이션
├── docker-dev.sh                 # 개발 스크립트
└── package.json                  # Workspace 관리
```

---

## 🔧 **빠른 시작**

### **1단계: 프로젝트 설정**
```bash
# HI 디렉토리로 이동
cd HI

# 환경변수 설정
cp .env.example .env
# .env 파일 편집 (Privy, Supabase, HyperCore 키 설정)

# 의존성 설치
npm install                    # 루트 workspace
cd backend && npm install      # 백엔드
cd ../frontend && pnpm install # 프론트엔드
```

### **2단계: Docker 환경 시작**
```bash
# 개발 환경 시작 (권장)
./docker-dev.sh dev

# 서비스 상태 확인
./docker-dev.sh status

# 로그 모니터링
./docker-dev.sh logs
```

### **3단계: 서비스 접속**
- 🌐 **Frontend**: http://localhost:3000
- 🔧 **Backend API**: http://localhost:3001
- 🗄️ **Redis**: localhost:6379

---

## 🎨 **핵심 통합 기능**

### **1. HyperCore 네이티브 통합**
```typescript
// CoreWriter를 통한 거래 실행
import { CoreWriter } from '@/lib/hypercore/writer';

const coreWriter = new CoreWriter(process.env.CORE_WRITER_PRIVATE_KEY);

// BTC 롱 포지션 ($50,000, 1 BTC)
const order = await coreWriter.placeLimitOrder({
  asset: 0,
  isBuy: true,
  limitPx: 50000n * 10n**8n,
  sz: 1n * 10n**8n,
  reduceOnly: false,
  tif: 2 // GTC
});
```

### **2. dev6 AMM + IndexToken 시스템**
```typescript
// IndexToken 생성 및 관리
import { IndexTokenFactory } from '@/lib/contracts/IndexTokenFactory';

const factory = new IndexTokenFactory(contractAddress);

// 새로운 인덱스 펀드 생성
const indexFund = await factory.createIndexFund({
  name: "K-Crypto Top 10",
  symbol: "KTOP10",
  components: [
    { token: "BTC", weight: 40 },
    { token: "ETH", weight: 30 },
    { token: "SOL", weight: 20 },
    { token: "MATIC", weight: 10 }
  ]
});
```

### **3. Basket 계산 엔진 (hlh)**
```typescript
// 고성능 basket 계산
import { calcBasketFromCandles } from '@/lib/services/basket';

const basketResult = calcBasketFromCandles([
  {
    symbol: "BTC",
    weight: 0.4,
    candles: await getCandles("BTC", "1h", startTime, endTime)
  },
  // ... 기타 자산들
]);

// 결과: basketPriceHistory, performance metrics
```

---

## 🔐 **환경변수 설정**

### **필수 설정**
```bash
# =============================================================================
# 🔐 Authentication & Database
# =============================================================================
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# =============================================================================
# 🔗 HyperCore Integration
# =============================================================================
HYPERCORE_RPC_URL=https://testnet.hypercore.hyperliquid.xyz
CORE_WRITER_ADDRESS=0x3333333333333333333333333333333333333333
CORE_WRITER_PRIVATE_KEY=your_testnet_private_key

# =============================================================================
# 📊 HyperLiquid API
# =============================================================================
HYPERLIQUID_API_URL=https://api.testnet.hyperliquid.xyz
INFO_API_URL=https://api.testnet.hyperliquid.xyz/info

# =============================================================================
# 💾 Caching & Performance
# =============================================================================
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=hyperindex_secure_password
CACHE_TTL_SECONDS=60
RATE_LIMIT_MAX=100
```

---

## 🛠️ **개발 워크플로우**

### **일상적인 개발**
```bash
# 개발 환경 시작
./docker-dev.sh dev

# 실시간 로그 모니터링
./docker-dev.sh logs

# 특정 서비스 로그
./docker-dev.sh logs backend
./docker-dev.sh logs frontend

# 컨테이너 셸 접속
./docker-dev.sh shell backend
./docker-dev.sh shell redis
```

### **개발 중 코드 수정**
- **Backend**: TypeScript 파일 수정 시 자동 재시작 (tsx watch)
- **Frontend**: React 컴포넌트 수정 시 Hot Reload 자동 적용
- **Contracts**: Solidity 파일 수정 후 재컴파일 필요

### **테스트 실행**
```bash
# API 테스트
curl http://localhost:3001/health

# 프론트엔드 테스트
curl http://localhost:3000

# 전체 서비스 테스트
./docker-dev.sh test
```

---

## 🧪 **개발 및 테스트**

### **API 개발**
```bash
# 백엔드 개발 서버
cd backend
npm run dev

# 새로운 API 엔드포인트 추가
# backend/src/routes/trading.ts
export async function POST(req: Request) {
  // HyperCore 통합 로직
  const result = await coreWriter.processOrder(orderData);
  return Response.json({ success: true, result });
}
```

### **프론트엔드 개발**
```bash
# 프론트엔드 개발 서버
cd frontend
pnpm dev

# 새로운 컴포넌트 추가
# frontend/src/components/trading/OrderForm.tsx
export function OrderForm() {
  // Privy + HyperCore 통합 UI
}
```

### **스마트 컨트랙트 개발**
```bash
# 컨트랙트 컴파일
npx hardhat compile

# 테스트 실행
npx hardhat test

# 로컬 배포
npx hardhat run scripts/deploy.js --network localhost
```

---

## 🚀 **프로덕션 배포**

### **Docker 프로덕션 빌드**
```bash
# 프로덕션 모드 시작
./docker-dev.sh prod

# 또는 직접 실행
docker compose -f docker-compose.yml up --build -d --target production
```

### **환경별 설정**
```bash
# 개발환경
NODE_ENV=development
HYPERCORE_RPC_URL=https://testnet.hypercore.hyperliquid.xyz

# 프로덕션
NODE_ENV=production
HYPERCORE_RPC_URL=https://hypercore.hyperliquid.xyz
```

---

## 🎯 **마이그레이션 가이드**

### **dev6에서 HI로 이전**
1. **환경변수 이전**: dev6/.env → HI/.env
2. **커스텀 컴포넌트**: dev6/components → HI/frontend/src/components
3. **API 로직**: dev6/app/api → HI/backend/src/routes
4. **스마트 컨트랙트**: 이미 HI/contracts에 복사됨

### **hlh에서 HI로 이전**
1. **HyperCore 모듈**: 이미 HI/contracts/hypercore에 복사됨
2. **Docker 설정**: 이미 HI에 적용됨
3. **Basket 서비스**: hlh/backend/src/services → HI/backend/src/services

---

## 📊 **성능 및 모니터링**

### **Redis 캐싱**
- HyperLiquid API 응답 캐싱 (60초 TTL)
- 실시간 가격 데이터 스테일-와일-리밸리데이트
- Rate limiting 정보 저장

### **모니터링 대시보드**
```bash
# 서비스 상태 확인
./docker-dev.sh status

# 리소스 사용량
docker stats

# Redis 상태
./docker-dev.sh shell redis
redis-cli info memory
```

---

## 🔧 **트러블슈팅**

### **자주 발생하는 문제**

**1. HyperCore 연결 실패**
```bash
# 네트워크 확인
curl https://testnet.hypercore.hyperliquid.xyz

# 프라이빗 키 확인
echo $CORE_WRITER_PRIVATE_KEY | wc -c  # 64자여야 함 (0x 제외)
```

**2. Docker 컨테이너 시작 실패**
```bash
# 로그 확인
./docker-dev.sh logs

# 컨테이너 재빌드
docker compose down -v
docker compose up --build
```

**3. 포트 충돌**
```bash
# 사용 중인 포트 확인
lsof -i :3000
lsof -i :3001
lsof -i :6379

# .env에서 포트 변경
FRONTEND_PORT=3002
BACKEND_PORT=3003
```

**4. Redis 연결 문제**
```bash
# Redis 컨테이너 확인
docker compose logs redis

# Redis 연결 테스트
redis-cli -h localhost -p 6379 ping
```

---

## ✅ **체크리스트**

### **초기 설정 완료**
- [ ] HI 프로젝트 클론/복사
- [ ] .env 파일 설정 (Privy, Supabase, HyperCore)
- [ ] Docker Desktop 실행
- [ ] `./docker-dev.sh dev` 성공적 실행
- [ ] http://localhost:3000 접속 확인
- [ ] http://localhost:3001/health API 확인

### **개발 환경 준비**
- [ ] 코드 에디터 설정 (VSCode 권장)
- [ ] Git 설정 및 첫 커밋
- [ ] 팀 개발 브랜치 전략 이해
- [ ] 코드 리뷰 프로세스 숙지

### **첫 주 개발 목표**
- [ ] HyperCore API 호출 성공
- [ ] 기존 IndexToken 시스템 이해
- [ ] 첫 번째 API 엔드포인트 구현
- [ ] 프론트엔드 컴포넌트 수정

---

## 🎉 **결론**

HI 통합 프로젝트는 dev6의 완성된 DeFi 인프라와 hlh의 혁신적인 HyperCore 통합을 결합하여 차세대 인덱스 거래 플랫폼을 구축합니다.

### **핵심 이점**
- ✅ **완전한 HyperCore 네이티브 통합**
- ✅ **검증된 AMM + IndexToken 시스템**
- ✅ **Docker 기반 확장 가능한 아키텍처**
- ✅ **개발자 친화적 환경**

**새로운 팀원들이 HI에서 멋진 제품을 함께 만들어가길 기대합니다!** 🚀