// scripts/deploy-factory.js
/**
 * Deploy HyperIndexFactory to HyperEVM Testnet
 * Created: 2025-08-11
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying HyperIndexFactory to HyperEVM Testnet...");
  
  // Debug: Check if PRIVATE_KEY exists
  if (!process.env.PRIVATE_KEY) {
    console.error("❌ PRIVATE_KEY not found in environment variables");
    console.error("Please ensure your .env file contains: PRIVATE_KEY=your_private_key_here");
    process.exit(1);
  }

  // Get deployer account
  const signers = await ethers.getSigners();
  
  if (!signers || signers.length === 0) {
    throw new Error("No signers available. Please check your PRIVATE_KEY in .env file");
  }
  
  const deployer = signers[0];
  
  if (!deployer || !deployer.address) {
    throw new Error("Invalid deployer account. Please check your configuration");
  }
  
  console.log("Deploying with account:", deployer.address);

  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "HYPE");

  if (balance < ethers.parseEther("0.1")) {
    throw new Error("❌ Insufficient HYPE balance for deployment");
  }

  // Deploy Factory
  console.log("\n📦 Deploying HyperIndexFactory...");
  
  const HyperIndexFactory = await ethers.getContractFactory("HyperIndexFactory");
  const factory = await HyperIndexFactory.deploy(deployer.address); // feeToSetter
  
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log("✅ HyperIndexFactory deployed to:", factoryAddress);
  
  // Verify deployment
  const codeSize = await deployer.provider.getCode(factoryAddress);
  if (codeSize === '0x') {
    throw new Error("❌ Factory deployment failed - no code at address");
  }

  // Test basic functionality
  console.log("\n🧪 Testing Factory functionality...");
  
  const allPairsLength = await factory.allPairsLength();
  console.log("Initial pairs count:", allPairsLength.toString());
  
  const owner = await factory.owner();
  console.log("Factory owner:", owner);

  // Save deployment info
  const deploymentInfo = {
    network: "hypervm-testnet",
    chainId: 998,
    factory: {
      address: factoryAddress,
      deployer: deployer.address,
      deploymentTime: new Date().toISOString(),
      transactionHash: factory.deploymentTransaction?.hash || "N/A"
    }
  };

  console.log("\n📄 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Update config file hint
  console.log("\n⚙️ Next Steps:");
  console.log("1. Update HYPERVM_TESTNET_CONFIG.contracts.factory with:", factoryAddress);
  console.log("2. Run: npx hardhat run scripts/deploy-router.js --network hypervm-testnet");
  
  return factoryAddress;
}

main()
  .then((address) => {
    console.log(`\n🎉 Factory deployment completed: ${address}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });