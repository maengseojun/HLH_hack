// scripts/deploy-router.js
/**
 * Deploy HyperIndexRouter to HyperEVM Testnet
 * Created: 2025-08-11
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying HyperIndexRouter to HyperEVM Testnet...");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Factory address (update this after factory deployment)
  const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS;
  if (!FACTORY_ADDRESS) {
    throw new Error("❌ FACTORY_ADDRESS environment variable required");
  }

  // WHYPE address on HyperEVM (Wrapped HYPE)
  const WHYPE_ADDRESS = process.env.WHYPE_ADDRESS || "0x0000000000000000000000000000000000000000";
  if (WHYPE_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.log("⚠️ Using zero address for WHYPE - update if WHYPE is available");
  }

  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "HYPE");

  // Verify factory exists
  const factoryCode = await deployer.provider.getCode(FACTORY_ADDRESS);
  if (factoryCode === '0x') {
    throw new Error(`❌ No factory contract found at ${FACTORY_ADDRESS}`);
  }

  // Deploy Router
  console.log("\n📦 Deploying HyperIndexRouter...");
  console.log("Factory address:", FACTORY_ADDRESS);
  console.log("WHYPE address:", WHYPE_ADDRESS);
  
  const HyperIndexRouter = await ethers.getContractFactory("HyperIndexRouter");
  const router = await HyperIndexRouter.deploy(FACTORY_ADDRESS, WHYPE_ADDRESS);
  
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();

  console.log("✅ HyperIndexRouter deployed to:", routerAddress);
  
  // Verify deployment
  const codeSize = await deployer.provider.getCode(routerAddress);
  if (codeSize === '0x') {
    throw new Error("❌ Router deployment failed - no code at address");
  }

  // Test basic functionality
  console.log("\n🧪 Testing Router functionality...");
  
  const factoryFromRouter = await router.factory();
  console.log("Router's factory address:", factoryFromRouter);
  
  if (factoryFromRouter.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) {
    throw new Error("❌ Router factory address mismatch");
  }

  const whypeFromRouter = await router.WHYPE();
  console.log("Router's WHYPE address:", whypeFromRouter);

  // Test quote function with dummy values
  try {
    const quote = await router.quote(
      ethers.parseEther("100"), // 100 tokens
      ethers.parseEther("1000"), // 1000 reserve A
      ethers.parseEther("1000")  // 1000 reserve B
    );
    console.log("Quote test result:", ethers.formatEther(quote));
  } catch (error) {
    console.log("⚠️ Quote test failed (expected if no pairs exist):", error.message);
  }

  // Save deployment info
  const deploymentInfo = {
    network: "hypervm-testnet",
    chainId: 998,
    router: {
      address: routerAddress,
      factory: FACTORY_ADDRESS,
      whype: WHYPE_ADDRESS,
      deployer: deployer.address,
      deploymentTime: new Date().toISOString(),
      transactionHash: router.deploymentTransaction().hash
    }
  };

  console.log("\n📄 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Update config file hint
  console.log("\n⚙️ Next Steps:");
  console.log("1. Update HYPERVM_TESTNET_CONFIG.contracts.router with:", routerAddress);
  console.log("2. Run: npx hardhat run scripts/deploy-token.js --network hypervm-testnet");
  
  return routerAddress;
}

main()
  .then((address) => {
    console.log(`\n🎉 Router deployment completed: ${address}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });