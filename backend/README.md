# HyperIndex Backend

Express-based backend for HyperIndex MVP with Supabase integration

## 🏗️ Architecture

```
backend/
├── src/
│   ├── config.ts              # Configuration management
│   ├── index.ts               # Express app entry point
│   ├── lib/                   # ✅ Libraries
│   │   ├── supabase.ts        # ✅ Supabase client
│   │   └── types.ts           # ✅ Database types
│   ├── middlewares/           # Request processing pipeline
│   │   ├── auth.ts            # Authentication
│   │   ├── errorHandler.ts    # Error handling
│   │   ├── idempotency.ts     # Idempotency support
│   │   ├── metricsCollector.ts # Metrics collection
│   │   ├── requestContext.ts  # Request logging
│   │   └── circuitBreaker.ts  # Emergency stop mechanism
│   ├── routes/                # API endpoints
│   │   ├── health.ts          # Health check
│   │   ├── monitoring.ts      # Metrics endpoint
│   │   ├── balance.ts         # Balance API
│   │   ├── trading.ts         # Trading API
│   │   ├── indexes.ts         # Index/Layer API
│   │   ├── bondingCurve.ts    # Bonding Curve API
│   │   └── token.ts           # Native Token API
│   ├── services/              # Business logic
│   │   ├── balance.ts         # Balance service
│   │   ├── trading.ts         # Trading service (AMM)
│   │   ├── index.ts           # Index/Layer management
│   │   ├── bondingCurve.ts    # Price calculation
│   │   ├── graduation.ts      # L3→L2 migration
│   │   ├── token.ts           # Token management
│   │   ├── fundingRound.ts    # Investment rounds
│   │   └── feeCollection.ts   # Fee & Buyback
│   ├── types/                 # TypeScript types
│   │   ├── express.d.ts       # Express type extensions
│   │   ├── index.ts           # Index/Layer types
│   │   └── token.ts           # Token types
│   ├── schemas/               # Validation schemas
│   │   ├── common.ts          # Common Zod schemas
│   │   └── env.ts             # Environment validation
│   ├── utils/                 # Utility functions
│   │   └── httpError.ts       # Error handling utilities
│   └── infra/                 # Infrastructure
│       └── logger.ts          # Logging setup
├── supabase/                  # ✅ Database
│   └── migrations/
│       ├── 20250120_create_token_tables.sql
│       ├── 20250120_create_funding_tables.sql
│       └── 20250120_create_index_tables.sql
├── package.json
├── tsconfig.json
├── .env.example
├── ESSENTIAL.md               # External services & costs
├── API.md                     # Complete API documentation
├── SUPABASE_SETUP.md          # ✅ Supabase setup guide
├── PHASE4_COMPLETION_REPORT.md # Phase 4 details
├── PHASE5_COMPLETION_REPORT.md # Phase 5 details
├── PHASE6_COMPLETION_REPORT.md # ✅ Phase 6 details
└── README.md
```

## 🎯 Features

### ✅ Phase 1: Base Infrastructure
- Express server with TypeScript
- Middleware pipeline (auth, logging, metrics, rate limiting)
- Configuration management with Zod validation
- Comprehensive error handling
- Idempotency support
- Health checks and monitoring

### ✅ Phase 2: Trading Core
- Balance management
- AMM swaps
- Order management (market/limit)
- Pool information

### ✅ Phase A: Layer System
- **Layer 1 (L1)**: Major market indices (50+ tokens, AMM)
- **Layer 2 (L2)**: Themed indices (5-50 tokens, AMM)
- **Layer 3 (L3)**: User-launched indices (2-20 tokens, Bonding Curve)
- Index CRUD operations
- Component validation
- Layer-specific configurations
- Rebalancing support

### ✅ Phase 4: Bonding Curve
- **Sigmoid Hybrid Model**: Fair pricing for all participants
- **Circuit Breaker**: TVL-based emergency stop (25% decline = 48h halt)
- **Graduation Logic**: Automated L3→L2 migration
- **Price Calculations**: Buy/Sell quotes with slippage
- **Progress Tracking**: Real-time graduation progress

### ✅ Phase 5: Native Token
- **Token Economics**: HI token with 1B supply
- **Funding Rounds**: Seed/Strategic/Public (3 rounds)
- **Vesting System**: Linear unlock with cliff periods
- **Fee Collection**: Native token fees (swap/management/performance)
- **Buy-back Mechanism**: Automated price support + burn
- **Token Distribution**: 5-way allocation

### ✅ Phase 6: Supabase Integration
- **Database Schema**: 7 new tables + 2 from dev6
- **Row Level Security**: Granular access control
- **Migrations**: SQL migration files
- **TypeScript Types**: Full type safety
- **Setup Guide**: Complete Supabase setup documentation

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm
- Supabase account (for database)

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# See SUPABASE_SETUP.md for Supabase configuration
```

### Supabase Setup

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed instructions.

Quick setup:
```bash
1. Create Supabase project
2. Copy API keys to .env
3. Run migrations (supabase db push)
4. Start backend
```

### Development

```bash
# Start development server with hot reload
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

### Testing APIs

See [API.md](./API.md) for complete documentation.

**Quick test:**
```bash
# Health check (includes Supabase status)
curl http://localhost:3001/health

# Get token metrics
curl http://localhost:3001/v1/token/metrics

# Get active funding rounds
curl "http://localhost:3001/v1/token/funding-rounds?active=true"
```

## 📖 Documentation

- **[API.md](./API.md)**: Complete API documentation
- **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**: Supabase setup guide ✨ NEW
- **[ESSENTIAL.md](./ESSENTIAL.md)**: External services & costs
- **[PHASE4_COMPLETION_REPORT.md](./PHASE4_COMPLETION_REPORT.md)**: Bonding curve details
- **[PHASE5_COMPLETION_REPORT.md](./PHASE5_COMPLETION_REPORT.md)**: Native token details
- **[PHASE6_COMPLETION_REPORT.md](./PHASE6_COMPLETION_REPORT.md)**: Supabase integration ✨ NEW

## 🗄️ Database

### Tables

**From dev6 (existing):**
- `users` - User accounts (Privy integration)
- `user_wallets` - EVM wallet addresses

**New (Phase 6):**
- `token_holders` - Token balances
- `token_transactions` - Token operations
- `funding_rounds` - Investment rounds
- `investments` - User investments
- `indices` - Index funds
- `index_components` - Index components
- `bonding_curve_params` - L3 bonding curves

### Row Level Security

- ✅ Public read: indices, funding_rounds
- 🔒 User-specific: token_holders, investments
- 🔑 Service role: Full access

## 🔐 Authentication

Currently supports Bearer token authentication for MVP:

```bash
curl -H "Authorization: Bearer hyperindex-demo-token-2024" \
  http://localhost:3001/v1/token/balance
```

Production will use Privy + Supabase RLS.

## 📊 Monitoring

- Health check: `GET /health` (includes Supabase status)
- Metrics: `GET /metrics`
- Dashboard: `GET /dashboard`
- Token metrics: `GET /v1/token/metrics`

## 🛠️ Development Roadmap

### Phase 1: Base Infrastructure ✅
- [x] Express setup
- [x] Middleware pipeline
- [x] Configuration management

### Phase 2: Trading Core ✅
- [x] Balance service
- [x] Trading service (AMM)
- [x] Swap/Order endpoints

### Phase A: Layer System ✅
- [x] Layer types and configurations
- [x] Index CRUD operations
- [x] Component validation

### Phase 4: Bonding Curve ✅
- [x] Sigmoid hybrid calculation
- [x] Circuit breaker
- [x] Graduation logic

### Phase 5: Native Token ✅
- [x] Token economics
- [x] Funding rounds
- [x] Vesting system
- [x] Fee collection
- [x] Buy-back mechanism

### Phase 6: Supabase Integration ✅
- [x] Database schema design
- [x] Migration files
- [x] TypeScript types
- [x] RLS policies
- [x] Setup documentation
- [ ] Service integration 🔄 Next

### Phase 6.1: Service Migration 🔄
- [ ] Token service → Supabase
- [ ] Funding round service → Supabase
- [ ] Index service → Supabase
- [ ] Transaction history
- [ ] Real-time subscriptions

### Phase 7: Smart Contracts ⏳
- [ ] Research & design
- [ ] Token contract (ERC-20)
- [ ] Vesting contract
- [ ] Blockchain integration

## 💎 Native Token (HI)

### Specs
```
Symbol: HI
Total Supply: 1,000,000,000
Decimals: 18
Base Price: $0.05
```

### Allocation
- Team: 20% (36mo vesting, 12mo cliff)
- Investors: 20% (24mo vesting, 6mo cliff)
- Community: 35% (48mo vesting)
- Foundation: 15% (48mo vesting)
- Treasury: 10% (liquid)

### Funding Rounds
1. Seed: $0.01/token (70% discount)
2. Strategic: $0.02/token (40% discount)
3. Public: $0.05/token (no discount)

## 💰 Cost Estimates

### MVP (Current)
- Supabase: **$0/month** (Free tier)
- Total: **$0/month**

### Growth (1,000+ users)
- Supabase: $25/month (Pro plan)
- Other services: $150-225/month
- Total: **$175-250/month**

See [ESSENTIAL.md](./ESSENTIAL.md) for details.

## 🔧 Current Status

### ✅ Working
- All API endpoints (50 total)
- In-memory data operations
- Supabase schema ready
- Full type safety

### 🔄 In Progress
- Service → Supabase migration
- Data persistence

### ⏳ Planned
- Smart contracts (after research)
- Blockchain integration
- WebSocket support

## 📋 Next Steps

1. [ ] Migrate services to Supabase
2. [ ] Test with real Supabase instance
3. [ ] Add real-time subscriptions
4. [ ] Research Smart Contracts
5. [ ] Deploy token contracts (optional)

## 🐛 Known Issues

- Services still use in-memory storage (Phase 6.1)
- HyperCore RPC integration pending
- Token operations are simulated
- No WebSocket support yet

## 📊 Stats

- **Total Endpoints**: 50
- **Database Tables**: 9 (7 new + 2 from dev6)
- **Services**: 8
- **Migrations**: 3
- **RLS Policies**: 15+

## 📄 License

Private - All rights reserved
