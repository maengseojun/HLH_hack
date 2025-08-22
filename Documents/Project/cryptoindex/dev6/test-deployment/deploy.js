// test-deployment/deploy.js
/**
 * Simple deployment script for HyperEVM testnet testing
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 HyperEVM Testnet Deployment Test\n");
  
  try {
    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log("🌐 Network:", network.chainId.toString());
    
    // Get deployer
    const [deployer] = await ethers.getSigners();
    console.log("👤 Deployer:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Balance:", ethers.formatEther(balance), "HYPE");
    
    if (parseFloat(ethers.formatEther(balance)) < 0.001) {
      console.log("❌ Insufficient balance");
      console.log("💡 Get testnet HYPE from: https://faucet.hyperliquid-testnet.xyz");
      return;
    }
    
    // Deploy
    console.log("\n📦 Deploying TestContract...");
    const TestContract = await ethers.getContractFactory("TestContract");
    const contract = await TestContract.deploy();
    
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    
    console.log("✅ Contract deployed to:", address);
    
    // Test functionality
    console.log("\n🧪 Testing contract...");
    const value = await contract.getValue();
    console.log("📊 Initial value:", value.toString());
    
    const tx = await contract.setValue(123);
    await tx.wait();
    
    const newValue = await contract.getValue();
    console.log("✅ New value:", newValue.toString());
    
    console.log("\n🎉 HyperEVM testnet deployment successful!");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });