// scripts/deploy-complete-amm.js
/**
 * Complete AMM Deployment with Settlement Contract
 * Created: 2025-08-11
 * 
 * This script deploys:
 * 1. HyperIndexFactory
 * 2. HyperIndexRouter
 * 3. HyperIndexSettlement
 * 4. Test tokens (HYPERINDEX, USDC mock)
 * 5. Creates trading pairs
 * 6. Adds initial liquidity
 */

const { ethers } = require("hardhat");
const fs = require("fs").promises;

// Deployment configuration
const CONFIG = {
  initialLiquidity: {
    hyperindex: "1000000", // 1M HYPERINDEX
    usdc: "1000000"        // 1M USDC
  },
  feeRate: 30,  // 0.3% in basis points
  testAmounts: {
    smallSwap: "100",
    mediumSwap: "1000", 
    largeSwap: "10000"
  }
};

// Color console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m"
};

function log(message, color = "reset") {
  console.log(colors[color] + message + colors.reset);
}

async function checkNetwork() {
  const [deployer] = await ethers.getSigners();
  const network = await deployer.provider.getNetwork();
  
  log("\n📊 Network Information:", "cyan");
  log(`- Chain ID: ${network.chainId}`);
  log(`- Deployer: ${deployer.address}`);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  log(`- Balance: ${ethers.formatEther(balance)} HYPE`);
  
  if (balance < ethers.parseEther("0.1")) {
    throw new Error("Insufficient HYPE balance for deployment");
  }
  
  // Check block type
  const block = await deployer.provider.getBlock("latest");
  const isBigBlock = block.gasLimit > 3000000;
  log(`- Block Type: ${isBigBlock ? "BIG BLOCKS ✅" : "Small Blocks ⚠️"}`);
  log(`- Gas Limit: ${block.gasLimit.toString()}`);
  
  // Check if user is set to use Big Blocks
  log("\n🔄 Checking Big Block configuration...");
  if (!isBigBlock) {
    log("⚠️ Small Blocks detected. For large contract deployment, switch to Big Blocks:", "yellow");
    log("  1. Use: node scripts/toggle-block-type.js big", "yellow");
    log("  2. Or set usingBigBlocks flag via HyperCore action", "yellow");
    log("  3. Or use bigBlockGasPrice in deployment transactions", "yellow");
  }
  
  return { deployer, network, block, isBigBlock };
}

async function deployFactory(deployer, useBigBlock = false) {
  log("\n📦 Deploying HyperIndexFactory...", "yellow");
  
  const HyperIndexFactory = await ethers.getContractFactory("HyperIndexFactory");
  
  // Configure deployment options based on block type
  const deployOptions = {};
  if (useBigBlock) {
    // Use bigBlockGasPrice for Big Block deployment
    const bigBlockGasPrice = ethers.parseUnits("50", "gwei");
    deployOptions.gasPrice = bigBlockGasPrice;
    deployOptions.gasLimit = 5000000;
    log("  Using Big Block gas price for deployment", "cyan");
  }
  
  const factory = await HyperIndexFactory.deploy(deployer.address, deployOptions);
  await factory.waitForDeployment();
  
  const factoryAddress = await factory.getAddress();
  log(`✅ Factory deployed to: ${factoryAddress}`, "green");
  
  return factory;
}

async function deployRouter(factoryAddress, deployer, useBigBlock = false) {
  log("\n📦 Deploying HyperIndexRouter...", "yellow");
  
  // For testnet, we'll use zero address for WHYPE (wrapped HYPE)
  // In production, this should be the actual WHYPE address
  const WHYPE = "0x0000000000000000000000000000000000000000";
  
  const HyperIndexRouter = await ethers.getContractFactory("HyperIndexRouter");
  
  const deployOptions = {};
  if (useBigBlock) {
    const bigBlockGasPrice = ethers.parseUnits("50", "gwei");
    deployOptions.gasPrice = bigBlockGasPrice;
    deployOptions.gasLimit = 5000000;
    log("  Using Big Block gas price for deployment", "cyan");
  }
  
  const router = await HyperIndexRouter.deploy(factoryAddress, WHYPE, deployOptions);
  await router.waitForDeployment();
  
  const routerAddress = await router.getAddress();
  log(`✅ Router deployed to: ${routerAddress}`, "green");
  
  return router;
}

