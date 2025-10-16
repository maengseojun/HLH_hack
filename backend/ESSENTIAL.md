# Essential External Services & APIs

HyperIndex Backend에서 필요한 모든 외부 서비스, API, 그리고 환경변수 정리

---

## 📋 Phase 1: Base Infrastructure (현재 완료)

### 1. **Supabase**
- **목적**: 사용자 인증 및 데이터베이스
- **필요한 환경변수**:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
  SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
  ```
- **왜 필요한가**: 
  - 사용자 계정 관리
  - Position, Order 히스토리 저장
  - Native token balance 추적
  - Transaction 기록
- **비용**:
  - Free tier: 500MB 데이터베이스, 2GB 대역폭/월
  - Pro: $25/month (8GB DB, 100GB 대역폭)
  - 예상: **초기 Free tier 가능, 트래픽 증가 시 Pro ($25/month)**
- **가입 링크**: https://supabase.com
- **필요 시점**: 즉시 (Phase 1 완료 시)

---

### 2. **Privy**
- **목적**: Web3 지갑 인증 (Embedded Wallet)
- **필요한 환경변수**:
  ```env
  NEXT_PUBLIC_PRIVY_APP_ID=clxxx...
  PRIVY_APP_SECRET=xxx...
  ```
- **왜 필요한가**:
  - 사용자가 쉽게 지갑 생성 (소셜 로그인)
  - Privy embedded wallet로 HyperCore 거래
  - 간편한 onboarding (이메일/소셜로 지갑 자동 생성)
- **비용**:
  - Free tier: 1,000 MAU (Monthly Active Users)
  - Growth: $99/month (10,000 MAU)
  - Pro: $299/month (50,000 MAU)
  - 예상: **초기 Free tier 가능, Growth 단계에서 $99/month**
- **가입 링크**: https://privy.io
- **필요 시점**: Phase 1 완료 직후 (인증 시스템 구축)

---

### 3. **Hyperliquid API**
- **목적**: HyperCore 체인 데이터 조회 및 가격 정보
- **필요한 환경변수**:
  ```env
  HYPERLIQUID_API_URL=https://api.hyperliquid.xyz
  INFO_API_URL=https://api.hyperliquid.xyz/info
  REQUEST_TIMEOUT_MS=10000
  ```
- **왜 필요한가**:
  - HyperCore 토큰 가격 조회
  - Market cap, Volume 데이터
  - Index 구성 토큰 정보
  - Real-time price feeds
- **비용**: **무료 (Public API)**
- **제한사항**: 
  - Rate limit: 100 requests/10s per IP
  - WebSocket 연결 제한 있음
- **문서**: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
- **필요 시점**: 즉시 (Phase 1 완료)

---

### 4. **HyperCore RPC**
- **목적**: HyperCore 블록체인과 직접 통신 (트랜잭션 전송)
- **필요한 환경변수**:
  ```env
  HYPERCORE_RPC_URL=https://rpc.hyperliquid.xyz
  HYPERCORE_WALLET_KEY=0x...
  HYPERCORE_TIMEOUT=30000
  CORE_WRITER_ADDRESS=0x...
  ```
- **왜 필요한가**:
  - AMM swap 실행
  - Position open/close
  - Native token transfer
  - Smart contract 호출
- **비용**: **무료 (Public RPC)**
- **제한사항**: 
  - Public RPC는 rate limit 있을 수 있음
  - 프로덕션에서는 Dedicated RPC 고려
- **필요 시점**: Phase 2 (Trading Core) 시작 시

---

## 💰 Phase 2: Trading Core

### 5. **Chainlink Price Feeds (Optional)**
- **목적**: 백업 가격 데이터 / Oracle
- **필요한 환경변수**:
  ```env
  CHAINLINK_RPC_URL=https://...
  CHAINLINK_API_KEY=...
  ```
- **왜 필요한가**:
  - Hyperliquid API 장애 시 백업
  - 가격 조작 방지를 위한 cross-reference
  - Bonding curve graduation 시 가격 검증
- **비용**:
  - Data Feeds: 가스비만 지불 (읽기)
  - 예상: **$50-100/month (가스비)**
- **필요 시점**: Phase 2 중반 (선택사항)
- **대안**: Hyperliquid API만으로도 충분할 수 있음

---

### 6. **Dedicated RPC Provider (Recommended for Production)**
- **목적**: 안정적인 RPC 연결 (Public RPC 한계 극복)
- **옵션**:
  - **Alchemy**: Enterprise RPC
  - **Infura**: Reliable RPC
  - **QuickNode**: Fast RPC
- **필요한 환경변수**:
  ```env
  HYPERCORE_RPC_URL=https://your-dedicated-endpoint.com
  RPC_API_KEY=...
  ```
- **왜 필요한가**:
  - Public RPC rate limit 회피
  - 더 빠른 응답 시간
  - SLA 보장
  - WebSocket 지원
- **비용**:
  - Alchemy: $49/month (Growth)
  - QuickNode: $49/month (Build)
  - 예상: **$50/month**
- **필요 시점**: Phase 2 완료 후 (트래픽 증가 시)

---

## 🎯 Phase A: Layer System

### 7. **LayerZero (나중에 - 단일체인 MVP에서는 불필요)**
- **목적**: Cross-chain messaging (멀티체인 확장 시)
- **필요한 환경변수**:
  ```env
  LAYERZERO_ENDPOINT_ADDRESS=0x...
  LAYERZERO_CHAIN_ID=...
  ```
- **왜 필요한가**:
  - Layer 간 cross-chain 통신
  - 다른 체인으로 확장 시 필요
- **비용**: 가스비만 (메시지당 $0.01-0.10)
- **필요 시점**: **MVP에서는 불필요 (단일체인)**

---

## 🔐 Phase C: MEV Protection & Gas-free

### 8. **MEV Protection Service**
- **목적**: Bonding Curve 거래 시 MEV 공격 방지
- **옵션**:
  - **Flashbots Protect** (Ethereum)
  - **Custom MEV 솔루션** (기술 지원팀에서 제공 예정)
- **필요한 환경변수**:
  ```env
  MEV_PROTECTION_ENABLED=true
  MEV_RPC_URL=...
  MEV_API_KEY=...
  ```
- **왜 필요한가**:
  - Layer 3 Bonding Curve에서 front-running 방지
  - 사용자 거래 가격 보호
  - Sandwich attack 방지
- **비용**:
  - Flashbots: 무료 (하지만 HyperCore에서 작동 안 할 수 있음)
  - Custom solution: **협의 필요 (기술 지원팀)**
- **필요 시점**: Phase 4 (Bonding Curve) 구현 시

---

### 9. **Gas-free Bridging Service**
- **목적**: 사용자가 Layer 간 이동 시 가스비 부담 제거
- **필요한 환경변수**:
  ```env
  GASLESS_RELAYER_URL=...
  GASLESS_API_KEY=...
  GASLESS_SPONSOR_ADDRESS=0x...
  ```
- **왜 필요한가**:
  - UX 개선 (사용자가 가스 토큰 보유 불필요)
  - Layer 1 ↔ Layer 2 ↔ Layer 3 전환 시 gasless
  - 신규 사용자 onboarding 용이
- **비용 예상**:
  - Relayer 운영 비용: **$200-500/month**
  - 트랜잭션당 가스비: **$0.001-0.01**
  - 예상 월간 비용 (1만 거래): **$500-1000**
- **필요 시점**: Phase A (Layer System) 구현 시

---

## 💎 Phase 5: Native Token

### 10. **Token Deployment & Management**
- **목적**: HyperIndex Native Token 발행
- **필요한 환경변수**:
  ```env
  NATIVE_TOKEN_ADDRESS=0x...
  TOKEN_OWNER_PRIVATE_KEY=0x...
  TREASURY_ADDRESS=0x...
  ```
- **왜 필요한가**:
  - Fee payment를 native token으로 받기
  - Funding 참여자 보상
  - Buy-back 메커니즘
  - Governance (나중에)
- **비용**:
  - 토큰 배포 가스비: **$100-200 (1회)**
  - Liquidity 공급: **$10,000+ (초기)**
- **필요 시점**: Phase 5

---

## 📊 모니터링 & Analytics (Optional but Recommended)

### 11. **Sentry**
- **목적**: 에러 트래킹 및 모니터링
- **필요한 환경변수**:
  ```env
  SENTRY_DSN=https://...@sentry.io/...
  ```
- **왜 필요한가**:
  - Backend 에러 실시간 알림
  - 버그 추적 및 디버깅
  - Performance 모니터링
- **비용**:
  - Free tier: 5,000 errors/month
  - Team: $26/month (50,000 errors)
  - 예상: **초기 Free, 나중에 $26/month**
- **필요 시점**: Phase 2 이후 (프로덕션 준비)

---

### 12. **Datadog / Grafana Cloud (Optional)**
- **목적**: 인프라 모니터링 및 대시보드
- **필요한 환경변수**:
  ```env
  DATADOG_API_KEY=...
  DATADOG_APP_KEY=...
  ```
- **왜 필요한가**:
  - API latency 모니터링
  - Database query 성능
  - Rate limit 상태 추적
- **비용**:
  - Datadog: $15/host/month
  - Grafana Cloud: Free tier 있음
  - 예상: **$15-50/month**
- **필요 시점**: 프로덕션 런칭 후

---

## 💰 예상 월간 비용 요약

### 🎯 MVP 단계 (Phase 1-2)
| 서비스 | 비용 | 필수 여부 |
|--------|------|-----------|
| Supabase | $0 (Free tier) | ✅ 필수 |
| Privy | $0 (Free tier) | ✅ 필수 |
| Hyperliquid API | $0 | ✅ 필수 |
| HyperCore RPC | $0 | ✅ 필수 |
| **합계** | **$0/month** | |

### 🚀 Growth 단계 (사용자 1,000+)
| 서비스 | 비용 | 필수 여부 |
|--------|------|-----------|
| Supabase Pro | $25 | ✅ 필수 |
| Privy Growth | $99 | ✅ 필수 |
| Dedicated RPC | $50 | ✅ 추천 |
| Sentry | $26 | 🟡 선택 |
| Monitoring | $50 | 🟡 선택 |
| **합계** | **$174-250/month** | |

### 🏆 Scale 단계 (사용자 10,000+)
| 서비스 | 비용 | 필수 여부 |
|--------|------|-----------|
| Supabase Pro | $25 | ✅ 필수 |
| Privy Pro | $299 | ✅ 필수 |
| Dedicated RPC | $99 | ✅ 필수 |
| MEV Protection | $0-협의 | ✅ 필수 |
| Gas-free Service | $500-1000 | ✅ 필수 |
| Monitoring | $100 | ✅ 추천 |
| **합계** | **$1,023-1,523/month** | |

---

## 📝 즉시 필요한 것들 (우선순위)

### 🔴 지금 즉시 (Phase 1)
1. ✅ Hyperliquid API - 무료 (이미 설정 가능)
2. ⏳ Supabase 계정 생성 - 무료
3. ⏳ Privy 계정 생성 - 무료
4. ⏳ HyperCore testnet wallet 생성 - 무료

### 🟡 Phase 2 시작 전
1. Supabase DB 스키마 설계
2. HyperCore mainnet wallet (funding 필요)
3. Dedicated RPC 고려 (트래픽에 따라)

### 🟢 Phase 4-5 (Bonding Curve & Native Token)
1. MEV Protection 기술 지원 미팅
2. Gas-free Relayer 셋업
3. Native Token 배포 계획

---

## 🔗 유용한 링크

- Hyperliquid Docs: https://hyperliquid.gitbook.io
- Supabase: https://supabase.com
- Privy: https://privy.io
- Sentry: https://sentry.io

---

## 📌 다음 액션 아이템

1. [ ] Supabase 프로젝트 생성
2. [ ] Privy 앱 등록
3. [ ] HyperCore testnet faucet에서 테스트 토큰 받기
4. [ ] .env 파일에 모든 키 설정
5. [ ] Phase 2 시작 전 외부 팀과 MEV/Gas-free 논의

---

*Last Updated: 2025-01-XX*
