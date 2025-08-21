// scripts/test-deploy.js
/**
 * Test simple deployment to HyperEVM Testnet
 * Created: 2025-08-11
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Testing simple deployment to HyperEVM Testnet...");
  
  try {
    // Get deployer
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    
    // Check balance
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "HYPE");
    
    // Get network info
    const network = await deployer.provider.getNetwork();
    console.log("Network:", {
      chainId: network.chainId.toString(),
      name: network.name
    });
    
    // Deploy simple contract
    console.log("\n📦 Deploying TestSimple contract...");
    const TestSimple = await ethers.getContractFactory("TestSimple");
    
    // Try with explicit gas settings
    const gasPrice = await deployer.provider.getFeeData();
    console.log("Gas Price:", gasPrice.gasPrice?.toString());
    
    const deployTx = await TestSimple.deploy({
      gasLimit: 500000, // Set explicit gas limit
      gasPrice: gasPrice.gasPrice
    });
    
    console.log("Deployment transaction sent...");
    await deployTx.waitForDeployment();
    
    const address = await deployTx.getAddress();
    console.log("✅ TestSimple deployed to:", address);
    
    // Test the contract
    console.log("\n🧪 Testing contract functions...");
    await deployTx.setValue(42);
    const value = await deployTx.getValue();
    console.log("Value set and retrieved:", value.toString());
    
    console.log("\n✅ Deployment test successful!");
    
  } catch (error) {
    console.error("\n❌ Error details:");
    console.error("Message:", error.message);
    console.error("Code:", error.code);
    
    if (error.error) {
      console.error("Inner error:", error.error);
    }
    
    if (error.transaction) {
      console.error("Transaction:", error.transaction);
    }
    
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });