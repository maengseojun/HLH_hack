# 🎓 HyperIndex 완전 정복 가이드
## 초보자를 위한 1-2일 집중 학습 로드맵

> **"이 문서 하나면 누구에게든 HyperIndex를 설명할 수 있습니다"**
> 
> 작성일: 2025년 1월 20일  
> 대상: 프로그래밍 기초는 있지만 DeFi/블록체인 초보인 개발자  
> 학습 시간: 총 16시간 (2일 × 8시간)

---

## 🛠️ 기술 스택 (Tech Stack)

### Backend
| 항목 | 기술 | 설명 | 사용 이유 |
|-----|------|------|----------|
| **런타임** | Node.js 22+ | JavaScript 런타임 | 빠른 개발, 큰 생태계 |
| **프레임워크** | Express.js | API 서버 프레임워크 | 간단하고 유연함 |
| **언어** | TypeScript | 타입 안전 JavaScript | 버그 감소, IDE 지원 |
| **데이터베이스** | Supabase (PostgreSQL) | 관계형 DB | 무료, 실시간 지원 |
| **캐시** | Redis 7 | 인메모리 데이터베이스 | 빠른 조회, 세션 저장 |
| **인증** | Privy | 월렛 연결 & 인증 | 쉬운 Web3 로그인 |

### Frontend
| 항목 | 기술 | 설명 | 사용 이유 |
|-----|------|------|----------|
| **프레임워크** | Next.js 15 | React 풀스택 프레임워크 | SEO, SSR/SSG 지원 |
| **언어** | TypeScript | 타입 안전 JavaScript | Backend와 타입 공유 |
| **스타일** | Tailwind CSS | 유틸리티 CSS | 빠른 UI 개발 |
| **상태관리** | React Hooks | React 내장 상태관리 | 간단하고 충분함 |
| **블록체인** | ethers.js / viem | 이더리움 라이브러리 | Smart Contract 상호작용 |

### Smart Contracts
| 항목 | 기술 | 설명 | 사용 이유 |
|-----|------|------|----------|
| **언어** | Solidity ^0.8.20 | Smart Contract 언어 | EVM 표준 |
| **AMM** | Uniswap V2 호환 | 자동 시장 조성자 | 검증된 알고리즘 |
| **표준** | ERC-20 | 토큰 표준 | 호환성 |
| **패턴** | Upgradeable | 업그레이드 가능 패턴 | 유지보수 가능 |

### Infrastructure
| 항목 | 기술 | 설명 | 사용 이유 |
|-----|------|------|----------|
| **컨테이너** | Docker | 애플리케이션 패키징 | 일관된 환경 |
| **오케스트레이션** | Docker Compose | 멀티 컨테이너 관리 | 개발 편의성 |
| **CI/CD** | GitHub Actions (예정) | 자동화 파이프라인 | 배포 자동화 |

### Blockchain
| 항목 | 기술 | 설명 | 사용 이유 |
|-----|------|------|----------|
| **L1** | HyperCore | HyperLiquid 블록체인 | 초고속 거래 |
| **L2** | Arbitrum / Polygon | Layer 2 스케일링 | 낮은 Gas fees |
| **Bridge** | LayerZero (예정) | 크로스체인 브릿지 | L3↔L2 전환 |

---

## 📊 프로젝트 구조 요약

```
HyperIndex/
│
├── 📱 frontend/          [Next.js 15 + TypeScript]
│   - 사용자 UI
│   - Privy 월렛 연결
│   - ethers.js/viem으로 Contract 호출
│
├── 🔧 backend/           [Express.js + TypeScript]
│   - REST API
│   - Supabase 연동
│   - Redis 캐싱
│   - HyperCore RPC 통합
│
├── 📝 contracts/         [Solidity ^0.8.20]
│   - AMM (Uniswap V2 스타일)
│   - Index Token (ERC-20)
│   - HyperCore Actions
│   - ⚠️ 현재 배포되지 않음 (시뮬레이션)
│
└── 🐳 docker/            [Docker Compose]
    - Redis 컨테이너
    - Backend 컨테이너
    - Frontend 컨테이너
```

---

## 🔄 데이터 흐름 (Data Flow)

```
사용자 브라우저
       ↓
    Frontend (Next.js)
       ↓ REST API
    Backend (Express)
    ↙       ↘
 Supabase   Redis
             ↓
        HyperCore RPC
             ↓
      Smart Contracts (예정)
```

---

## 💰 Native Token (HI) 경제학

### 토큰 스펙
```
Symbol: HI
Total Supply: 1,000,000,000 (1B)
Decimals: 18
Base Price: $0.05
```

### 할당 구조
- **Team & Advisors**: 20% (200M) - 36개월 베스팅, 12개월 cliff
- **Ecosystem Incentives**: 30% (300M) - 펀딩 타임, LP 보상
- **Community**: 35% (350M) - 48개월 베스팅
- **DAO Treasury**: 15% (150M) - 거버넌스 운영

### Funding Rounds
| Round | Price | Discount | Target | Vesting |
|-------|-------|----------|--------|---------|
| Seed | $0.01 | 70% | $500k | 12mo/3mo cliff |
| Strategic | $0.02 | 40% | $2M | 18mo/6mo cliff |
| Public | $0.05 | 0% | $5M | 6mo/0mo cliff |

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

[이하 기존 내용 계속...]
