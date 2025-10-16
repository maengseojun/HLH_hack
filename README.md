# 🚀 HyperIndex (HI) - Integrated Project

> **HyperCore 기반 통합 거래 플랫폼 - Index Token DEX**

---

## 🛠️ 기술 스택

### Backend: **TypeScript** + Express.js
- Node.js 22+ Runtime
- Supabase (PostgreSQL) Database
- Redis 7 Cache

### Smart Contracts: **Solidity** ^0.8.20
- AMM (Uniswap V2 compatible)
- Index Tokens (ERC-20)
- Bonding Curve System
- ⚠️ **Status**: Code ready, not yet deployed

### Frontend: **TypeScript** + Next.js 15
- React 19
- Tailwind CSS
- Privy Auth

👉 **[전체 기술 스택 보기](./TECH_STACK.md)**

---

## 📁 프로젝트 구조

```
HI/
├── 📱 frontend/              # Next.js 15 Frontend
├── 🔧 backend/               # Express API Server
│   ├── src/
│   │   ├── routes/          # API Endpoints (50개)
│   │   ├── services/        # Business Logic (8개)
│   │   ├── lib/             # Supabase Client
│   │   └── types/           # TypeScript Types
│   └── supabase/            # Database Migrations
├── 📝 contracts/             # Smart Contracts (Solidity)
│   ├── hypercore/           # HyperCore Integration
│   ├── amm/                 # AMM System
│   ├── tokens/              # Index Token Management
│   ├── governance/          # DAO Governance (예정)
│   └── interfaces/          # Interfaces
├── 🐳 docker/               # Docker Configuration
├── 📚 docs/                 # Documentation
│   ├── api/                # API Docs
│   ├── contracts/          # Contract Docs
│   └── setup/              # Setup Guides
├── 🧪 tests/                # Tests
└── 🛠️ scripts/              # Deployment Scripts
```

---

## 🎯 핵심 기능

### ✅ Phase 1-6 완료
- **Layer System**: L1 (Major), L2 (Themed), L3 (User-Launched) Indices
- **Bonding Curve**: Sigmoid Hybrid Model for fair pricing
- **AMM Integration**: Uniswap V2 compatible DEX
- **Native Token (HI)**: 1B supply with funding rounds
- **Graduation Logic**: Automatic L3→L2 migration
- **Database**: Supabase schema (9 tables)

### 🔄 In Progress
- Service → Supabase Migration
- Frontend Development
- Real-time Subscriptions

### ⏳ Planned
- Smart Contract Deployment
- Blockchain Integration
- L3↔L2 Bridge

---

## 🚀 빠른 시작

### 1. 사전 준비
```bash
# 필수 소프트웨어
- Node.js 22+
- Docker Desktop
- Git

# 계정 생성 (선택)
- Privy (https://privy.io)
- Supabase (https://supabase.com)
```

### 2. 설치
```bash
# 프로젝트 클론
git clone <repository-url>
cd HI

# 환경 변수 설정
cp .env.example .env
# .env 파일 편집

# Docker로 실행
./docker-dev.sh dev
```

### 3. 접속
```bash
# Frontend
http://localhost:3000

# Backend API
http://localhost:3001/api/v1/health

# Redis
docker exec -it hlh-redis redis-cli
```

---

## 📖 Documentation

### 시작 가이드
- 📘 **[Complete Learning Guide](./COMPLETE_LEARNING_GUIDE.md)** - 16시간 학습 로드맵
- 🔧 **[Tech Stack](./TECH_STACK.md)** - 기술 스택 상세
- 🚀 **[Developer Onboarding](./DEVELOPER_ONBOARDING_GUIDE.md)** - 개발자 온보딩

### Backend
- 📖 **[Backend README](./backend/README.md)** - Backend 상세 가이드
- 📊 **[API Documentation](./backend/API.md)** - 50개 API 엔드포인트
- 🗄️ **[Supabase Setup](./backend/SUPABASE_SETUP.md)** - DB 설정 가이드

### Phase Reports
- 🎉 **[Phase 4: Bonding Curve](./backend/PHASE4_COMPLETION_REPORT.md)**
- 🎉 **[Phase 5: Native Token](./backend/PHASE5_COMPLETION_REPORT.md)**
- 🎉 **[Phase 6: Supabase](./backend/PHASE6_COMPLETION_REPORT.md)**

### Analysis
- 🔍 **[Project Comparison](./backend/PROJECT_COMPARISON_ANALYSIS.md)** - Index Token DEX vs HyperIndex

---

## 💎 Native Token (HI)

```
Symbol: HI
Total Supply: 1,000,000,000 (1B)
Base Price: $0.05

Allocation:
- Team: 20% (36mo vesting, 12mo cliff)
- Investors: 20% (24mo vesting, 6mo cliff)
- Community: 35% (48mo vesting)
- Foundation: 15% (48mo vesting)
- Treasury: 10% (liquid)

Funding Rounds:
- Seed: $0.01/token (70% discount, $500k target)
- Strategic: $0.02/token (40% discount, $2M target)
- Public: $0.05/token (no discount, $5M target)
```

---

## 📊 Project Status

### Phase Progress
```
✅ Phase 1: Base Infrastructure      100%
✅ Phase 2: Trading Core              100%
✅ Phase A: Layer System              100%
✅ Phase 4: Bonding Curve             100%
✅ Phase 5: Native Token              100%
✅ Phase 6: Supabase Integration      80%
🔄 Phase 6.1: Service Migration       0%
⏳ Phase 7: Smart Contracts           0%
```

### Implementation
```
Backend API:       50 endpoints ✅
Services:          8 services ✅
Database:          9 tables ✅
Smart Contracts:   8 contracts (not deployed)
Documentation:     100% ✅
```

---

## 🛠️ Development

### Docker 명령어
```bash
# 모든 서비스 시작
./docker-dev.sh dev

# 로그 확인
docker compose logs -f

# 특정 서비스 재시작
docker compose restart backend

# 모든 서비스 중지
./docker-dev.sh stop

# 완전 초기화 (볼륨 삭제)
docker compose down -v
```

### Backend 개발
```bash
cd backend

# 개발 서버
pnpm dev

# 빌드
pnpm build

# 프로덕션 실행
pnpm start
```

---

## 🌐 API Endpoints

**Total: 50 endpoints**

| Category | Count | Examples |
|----------|-------|----------|
| Health & Monitoring | 3 | `/health`, `/metrics` |
| Balance | 3 | `/v1/balance` |
| Trading | 5 | `/v1/trading/swap` |
| Indexes | 7 | `/v1/indexes` |
| Bonding Curve | 7 | `/v1/bonding-curve/quote` |
| Token | 18 | `/v1/token/balance` |

👉 **[Full API Documentation](./backend/API.md)**

---

## 💰 Cost Estimates

### MVP (Current)
- **Backend**: Supabase Free Tier
- **Cache**: Redis (Docker)
- **Total**: **$0/month** ✅

### Growth (1,000+ users)
- Supabase Pro: $25/month
- Other services: $150-225/month
- **Total**: $175-250/month

### Scale (10,000+ users)
- Supabase Pro + Add-ons
- Infrastructure scaling
- **Total**: $1,000-1,500/month

👉 **[Detailed Cost Breakdown](./backend/ESSENTIAL.md)**

---

## 🤝 Contributing

### 개발 시작하기
1. 📖 [Complete Learning Guide](./COMPLETE_LEARNING_GUIDE.md) 읽기
2. 🚀 [Developer Onboarding](./DEVELOPER_ONBOARDING_GUIDE.md) 따라하기
3. 🔧 환경 설정
4. 💻 개발 시작!

### 코드 스타일
- TypeScript (Backend & Frontend)
- Solidity ^0.8.20 (Smart Contracts)
- ESLint + Prettier

---

## 📄 License

Private - All rights reserved

---

## 📞 Support

- 📧 Email: support@hyperindex.io
- 💬 Discord: (예정)
- 📝 GitHub Issues: (예정)

---

**Last Updated**: 2025-01-20
