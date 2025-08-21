const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting HyperIndex AMM deployment on HyperEVM...");
  
  const [deployer] = await ethers.getSigners();
  console.log(`📝 Deploying with account: ${deployer.address}`);
  
  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`💰 Account balance: ${ethers.formatEther(balance)} HYPE`);
  
  if (balance < ethers.parseEther("0.1")) {
    console.warn("⚠️  Low balance! You may need more HYPE for deployment.");
  }

  const deployments = {};
  const network = hre.network.name;
  
  try {
    // 1. Deploy HyperIndexFactory
    console.log("\n📦 Deploying HyperIndexFactory...");
    const HyperIndexFactory = await ethers.getContractFactory("HyperIndexFactory");
    const factory = await HyperIndexFactory.deploy(deployer.address);
    await factory.waitForDeployment();
    
    const factoryAddress = await factory.getAddress();
    console.log(`✅ HyperIndexFactory deployed to: ${factoryAddress}`);
    deployments.factory = factoryAddress;

    // 2. Deploy HyperIndexRouter
    console.log("\n📦 Deploying HyperIndexRouter...");
    const HyperIndexRouter = await ethers.getContractFactory("HyperIndexRouter");
    
    // WETH address - HyperEVM의 Wrapped HYPE 주소 (추후 확인 필요)
    const WHYPE_ADDRESS = process.env.WHYPE_ADDRESS || "0x0000000000000000000000000000000000000000";
    
    const router = await HyperIndexRouter.deploy(factoryAddress, WHYPE_ADDRESS);
    await router.waitForDeployment();
    
    const routerAddress = await router.getAddress();
    console.log(`✅ HyperIndexRouter deployed to: ${routerAddress}`);
    deployments.router = routerAddress;
    deployments.whype = WHYPE_ADDRESS;

    // 3. Deploy test tokens if on testnet
    if (network.includes("testnet")) {
      console.log("\n📦 Deploying test tokens...");
      
      // Deploy mock USDC
      const MockERC20 = await ethers.getContractFactory("HyperIndexToken");
      
      const mockUSDC = await MockERC20.deploy(
        "USD Coin",
        "USDC",
        6, // 6 decimals for USDC
        ethers.parseUnits("1000000", 6) // 1M USDC
      );
      await mockUSDC.waitForDeployment();
      
      const usdcAddress = await mockUSDC.getAddress();
      console.log(`✅ Mock USDC deployed to: ${usdcAddress}`);
      deployments.mockUSDC = usdcAddress;
      
      // Deploy mock HYPERINDEX token
      const mockHYPERINDEX = await MockERC20.deploy(
        "HyperIndex Token",
        "HYPERINDEX",
        18, // 18 decimals
        ethers.parseUnits("10000000", 18) // 10M HYPERINDEX
      );
      await mockHYPERINDEX.waitForDeployment();
      
      const hyperindexAddress = await mockHYPERINDEX.getAddress();
      console.log(`✅ Mock HYPERINDEX deployed to: ${hyperindexAddress}`);
      deployments.mockHYPERINDEX = hyperindexAddress;

      // 4. Create initial liquidity pool
      console.log("\n🏊 Creating HYPERINDEX/USDC pair...");
      
      const factoryContract = await ethers.getContractAt("HyperIndexFactory", factoryAddress);
      const createPairTx = await factoryContract.createPair(hyperindexAddress, usdcAddress);
      await createPairTx.wait();
      
      const pairAddress = await factoryContract.getPair(hyperindexAddress, usdcAddress);
      console.log(`✅ HYPERINDEX/USDC pair created at: ${pairAddress}`);
      deployments.hyperindexUsdcPair = pairAddress;

      // 5. Add initial liquidity
      console.log("\n💧 Adding initial liquidity...");
      
      // Approve tokens for router
      const usdcContract = await ethers.getContractAt("HyperIndexToken", usdcAddress);
      const hyperindexContract = await ethers.getContractAt("HyperIndexToken", hyperindexAddress);
      
      const usdcAmount = ethers.parseUnits("10000", 6); // 10,000 USDC
      const hyperindexAmount = ethers.parseUnits("10000", 18); // 10,000 HYPERINDEX (1:1 ratio)
      
      console.log("📝 Approving tokens...");
      await usdcContract.approve(routerAddress, usdcAmount);
      await hyperindexContract.approve(routerAddress, hyperindexAmount);
      
      console.log("📝 Adding liquidity...");
      const routerContract = await ethers.getContractAt("HyperIndexRouter", routerAddress);
      
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes from now
      const addLiquidityTx = await routerContract.addLiquidity(
        hyperindexAddress,
        usdcAddress,
        hyperindexAmount,
        usdcAmount,
        ethers.parseUnits("9000", 18), // min HYPERINDEX (90% slippage tolerance)
        ethers.parseUnits("9000", 6),  // min USDC
        deployer.address,
        deadline
      );
      
      await addLiquidityTx.wait();
      console.log("✅ Initial liquidity added successfully!");
      
      // Get LP token balance
      const pairContract = await ethers.getContractAt("HyperIndexPair", pairAddress);
      const lpBalance = await pairContract.balanceOf(deployer.address);
      console.log(`💎 LP tokens received: ${ethers.formatEther(lpBalance)}`);
    }

    // Save deployment info
    const deploymentInfo = {
      network,
      chainId: (await deployer.provider.getNetwork()).chainId.toString(),
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: deployments,
      gasUsed: "To be calculated", // 실제로는 각 트랜잭션의 가스 사용량 합계
    };

    // Save to file
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const filename = `${network}-${Date.now()}.json`;
    const filepath = path.join(deploymentsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n📄 Deployment info saved to: ${filepath}`);

    // Update .env.local template
    console.log("\n📋 Environment variables for .env.local:");
    console.log(`NEXT_PUBLIC_HYPERINDEX_FACTORY_ADDRESS=${deployments.factory}`);
    console.log(`NEXT_PUBLIC_HYPERINDEX_ROUTER_ADDRESS=${deployments.router}`);
    if (deployments.mockUSDC) {
      console.log(`NEXT_PUBLIC_USDC_ADDRESS=${deployments.mockUSDC}`);
      console.log(`NEXT_PUBLIC_HYPERINDEX_ADDRESS=${deployments.mockHYPERINDEX}`);
      console.log(`NEXT_PUBLIC_HYPERINDEX_USDC_PAIR=${deployments.hyperindexUsdcPair}`);
    }

    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("1. Add the environment variables above to your .env.local file");
    console.log("2. Update your frontend to use these contract addresses");
    console.log("3. Test the AMM functionality with the deployed contracts");

  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  }
}

// Helper function to estimate gas costs
async function estimateGasCosts() {
  const gasPrice = await ethers.provider.getGasPrice();
  console.log(`⛽ Current gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
  
  // Estimated gas usage for deployment
  const estimatedGas = {
    factory: 3000000,
    router: 4000000,
    tokens: 2000000,
    pair: 1000000,
    liquidity: 500000
  };
  
  const totalGas = Object.values(estimatedGas).reduce((a, b) => a + b, 0);
  const totalCost = gasPrice * BigInt(totalGas);
  
  console.log(`💰 Estimated total deployment cost: ${ethers.formatEther(totalCost)} HYPE`);
  
  return totalCost;
}

// Run the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });