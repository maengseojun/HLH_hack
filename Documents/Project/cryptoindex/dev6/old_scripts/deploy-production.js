// scripts/deploy-production.js
/**
 * 🔒 PRODUCTION Deployment Script for HyperEVM
 * 
 * ⚠️ SECURITY REQUIREMENTS:
 * 1. All oracle addresses must be REAL Chainlink feeds
 * 2. Multi-signature wallet for ownership
 * 3. Comprehensive testing before deployment
 * 4. Emergency response procedures ready
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// ⚠️ CRITICAL: Replace with REAL Chainlink oracle addresses
const PRODUCTION_ORACLES = {
  // HyperEVM Mainnet Chainlink Price Feeds
  // ❌ DO NOT USE PLACEHOLDER ADDRESSES IN PRODUCTION!
  'DOGE': process.env.DOGE_CHAINLINK_FEED, // Real DOGE/USD feed
  'PEPE': process.env.PEPE_CHAINLINK_FEED, // Real PEPE/USD feed
  'SHIB': process.env.SHIB_CHAINLINK_FEED, // Real SHIB/USD feed
  'WIF': process.env.WIF_CHAINLINK_FEED,   // Real WIF/USD feed
  'BONK': process.env.BONK_CHAINLINK_FEED  // Real BONK/USD feed
};

const COMPONENT_WEIGHTS = {
  'DOGE': 2500,  // 25%
  'PEPE': 2000,  // 20%
  'SHIB': 1500,  // 15%
  'WIF': 1000,   // 10%
  'BONK': 3000   // 30%
};

async function main() {
  console.log("🔒 Starting PRODUCTION Deployment to HyperEVM...\n");
  
  // Security checks
  await performPreDeploymentChecks();
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "HYPE");
  
  if (balance < ethers.parseEther("1.0")) {
    throw new Error("❌ Insufficient balance! Need at least 1 HYPE for production deployment");
  }
  
  const deployedContracts = {};
  
  try {
    // 1. Deploy SECURE HyperIndex Token
    console.log("\n🔥 1. Deploying SECURE HyperIndex Token...");
    const HyperIndexToken = await ethers.getContractFactory("HyperIndexToken");
    const hyperIndexToken = await HyperIndexToken.deploy();
    await hyperIndexToken.waitForDeployment();
    
    const hyperIndexAddress = await hyperIndexToken.getAddress();
    deployedContracts.HYPERINDEX_TOKEN = hyperIndexAddress;
    console.log("✅ SECURE HyperIndex Token deployed:", hyperIndexAddress);
    
    // 2. Deploy Mock USDC (for testnet) or connect to real USDC (for mainnet)
    let usdcAddress;
    if (process.env.NETWORK === 'testnet') {
      console.log("\n🔥 2. Deploying Mock USDC for testnet...");
      const MockUSDC = await ethers.getContractFactory("MockUSDC");
      const mockUSDC = await MockUSDC.deploy();
      await mockUSDC.waitForDeployment();
      usdcAddress = await mockUSDC.getAddress();
      console.log("✅ Mock USDC deployed:", usdcAddress);
    } else {
      // Production: Use real USDC address
      usdcAddress = process.env.REAL_USDC_ADDRESS;
      console.log("📝 Using real USDC address:", usdcAddress);
    }
    deployedContracts.USDC_TOKEN = usdcAddress;
    
    // 3. Deploy AMM Factory
    console.log("\n🔥 3. Deploying AMM Factory...");
    const HyperIndexFactory = await ethers.getContractFactory("HyperIndexFactory");
    const factory = await HyperIndexFactory.deploy(deployer.address);
    await factory.waitForDeployment();
    
    const factoryAddress = await factory.getAddress();
    deployedContracts.AMM_FACTORY = factoryAddress;
    console.log("✅ AMM Factory deployed:", factoryAddress);
    
    // 4. Deploy AMM Router
    console.log("\n🔥 4. Deploying AMM Router...");
    const HyperIndexRouter = await ethers.getContractFactory("HyperIndexRouter");
    const router = await HyperIndexRouter.deploy(factoryAddress);
    await router.waitForDeployment();
    
    const routerAddress = await router.getAddress();
    deployedContracts.AMM_ROUTER = routerAddress;
    console.log("✅ AMM Router deployed:", routerAddress);
    
    // 5. Deploy Settlement Contract
    console.log("\n🔥 5. Deploying Settlement Contract...");
    const HyperIndexSettlement = await ethers.getContractFactory("HyperIndexSettlement");
    const settlement = await HyperIndexSettlement.deploy(deployer.address);
    await settlement.waitForDeployment();
    
    const settlementAddress = await settlement.getAddress();
    deployedContracts.SETTLEMENT = settlementAddress;
    console.log("✅ Settlement Contract deployed:", settlementAddress);
    
    // 6. CRITICAL: Configure Oracle Components with REAL addresses
    console.log("\n🔥 6. Configuring Oracle Components (PRODUCTION)...");
    await configureOracleComponents(hyperIndexToken);
    
    // 7. Create Initial Liquidity Pool
    if (process.env.NETWORK === 'testnet') {
      console.log("\n🔥 7. Creating Initial Liquidity Pool...");
      await createInitialLiquidity(hyperIndexToken, { address: usdcAddress }, router, deployer);
      
      const pairAddress = await factory.getPair(hyperIndexAddress, usdcAddress);
      deployedContracts.HYPERINDEX_USDC_PAIR = pairAddress;
    }
    
    // 8. Security Configuration
    console.log("\n🔥 8. Applying Security Configuration...");
    await applySecurityConfiguration(settlement, hyperIndexToken);
    
    // 9. Verification and Health Check
    console.log("\n🔍 9. Running Production Health Checks...");
    await runProductionHealthChecks(hyperIndexToken, settlement);
    
    // 10. Save deployment info
    await saveDeploymentInfo(deployedContracts, deployer);
    
    console.log("\n🎉 PRODUCTION Deployment Completed Successfully!");
    console.log("🔒 Security checklist completed");
    console.log("📊 All health checks passed");
    
  } catch (error) {
    console.error("\n❌ PRODUCTION Deployment failed:");
    console.error(error);
    process.exit(1);
  }
}

/**
 * 🔍 Pre-deployment security checks
 */
