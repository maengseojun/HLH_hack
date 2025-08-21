
# HOOATS System Architecture - Structural Visualization

*Created: 2025-08-13*

  

## Executive Summary

  

This document provides a comprehensive architectural analysis of the HOOATS (Hybrid OffChain Orderbook + AMM Trading System) following a detailed review of all lib/trading, lib/orderbook, and lib/security directories. The system is designed for testnet deployment on HyperEVM with a target performance of 15-20K TPS while maintaining robust security protections.

  

## System Architecture Overview

  

```mermaid

graph TB
      subgraph "Frontend Layer"
          UI[Next.js Trading Interface]
          WS[WebSocket Real-time Data]
      end

      subgraph "API Layer"
          V1[Trading API V1]
          V2[Trading API V2 - SmartRouter]
          AUTH[Privy Authentication]
          REDIS_API[Redis Management APIs]
      end

      subgraph "Core Trading Engine"
          OV[OrderValidator]
          SR2[SmartRouterV2]
          UPO[UltraPerformanceOrderbook]
          PME[ParallelMatchingEngine]
          MPM[MemoryPoolManager]
          STE[SecureTPSEngine]
          RS[Redis Lua Scripts]
      end

      subgraph "Security Layer"
          MEV[MEVProtection]
          CSV[CrossSystemValidator]
          RL[RateLimiter]
          AUDIT[AuditLogger]
          FF[FraudDetection]
          REJECT[Order Rejection]
      end

      subgraph "Settlement Layer"
          QUEUE[Settlement Queue]
          BATCH[Batch Processor]
          SETTLE[OnChainSettlement]
      end

      subgraph "Data Layer"
          REDIS[(Redis Hot Data)]
          PG[(PostgreSQL Cold Storage)]
          ONCHAIN[(HyperEVM Blockchain)]
      end

      subgraph "AMM Integration"
          HAMM[HyperVMAMM]
          CONTRACTS[Smart Contracts]
      end

      %% Main Flow
      UI --> V2
      V2 --> OV
      OV --> SR2

      %% Security Flow
      SR2 --> STE
      STE --> MEV
      STE --> RL
      STE --> CSV

      %% Security Decision Points
      MEV --> |Pass| UPO
      MEV --> |Block| REJECT
      RL --> |Pass| UPO
      RL --> |Block| REJECT
      CSV --> |Pass| UPO
      CSV --> |Block| REJECT

      %% Trading Engine Flow
      SR2 --> |Route to AMM| HAMM
      SR2 --> |Route to Orderbook| UPO
      UPO --> PME
      PME --> MPM
      UPO --> RS

      %% Settlement Flow
      UPO --> |Completed Trades| QUEUE
      HAMM --> |AMM Trades| QUEUE
      QUEUE --> BATCH
      BATCH --> SETTLE
      SETTLE --> CONTRACTS

      %% Data Flow
      UPO --> REDIS
      SR2 --> PG
      SETTLE --> PG
      HAMM --> ONCHAIN
      CONTRACTS --> ONCHAIN

      %% Audit Flow
      MEV --> AUDIT
      FF --> AUDIT
      RL --> AUDIT
      REJECT --> AUDIT
      SETTLE --> AUDIT

      %% Styling
      classDef security fill:#ffcccc
      classDef trading fill:#ccffcc
      classDef settlement fill:#ccccff
      classDef data fill:#ffffcc

      class MEV,CSV,RL,FF,REJECT,AUDIT security
      class OV,SR2,UPO,PME,MPM,STE,RS trading
      class QUEUE,BATCH,SETTLE settlement
      class REDIS,PG,ONCHAIN data

```

  

## Directory Structure Analysis

  

### lib/trading/ - Core Trading Components

  

#### ✅ Production Ready Files

- **precision-utils.ts** - Essential precision handling utilities

- **smart-router-v2.ts** - Main production router with dynamic chunking

- **on-chain-settlement.ts** - Settlement service for orderbook trades

- order validator - Order 검증 및 유효성 테스트트

  

#### ❌ Deprecated/Problematic Files (모두 삭제됨)

- **order-service.ts** - Legacy V1, references non-existent DB tables

- **advanced-order-service.ts** - Mock implementation, incompatible tables

- **partial-fill-manager.ts** - Dependent on deprecated services

- **portfolio-service.ts** - Mock-only implementation, no real functionality

- **ultra-fast-router.ts** - Dependency issues with missing components

  

### lib/orderbook/ - High-Performance Order Matching

  

#### ✅ Production Ready Files

- **ultra-performance-orderbook.ts** - 15-20K TPS core engine

- **parallel-matching-engine.ts** - CPU sharding for performance

- **memory-pool-manager.ts** - 95% GC pressure reduction

- **redis-scripts.ts** - Complete Lua script collection

  

#### ⚠️ Needs Database Schema Fix

- **postgres-sync.ts** - References non-existent tables (orderbook_orders, orderbook_trades)

  

### lib/security/ - Comprehensive Security Suite

  

#### ✅ Production Ready Files

- **AdvancedSandwichDetector.ts** - Sophisticated MEV attack detection

- **CrossSystemValidator.ts** - Off-chain/on-chain state verification

- **MEVProtection.ts** - 3-layer MEV defense system

- **SecureTPSEngine.ts** - 20K TPS with security integration

- **ImprovedRateLimiter.ts** - Clean separation from order management

- **audit-logger.ts** - Comprehensive audit logging

- **behavior-analyzer.ts** - User behavior analysis

- **fraud-detection.ts** - ML-integrated fraud detection

- **withdrawal-verification.ts** - Multi-method withdrawal verification

- **privy-events.ts** - Enhanced security logging with Privy integration

  

#### ⚠️ Needs Database Schema

- **2fa-service.ts** - Complete 2FA implementation (needs user_2fa tables)

- Most security services reference tables that need to be created

  

### lib/redis/ - Caching & Hot Data

  

#### ✅ Production Ready Files

- **client.ts** - Redis connection with fallback

- **fallback-client.ts** - In-memory development fallback

- **test-utils.ts** - Redis functionality testing

  

## Database Schema Requirements

  

### Missing Tables That Need Creation

  

```sql

-- Security Tables

CREATE TABLE user_2fa (

    id UUID PRIMARY KEY,

    user_id UUID NOT NULL,

    secret_key TEXT NOT NULL,

    backup_codes TEXT[],

    is_enabled BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT NOW()

);

  

CREATE TABLE user_2fa_setup (

    id UUID PRIMARY KEY,

    user_id UUID NOT NULL,

    setup_token TEXT NOT NULL,

    qr_code_data TEXT,

    expires_at TIMESTAMP NOT NULL,

    created_at TIMESTAMP DEFAULT NOW()

);

  

CREATE TABLE security_audit_log (

    id UUID PRIMARY KEY,

    user_id UUID,

    action TEXT NOT NULL,

    severity TEXT NOT NULL,

    outcome TEXT NOT NULL,

    ip_address INET,

    device_fingerprint TEXT,

    risk_score INTEGER,

    additional_data JSONB,

    created_at TIMESTAMP DEFAULT NOW()

);

  

CREATE TABLE user_behavior_patterns (

    id UUID PRIMARY KEY,

    user_id UUID NOT NULL,

    pattern_type TEXT NOT NULL,

    pattern_data JSONB NOT NULL,

    confidence_score DECIMAL(5,4),

    last_updated TIMESTAMP DEFAULT NOW()

);

  

CREATE TABLE withdrawal_verifications (

    id UUID PRIMARY KEY,

    user_id UUID NOT NULL,

    wallet_address TEXT NOT NULL,

    amount DECIMAL(20,8) NOT NULL,

    destination_address TEXT NOT NULL,

    verification_code TEXT NOT NULL,

    verification_method TEXT NOT NULL,

    expires_at TIMESTAMP NOT NULL,

    is_verified BOOLEAN DEFAULT false,

    attempt_count INTEGER DEFAULT 0,

    verified_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW()

);

  

-- Orderbook Tables

CREATE TABLE orderbook_orders (

    id UUID PRIMARY KEY,

    redis_order_id TEXT UNIQUE,

    user_id UUID NOT NULL,

    pair TEXT NOT NULL,

    side TEXT CHECK (side IN ('buy', 'sell')),

    price DECIMAL(20,8) NOT NULL,

    amount DECIMAL(20,8) NOT NULL,

    filled_amount DECIMAL(20,8) DEFAULT 0,

    status TEXT DEFAULT 'active',

    created_at TIMESTAMP DEFAULT NOW()

);

  

CREATE TABLE orderbook_trades (

    id UUID PRIMARY KEY,

    redis_trade_id TEXT UNIQUE,

    pair TEXT NOT NULL,

    buyer_order_id TEXT,

    seller_order_id TEXT,

    price DECIMAL(20,8) NOT NULL,

    amount DECIMAL(20,8) NOT NULL,

    side TEXT CHECK (side IN ('buy', 'sell')),

    executed_at TIMESTAMP DEFAULT NOW()

);

  

-- Settlement Tables (extend existing trade_history)

ALTER TABLE trade_history ADD COLUMN IF NOT EXISTS settlement_tx_hash TEXT;

ALTER TABLE trade_history ADD COLUMN IF NOT EXISTS settlement_block_number BIGINT;

ALTER TABLE trade_history ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'pending';

```

  

### Existing Tables That Are Compatible

- `users` - Compatible with all services

- `user_balances` - Compatible with trading services  

- `order_history` - Compatible with trading services

- `trade_history` - Compatible with trading services (needs settlement columns)

  

## System Integration Flow

  

### 1. Order Processing Flow (SmartRouterV2)

```

User Order → API V2 → SmartRouterV2 → Price Analysis → Chunk Decision

                                   ↓

Chunk 1: AMM → HyperVMAMM → On-chain Execution → Settlement

Chunk 2: Orderbook → UltraPerformanceOrderbook → Redis → PostgreSQL

                                   ↓

                    ParallelMatchingEngine → MemoryPoolManager

```

  

### 2. Security Integration Flow

```

Order → RateLimiter → MEVProtection → SecureTPSEngine → AuditLogger

                          ↓

        AdvancedSandwichDetector → FraudDetection → CrossSystemValidator

```

  

### 3. Data Flow Architecture

```

Hot Data (Redis):

- Real-time orderbook

- Active orders

- Recent trades (last 100)

- Session data

- Performance metrics

  

Cold Data (PostgreSQL):

- Order history

- Trade history  

- User profiles

- Audit logs

- Security events

  

On-chain Data (HyperEVM):

- AMM liquidity pools

- Settlement contracts

- Token balances

- Transaction history

```

  

## Performance Characteristics

  

### Current Achievements

- **13K+ TPS** achieved in testing (65% of 20K target)

- **95% GC pressure reduction** with MemoryPoolManager

- **Sub-50ms latency** for order processing

- **Real-time price-based routing** between AMM/Orderbook

  

### Target Performance (Testnet Ready)

- **15-20K TPS** with UltraPerformanceOrderbook + SecureTPSEngine

- **MEV Protection** with 3-layer defense system

- **Cross-system validation** for state consistency

- **Redis Lua scripts** for atomic operations

  

## Deployment Readiness Assessment

  

### ✅ Ready for Testnet

1. **SmartRouterV2** - Production-ready hybrid router

2. **UltraPerformanceOrderbook** - High-performance order matching

3. **HyperVMAMM** - Real on-chain AMM integration  

4. **Security Suite** - Comprehensive attack prevention

5. **Redis Infrastructure** - Hot data management

6. **PostgreSQL Storage** - Permanent record keeping

  

### ⚠️ Requires Database Migration

1. Create missing security tables (2FA, audit logs, behavior patterns)

2. Create missing orderbook sync tables

3. Add settlement columns to existing tables

4. Setup proper indexes for performance

  

### ❌ Should Be Removed/Deprecated

1. **order-service.ts** - Replace with SmartRouterV2

2. **advanced-order-service.ts** - Remove mock implementation

3. **partial-fill-manager.ts** - Functionality moved to SmartRouterV2

4. **portfolio-service.ts** - No real implementation

5. **ultra-fast-router.ts** - Dependency issues, not essential

  

## Security Threat Model

  

### Protected Against

- **Sandwich Attacks** - 3-layer MEV protection with commit-reveal

- **Front-running** - Batch auction processing

- **Price Manipulation** - Statistical anomaly detection

- **High-frequency MEV** - Rate limiting and pattern recognition

- **Cross-system Attacks** - State validation between on/off-chain

- **User Account Compromise** - 2FA, behavior analysis, audit logging

  

### Security Layers

1. **Input Validation** - Order signature verification, schema validation

2. **Rate Limiting** - Per-user tier limits, global system protection  

3. **MEV Detection** - Pattern recognition, statistical analysis

4. **Audit Trail** - Comprehensive logging, tamper-resistant records

5. **State Verification** - Cross-system consistency checks

  

## Implementation Priority

  

### Phase 1: Core System (Immediate)

1. Deploy database migrations for missing tables

2. Test SmartRouterV2 with real testnet contracts

3. Validate UltraPerformanceOrderbook performance

4. Setup Redis with production configuration

  

### Phase 2: Security Hardening

1. Enable comprehensive audit logging

2. Deploy MEV protection systems

3. Setup behavior analysis and fraud detection

4. Test 2FA and withdrawal verification

  

### Phase 3: Performance Optimization  

1. Optimize for 20K TPS target

2. Fine-tune parallel processing

3. Implement advanced rate limiting

4. Deploy monitoring and alerting

  

### Phase 4: Production Preparation

1. Full security penetration testing

2. Performance stress testing

3. Disaster recovery procedures

4. Documentation and runbooks

  

## Conclusion

  

The HOOATS system architecture is fundamentally sound and ready for testnet deployment with proper database schema setup. The core trading engine (SmartRouterV2 + UltraPerformanceOrderbook) is production-ready, while the comprehensive security suite provides robust protection against MEV attacks and fraud.

  

Key success factors for testnet deployment:

1. **Database migration** to create missing tables

2. **Remove deprecated components** to reduce complexity

3. **Focus on SmartRouterV2** as the primary trading interface

4. **Enable security monitoring** for attack detection

5. **Performance testing** to validate 15-20K TPS targets

  

The system is well-architected for the hybrid AMM + Orderbook model and ready for multi-session implementation work to achieve full production readiness.