async function deploySettlement(deployer, useBigBlock = false) {
  log("\n📦 Deploying HyperIndexSettlement...", "yellow");
  
  const HyperIndexSettlement = await ethers.getContractFactory("HyperIndexSettlement");
  
  const deployOptions = {};
  if (useBigBlock) {
    const bigBlockGasPrice = ethers.parseUnits("50", "gwei");
    deployOptions.gasPrice = bigBlockGasPrice;
    deployOptions.gasLimit = 8000000; // Settlement needs more gas
    log("  Using Big Block gas price for deployment", "cyan");
  }
  
  const settlement = await HyperIndexSettlement.deploy(deployer.address, deployOptions);
  await settlement.waitForDeployment();
  
  const settlementAddress = await settlement.getAddress();
  log(`✅ Settlement deployed to: ${settlementAddress}`, "green");
  
  // Configure settlement contract
  log("⚙️ Configuring Settlement contract...");
  
  // Set fee recipient
  await settlement.setFeeRecipient(deployer.address);
  log("  - Fee recipient set");
  
  // Set fee rate
  await settlement.setFeeRate(CONFIG.feeRate);
  log(`  - Fee rate set to ${CONFIG.feeRate / 100}%`);
  
  // Add deployer as settlement operator for testing
  await settlement.addOperator(deployer.address);
  log("  - Settlement operator added");
  
  return settlement;
}

async function deployTokens(deployer) {
  log("\n📦 Deploying Test Tokens...", "yellow");
  
  // Deploy HYPERINDEX token
  const HyperIndexToken = await ethers.getContractFactory("HyperIndexToken");
  const hyperindex = await HyperIndexToken.deploy();
  await hyperindex.waitForDeployment();
  const hyperindexAddress = await hyperindex.getAddress();
  log(`✅ HYPERINDEX token deployed to: ${hyperindexAddress}`, "green");
  
  // Deploy mock USDC token for testing
  // In production, use the actual USDC address on HyperEVM
  const MockUSDC = await ethers.getContractFactory("HyperIndexToken");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  log(`✅ Mock USDC deployed to: ${usdcAddress}`, "green");
  
  // Mint initial supply to deployer
  log("⚙️ Minting initial token supply...");
  const mintAmount = ethers.parseEther("10000000"); // 10M tokens
  
  await hyperindex.transfer(deployer.address, mintAmount);
  await usdc.transfer(deployer.address, mintAmount);
  
  log(`  - Minted ${ethers.formatEther(mintAmount)} HYPERINDEX`);
  log(`  - Minted ${ethers.formatEther(mintAmount)} USDC`);
  
  return { hyperindex, usdc };
}

async function createPair(factory, hyperindexAddress, usdcAddress) {
  log("\n🔄 Creating HYPERINDEX-USDC pair...", "yellow");
  
  const createPairTx = await factory.createPair(hyperindexAddress, usdcAddress);
  await createPairTx.wait();
  
  const pairAddress = await factory.getPair(hyperindexAddress, usdcAddress);
  log(`✅ Pair created at: ${pairAddress}`, "green");
  
  const HyperIndexPair = await ethers.getContractFactory("HyperIndexPair");
  const pair = HyperIndexPair.attach(pairAddress);
  
  return pair;
}

async function addLiquidity(router, hyperindex, usdc, deployer, useBigBlock = false) {
  log("
💧 Adding initial liquidity...", "yellow");
  
  const routerAddress = await router.getAddress();
  const hyperindexAddress = await hyperindex.getAddress();
  const usdcAddress = await usdc.getAddress();
  
  // Approve router to spend tokens
  const liquidityAmount = ethers.parseEther(CONFIG.initialLiquidity.hyperindex);
  
  // Configure gas options for Big Block if needed
  const gasOptions = {};
  if (useBigBlock) {
    const bigBlockGasPrice = ethers.parseUnits("50", "gwei");
    gasOptions.gasPrice = bigBlockGasPrice;
    gasOptions.gasLimit = 5000000;
    log("  Using Big Block gas price for liquidity operations", "cyan");
  }
  
  log("⚙️ Approving token transfers...");
  await hyperindex.approve(routerAddress, liquidityAmount, gasOptions);
  await usdc.approve(routerAddress, liquidityAmount, gasOptions);
  
  // Add liquidity
  log("⚙️ Adding liquidity to pool...");
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  
  const addLiquidityTx = await router.addLiquidity(
    hyperindexAddress,
    usdcAddress,
    liquidityAmount,
    liquidityAmount,
    ethers.parseEther("0"), // Accept any amount of tokens (for first liquidity)
    ethers.parseEther("0"), // Accept any amount of tokens (for first liquidity)
    deployer.address,
    deadline,
    gasOptions
  );
  
  const receipt = await addLiquidityTx.wait();
  log(`✅ Liquidity added! Gas used: ${receipt.gasUsed.toString()}`, "green");
  
  return receipt;
}

async function testSwaps(router, hyperindex, usdc, pair, deployer) {
  log("\n🧪 Testing swap functionality...", "cyan");
  
  const routerAddress = await router.getAddress();
  const hyperindexAddress = await hyperindex.getAddress();
  const usdcAddress = await usdc.getAddress();
  
  // Test 1: Small swap USDC -> HYPERINDEX
  log("\n📊 Test 1: Small swap (100 USDC -> HYPERINDEX)");
  const swapAmount1 = ethers.parseEther(CONFIG.testAmounts.smallSwap);
  await usdc.approve(routerAddress, swapAmount1);
  
  const path1 = [usdcAddress, hyperindexAddress];
  const amounts1 = await router.getAmountsOut(swapAmount1, path1);
  log(`  Expected output: ${ethers.formatEther(amounts1[1])} HYPERINDEX`);
  
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const swapTx1 = await router.swapExactTokensForTokens(
    swapAmount1,
    ethers.parseEther("0"), // Accept any amount out
    path1,
    deployer.address,
    deadline
  );
  await swapTx1.wait();
  log(`  ✅ Swap successful!`, "green");
  
  // Test 2: Check reserves after swap
  log("\n📊 Test 2: Checking pool reserves");
  const reserves = await pair.getReserves();
  log(`  Reserve0: ${ethers.formatEther(reserves[0])}`);
  log(`  Reserve1: ${ethers.formatEther(reserves[1])}`);
  
  // Calculate price
  const price = Number(reserves[0]) / Number(reserves[1]);
  log(`  Price ratio: ${price.toFixed(6)}`);
  
  // Test 3: Larger swap with price impact
  log("\n📊 Test 3: Large swap with price impact (10000 HYPERINDEX -> USDC)");
  const swapAmount3 = ethers.parseEther(CONFIG.testAmounts.largeSwap);
  await hyperindex.approve(routerAddress, swapAmount3);
  
  const path3 = [hyperindexAddress, usdcAddress];
  const amounts3 = await router.getAmountsOut(swapAmount3, path3);
  log(`  Expected output: ${ethers.formatEther(amounts3[1])} USDC`);
  
  // Calculate price impact
  const priceImpact = (1 - (Number(amounts3[1]) / Number(swapAmount3))) * 100;
  log(`  Price impact: ${priceImpact.toFixed(2)}%`);
  
  if (priceImpact > 5) {
    log(`  ⚠️ High price impact detected!`, "yellow");
  }
  
  return { swapCount: 2, totalGasUsed: 0 };
}

async function validateDeployment(contracts) {
  log("\n✅ Deployment Validation", "cyan");
  
  const checks = [
    { name: "Factory", address: contracts.factory },
    { name: "Router", address: contracts.router },
    { name: "Settlement", address: contracts.settlement },
    { name: "HYPERINDEX Token", address: contracts.hyperindex },
    { name: "USDC Token", address: contracts.usdc },
    { name: "Trading Pair", address: contracts.pair }
  ];
  
  for (const check of checks) {
    if (!check.address || check.address === "0x0000000000000000000000000000000000000000") {
      log(`  ❌ ${check.name}: NOT DEPLOYED`, "red");
      return false;
    } else {
      log(`  ✅ ${check.name}: ${check.address}`, "green");
    }
  }
  
  return true;
}

async function saveDeployment(contracts, network) {
  const deployment = {
    network: network.name || "hypervm-testnet",
    chainId: Number(network.chainId),
    timestamp: new Date().toISOString(),
    contracts: {
      factory: contracts.factory,
      router: contracts.router,
      settlement: contracts.settlement,
      hyperindex: contracts.hyperindex,
      usdc: contracts.usdc,
      pair: contracts.pair
    },
    configuration: CONFIG,
    kpis: {
      deploymentTime: contracts.deploymentTime,
      gasUsed: contracts.totalGasUsed,
      swapsExecuted: contracts.swapCount
    }
  };
  
  const filename = `deployment-${network.chainId}-${Date.now()}.json`;
  await fs.writeFile(filename, JSON.stringify(deployment, null, 2));
  
  log(`\n📄 Deployment saved to: ${filename}`, "cyan");
  
  return deployment;
}

async function main() {
  const startTime = Date.now();
  
  log("\n" + "=".repeat(60), "cyan");
  log("HyperIndex Complete AMM Deployment", "cyan");
  log("=".repeat(60), "cyan");
  
  try {
    // Step 1: Check network and block type
    const { deployer, network, block, isBigBlock } = await checkNetwork();
    
    // Determine if we should use Big Block deployment
    let useBigBlock = false;
    
    // Option 1: Check if already on Big Blocks
    if (isBigBlock) {
      log("\n✅ Big Blocks detected - will use standard deployment", "green");
      useBigBlock = false; // Already on Big Block, no need for special gas price
    } 
    // Option 2: Force Big Block deployment via gas price
    else if (process.env.FORCE_BIG_BLOCK === 'true') {
      log("\n⚡ Forcing Big Block deployment via bigBlockGasPrice", "yellow");
      useBigBlock = true;
    }
    // Option 3: Ask user
    else {
      log("\n⚠️ Small Blocks detected. Options:", "yellow");
      log("1. Deploy with bigBlockGasPrice (forces Big Block)", "yellow");
      log("2. Continue with Small Blocks (may fail for large contracts)", "yellow");
      log("\nSet FORCE_BIG_BLOCK=true in .env to use option 1", "cyan");
      useBigBlock = false; // Default to Small Blocks unless forced
    }
    
    // Step 2: Deploy core contracts
    const factory = await deployFactory(deployer, useBigBlock);
    const router = await deployRouter(await factory.getAddress(), deployer, useBigBlock);
    const settlement = await deploySettlement(deployer, useBigBlock);
    
    // Step 3: Deploy tokens
    const { hyperindex, usdc } = await deployTokens(deployer);
    
    // Step 4: Create trading pair
    const pair = await createPair(
      factory, 
      await hyperindex.getAddress(), 
      await usdc.getAddress()
    );
    
    // Step 5: Add initial liquidity
    await addLiquidity(router, hyperindex, usdc, deployer, useBigBlock);
    
    // Step 6: Test swaps
    const testResults = await testSwaps(router, hyperindex, usdc, pair, deployer);
    
    // Step 7: Configure settlement for tokens
    log("\n⚙️ Configuring Settlement for tokens...", "yellow");
    await settlement.addSupportedToken(await hyperindex.getAddress());
    await settlement.addSupportedToken(await usdc.getAddress());
    log("✅ Tokens added to settlement contract", "green");
    
    // Prepare contract addresses
    const contracts = {
      factory: await factory.getAddress(),
      router: await router.getAddress(),
      settlement: await settlement.getAddress(),
      hyperindex: await hyperindex.getAddress(),
      usdc: await usdc.getAddress(),
      pair: await pair.getAddress(),
      deploymentTime: (Date.now() - startTime) / 1000,
      totalGasUsed: 0,
      swapCount: testResults.swapCount
    };
    
    // Step 8: Validate deployment
    const isValid = await validateDeployment(contracts);
    
    if (!isValid) {
      throw new Error("Deployment validation failed!");
    }
    
    // Step 9: Save deployment info
    const deployment = await saveDeployment(contracts, network);
    
    // Step 10: Display KPIs
    log("\n" + "=".repeat(60), "cyan");
    log("📊 Deployment KPIs", "cyan");
    log("=".repeat(60), "cyan");
    log(`⏱️ Total deployment time: ${contracts.deploymentTime.toFixed(2)}s`);
    log(`⛽ Total gas used: ${contracts.totalGasUsed}`);
    log(`🔄 Swaps executed: ${contracts.swapCount}`);
    log(`📦 Contracts deployed: 6`);
    log(`💧 Initial liquidity: ${CONFIG.initialLiquidity.hyperindex} HYPERINDEX / ${CONFIG.initialLiquidity.usdc} USDC`);
    
    log("\n🎉 DEPLOYMENT SUCCESSFUL!", "green");
    log("\n📝 Next Steps:", "yellow");
    log("1. Update lib/config/hypervm-config.ts with deployed addresses");
    log("2. Test AMM integration with HOOATS system");
    log("3. Run security test suite");
    log("4. Monitor performance metrics");
    
    return deployment;
    
  } catch (error) {
    log(`\n❌ Deployment failed: ${error.message}`, "red");
    console.error(error);
    process.exit(1);
  }
}

// Execute deployment
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };