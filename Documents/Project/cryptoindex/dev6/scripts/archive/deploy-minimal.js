// scripts/deploy-minimal.js
/**
 * Deploy Minimal AMM to HyperEVM Testnet
 * Created: 2025-08-11
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying Minimal AMM to HyperEVM Testnet...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "HYPE");
  
  try {
    // Deploy Minimal Factory
    console.log("\n📦 Deploying MinimalFactory...");
    const MinimalFactory = await ethers.getContractFactory("MinimalFactory");
    const factory = await MinimalFactory.deploy();
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("✅ MinimalFactory deployed to:", factoryAddress);
    
    // Test pair creation
    console.log("\n🧪 Testing pair creation...");
    const token0 = "0x0000000000000000000000000000000000000001"; // Dummy address
    const token1 = "0x0000000000000000000000000000000000000002"; // Dummy address
    
    const tx = await factory.createPair(token0, token1);
    await tx.wait();
    
    const pairAddress = await factory.getPair(token0, token1);
    console.log("✅ Test pair created at:", pairAddress);
    
    const pairsCount = await factory.allPairsLength();
    console.log("Total pairs:", pairsCount.toString());
    
    console.log("\n🎉 Deployment successful!");
    console.log("Factory address:", factoryAddress);
    
    // Save deployment
    const fs = require('fs').promises;
    await fs.writeFile(
      'minimal-deployment.json',
      JSON.stringify({
        factory: factoryAddress,
        network: "hypervm-testnet",
        deployer: deployer.address,
        timestamp: new Date().toISOString()
      }, null, 2)
    );
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.message.includes("gas")) {
      console.log("Still too big for HyperEVM's 2M gas limit");
    }
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  });