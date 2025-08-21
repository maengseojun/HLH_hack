# HyperIndex AMM Deployment Pipeline Guide
*Created: 2025-08-11*

## Overview
Complete guide for deploying HyperIndex AMM on HyperEVM with lessons learned from debugging and root cause analysis.

## Table of Contents
1. [Critical Bug Discovery & Resolution](#critical-bug-discovery--resolution)
2. [Prerequisites](#prerequisites)
3. [Production Deployment Pipeline](#production-deployment-pipeline)
4. [Troubleshooting Guide](#troubleshooting-guide)
5. [Scripts Reference](#scripts-reference)
6. [Key Learnings](#key-learnings)

---

## Critical Bug Discovery & Resolution

### 🚨 **Root Cause Found: HyperIndexLibrary Init Code Hash Mismatch**

**Problem:**
- Router.addLiquidity() consistently failed with "execution reverted"
- All other components (Factory, Tokens, Pair, approvals) were working correctly
- Gas settings, token order, and timing were all properly configured

**Root Cause:**
HyperIndexLibrary.sol had hardcoded init code hash that didn't match the actual Factory's PAIR_CODE_HASH:
```solidity
// Wrong hash in HyperIndexLibrary.sol
hex"96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f"

// Correct hash from Factory.PAIR_CODE_HASH()
hex"850862577798453a83a82988c33040528b3c07c908b27877fad5f2059df00c43"
```

**Impact:**
- `HyperIndexLibrary.pairFor()` calculated wrong addresses
- Router sent tokens to non-existent addresses
- All addLiquidity operations failed silently

**Resolution:**
1. Updated HyperIndexLibrary.sol with correct hash
2. Redeployed only Router contract (other contracts unchanged)
3. Updated scripts with new Router address
4. Successfully added liquidity

---

## Prerequisites

### Environment Setup
```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env.local
# Fill in your private keys and RPC URLs

# 3. Verify network configuration
npx hardhat run scripts/check-network.js --network hypervm-testnet
```

### Required HYPE Balance
- **Minimum**: 5 HYPE for gas fees
- **Recommended**: 10+ HYPE for safety margin
- **Big Block operations**: Require higher gas limits (5-8M gas)

### HyperEVM Block Architecture Understanding
- **Small Blocks**: 1s interval, 2M gas limit (normal transactions)
- **Big Blocks**: 1min interval, 30M gas limit (large contract deployments)
- Use `bigBlockGasPrice` to force Big Block execution

---

## Production Deployment Pipeline

### Phase 1: Core Contract Deployment

#### Step 1.1: Deploy Factory
```bash
npx hardhat run scripts/deploy-factory.js --network hypervm-mainnet
```
**Expected Output:**
- Factory address
- PAIR_CODE_HASH value (CRITICAL: Save this!)

#### Step 1.2: Verify Init Code Hash
Before proceeding, verify the Factory's PAIR_CODE_HASH matches HyperIndexLibrary:
```javascript
// Check contracts/libraries/HyperIndexLibrary.sol line ~28
// Must match Factory.PAIR_CODE_HASH() exactly
```

#### Step 1.3: Deploy Router
```bash
npx hardhat run scripts/deploy-router.js --network hypervm-mainnet
```
**Gas Configuration:**
```javascript
const gasOptions = {
  gasPrice: ethers.parseUnits("50", "gwei"), // Big Block gas
  gasLimit: 8000000 // Router needs high gas limit
};
```

#### Step 1.4: Deploy Settlement Contract
```bash
npx hardhat run scripts/deploy-settlement.js --network hypervm-mainnet
```

### Phase 2: Token Deployment & Pair Creation

#### Step 2.1: Deploy HyperIndex Token
```bash
npx hardhat run scripts/deploy-token.js --network hypervm-mainnet
```

#### Step 2.2: Create Trading Pair
```bash
npx hardhat run scripts/create-pair.js --network hypervm-mainnet
```
**Verify:**
- Pair address matches Factory.getPair() result
- Token0/Token1 are correctly ordered (sorted by address)

### Phase 3: Initial Liquidity Addition

#### Step 3.1: Critical Pre-checks
```bash
# Verify all contract states
npx hardhat run scripts/debug-contracts.js --network hypervm-mainnet
```
**Must verify:**
- ✅ Token balances sufficient
- ✅ Router allowances set correctly  
- ✅ Pair configuration matches tokens
- ✅ pairFor calculation matches actual pair

#### Step 3.2: Add Initial Liquidity
```bash
npx hardhat run scripts/add-liquidity.js --network hypervm-mainnet
```
**Critical Requirements:**
```javascript
// 1. Proper token order (sorted by address)
const token0 = /* Lower address */;
const token1 = /* Higher address */;

// 2. Wait for approve transactions
const approveTx = await token.approve(router, amount, gasOptions);
await approveTx.wait(); // CRITICAL: Must wait!

// 3. Big Block gas settings
const gasOptions = {
  gasPrice: ethers.parseUnits("50", "gwei"),
  gasLimit: 5000000
};
```

### Phase 4: Production Verification

#### Step 4.1: End-to-End Testing
```bash
npx hardhat run scripts/test-trading.js --network hypervm-mainnet
```
**Test Coverage:**
- Small swaps (price stability)
- Large swaps (slippage handling)
- Multiple consecutive operations
- Gas consumption analysis

#### Step 4.2: Security Validation
```bash
npx hardhat run scripts/run-security-tests.ts --network hypervm-mainnet
```

---

## Troubleshooting Guide

### Common Issues & Solutions

#### 1. "execution reverted" on addLiquidity
**Symptoms:**
- approve transactions succeed
- addLiquidity fails with no specific error
- Gas used ~37K (very low)

**Root Cause Check:**
```javascript
// Verify pairFor calculation
const factory = await ethers.getContractAt("HyperIndexFactory", factoryAddress);
const actualHash = await factory.PAIR_CODE_HASH();
console.log("Factory hash:", actualHash);

// Check HyperIndexLibrary.sol hardcoded hash
// Must match exactly!
```

**Solution:**
1. Update HyperIndexLibrary.sol with correct hash
2. Redeploy Router only
3. Update scripts with new Router address

#### 2. Gas Price Too Low
**Symptoms:**
- Transactions pending indefinitely
- "replacement transaction underpriced"

**Solution:**
```javascript
const gasOptions = {
  gasPrice: ethers.parseUnits("50", "gwei"), // Force Big Block
  gasLimit: 5000000
};
```

#### 3. Token Order Mismatch
**Symptoms:**
- Router calls succeed but with unexpected results
- HYPERINDEX appears as token0 when it should be token1

**Solution:**
```javascript
// Always use sorted order
const [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];

// In addLiquidity call
await router.addLiquidity(
  token0, // Lower address first
  token1, // Higher address second
  amount0,
  amount1,
  // ...
);
```

#### 4. Approve Transaction Timing
**Symptoms:**
- "transfer amount exceeds allowance"
- Intermittent failures

**Solution:**
```javascript
// ALWAYS wait for approve confirmation
const approveTx = await token.approve(router, amount, gasOptions);
await approveTx.wait(); // Essential!

// Then proceed with transfer operation
```

### HyperEVM Specific Issues

#### Block Type Problems
**Check current block:**
```javascript
const block = await provider.getBlock("latest");
const isBigBlock = block.gasLimit > 3000000;
console.log("Block type:", isBigBlock ? "Big" : "Small");
```

**Force Big Block:**
```javascript
const bigBlockGasPrice = ethers.parseUnits("50", "gwei");
// This forces transaction to Big Block mempool
```

#### Network Configuration
```javascript
// HyperEVM Testnet
{
  chainId: 998,
  rpcUrl: "https://api.hyperliquid-testnet.xyz/evm",
  gasToken: "HYPE"
}

// HyperEVM Mainnet  
{
  chainId: 42161, // Check latest docs
  rpcUrl: "https://api.hyperliquid.xyz/evm",
  gasToken: "HYPE"
}
```

---

## Scripts Reference

### ✅ Production-Ready Scripts
- `deploy-factory.js` - Deploy Factory contract
- `deploy-router.js` - Deploy Router contract  
- `redeploy-router.js` - Redeploy Router only (for library fixes)
- `debug-contracts.js` - Comprehensive state diagnosis
- `add-liquidity.js` - Add liquidity with proper error handling

### 🧪 Testing Scripts
- `test-trading.js` - End-to-end trading tests
- `run-security-tests.ts` - Security test suite
- `check-network.js` - Network connectivity verification

### 🔧 Utility Scripts
- `check-block-type.js` - Monitor block type
- `toggle-block-type.js` - Switch between block types
- `monitor-blocks.js` - Real-time block monitoring

### 📊 Diagnostic Scripts
- `debug-contracts.js` - Complete system diagnosis
- `test-rpc.js` - RPC connection testing
- `check-hyperswap.js` - Integration testing

### 🗂️ Deprecated Scripts (Archive)
- `deploy-complete-amm.js` - Monolithic deployment (issues found)
- `fix-liquidity-v2.js` - Troubleshooting attempts
- `deploy-with-*.js` - Various deployment attempts
- `test-deploy.js` - Basic deployment testing

---

## Key Learnings

### 1. **Always Verify Init Code Hashes**
- Factory deployment generates unique PAIR_CODE_HASH
- Libraries with hardcoded hashes MUST match exactly
- Mismatch causes silent failures in address calculations

### 2. **HyperEVM Block Architecture**
- Big Blocks required for large contract deployments
- Small Blocks sufficient for normal operations
- Use `bigBlockGasPrice` to force block type

### 3. **Transaction Timing Critical**
- `await tx.wait()` is mandatory for sequential operations
- Allowances must be confirmed before transfers
- Never assume transaction ordering

### 4. **Token Address Ordering**
- Pair contracts sort tokens by address (not symbol)
- Always use sorted order in Router calls
- Verify token0/token1 assignments after deployment

### 5. **Systematic Debugging**
- Start with simplest components (balances, allowances)
- Verify each layer before proceeding
- Use comprehensive diagnostic scripts
- Never skip address/hash verification

### 6. **HyperEVM Specific Considerations**
- HYPE is the native gas token
- Higher gas prices may be required
- Network configuration differs from standard EVM
- Block finality affects transaction timing

---

## Final Contract Addresses (Testnet)

```javascript
const FINAL_ADDRESSES = {
  factory: "0x73bF19534DA1c60772E40136A4e5E77921b7a632",
  router: "0xD70399962f491c4d38f4ACf7E6a9345B0B9a3A7A", // Fixed Router
  settlement: "0x543C050a536457c47c569D26AABd52Fae17cbA4B",
  hyperindex: "0x6065Ab1ec8334ab6099aF27aF145411902EAef40",
  usdc: "0x53aE8e677f34BC709148085381Ce2D4b6ceA1Fc3",
  pair: "0x5706084ad9Cac84393eaA1Eb265Db9b22bA63cd1"
};

const PAIR_CODE_HASH = "0x850862577798453a83a82988c33040528b3c07c908b27877fad5f2059df00c43";
```

---

## Next Steps for Production

1. **Security Audit** - Professional audit of all contracts
2. **Mainnet Deployment** - Follow this pipeline exactly
3. **Monitoring Setup** - Real-time error tracking
4. **HOOATS Integration** - Connect to trading system
5. **Performance Testing** - Load testing with realistic volumes

---

*This guide represents lessons learned from extensive debugging and successful resolution of critical deployment issues on HyperEVM. Follow these procedures exactly to avoid similar problems.*