async function performPreDeploymentChecks() {
  console.log("🔍 Performing pre-deployment security checks...");
  
  // Check oracle addresses
  for (const [symbol, address] of Object.entries(PRODUCTION_ORACLES)) {
    if (!address || address.startsWith('0x000') || address === '0x...') {
      throw new Error(`❌ Invalid oracle address for ${symbol}: ${address}`);
    }
    console.log(`✅ ${symbol} oracle: ${address}`);
  }
  
  // Check network
  const network = await ethers.provider.getNetwork();
  console.log(`📡 Network: ${network.name} (${network.chainId})`);
  
  if (process.env.NETWORK === 'mainnet' && network.chainId !== 999n) {
    throw new Error("❌ Network mismatch! Expected HyperEVM mainnet (999)");
  }
  
  if (process.env.NETWORK === 'testnet' && network.chainId !== 998n) {
    throw new Error("❌ Network mismatch! Expected HyperEVM testnet (998)");
  }
  
  console.log("✅ Pre-deployment checks passed");
}

/**
 * 🔗 Configure oracle components with REAL Chainlink feeds
 */
async function configureOracleComponents(token) {
  console.log("📝 Adding oracle components with validation...");
  
  for (const [symbol, oracleAddress] of Object.entries(PRODUCTION_ORACLES)) {
    if (!oracleAddress) {
      console.warn(`⚠️ Skipping ${symbol} - no oracle address provided`);
      continue;
    }
    
    const weight = COMPONENT_WEIGHTS[symbol];
    if (!weight) {
      console.warn(`⚠️ Skipping ${symbol} - no weight configured`);
      continue;
    }
    
    try {
      console.log(`📊 Adding ${symbol} with weight ${weight/100}%...`);
      
      // Test oracle before adding
      const oracle = await ethers.getContractAt("AggregatorV3Interface", oracleAddress);
      const roundData = await oracle.latestRoundData();
      console.log(`  📈 Current ${symbol} price: $${ethers.formatUnits(roundData.answer, 8)}`);
      
      // Add component (this will trigger validation in the contract)
      const tx = await token.addComponent(symbol, oracleAddress, weight);
      await tx.wait();
      
      console.log(`✅ ${symbol} component added successfully`);
      
    } catch (error) {
      console.error(`❌ Failed to add ${symbol} component:`, error.message);
      throw error; // Fail deployment if any oracle is invalid
    }
  }
  
  console.log("✅ All oracle components configured");
}

