# HyperIndex Hybrid Trading System Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Deep Dive](#architecture-deep-dive)
3. [Code Review Summary](#code-review-summary)
4. [Deployment Guide](#deployment-guide)
5. [Test Scenarios](#test-scenarios)
6. [Performance Optimization](#performance-optimization)
7. [Troubleshooting](#troubleshooting)

---

## System Overview

HyperIndex implements a **hybrid decentralized exchange** that combines:
- **Off-chain orderbook** (Redis) for efficient price-time priority matching
- **On-chain AMM** (HyperEVM) for immediate liquidity
- **Smart routing** that optimally splits orders between venues
- **On-chain settlement** for orderbook trades to ensure finality

### Key Benefits
- **Best Price Execution**: Smart router finds optimal price across venues
- **Gas Efficiency**: Batch settlement reduces transaction costs
- **High Performance**: 900+ TPS capability with async processing
- **Real Blockchain Integration**: Actual HyperEVM testnet deployment

---

## Architecture Deep Dive

### 1. Trading Engine Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │────│  API Gateway    │────│  V2 Router      │
│  (Next.js)      │    │  (Next.js API)  │    │  (Smart Route)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                        ┌───────────────────────────────┼───────────────────────────────┐
                        │                               │                               │
                ┌───────▼──────┐                ┌──────▼──────┐                ┌──────▼──────┐
                │ Redis        │                │ Mock AMM    │                │ Blockchain  │
                │ Orderbook    │                │ (Testing)   │                │ AMM         │
                │              │                │             │                │ (HyperEVM)  │
                └──────────────┘                └─────────────┘                └─────────────┘
                        │                               │                               │
                ┌───────▼──────┐                ┌──────▼──────┐                ┌──────▼──────┐
                │ PostgreSQL   │                │ Price       │                │ Settlement  │
                │ (History)    │                │ Impact      │                │ Contract    │
                │              │                │ Tracking    │                │             │
                └──────────────┘                └─────────────┘                └─────────────┘
```

### 2. Data Flow Architecture

#### Hot Data (Redis)
- **Real-time orderbook**: Bids/asks with price-time priority
- **Active orders**: User orders awaiting execution
- **Recent trades**: Last 100 trades per pair
- **Market data**: Current prices, volume, liquidity

#### Cold Data (PostgreSQL)
- **Order history**: Complete audit trail of all orders
- **Trade history**: Permanent record with AMM/Orderbook attribution
- **User balances**: Account state management
- **Settlement tracking**: On-chain transaction monitoring

### 3. Smart Router V2 Logic

```typescript
// Chunk-based order processing
for (const chunk of orderChunks) {
  // 1. Check AMM price impact
  const ammQuote = await amm.calculateSwapOutput(chunk);
  
  // 2. Check orderbook liquidity
  const orderbookQuote = await orderbook.getBestPrice(chunk);
  
  // 3. Route to better venue
  if (ammQuote.effectivePrice < orderbookQuote.price) {
    await executeAMMSwap(chunk);
  } else {
    await executeOrderbookTrade(chunk);
  }
}
```

---

## Code Review Summary

### ✅ Strengths

1. **Robust Architecture**
   - Clean separation of concerns
   - Async processing for performance
   - Comprehensive error handling

2. **Security Measures**
   - JWT authentication with Privy
   - Input validation with Zod schemas
   - Decimal precision handling
   - Reentrancy protection in smart contracts

3. **Performance Optimizations**
   - Batch database operations
   - Redis pipeline operations
   - Chunk-based order processing
   - 900+ TPS testing capability

4. **Monitoring & Debugging**
   - Extensive logging throughout
   - Performance metrics tracking
   - Real-time execution feedback

### ⚠️ Areas for Improvement

1. **Production Readiness**
   - Mock oracle addresses need replacement
   - Rate limiting currently disabled
   - Error recovery mechanisms need strengthening

2. **Smart Contract Security**
   - Placeholder addresses in production contracts
   - Oracle price validation needed
   - Emergency pause mechanisms require testing

3. **Scalability Considerations**
   - Database connection pooling optimization
   - Redis clustering for high availability
   - Load balancing for API endpoints

---

## Deployment Guide

### Prerequisites

1. **Environment Setup**
   ```bash
   # Node.js and dependencies
   npm install
   
   # Redis server
   npm run redis
   
   # Environment variables
   cp .env.example .env.local
   ```

2. **Required Services**
   - Supabase project with RLS policies
   - Redis instance (local or cloud)
   - HyperEVM testnet access
   - Privy authentication setup

### Step 1: Database Migration

```bash
# Check existing migration files
ls supabase/migrations/

# Run migrations
npx supabase migration up

# Verify schema
curl http://localhost:3000/api/debug/schema
```

### Step 2: Smart Contract Deployment

```bash
# Deploy to HyperEVM testnet
node scripts/deploy-testnet.js

# Update environment variables with contract addresses
NEXT_PUBLIC_AMM_ROUTER_ADDRESS=0x...
NEXT_PUBLIC_AMM_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_HYPERINDEX_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_SETTLEMENT_ADDRESS=0x...
```

### Step 3: System Configuration

```bash
# Configure supported tokens
curl -X POST http://localhost:3000/api/admin/tokens \
  -H "Authorization: Bearer dev-token" \
  -d '{"address": "0x...", "symbol": "USDC"}'

# Initialize AMM pools
curl -X POST http://localhost:3000/api/admin/amm/pools \
  -H "Authorization: Bearer dev-token" \
  -d '{"pair": "HYPERINDEX-USDC", "reserveA": 1000000, "reserveB": 1000000}'
```

### Step 4: Testing & Validation

```bash
# Start development server
npm run dev

# Run health checks
curl http://localhost:3000/api/health
curl http://localhost:3000/api/redis/health

# Test trading endpoints
curl -X POST http://localhost:3000/api/trading/v2/orders \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{"pair": "HYPERINDEX-USDC", "type": "market", "side": "buy", "amount": "100"}'
```

---

## Test Scenarios

### Basic Functionality Tests

#### Test 1: Market Order Execution
```javascript
// Small market buy order
const order = {
  pair: 'HYPERINDEX-USDC',
  type: 'market',
  side: 'buy',
  amount: '100'
};

// Expected: Route to AMM for immediate execution
```

#### Test 2: Limit Order Placement
```javascript
// Limit order with competitive price
const order = {
  pair: 'HYPERINDEX-USDC',
  type: 'limit',
  side: 'sell',
  amount: '500',
  price: '1.05'
};

// Expected: Add to orderbook, match against bids
```

#### Test 3: Large Order Chunking
```javascript
// Large order requiring chunking
const order = {
  pair: 'HYPERINDEX-USDC',
  type: 'market',
  side: 'buy',
  amount: '10000'
};

// Expected: Split into multiple chunks, hybrid routing
```

### Edge Case Scenarios

#### Edge Case 1: Zero Liquidity
```javascript
// Market order when AMM has no liquidity
const scenario = {
  ammReserves: { reserveA: 0, reserveB: 1000000 },
  orderbookDepth: 0,
  order: { type: 'market', side: 'buy', amount: '1000' }
};

// Expected: Order rejection with clear error message
```

#### Edge Case 2: Price Impact Limit
```javascript
// Large order with high price impact
const scenario = {
  order: { type: 'market', side: 'buy', amount: '100000' },
  expectedPriceImpact: 15 // 15%
};

// Expected: Split execution, price protection triggered
```

#### Edge Case 3: Partial Fill with Settlement
```javascript
// Order partially filled via orderbook
const scenario = {
  order: { type: 'limit', side: 'sell', amount: '1000', price: '1.00' },
  orderbookLiquidity: 600, // Only 60% can be filled
  expectedFill: 600,
  settlementRequired: true
};

// Expected: Partial fill + settlement queue + remaining in orderbook
```

#### Edge Case 4: Network Congestion
```javascript
// High gas fees scenario
const scenario = {
  gasPrice: 1000, // Very high
  order: { type: 'market', side: 'buy', amount: '50' },
  expectedRouting: 'orderbook' // Avoid AMM due to gas costs
};

// Expected: Route to orderbook to minimize costs
```

#### Edge Case 5: Oracle Price Deviation
```javascript
// AMM price vs Oracle price mismatch
const scenario = {
  ammPrice: 1.10,
  oraclePrice: 1.00,
  deviation: 10, // 10% deviation
  order: { type: 'market', side: 'buy', amount: '1000' }
};

// Expected: Price validation, potential order rejection
```

### Performance Test Scenarios

#### Stress Test 1: High Frequency Orders
```javascript
// Simulate 900+ orders per second
const testConfig = {
  ordersPerSecond: 900,
  duration: 60, // 1 minute
  orderTypes: { market: 0.7, limit: 0.3 },
  expectedSuccessRate: 0.95
};

// Access: /trading-simulator
```

#### Stress Test 2: Large Order Processing
```javascript
// Multiple large orders simultaneously
const scenario = {
  concurrentOrders: 10,
  orderSize: 10000,
  expectedChunking: true,
  maxExecutionTime: 5000 // 5 seconds
};
```

#### Stress Test 3: Settlement Queue Processing
```javascript
// High volume settlement processing
const scenario = {
  tradesPerBatch: 100,
  batchFrequency: 1000, // 1 second
  expectedGasOptimization: true
};
```

### Integration Test Scenarios

#### Integration Test 1: End-to-End Flow
```javascript
// Complete trading cycle
const flow = [
  'User authentication',
  'Balance check',
  'Order placement',
  'Smart routing',
  'Execution',
  'Settlement',
  'Balance update',
  'History recording'
];

// Test all components working together
```

#### Integration Test 2: Blockchain Integration
```javascript
// Real HyperEVM testnet interaction
const scenario = {
  network: 'HyperEVM Testnet',
  walletConnection: 'MetaMask',
  tokenContract: '0xd9CBEC81df392A88AEff575E962d149d57F4d6bc',
  expectedBehavior: 'Real blockchain transactions'
};

// Access: /testnet for real blockchain testing
```

### Error Handling Test Scenarios

#### Error Test 1: Database Connection Loss
```javascript
// Simulate database failure
const scenario = {
  failureType: 'PostgreSQL connection lost',
  expectedBehavior: 'Graceful degradation, Redis-only mode',
  recoveryTime: 30 // seconds
};
```

#### Error Test 2: Redis Connection Loss
```javascript
// Simulate Redis failure
const scenario = {
  failureType: 'Redis connection lost',
  expectedBehavior: 'AMM-only routing, order rejection',
  alerting: true
};
```

#### Error Test 3: Smart Contract Revert
```javascript
// Contract function failure
const scenario = {
  failureType: 'Settlement contract revert',
  expectedBehavior: 'Transaction retry, user notification',
  maxRetries: 3
};
```

---

## Performance Optimization

### Database Optimization

1. **Async Batch Processing**
   ```typescript
   // AsyncDBWriter handles bulk operations
   asyncDBWriter.queueOrderHistory(orderData);
   asyncDBWriter.queueTradeHistory(tradeData);
   // Processes in batches of 50-200 records
   ```

2. **Index Strategy**
   ```sql
   -- Critical indexes for performance
   CREATE INDEX idx_order_history_user_pair ON order_history(user_id, pair);
   CREATE INDEX idx_trade_history_pair_time ON trade_history(pair, executed_at);
   CREATE INDEX idx_user_balances_user_token ON user_balances(user_id, token_symbol);
   ```

### Redis Optimization

1. **Pipeline Operations**
   ```typescript
   const pipe = redis.pipeline();
   pipe.hset(orderKey, orderData);
   pipe.zadd(bookKey, score, orderInfo);
   pipe.hincrby(levelKey, 'amount', amount);
   await pipe.exec(); // Single network round-trip
   ```

2. **Memory Management**
   ```typescript
   // Automatic cleanup of old data
   pipe.ltrim('trades:HYPERINDEX-USDC', 0, 999); // Keep last 1000 trades
   await cleanupExpiredOrders(); // Remove expired orders
   ```

### Smart Router Optimization

1. **Chunk Size Adaptation**
   ```typescript
   // Dynamic chunk sizing based on liquidity
   const chunkSize = Math.min(
     maxChunkSize,
     availableLiquidity * 0.1 // 10% of available liquidity
   );
   ```

2. **Parallel Execution**
   ```typescript
   // Process multiple chunks simultaneously
   const chunkPromises = chunks.map(chunk => processChunk(chunk));
   const results = await Promise.allSettled(chunkPromises);
   ```

---

## Troubleshooting

### Common Issues

#### Issue 1: Order Processing Slow
**Symptoms**: Orders taking >2 seconds to process
**Diagnosis**:
```bash
# Check Redis latency
redis-cli --latency -h localhost -p 6379

# Check database connections
curl http://localhost:3000/api/debug/schema
```
**Solutions**:
- Increase Redis connection pool
- Optimize database queries
- Check network latency

#### Issue 2: Settlement Failures
**Symptoms**: Trades not settling on-chain
**Diagnosis**:
```bash
# Check settlement queue
curl http://localhost:3000/api/debug/settlement-queue

# Check gas prices
curl "https://rpc.hyperliquid-testnet.xyz/evm" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"method":"eth_gasPrice","params":[],"id":1,"jsonrpc":"2.0"}'
```
**Solutions**:
- Increase gas limits
- Check operator wallet balance
- Retry failed settlements

#### Issue 3: Price Deviation
**Symptoms**: AMM and orderbook prices diverging
**Diagnosis**:
```typescript
// Check price sources
const ammPrice = amm.getSpotPrice('HYPERINDEX-USDC');
const orderbookBid = await orderbook.getBestBid('HYPERINDEX-USDC');
const deviation = Math.abs(ammPrice - orderbookBid) / ammPrice;
```
**Solutions**:
- Increase arbitrage incentives
- Adjust AMM fees
- Add more liquidity

### Performance Monitoring

```typescript
// Key metrics to monitor
const metrics = {
  orderProcessingTime: '< 1000ms',
  databaseWriteLatency: '< 100ms',
  redisOperationTime: '< 10ms',
  settlementSuccess: '> 95%',
  systemUptime: '> 99.9%'
};
```

### Emergency Procedures

1. **System Overload**
   - Enable rate limiting: `DISABLE_RATE_LIMIT=false`
   - Pause non-critical operations
   - Scale Redis/Database resources

2. **Smart Contract Issues**
   - Pause settlement contract
   - Switch to AMM-only mode
   - Notify users of service degradation

3. **Data Corruption**
   - Stop order processing
   - Compare Redis vs PostgreSQL state
   - Restore from backup if necessary

---

## Next Steps for Production

1. **Security Hardening**
   - Replace all mock/placeholder addresses
   - Implement comprehensive access controls
   - Add multi-signature requirements for admin functions

2. **Monitoring & Alerting**
   - Set up comprehensive logging
   - Implement real-time alerting
   - Add performance dashboards

3. **Scalability Improvements**
   - Implement horizontal scaling
   - Add load balancers
   - Optimize for high-availability

4. **User Experience**
   - Add real-time WebSocket updates
   - Implement advanced order types
   - Build mobile-responsive interface

---

*This documentation serves as a comprehensive guide for understanding, deploying, and maintaining the HyperIndex hybrid trading system. For additional technical details, refer to the inline code comments and API documentation.*