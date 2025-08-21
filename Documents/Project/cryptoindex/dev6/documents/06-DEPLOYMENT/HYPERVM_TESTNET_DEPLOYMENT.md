# HyperEVM Testnet Deployment Guide

## Overview
This guide covers the deployment and testing of HyperIndex's HyperVMAMM on the HyperEVM testnet, including security review and E2E integration testing.

## Prerequisites

### Environment Setup
```bash
# Required environment variables
HYPERVM_TESTNET_RPC=https://api.hyperliquid-testnet.xyz/evm
HYPERVM_TESTNET_CHAIN_ID=998
TEST_WALLET_PRIVATE_KEY=your_test_wallet_private_key
```

### Network Configuration
- **Chain ID**: 998 (HyperEVM Testnet)
- **RPC URL**: `https://api.hyperliquid-testnet.xyz/evm`
- **Block Explorer**: `https://explorer.hyperliquid-testnet.xyz`
- **Native Currency**: HYPE (18 decimals)

## Phase 1: AMM Testnet Deployment

### 1.1 Smart Contract Deployment

**⚠️ IMPORTANT**: This requires manual deployment by the user with actual wallet and funds.

```solidity
// Contracts to deploy:
1. MockUSDC.sol (Test USDC with faucet)
2. HyperIndexToken.sol (HYPERINDEX token)
3. UniswapV2Factory.sol (AMM Factory)
4. UniswapV2Router02.sol (AMM Router)
5. Create HYPERINDEX-USDC pair
```

### 1.2 Contract Verification Steps

#### Verify Network Connection
```typescript
import { HyperVMAMM } from '@/lib/blockchain/hypervm-amm';
import { getHyperVMConfig } from '@/lib/config/hypervm-config';

const config = getHyperVMConfig();
const amm = new HyperVMAMM(config.rpcUrl, config.contracts);

// Test network connection
const isConnected = await amm.verifyNetwork();
console.log('Network connected:', isConnected);
```

#### Test Basic Operations
```typescript
// 1. Check token balances
const hyperBalance = await amm.getTokenBalance(config.contracts.hyperIndex, userAddress);
const usdcBalance = await amm.getTokenBalance(config.contracts.usdc, userAddress);

// 2. Use faucet (Mock USDC only)
if (usdcBalance === '0') {
  const faucetTx = await amm.useFaucet(config.contracts.usdc);
  console.log('Faucet transaction:', faucetTx);
}

// 3. Get swap quote
const quote = await amm.getSwapQuote(
  config.contracts.usdc,
  config.contracts.hyperIndex,
  ethers.parseEther('100') // 100 USDC
);
console.log('Swap quote:', quote);
```

### 1.3 Security Review Checklist

#### Smart Contract Security
- [ ] **Reentrancy Protection**: Verify all external calls use proper guards
- [ ] **Access Control**: Check admin functions have appropriate restrictions
- [ ] **Integer Overflow**: Ensure SafeMath or Solidity 0.8+ protections
- [ ] **Front-running Protection**: Implement commit-reveal for sensitive operations
- [ ] **Flash Loan Attack**: Verify price manipulation resistance

#### Integration Security
- [ ] **Private Key Management**: Secure storage and access patterns
- [ ] **RPC Endpoint Security**: Rate limiting and error handling
- [ ] **Transaction Monitoring**: Failed transaction detection and recovery
- [ ] **Gas Price Management**: Dynamic gas pricing and limits
- [ ] **Slippage Protection**: Maximum slippage enforcement

#### Code Review Points
```typescript
// Example security checks
class SecurityValidator {
  validateSwapParams(params: SwapParams): void {
    // Check slippage tolerance bounds
    if (params.slippageTolerance > 5000) { // 50%
      throw new Error('Slippage tolerance too high');
    }
    
    // Validate token addresses
    if (!this.isValidTokenAddress(params.tokenIn)) {
      throw new Error('Invalid token address');
    }
    
    // Check amount bounds
    if (BigInt(params.amountIn) <= 0) {
      throw new Error('Amount must be positive');
    }
  }
}
```

## Phase 2: E2E Integration Testing

### 2.1 AMM + OCOB + OnChainSettlement Integration

#### Test Scenario 1: Hybrid Order Routing
```typescript
// Large order that requires both AMM and orderbook
const testOrder = {
  pair: 'HYPERINDEX-USDC',
  side: 'buy',
  type: 'market',
  amount: '10000' // Large amount to test routing
};

// Execute through SmartRouterV2
const result = await smartRouter.processHybridOrder(testOrder);

// Verify routing decisions
assert(result.routing.some(r => r.source === 'AMM'));
assert(result.routing.some(r => r.source === 'Orderbook'));
```

#### Test Scenario 2: Price Impact Mitigation
```typescript
// Test chunk-based processing
const largeOrder = {
  pair: 'HYPERINDEX-USDC',
  side: 'buy',
  type: 'market',
  amount: '50000'
};

const result = await smartRouter.processHybridOrder(largeOrder);

// Verify price impact stays within bounds
const totalPriceImpact = result.routing.reduce((sum, chunk) => 
  sum + (chunk.priceImpact || 0), 0
) / result.routing.length;

assert(totalPriceImpact < 5.0); // Less than 5% average impact
```

### 2.2 Edge Case Testing Matrix

#### High-Volume Scenarios
```typescript
const edgeCases = [
  {
    name: 'Empty Orderbook',
    setup: () => clearOrderbook(),
    order: { amount: '1000', side: 'buy' },
    expectedSource: 'AMM'
  },
  {
    name: 'AMM Depleted',
    setup: () => drainAMMReserves(),
    order: { amount: '1000', side: 'buy' },
    expectedSource: 'Orderbook'
  },
  {
    name: 'Extreme Price Impact',
    setup: () => setLowLiquidity(),
    order: { amount: '100000', side: 'buy' },
    expectedBehavior: 'ChunkSplitting'
  },
  {
    name: 'Network Congestion',
    setup: () => simulateHighGas(),
    order: { amount: '1000', side: 'buy' },
    expectedBehavior: 'GasOptimization'
  }
];

for (const testCase of edgeCases) {
  await testCase.setup();
  const result = await executeTest(testCase);
  validateExpectedBehavior(result, testCase);
}
```

#### Exception Handling Tests
```typescript
const exceptionScenarios = [
  {
    name: 'Insufficient Balance',
    error: 'ERC20: transfer amount exceeds balance',
    expectedRecovery: 'GracefulFailure'
  },
  {
    name: 'Gas Price Spike',
    error: 'Transaction underpriced',
    expectedRecovery: 'GasPriceAdjustment'
  },
  {
    name: 'Network Timeout',
    error: 'Request timeout',
    expectedRecovery: 'RetryWithBackoff'
  },
  {
    name: 'Contract Paused',
    error: 'Pausable: paused',
    expectedRecovery: 'RouteToAlternative'
  }
];
```

## Phase 3: Real Trading Scenarios

### 3.1 Market Making Simulation
```typescript
// Simulate market maker providing liquidity
const marketMakerTest = async () => {
  // 1. Add initial liquidity
  await amm.addLiquidity({
    tokenA: contracts.hyperIndex,
    tokenB: contracts.usdc,
    amountADesired: ethers.parseEther('10000'),
    amountBDesired: ethers.parseEther('10000'),
    slippageTolerance: 100, // 1%
    recipient: marketMakerAddress
  });
  
  // 2. Create competing orderbook orders
  await createOrderbookLiquidity();
  
  // 3. Execute various trading scenarios
  const scenarios = [
    { amount: '100', expectedSource: 'Orderbook' },
    { amount: '5000', expectedSource: 'Hybrid' },
    { amount: '20000', expectedSource: 'Mixed' }
  ];
  
  for (const scenario of scenarios) {
    const result = await executeTradeScenario(scenario);
    analyzeRoutingDecision(result);
  }
};
```

### 3.2 Arbitrage Detection
```typescript
// Test arbitrage opportunities and MEV protection
const arbitrageTest = async () => {
  // Create price discrepancy
  await createPriceImbalance();
  
  // Attempt arbitrage transaction
  const arbitrageTx = await attemptArbitrage();
  
  // Verify MEV protection activated
  const protectionLog = await secureTPSEngine.getProtectionLog();
  assert(protectionLog.sandwichAttacksPrevented > 0);
};
```

## Phase 4: Performance Validation

### 4.1 TPS Testing
```typescript
// Validate 13K+ TPS capability
const performanceTest = async () => {
  const startTime = Date.now();
  const totalOrders = 13000;
  
  // Execute orders in parallel batches
  const batchSize = 100;
  const batches = Math.ceil(totalOrders / batchSize);
  
  for (let i = 0; i < batches; i++) {
    const batchOrders = generateBatchOrders(batchSize);
    await Promise.all(batchOrders.map(order => 
      ultraPerformanceOrderbook.processOrder(order)
    ));
  }
  
  const duration = (Date.now() - startTime) / 1000;
  const actualTPS = totalOrders / duration;
  
  console.log(`Achieved TPS: ${actualTPS}`);
  assert(actualTPS >= 13000);
};
```

### 4.2 Memory Optimization Validation
```typescript
// Verify 95% GC pressure reduction
const memoryTest = async () => {
  const memoryBefore = process.memoryUsage();
  
  // Execute memory-intensive operations
  await runHighVolumeTrading(50000);
  
  const memoryAfter = process.memoryUsage();
  const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
  
  // Verify memory pool effectiveness
  const poolStats = memoryPoolManager.getStats();
  assert(poolStats.poolHitRate > 0.95); // 95% pool reuse
  assert(memoryIncrease < expectedWithoutPool * 0.05); // 95% reduction
};
```

## Phase 5: Deployment Checklist

### Pre-Production Validation
- [ ] **Network Connectivity**: HyperEVM testnet connection verified
- [ ] **Contract Deployment**: All contracts deployed and verified
- [ ] **Integration Testing**: E2E tests passing
- [ ] **Security Review**: All security checks completed
- [ ] **Performance Testing**: TPS targets met
- [ ] **Edge Case Coverage**: All scenarios tested
- [ ] **Exception Handling**: Error recovery verified
- [ ] **Memory Optimization**: Pool manager functioning
- [ ] **MEV Protection**: Security features active

### Production Readiness
- [ ] **Monitoring Setup**: Performance and security dashboards
- [ ] **Alert Configuration**: Critical threshold notifications
- [ ] **Backup Procedures**: Database and configuration backups
- [ ] **Rollback Plan**: Emergency rollback procedures
- [ ] **Documentation**: Updated deployment documentation
- [ ] **Team Training**: Operations team briefed

## Monitoring and Maintenance

### Key Metrics to Monitor
```typescript
interface MonitoringMetrics {
  performance: {
    tps: number;
    latency: number;
    memoryUsage: number;
    gcPressure: number;
  };
  security: {
    mevAttacksBlocked: number;
    sandwichAttacksDetected: number;
    suspiciousTransactions: number;
  };
  amm: {
    successfulSwaps: number;
    failedTransactions: number;
    averageGasUsed: number;
    slippageEvents: number;
  };
}
```

### Automated Health Checks
- **Network Connectivity**: Continuous RPC endpoint monitoring
- **Contract State**: Regular contract function call tests
- **Performance Metrics**: Real-time TPS and latency tracking
- **Security Monitoring**: MEV attack pattern detection
- **Memory Management**: Pool utilization and GC pressure tracking

## Troubleshooting Guide

### Common Deployment Issues
1. **Network Connection Failures**
   - Verify RPC endpoint accessibility
   - Check firewall and network configuration
   - Validate chain ID configuration

2. **Contract Interaction Errors**
   - Confirm contract addresses are correct
   - Verify ABI compatibility
   - Check gas price and limits

3. **Performance Issues**
   - Monitor CPU and memory utilization
   - Check Redis connection pooling
   - Verify parallel processing configuration

4. **Security Alert Triggers**
   - Review MEV protection logs
   - Analyze transaction patterns
   - Verify commit-reveal timing