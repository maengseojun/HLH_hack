# HyperIndex AMM Scripts Directory

## 📋 Quick Reference

### 🚀 Production Deployment (In Order)
```bash
1. npx hardhat run scripts/deploy-factory.js --network hypervm-testnet
2. npx hardhat run scripts/deploy-router.js --network hypervm-testnet  
3. npx hardhat run scripts/deploy-token.js --network hypervm-testnet
4. npx hardhat run scripts/create-pair.js --network hypervm-testnet
5. npx hardhat run scripts/fix-liquidity.js --network hypervm-testnet
```

### 🔍 Debugging & Diagnostics
```bash
# Complete system diagnosis
npx hardhat run scripts/debug-contracts.js --network hypervm-testnet

# Network connectivity check
npx hardhat run scripts/check-network.js --network hypervm-testnet

# Block type monitoring
npx hardhat run scripts/check-block-type.js --network hypervm-testnet
```

---

## 📁 Script Categories

### ✅ **Core Deployment Scripts**
- **`deploy-factory.js`** - Deploy HyperIndexFactory contract
- **`deploy-router.js`** - Deploy HyperIndexRouter contract
- **`deploy-token.js`** - Deploy HyperIndex token
- **`create-pair.js`** - Create HYPERINDEX-USDC trading pair
- **`fix-liquidity.js`** - Add initial liquidity (PRODUCTION READY)

### 🔧 **Maintenance Scripts**  
- **`redeploy-router.js`** - Redeploy Router only (for library fixes)

### 🔍 **Diagnostic Scripts**
- **`debug-contracts.js`** - Complete system state diagnosis
- **`check-network.js`** - Verify network connectivity and configuration
- **`check-block-type.js`** - Monitor current block type (Big/Small)
- **`test-rpc.js`** - Test RPC endpoint connectivity

### 🧪 **Testing Scripts**
- **`test-hypervm-amm.js`** - Test AMM integration
- **`run-security-tests.ts`** - Security test suite execution
- **`check-hyperswap.js`** - Integration testing

### 🛠️ **Utility Scripts**
- **`toggle-block-type.js`** - Switch between Big/Small blocks
- **`monitor-blocks.js`** - Real-time block monitoring  
- **`integrate-hooats.js`** - HOOATS system integration
- **`start-redis.sh`** - Start Redis for development

---

## 🗂️ Archived Scripts
**Location**: `scripts/archive/`
- Deprecated deployment attempts
- Troubleshooting scripts from debugging phase
- Experimental configurations

---

## ⚠️ Critical Notes

### 1. **Always Use fix-liquidity.js for Liquidity**
- Contains all bug fixes discovered during deployment
- Proper token order (USDC first, HYPERINDEX second)
- Correct approve transaction waiting
- Big Block gas configuration

### 2. **Root Cause Awareness**
- HyperIndexLibrary init code hash MUST match Factory PAIR_CODE_HASH
- Check `DEPLOYMENT_PIPELINE_GUIDE.md` for full debugging story

### 3. **HyperEVM Specific**
- Use Big Block gas settings for contract deployments
- HYPE is the native gas token
- Block architecture affects transaction timing

---

## 📖 Detailed Documentation
**See**: `DEPLOYMENT_PIPELINE_GUIDE.md` for complete deployment pipeline and troubleshooting guide.

---

*Scripts organized after successful AMM deployment on HyperEVM - 2025-08-11*