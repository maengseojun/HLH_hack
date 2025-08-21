# AMM Testnet Deployment Script
*Created: 2025-08-11*

## Overview
HyperIndex AMM을 HyperEVM 테스트넷에 배포하고 검증하는 단계별 스크립트입니다.

## Prerequisites
- ✅ HyperEVM 테스트넷에 HYPE 보유
- ✅ HyperEVM 테스트넷에 USDC 보유
- ✅ MetaMask HyperEVM 네트워크 설정 완료

## Step 1: Smart Contract Deployment

### 1.1 Deploy Factory Contract
```bash
# Navigate to contracts directory
cd contracts

# Deploy HyperIndexFactory
npx hardhat run scripts/deploy-factory.js --network hypervm-testnet
```

### 1.2 Deploy Router Contract
```bash
# Deploy HyperIndexRouter (needs Factory address)
npx hardhat run scripts/deploy-router.js --network hypervm-testnet
```

### 1.3 Deploy HyperIndex Token
```bash
# Deploy HYPERINDEX token
npx hardhat run scripts/deploy-token.js --network hypervm-testnet
```

## Step 2: Pair Creation and Initial Liquidity

### 2.1 Create HYPERINDEX-USDC Pair
```typescript
// Create pair via factory
const factory = await ethers.getContractAt("HyperIndexFactory", FACTORY_ADDRESS);
const createPairTx = await factory.createPair(HYPERINDEX_ADDRESS, USDC_ADDRESS);
await createPairTx.wait();

const pairAddress = await factory.getPair(HYPERINDEX_ADDRESS, USDC_ADDRESS);
console.log("Pair created at:", pairAddress);
```

### 2.2 Add Initial Liquidity
```typescript
const router = await ethers.getContractAt("HyperIndexRouter", ROUTER_ADDRESS);

// Approve tokens first
const hyperToken = await ethers.getContractAt("IERC20", HYPERINDEX_ADDRESS);
const usdcToken = await ethers.getContractAt("IERC20", USDC_ADDRESS);

await hyperToken.approve(ROUTER_ADDRESS, ethers.parseEther("1000"));
await usdcToken.approve(ROUTER_ADDRESS, ethers.parseEther("1000"));

// Add liquidity (1:1 ratio)
const addLiquidityTx = await router.addLiquidity(
  HYPERINDEX_ADDRESS,
  USDC_ADDRESS,
  ethers.parseEther("500"), // 500 HYPERINDEX
  ethers.parseEther("500"), // 500 USDC
  ethers.parseEther("450"), // Min 450 HYPERINDEX
  ethers.parseEther("450"), // Min 450 USDC
  deployer.address,
  Math.floor(Date.now() / 1000) + 1200 // 20min deadline
);
await addLiquidityTx.wait();
```

## Step 3: Integration with HyperVMAMM

### 3.1 Update Config File
```typescript
// Update lib/config/hypervm-config.ts
export const HYPERVM_TESTNET_CONFIG: HyperVMConfig = {
  rpcUrl: 'https://api.hyperliquid-testnet.xyz/evm',
  chainId: 998,
  contracts: {
    router: 'DEPLOYED_ROUTER_ADDRESS',
    factory: 'DEPLOYED_FACTORY_ADDRESS',
    hyperIndex: 'DEPLOYED_HYPERINDEX_ADDRESS',
    usdc: 'YOUR_USDC_ADDRESS',
    pair: 'CREATED_PAIR_ADDRESS',
  },
  // ... rest of config
};
```

### 3.2 Test HyperVMAMM Integration
```typescript
import { HyperVMAMM } from '@/lib/blockchain/hypervm-amm';
import { getHyperVMConfig } from '@/lib/config/hypervm-config';

const config = getHyperVMConfig();
const amm = new HyperVMAMM(config.rpcUrl, config.contracts);

// Connect signer
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
amm.connectSigner(signer);

// Test basic operations
console.log("Testing AMM integration...");

// 1. Check network connection
const isConnected = await amm.verifyNetwork();
console.log("✅ Network connected:", isConnected);

// 2. Get current reserves
const reserves = await amm.getPairReserves();
console.log("✅ Pair reserves:", reserves);

// 3. Get swap quote
const quote = await amm.getSwapQuote(
  config.contracts.usdc,
  config.contracts.hyperIndex,
  ethers.parseEther("10").toString()
);
console.log("✅ Swap quote:", quote);
```

## Step 4: Basic Functionality Tests

### 4.1 Token Swap Test
```typescript
// Test USDC → HYPERINDEX swap
const swapResult = await amm.executeSwap({
  tokenIn: config.contracts.usdc,
  tokenOut: config.contracts.hyperIndex,
  amountIn: ethers.parseEther("10").toString(),
  slippageTolerance: 100, // 1%
  recipient: signer.address
});

console.log("✅ Swap successful:", swapResult.hash);
console.log("   Amount out:", swapResult.amountOut);
console.log("   Price impact:", swapResult.priceImpact);
console.log("   Gas used:", swapResult.gasUsed);
```

### 4.2 Liquidity Operations Test
```typescript
// Test adding more liquidity
const addLiquidityResult = await amm.addLiquidity({
  tokenA: config.contracts.hyperIndex,
  tokenB: config.contracts.usdc,
  amountADesired: ethers.parseEther("100").toString(),
  amountBDesired: ethers.parseEther("100").toString(),
  slippageTolerance: 100,
  recipient: signer.address
});

console.log("✅ Liquidity added:", addLiquidityResult.hash);
```

## Step 5: SmartRouterV2 Integration Test

### 5.1 Update SmartRouterV2 Config
```typescript
// Ensure SmartRouterV2 uses real HyperVMAMM
const smartRouter = HybridSmartRouter.getInstance();

// Test hybrid order processing
const testOrder = {
  id: `test-${Date.now()}`,
  userId: 'test-user',
  pair: 'HYPERINDEX-USDC',
  side: 'buy' as const,
  type: 'market' as const,
  amount: '50',
  price: '0',
  remaining: '50',
  status: 'active' as const,
  timestamp: Date.now()
};

const routingResult = await smartRouter.processHybridOrder(testOrder);
console.log("✅ Hybrid routing result:", routingResult);
```

## Step 6: Performance Validation

### 6.1 Stress Test AMM
```typescript
// Test multiple concurrent swaps
const stressTest = async () => {
  const promises = [];
  
  for (let i = 0; i < 10; i++) {
    const swapPromise = amm.executeSwap({
      tokenIn: config.contracts.usdc,
      tokenOut: config.contracts.hyperIndex,
      amountIn: ethers.parseEther("1").toString(),
      slippageTolerance: 200,
      recipient: signer.address
    });
    promises.push(swapPromise);
  }
  
  const results = await Promise.allSettled(promises);
  const successful = results.filter(r => r.status === 'fulfilled').length;
  
  console.log(`✅ Stress test: ${successful}/10 swaps successful`);
};

await stressTest();
```

## Step 7: Security Validation

### 7.1 Slippage Protection Test
```typescript
// Test that slippage protection works
try {
  await amm.executeSwap({
    tokenIn: config.contracts.usdc,
    tokenOut: config.contracts.hyperIndex,
    amountIn: ethers.parseEther("100").toString(),
    slippageTolerance: 1, // Very low tolerance (0.01%)
    recipient: signer.address
  });
  console.log("❌ Slippage protection failed");
} catch (error) {
  console.log("✅ Slippage protection working:", error.message);
}
```

### 7.2 Access Control Test
```typescript
// Test that only factory can initialize pairs
const pair = await ethers.getContractAt("HyperIndexPair", pairAddress);

try {
  await pair.initialize(config.contracts.hyperIndex, config.contracts.usdc);
  console.log("❌ Access control failed");
} catch (error) {
  console.log("✅ Access control working:", error.message);
}
```

## Deployment Checklist

### Pre-deployment
- [ ] All contracts compiled successfully
- [ ] Network configuration correct
- [ ] Sufficient HYPE for gas fees
- [ ] Private keys secured

### During Deployment
- [ ] Factory deployed and verified
- [ ] Router deployed and verified
- [ ] HYPERINDEX token deployed
- [ ] Pair created successfully
- [ ] Initial liquidity added

### Post-deployment Validation
- [ ] HyperVMAMM integration working
- [ ] Basic swaps functioning
- [ ] Liquidity operations working
- [ ] SmartRouterV2 integration complete
- [ ] Performance tests passing
- [ ] Security validations complete
- [ ] Contract addresses updated in config

## Troubleshooting

### Common Issues
1. **"Transaction underpriced"**: Increase gas price
2. **"Insufficient liquidity"**: Add more liquidity to the pair
3. **"Transfer amount exceeds balance"**: Check token balances
4. **"Slippage tolerance exceeded"**: Increase slippage tolerance

### Emergency Procedures
- If deployment fails, check transaction status on HyperEVM explorer
- If contracts behave unexpectedly, immediately pause operations
- Keep backup of all deployed contract addresses
- Monitor for any unusual trading patterns

## Next Steps After Successful Deployment
1. Monitor AMM performance for 24 hours
2. Gradually increase test trade volumes
3. Integrate with OCOB system
4. Begin E2E testing with full trading stack