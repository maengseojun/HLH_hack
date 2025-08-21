// scripts/deploy-testnet.js
/**
 * 🚀 HyperEVM Testnet Deployment Script
 * 
 * Deploys the complete HyperIndex AMM system to HyperEVM testnet:
 * 1. HYPERINDEX Token
 * 2. Mock USDC Token (for testing)
 * 3. AMM Factory
 * 4. AMM Router
 * 5. Creates initial liquidity pool
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting HyperEVM Testnet Deployment...\n");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  
  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "HYPE");
  
  if (balance < ethers.parseEther("0.1")) {
    console.error("❌ Insufficient balance! Need at least 0.1 HYPE for deployment");
    console.log("💡 Get testnet HYPE from: https://faucet.hyperliquid-testnet.xyz");
    process.exit(1);
  }
  
  console.log("\n" + "=".repeat(50));
  
  const deployedContracts = {};
  
  try {
    // 1. Deploy HYPERINDEX Token
    console.log("🔥 1. Deploying HYPERINDEX Token...");
    const HyperIndexToken = await ethers.getContractFactory("HyperIndexToken");
    const hyperIndexToken = await HyperIndexToken.deploy();
    await hyperIndexToken.waitForDeployment();
    
    const hyperIndexAddress = await hyperIndexToken.getAddress();
    deployedContracts.HYPERINDEX_TOKEN = hyperIndexAddress;
    console.log("✅ HYPERINDEX Token deployed to:", hyperIndexAddress);
    
    // Check initial supply
    const totalSupply = await hyperIndexToken.totalSupply();
    console.log("📊 Total Supply:", ethers.formatEther(totalSupply), "HYPERINDEX");
    
    // 2. Deploy Mock USDC Token (for testnet)
    console.log("\n🔥 2. Deploying Mock USDC Token...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    
    const usdcAddress = await mockUSDC.getAddress();
    deployedContracts.USDC_TOKEN = usdcAddress;
    console.log("✅ Mock USDC deployed to:", usdcAddress);
    
    // 3. Deploy AMM Factory
    console.log("\n🔥 3. Deploying AMM Factory...");
    const HyperIndexFactory = await ethers.getContractFactory("HyperIndexFactory");
    const factory = await HyperIndexFactory.deploy(deployer.address); // fee_to_setter
    await factory.waitForDeployment();
    
    const factoryAddress = await factory.getAddress();
    deployedContracts.AMM_FACTORY = factoryAddress;
    console.log("✅ AMM Factory deployed to:", factoryAddress);
    
    // 4. Deploy AMM Router
    console.log("\n🔥 4. Deploying AMM Router...");
    const HyperIndexRouter = await ethers.getContractFactory("HyperIndexRouter");
    const router = await HyperIndexRouter.deploy(factoryAddress);
    await router.waitForDeployment();
    
    const routerAddress = await router.getAddress();
    deployedContracts.AMM_ROUTER = routerAddress;
    console.log("✅ AMM Router deployed to:", routerAddress);
    
    // 5. Create Initial Liquidity Pool
    console.log("\n🔥 5. Creating HYPERINDEX-USDC Liquidity Pool...");
    
    // Approve tokens for router
    const hyperIndexAmount = ethers.parseEther("1000000"); // 1M HYPERINDEX
    const usdcAmount = ethers.parseUnits("1000000", 6); // 1M USDC (6 decimals)
    
    console.log("📝 Approving tokens for router...");
    const approveTx1 = await hyperIndexToken.approve(routerAddress, hyperIndexAmount);
    await approveTx1.wait();
    console.log("✅ HYPERINDEX approved");
    
    const approveTx2 = await mockUSDC.approve(routerAddress, usdcAmount);
    await approveTx2.wait();
    console.log("✅ USDC approved");
    
    // Add initial liquidity
    console.log("💧 Adding initial liquidity...");
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
    
    const addLiquidityTx = await router.addLiquidity(
      hyperIndexAddress,
      usdcAddress,
      hyperIndexAmount,
      usdcAmount,
      0, // min amounts (0 for initial liquidity)
      0,
      deployer.address,
      deadline
    );
    
    console.log("⏳ Waiting for liquidity transaction...");
    const receipt = await addLiquidityTx.wait();
    console.log("✅ Initial liquidity added! Gas used:", receipt.gasUsed.toString());
    
    // Get pair address
    const pairAddress = await factory.getPair(hyperIndexAddress, usdcAddress);
    deployedContracts.HYPERINDEX_USDC_PAIR = pairAddress;
    console.log("🌊 Liquidity Pair created at:", pairAddress);
    
    // 6. Deploy Settlement Contract
    console.log("\n🔥 6. Deploying Settlement Contract...");
    const HyperIndexSettlement = await ethers.getContractFactory("HyperIndexSettlement");
    const settlement = await HyperIndexSettlement.deploy(deployer.address); // fee recipient
    await settlement.waitForDeployment();
    
    const settlementAddress = await settlement.getAddress();
    deployedContracts.SETTLEMENT = settlementAddress;
    console.log("✅ Settlement Contract deployed to:", settlementAddress);
    
    // Add supported tokens to settlement
    console.log("📝 Configuring settlement contract...");
    await settlement.addToken(hyperIndexAddress);
    await settlement.addToken(usdcAddress);
    console.log("✅ Tokens added to settlement contract");
    
    // 6. Verify deployment
    console.log("\n🔍 Verifying deployment...");
    const pair = await ethers.getContractAt("HyperIndexPair", pairAddress);
    const reserves = await pair.getReserves();
    console.log("📊 Pool Reserves:");
    console.log("  - Reserve 0:", ethers.formatUnits(reserves[0], 18));
    console.log("  - Reserve 1:", ethers.formatUnits(reserves[1], 6));
    console.log("  - Last Update:", new Date(Number(reserves[2]) * 1000).toLocaleString());
    
    // 7. Save deployment info
    console.log("\n💾 Saving deployment information...");
    const deploymentInfo = {
      network: "hypervm-testnet",
      chainId: 998,
      deployer: deployer.address,
      deployedAt: new Date().toISOString(),
      blockNumber: receipt.blockNumber,
      contracts: deployedContracts,
      initialLiquidity: {
        hyperIndex: ethers.formatEther(hyperIndexAmount),
        usdc: ethers.formatUnits(usdcAmount, 6)
      },
      gasUsed: {
        deployment: "Estimated ~0.05 HYPE",
        addLiquidity: receipt.gasUsed.toString()
      }
    };
    
    // Save to file
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const deploymentFile = path.join(deploymentsDir, "hypervm-testnet.json");
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log("📄 Deployment info saved to:", deploymentFile);
    
    // Generate environment variables
    console.log("\n🔧 Environment Variables for .env.local:");
    console.log("=" * 50);
    console.log(`NEXT_PUBLIC_HYPERINDEX_TOKEN_ADDRESS=${deployedContracts.HYPERINDEX_TOKEN}`);
    console.log(`NEXT_PUBLIC_USDC_TOKEN_ADDRESS=${deployedContracts.USDC_TOKEN}`);
    console.log(`NEXT_PUBLIC_AMM_FACTORY_ADDRESS=${deployedContracts.AMM_FACTORY}`);
    console.log(`NEXT_PUBLIC_AMM_ROUTER_ADDRESS=${deployedContracts.AMM_ROUTER}`);
    console.log(`NEXT_PUBLIC_HYPERINDEX_USDC_PAIR=${deployedContracts.HYPERINDEX_USDC_PAIR}`);
    console.log(`NEXT_PUBLIC_SETTLEMENT_ADDRESS=${deployedContracts.SETTLEMENT}`);
    
    // Generate .env.local update script
    const envUpdate = `
# Add these to your .env.local file:
NEXT_PUBLIC_HYPERINDEX_TOKEN_ADDRESS=${deployedContracts.HYPERINDEX_TOKEN}
NEXT_PUBLIC_USDC_TOKEN_ADDRESS=${deployedContracts.USDC_TOKEN}
NEXT_PUBLIC_AMM_FACTORY_ADDRESS=${deployedContracts.AMM_FACTORY}
NEXT_PUBLIC_AMM_ROUTER_ADDRESS=${deployedContracts.AMM_ROUTER}
NEXT_PUBLIC_HYPERINDEX_USDC_PAIR=${deployedContracts.HYPERINDEX_USDC_PAIR}
NEXT_PUBLIC_SETTLEMENT_ADDRESS=${deployedContracts.SETTLEMENT}
`;
    
    fs.writeFileSync(path.join(__dirname, "../.env.deployment"), envUpdate);
    
    console.log("\n🎉 Deployment Completed Successfully!");
    console.log("=" * 50);
    console.log("📝 Next Steps:");
    console.log("1. Update your .env.local with the contract addresses above");
    console.log("2. Get testnet tokens from the faucet");
    console.log("3. Test the AMM functionality");
    console.log("4. Start the Next.js app and connect your wallet");
    console.log("\n🔗 Useful Links:");
    console.log(`- Explorer: https://explorer.hyperliquid-testnet.xyz/address/${deployedContracts.AMM_FACTORY}`);
    console.log(`- HYPERINDEX Token: https://explorer.hyperliquid-testnet.xyz/address/${deployedContracts.HYPERINDEX_TOKEN}`);
    console.log(`- Liquidity Pool: https://explorer.hyperliquid-testnet.xyz/address/${deployedContracts.HYPERINDEX_USDC_PAIR}`);
    
  } catch (error) {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
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