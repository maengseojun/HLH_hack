# HyperIndex Hybrid Trading System - Deployment & Testing Guide

## Table of Contents

1. [System Overview](#system-overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Smart Contract Deployment](#smart-contract-deployment)
5. [Backend Service Configuration](#backend-service-configuration)
6. [Testing Scenarios](#testing-scenarios)
7. [Edge Case Testing](#edge-case-testing)
8. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
9. [Production Deployment](#production-deployment)

## System Overview

The HyperIndex hybrid trading system combines three execution venues:

### Architecture Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │  Backend APIs   │    │  Smart Contracts│
│                 │    │                 │    │                 │
│ • Trading UI    │◄──►│ • Authentication│◄──►│ • AMM Router    │
│ • Wallet Conn   │    │ • Order Routing │    │ • Settlement    │
│ • Real-time     │    │ • Redis/Postgres│    │ • Token Pairs   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Trading Flow

1. **Order Submission** → API validates and routes to appropriate venues
2. **Smart Routing** → V2 Router splits orders into optimal chunks
3. **Execution**:
   - **AMM**: Direct on-chain execution (immediate settlement)
   - **Orderbook**: Off-chain matching → On-chain settlement queue
4. **Settlement** → Batch processing for gas optimization

## Prerequisites

### System Requirements

```bash
# Required Software
- Node.js 18+ 
- Redis 6+
- PostgreSQL 13+
- Git
- MetaMask or compatible wallet

# Development Tools
- Hardhat (for smart contracts)
- Supabase CLI
- Docker (optional)
```

### Network Configuration

**HyperEVM Testnet:**
```javascript
const HYPERVM_TESTNET = {
  chainId: '0x3e6', // 998
  chainName: 'HyperEVM Testnet',
  rpcUrls: ['https://rpc.hyperliquid-testnet.xyz/evm'],
  nativeCurrency: {
    name: 'HYPE',
    symbol: 'HYPE',
    decimals: 18
  },
  blockExplorerUrls: ['https://explorer.hyperliquid-testnet.xyz']
};
```

### Required Tokens

**Official Testnet USDC:**
- Address: `0xd9CBEC81df392A88AEff575E962d149d57F4d6bc`
- Source: HyperLiquid drip faucet → Bridge to HyperEVM
- Verification: Check balance in MetaMask after adding token

## Environment Setup

### 1. Clone and Install

```bash
# Clone repository
git clone <repository-url>
cd Cryptoindex-V0

# Install dependencies
npm install

# Start Redis (required for trading)
npm run redis
```

### 2. Environment Variables

Create `.env.local`:

```bash
# Privy Authentication
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret
PRIVY_VERIFICATION_KEY=your_privy_verification_key

# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Redis
REDIS_URL=redis://localhost:6379

# HyperEVM Testnet
NEXT_PUBLIC_HYPERVM_TESTNET_RPC=https://rpc.hyperliquid-testnet.xyz/evm
NEXT_PUBLIC_USDC_TOKEN_ADDRESS=0xd9CBEC81df392A88AEff575E962d149d57F4d6bc

# Development
NODE_ENV=development
DISABLE_RATE_LIMIT=true
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Settlement (Generate after contract deployment)
SETTLEMENT_OPERATOR_KEY=0x... # Private key for settlement operator
NEXT_PUBLIC_SETTLEMENT_ADDRESS=0x... # Settlement contract address
```

### 3. Database Migration

```bash
# CRITICAL: Always check migration files first
cat supabase/migrations/*.sql

# Run migrations
npx supabase migration up

# Verify schema
curl http://localhost:3000/api/debug/schema
```

### 4. Start Development Server

```bash
npm run dev
```

## Smart Contract Deployment

### 1. Prepare Deployment Environment

```bash
# Install Hardhat dependencies
npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers

# Configure hardhat.config.js
cat > hardhat.config.js << 'EOF'
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.19",
  networks: {
    hypervm_testnet: {
      url: "https://rpc.hyperliquid-testnet.xyz/evm",
      accounts: ["0x..."] // Your private key with HYPE for gas
    }
  }
};
EOF
```

### 2. Deploy Contracts

```bash
# Deploy AMM contracts
node scripts/deploy-testnet.js

# Expected output:
# ✅ MockUSDC deployed to: 0x...
# ✅ HyperIndexToken deployed to: 0x...
# ✅ HyperIndexFactory deployed to: 0x...
# ✅ HyperIndexRouter deployed to: 0x...
# ✅ HyperIndexSettlement deployed to: 0x...
```

### 3. Verify Deployment

```bash
# Check contract deployment
curl -X POST https://rpc.hyperliquid-testnet.xyz/evm \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_getCode",
    "params":["0x...", "latest"],
    "id":1
  }'

# Should return bytecode, not "0x"
```

### 4. Update Environment Variables

After successful deployment, update `.env.local`:

```bash
# Contract Addresses (from deployment output)
NEXT_PUBLIC_AMM_ROUTER_ADDRESS=0x...
NEXT_PUBLIC_AMM_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_HYPERINDEX_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_HYPERINDEX_USDC_PAIR=0x...
NEXT_PUBLIC_SETTLEMENT_ADDRESS=0x...
```

## Backend Service Configuration

### 1. Redis Configuration

```bash
# Check Redis connection
redis-cli ping
# Should return: PONG

# Monitor Redis operations during testing
redis-cli monitor
```

### 2. Supabase Setup

```sql
-- Verify critical tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'order_history', 'trade_history', 'user_balances');

-- Check settlement tracking columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'trade_history' 
AND column_name IN ('settlement_tx_hash', 'settlement_status');
```

### 3. Authentication Test

```bash
# Test development authentication
curl -X GET http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer dev-token"

# Should return: { "success": true, "user": {...} }
```

## Testing Scenarios

### Phase 1: Basic Functionality Tests

#### 1.1 Market Order Testing

```bash
# Test basic market buy order
curl -X POST http://localhost:3000/api/trading/v2/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "pair": "HYPERINDEX-USDC",
    "type": "market",
    "side": "buy",
    "amount": "100"
  }'

# Expected: Immediate execution via AMM or orderbook matching
# Check response for: totalFilled, executionStats, fills array
```

#### 1.2 Limit Order Testing

```bash
# Test limit order creation
curl -X POST http://localhost:3000/api/trading/v2/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "pair": "HYPERINDEX-USDC",
    "type": "limit",
    "side": "sell",
    "amount": "50",
    "price": "1.05"
  }'

# Expected: Order added to orderbook if no immediate match
```

#### 1.3 Hybrid Execution Testing

```bash
# Large order that should trigger hybrid routing
curl -X POST http://localhost:3000/api/trading/v2/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "pair": "HYPERINDEX-USDC",
    "type": "market",
    "side": "buy",
    "amount": "10000"
  }'

# Expected: Multiple chunks, some via AMM, some via orderbook
# Check executionStats: totalChunks, ammChunks, orderbookChunks
```

### Phase 2: Integration Testing

#### 2.1 Wallet Integration Test

**Access**: http://localhost:3000/test-blockchain-hybrid

**Test Steps:**
1. Connect MetaMask wallet
2. Switch to HyperEVM testnet (auto-prompt)
3. Import USDC token if not visible
4. Execute small market order
5. Verify execution in transaction history

#### 2.2 Settlement System Test

```bash
# Check settlement queue status
curl http://localhost:3000/api/trading/settlement/status

# Expected response:
{
  "queuedTrades": 0,
  "processedTrades": 10,
  "failedSettlements": 0,
  "lastSettlement": "2025-01-XX"
}
```

#### 2.3 Real-time Updates Test

**WebSocket Testing:**
```javascript
// Connect to WebSocket for real-time updates
const ws = new WebSocket('ws://localhost:3000/ws/orderbook');
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Orderbook update:', update);
};
```

### Phase 3: Performance Testing

#### 3.1 Mass Order Simulation

**Access**: http://localhost:3000/trading-simulator

**Configuration:**
```javascript
const testConfig = {
  totalOrders: 1000,
  ordersPerSecond: 100,
  batchSize: 25,
  orderTypes: { market: 0.7, limit: 0.3 },
  sides: { buy: 0.5, sell: 0.5 },
  useV2Router: true
};
```

**Success Criteria:**
- ✅ >95% order success rate
- ✅ <500ms average response time
- ✅ No Redis connection timeouts
- ✅ Database queue processing without errors

#### 3.2 Concurrent User Testing

```bash
# Simulate 10 concurrent users placing orders
for i in {1..10}; do
  (curl -X POST http://localhost:3000/api/trading/v2/orders \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer dev-token" \
    -d "{\"pair\":\"HYPERINDEX-USDC\",\"type\":\"market\",\"side\":\"buy\",\"amount\":\"$((RANDOM % 100 + 10))\"}" &)
done
wait
```

## Edge Case Testing

### Critical Edge Cases

#### 1. Insufficient Liquidity Scenarios

**Test Case 1: AMM Price Impact Limit**
```json
{
  "pair": "HYPERINDEX-USDC",
  "type": "market",
  "side": "buy",
  "amount": "500000"  // Large amount to test price impact limits
}
```

**Expected Behavior:**
- AMM should execute until price impact limit (e.g., 10%)
- Remaining order routed to orderbook
- Total execution may be partial if orderbook insufficient

**Test Case 2: Empty Orderbook**
```json
{
  "pair": "MEMEINDEX-USDC",  // Less liquid pair
  "type": "limit",
  "side": "buy",
  "amount": "1000",
  "price": "0.45"
}
```

**Expected Behavior:**
- Order added to orderbook without immediate match
- Redis orderbook updated correctly
- Database history shows 'active' status

#### 2. Precision and Rounding Errors

**Test Case 3: Small Amount Orders**
```json
{
  "pair": "HYPERINDEX-USDC",
  "type": "market",
  "side": "buy",
  "amount": "0.000001"  // Very small amount
}
```

**Expected Behavior:**
- Precision math handles correctly
- No negative remaining amounts
- Proper fee calculations

**Test Case 4: High Precision Prices**
```json
{
  "pair": "HYPERINDEX-USDC",
  "type": "limit",
  "side": "sell",
  "amount": "100",
  "price": "1.123456789"  // High precision
}
```

#### 3. System Failure Scenarios

**Test Case 5: Redis Connection Loss**
```bash
# Stop Redis during active trading
redis-cli shutdown

# Execute order
curl -X POST http://localhost:3000/api/trading/v2/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{"pair":"HYPERINDEX-USDC","type":"market","side":"buy","amount":"100"}'

# Expected: Graceful error handling, no data corruption
```

**Test Case 6: Database Connection Issues**
```bash
# Test with Supabase down
# Order should fail gracefully with proper error message
```

**Test Case 7: Smart Contract Interaction Failures**
```bash
# Test with insufficient gas
# Test with contract paused
# Test with insufficient token allowance
```

#### 4. Authentication Edge Cases

**Test Case 8: Token Expiration**
```bash
# Test with expired JWT token
curl -X POST http://localhost:3000/api/trading/v2/orders \
  -H "Authorization: Bearer expired-token" \
  -d '{"pair":"HYPERINDEX-USDC","type":"market","side":"buy","amount":"100"}'

# Expected: 401 Unauthorized
```

**Test Case 9: Invalid User State**
```bash
# Test with user deleted from database
# Expected: Proper error handling and user recreation
```

### Business Logic Edge Cases

#### 5. Order Matching Edge Cases

**Test Case 10: Price Crossing**
```json
{
  "pair": "HYPERINDEX-USDC",
  "type": "limit",
  "side": "buy",
  "amount": "100",
  "price": "1.10"  // Above current market price
}
```

**Expected Behavior:**
- Should execute immediately at market price
- Not create limit order in orderbook

**Test Case 11: Self-Trading**
```bash
# Same user creating matching buy/sell orders
# System should prevent or handle appropriately
```

#### 6. Settlement Edge Cases

**Test Case 12: Settlement Failure Recovery**
```javascript
// Simulate settlement transaction failure
// Check retry mechanism
// Verify trade remains in queue for retry
```

**Test Case 13: Nonce Synchronization**
```javascript
// Test concurrent settlement operations
// Verify nonce management prevents double-spending
```

### Performance Edge Cases

#### 7. High Load Scenarios

**Test Case 14: Order Burst**
```bash
# Send 100 orders simultaneously
seq 1 100 | xargs -I {} -P 100 curl -X POST http://localhost:3000/api/trading/v2/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{"pair":"HYPERINDEX-USDC","type":"market","side":"buy","amount":"10"}'
```

**Test Case 15: Memory Exhaustion**
```bash
# Large order history queries
# Large orderbook depth requests
# Monitor memory usage during tests
```

## Monitoring & Troubleshooting

### Key Metrics to Monitor

#### System Health Endpoints

```bash
# Overall health check
curl http://localhost:3000/api/health

# Redis connectivity
curl http://localhost:3000/api/redis/health

# Database schema validation
curl http://localhost:3000/api/debug/schema

# Settlement system status
curl http://localhost:3000/api/trading/settlement/status
```

#### Real-time Monitoring

**Console Logging:**
```javascript
// Look for these log patterns during testing:
console.log('🚀 V2 ORDER PROCESSING:', orderDetails);
console.log('⚡ Queued order for async DB write');
console.log('✅ V2 ORDER COMPLETED:', result);
console.log('🎯 AMM price-limited swap:', swapDetails);
```

**Redis Monitoring:**
```bash
# Monitor Redis operations in real-time
redis-cli monitor

# Check memory usage
redis-cli info memory

# Check active connections
redis-cli info clients
```

### Common Issues and Solutions

#### Issue 1: Orders Not Executing

**Symptoms:**
- Orders submitted but no execution
- No error messages in logs

**Debugging Steps:**
```bash
# 1. Check Redis connection
redis-cli ping

# 2. Check orderbook state
redis-cli get "orderbook:HYPERINDEX-USDC:bids"

# 3. Check AMM state
curl http://localhost:3000/api/trading/amm/info

# 4. Check auth middleware
curl http://localhost:3000/api/user/profile -H "Authorization: Bearer dev-token"
```

#### Issue 2: Settlement Failures

**Symptoms:**
- Trades executed but not settled on-chain
- Settlement queue growing

**Debugging Steps:**
```bash
# 1. Check settlement operator balance
# 2. Verify contract addresses in .env
# 3. Check gas prices and limits
# 4. Verify token allowances
```

#### Issue 3: Precision Errors

**Symptoms:**
- Negative remaining amounts
- Incorrect price calculations

**Solutions:**
- Verify all operations use PrecisionMath
- Check decimal places configuration
- Monitor for floating-point arithmetic

## Production Deployment

### Pre-production Checklist

#### Security Hardening

- [ ] Replace all placeholder addresses with real contracts
- [ ] Enable rate limiting (`DISABLE_RATE_LIMIT=false`)
- [ ] Use production JWT secrets
- [ ] Enable HTTPS and secure headers
- [ ] Implement proper error handling (no stack traces)
- [ ] Set up monitoring and alerting
- [ ] Conduct security audit

#### Performance Optimization

- [ ] Configure Redis clustering for high availability
- [ ] Set up database connection pooling
- [ ] Implement proper caching strategies
- [ ] Optimize smart contract gas usage
- [ ] Set up CDN for static assets

#### Operational Readiness

- [ ] Set up backup and disaster recovery
- [ ] Create runbooks for common operations
- [ ] Implement log aggregation and analysis
- [ ] Set up uptime monitoring
- [ ] Configure automated deployment pipeline

### Mainnet Deployment Steps

1. **Smart Contract Deployment**
   - Deploy to mainnet with production parameters
   - Verify contracts on block explorer
   - Transfer ownership to multi-sig wallet

2. **Backend Services**
   - Deploy with production environment variables
   - Configure production database and Redis
   - Set up load balancing and auto-scaling

3. **Frontend Deployment**
   - Build and deploy to CDN
   - Configure domain and SSL certificates
   - Set up monitoring and analytics

4. **Go-Live Process**
   - Phased rollout with limited users
   - Monitor all systems closely
   - Have rollback plan ready

### Monitoring and Maintenance

#### Key Performance Indicators (KPIs)

- **Trading Volume**: Daily/hourly trading volume
- **Order Success Rate**: Percentage of successful order executions
- **System Uptime**: 99.9% availability target
- **Response Time**: <500ms for order processing
- **Settlement Success**: >99% settlement success rate

#### Alerting Rules

```yaml
# Example alerting configuration
alerts:
  - name: High Error Rate
    condition: error_rate > 5%
    duration: 5m
    
  - name: Settlement Queue Backlog
    condition: settlement_queue_size > 100
    duration: 10m
    
  - name: Database Connection Issues
    condition: db_connection_errors > 10
    duration: 2m
```

## Conclusion

This guide provides comprehensive instructions for deploying and testing the HyperIndex hybrid trading system. The testing scenarios cover both normal operations and edge cases to ensure system reliability and performance.

### Success Criteria Summary

**Basic Functionality**: ✅ All order types execute correctly
**Integration**: ✅ Wallet, blockchain, and database integration working
**Performance**: ✅ Handles 100+ orders per second with <5% error rate
**Edge Cases**: ✅ Graceful handling of error conditions
**Security**: ✅ Authentication, authorization, and input validation

### Next Steps

1. Execute all testing scenarios systematically
2. Document any issues found and resolutions
3. Conduct security review of smart contracts
4. Prepare for production deployment with hardening measures
5. Set up comprehensive monitoring and alerting

The system is ready for intensive testing on HyperEVM testnet and can proceed to production deployment after successful completion of all test scenarios.