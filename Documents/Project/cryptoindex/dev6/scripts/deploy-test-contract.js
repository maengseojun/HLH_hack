// scripts/deploy-test-contract.js
/**
 * Deploy simple test contract to HyperEVM testnet
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying Test Contract to HyperEVM Testnet\n");
  
  try {
    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📤 Deploying with account:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(balance), "HYPE");
    
    if (parseFloat(ethers.formatEther(balance)) === 0) {
      console.log("❌ Insufficient balance for deployment");
      console.log("💡 Get testnet tokens from: https://faucet.hyperliquid-testnet.xyz");
      return;
    }
    
    // Deploy test contract
    console.log("\n📦 Deploying TestContract...");
    const TestContract = await ethers.getContractFactory("TestContract");
    
    console.log("⏳ Deployment in progress...");
    const testContract = await TestContract.deploy();
    
    console.log("⌛ Waiting for confirmation...");
    await testContract.waitForDeployment();
    
    const contractAddress = await testContract.getAddress();
    console.log("✅ TestContract deployed to:", contractAddress);
    
    // Test contract functionality
    console.log("\n🧪 Testing contract functionality...");
    
    // Test getValue
    const initialValue = await testContract.getValue();
    console.log("📊 Initial value:", initialValue.toString());
    
    // Test setValue
    console.log("📝 Setting new value to 100...");
    const tx = await testContract.setValue(100);
    console.log("📋 Transaction hash:", tx.hash);
    
    console.log("⌛ Waiting for transaction confirmation...");
    await tx.wait();
    
    // Verify new value
    const newValue = await testContract.getValue();
    console.log("✅ New value:", newValue.toString());
    
    // Test getOwner
    const owner = await testContract.getOwner();
    console.log("👤 Contract owner:", owner);
    
    console.log("\n🎉 Test deployment completed successfully!");
    console.log("📊 Contract Details:");
    console.log("   Address:", contractAddress);
    console.log("   Owner:", owner);
    console.log("   Current Value:", newValue.toString());
    
    // Gas usage summary
    const deploymentReceipt = await ethers.provider.getTransactionReceipt(testContract.deploymentTransaction().hash);
    const setValueReceipt = await ethers.provider.getTransactionReceipt(tx.hash);
    
    console.log("\n⛽ Gas Usage Summary:");
    console.log("   Deployment Gas:", deploymentReceipt.gasUsed.toString());
    console.log("   setValue Gas:", setValueReceipt.gasUsed.toString());
    
    console.log("\n💡 HyperEVM testnet is ready for full system deployment!");
    
  } catch (error) {
    console.error("\n❌ Deployment failed:");
    console.error("Error:", error.message);
    
    if (error.message.includes("insufficient funds")) {
      console.log("\n💡 Solution: Get testnet HYPE tokens");
      console.log("   Faucet: https://faucet.hyperliquid-testnet.xyz");
    }
    
    if (error.message.includes("nonce")) {
      console.log("\n💡 Solution: Wait and retry deployment");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });