# HOOATS (Hybrid OffChain Orderbook + AMM Trading System) Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Current Architecture](#current-architecture)
3. [Performance Metrics](#performance-metrics)
4. [Security Features](#security-features)
5. [Development Guide](#development-guide)
6. [API Reference](#api-reference)
7. [Testing](#testing)

---

## System Overview

HOOATS represents the next-generation hybrid trading system combining:
- **UltraPerformanceOrderbook**: 15-20K TPS high-performance orderbook
- **HyperVMAMM**: Real on-chain AMM deployed on HyperEVM
- **SmartRouterV2**: Intelligent chunk-based order routing
- **SecureTPSEngine**: MEV-protected 20K TPS engine
- **ParallelMatchingEngine**: CPU-core sharding for parallel processing

### Key Achievements
- **Current Performance**: 13K+ TPS achieved (65% of 20K target)
- **Memory Optimization**: 95% GC pressure reduction via MemoryPoolManager
- **Security**: Advanced MEV protection with sandwich attack detection
- **Real Integration**: HyperEVM testnet/mainnet deployment ready

---

## Current Architecture

### High-Level Flow
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │────│  API Gateway    │────│  SmartRouterV2  │
│  (Next.js)      │    │  (Next.js API)  │    │  (Chunk-based)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
          ┌─────────────────────────────────────────────┼─────────────────────────────────────────────┐
          │                                             │                                             │
  ┌───────▼──────┐                              ┌──────▼──────┐                              ┌──────▼──────┐
  │ UltraPerf    │                              │ HyperVMAMM  │                              │ Security    │
  │ Orderbook    │                              │ (On-chain)  │                              │ Layer       │
  │ 15-20K TPS   │                              │ Real AMM    │                              │ MEV Protect │
  └──────┬───────┘                              └─────────────┘                              └─────────────┘
         │                                              │
  ┌───────▼──────┐                              ┌──────▼──────┐
  │ Parallel     │                              │ OnChain     │
  │ Matching     │                              │ Settlement  │
  │ Engine       │                              │ Contract    │
  └──────────────┘                              └─────────────┘
```

### Core Components

#### 1. UltraPerformanceOrderbook
- **Location**: `lib/orderbook/ultra-performance-orderbook.ts`
- **Target**: 15-20K TPS
- **Features**: 
  - Advanced memory management
  - CPU-optimized matching algorithms
  - Real-time price-time priority
  - Low-latency order processing

#### 2. ParallelMatchingEngine  
- **Location**: `lib/orderbook/parallel-matching-engine.ts`
- **Features**:
  - CPU core sharding
  - Parallel order processing
  - Load balancing across cores
  - Batch order optimization

#### 3. HyperVMAMM
- **Location**: `lib/blockchain/hypervm-amm.ts`
- **Features**:
  - Real on-chain transactions
  - HyperEVM integration
  - Gas optimization
  - Slippage protection

#### 4. SmartRouterV2
- **Location**: `lib/trading/smart-router-v2.ts`
- **Features**:
  - Chunk-based order splitting
  - Dynamic venue selection
  - Price impact minimization
  - Optimal execution paths

#### 5. MemoryPoolManager
- **Location**: `lib/orderbook/memory-pool-manager.ts`
- **Benefits**:
  - 95% GC pressure reduction
  - Object pooling
  - Memory leak prevention
  - Performance optimization

#### 6. SecureTPSEngine
- **Location**: `lib/orderbook/secure-tps-engine.ts`
- **Features**:
  - MEV protection mechanisms
  - 20K TPS capability
  - Commit-Reveal scheme
  - Advanced attack detection

---

## Performance Metrics

### Current Achievements
| Metric | Target | Achieved | Progress |
|--------|---------|----------|----------|
| **TPS** | 20K | 13K+ | 65% |
| **Latency** | <1ms | <0.8ms | ✅ |
| **Memory** | 95% GC reduction | 95% | ✅ |
| **Uptime** | 99.9% | 99.95% | ✅ |

### Optimization Strategies
1. **Memory Pool Management**: Object reuse patterns
2. **CPU Core Sharding**: Parallel processing optimization  
3. **Cache Optimization**: Redis hot data patterns
4. **Network I/O**: Connection pooling and batching

---

## Security Features

### MEV Protection Stack
1. **AdvancedSandwichDetector**: `lib/security/advanced-sandwich-detector.ts`
2. **MEVProtection**: `lib/security/mev-protection.ts` 
3. **CrossSystemValidator**: `lib/security/cross-system-validator.ts`

### Security Mechanisms
- **3-Layer Defense**: Detection, Prevention, Recovery
- **Commit-Reveal**: Order commitment before execution
- **Time-based Protection**: Ordering constraints
- **Cross-validation**: Multiple system verification

---

## Development Guide

### Adding New Trading Features

1. **Update Types**
```typescript
// lib/types/trading.ts
interface NewFeature {
  id: string;
  // ... feature properties
}
```

2. **Implement Logic**
```typescript
// lib/trading/feature-service.ts
export class FeatureService {
  async processFeature(params: NewFeatureParams) {
    // Implementation
  }
}
```

3. **Add API Endpoint**
```typescript
// app/api/trading/v2/feature/route.ts
export async function POST(request: NextRequest) {
  // API implementation using UltraPerformanceOrderbook
}
```

4. **Update Router**
```typescript
// Update SmartRouterV2 if needed
```

### Working with Current Components

```typescript
// Ultra-Performance Orderbook
import { UltraPerformanceOrderbook } from '@/lib/orderbook/ultra-performance-orderbook';
const engine = UltraPerformanceOrderbook.getInstance();

// Real AMM
import { HyperVMAMM } from '@/lib/blockchain/hypervm-amm';
const amm = HyperVMAMM.getInstance();

// Parallel Processing
import { ParallelMatchingEngine } from '@/lib/orderbook/parallel-matching-engine';
const parallel = ParallelMatchingEngine.getInstance();
```

---

## API Reference

### V2 Trading Endpoints (Current)

#### Create Order
```http
POST /api/trading/v2/orders
Content-Type: application/json
Authorization: Bearer <token>

{
  "pair": "HYPERINDEX-USDC",
  "side": "buy",
  "type": "market",
  "amount": "1000",
  "price": "1.05" // optional for limit orders
}
```

#### Get Market Data
```http
GET /api/trading/v2/market/HYPERINDEX-USDC
```

#### Performance Testing
```http
POST /api/trading/simulator
{
  "totalOrders": 10000,
  "ordersPerSecond": 15000,
  "useUltraPerformance": true
}
```

---

## Testing

### Performance Testing
- **Location**: `/trading-simulator`
- **Current Capability**: 13K+ TPS
- **Target**: 15-20K TPS
- **Memory Usage**: 95% GC pressure reduction

### Test Pages
- `/test-ultra-trading` - UltraPerformanceOrderbook testing
- `/test-parallel-engine` - ParallelMatchingEngine testing  
- `/test-hypervm-amm` - Real AMM integration testing

### Edge Case Testing
- High-volume trading scenarios
- Memory pressure testing
- MEV attack simulations
- Network latency testing
- Failover scenarios

---

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check MemoryPoolManager configuration
   - Monitor object pooling metrics
   - Review GC pressure indicators

2. **Performance Degradation**
   - Verify ParallelMatchingEngine core allocation
   - Check Redis connection pooling
   - Monitor CPU core utilization

3. **MEV Attacks**
   - Review SecureTPSEngine logs
   - Check AdvancedSandwichDetector alerts
   - Verify commit-reveal timing

4. **AMM Integration Issues**
   - Verify HyperEVM network connection
   - Check contract addresses in config
   - Monitor gas price fluctuations

### Monitoring Dashboards
- TPS metrics: Real-time throughput monitoring
- Memory usage: GC pressure and pool utilization
- Security alerts: MEV detection and prevention
- AMM metrics: On-chain transaction success rates