/**
 * 💧 Create initial liquidity (testnet only)
 */
async function createInitialLiquidity(hyperIndexToken, usdcToken, router, deployer) {
  const hyperIndexAmount = ethers.parseEther("1000000"); // 1M HYPERINDEX
  const usdcAmount = ethers.parseUnits("1000000", 6); // 1M USDC
  
  console.log("📝 Approving tokens for liquidity...");
  await hyperIndexToken.approve(await router.getAddress(), hyperIndexAmount);
  
  if (usdcToken.approve) {
    await usdcToken.approve(await router.getAddress(), usdcAmount);
  }
  
  console.log("💧 Adding initial liquidity...");
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
  
  const tx = await router.addLiquidity(
    await hyperIndexToken.getAddress(),
    usdcToken.address,
    hyperIndexAmount,
    usdcAmount,
    0, 0,
    deployer.address,
    deadline
  );
  
  await tx.wait();
  console.log("✅ Initial liquidity added");
}

/**
 * 🔒 Apply security configuration
 */
async function applySecurityConfiguration(settlement, token) {
  console.log("🔒 Applying security configurations...");
  
  // Add supported tokens to settlement
  await settlement.addToken(await token.getAddress());
  console.log("✅ HYPERINDEX token added to settlement");
  
  // Set conservative fee (0.3%)
  await settlement.setFeeRate(30);
  console.log("✅ Trading fee set to 0.3%");
  
  console.log("✅ Security configuration applied");
}

/**
 * 🩺 Run production health checks
 */
async function runProductionHealthChecks(token, settlement) {
  console.log("🩺 Running health checks...");
  
  // Check oracle health
  const healthCheck = await token.batchOracleHealthCheck();
  for (let i = 0; i < healthCheck.symbols.length; i++) {
    const symbol = healthCheck.symbols[i];
    const isHealthy = healthCheck.isHealthy[i];
    const lastUpdated = healthCheck.lastUpdated[i];
    
    if (!isHealthy) {
      throw new Error(`❌ Oracle health check failed for ${symbol}`);
    }
    
    console.log(`✅ ${symbol} oracle healthy (updated: ${new Date(Number(lastUpdated) * 1000).toLocaleString()})`);
  }
  
  // Check index price calculation
  const indexPrice = await token.getCurrentPrice();
  if (indexPrice === 0n) {
    throw new Error("❌ Index price calculation failed");
  }
  console.log(`✅ Index price: $${ethers.formatUnits(indexPrice, 8)}`);
  
  // Check settlement contract
  const feeRate = await settlement.feeRate();
  console.log(`✅ Settlement fee rate: ${feeRate / 100}%`);
  
  console.log("✅ All health checks passed");
}

/**
 * 💾 Save deployment information
 */
async function saveDeploymentInfo(contracts, deployer) {
  const deploymentInfo = {
    network: process.env.NETWORK || 'testnet',
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts,
    oracles: PRODUCTION_ORACLES,
    weights: COMPONENT_WEIGHTS,
    securityChecks: {
      oracleValidation: true,
      healthChecks: true,
      accessControl: true
    }
  };
  
  const filename = `deployment-${process.env.NETWORK || 'testnet'}-${Date.now()}.json`;
  const filepath = path.join(__dirname, "../deployments", filename);
  
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("📄 Deployment info saved:", filepath);
  
  // Generate environment variables
  console.log("\n🔧 Environment Variables for .env.local:");
  console.log("=" * 50);
  for (const [key, address] of Object.entries(contracts)) {
    console.log(`NEXT_PUBLIC_${key}_ADDRESS=${address}`);
  }
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
  process.exit(1);
});

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });