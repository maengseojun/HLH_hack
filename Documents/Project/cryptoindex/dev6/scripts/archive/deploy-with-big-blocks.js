// scripts/deploy-with-big-blocks.js
/**
 * Deploy to HyperEVM using Big Blocks (30M gas limit)
 * Created: 2025-08-11
 */

const { ethers } = require("hardhat");
const { execSync } = require("child_process");

async function switchToBigBlocks() {
  console.log("🔄 Switching to Big Blocks (30M gas limit)...");
  
  try {
    // Method 1: Try using LayerZero Hyperliquid Composer
    if (process.env.PRIVATE_KEY) {
      const command = `npx @layerzerolabs/hyperliquid-composer set-block --size big --network testnet --private-key ${process.env.PRIVATE_KEY}`;
      console.log("Executing:", command.replace(process.env.PRIVATE_KEY, "***"));
      
      try {
        execSync(command, { stdio: 'inherit' });
        console.log("✅ Switched to Big Blocks successfully!");
        return true;
      } catch (error) {
        console.log("⚠️ LayerZero method failed, please switch manually");
      }
    }
    
    // Method 2: Manual instruction
    console.log("\n📝 Please switch to Big Blocks manually:");
    console.log("1. Visit HyperEVM Block Toggle UI");
    console.log("2. Connect your wallet");
    console.log("3. Switch to 'Big Blocks' mode");
    console.log("4. Wait for confirmation");
    console.log("\nPress Enter when ready to continue...");
    
    // Wait for user confirmation
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
    return true;
  } catch (error) {
    console.error("❌ Failed to switch blocks:", error.message);
    return false;
  }
}

async function deployContracts() {
  console.log("\n🚀 Deploying HyperIndex AMM to HyperEVM (Big Blocks)...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "HYPE");
  
  // Check current block info
  const block = await deployer.provider.getBlock("latest");
  console.log("\n📊 Current Block Info:");
  console.log("- Number:", block.number);
  console.log("- Gas Limit:", block.gasLimit.toString());
  console.log("- Is Big Block:", block.gasLimit > 3000000 ? "YES ✅" : "NO ❌");
  
  if (block.gasLimit < 3000000) {
    console.error("\n❌ Still on Small Blocks! Please switch to Big Blocks first.");
    return null;
  }
  
  try {
    // Deploy Factory
    console.log("\n📦 Deploying HyperIndexFactory...");
    const HyperIndexFactory = await ethers.getContractFactory("HyperIndexFactory");
    const factory = await HyperIndexFactory.deploy(deployer.address, {
      gasLimit: 5000000 // Use 5M gas for safety
    });
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("✅ Factory deployed to:", factoryAddress);
    
    // Deploy Router (optional - can be done in separate transaction)
    console.log("\n📦 Deploying HyperIndexRouter...");
    const WHYPE = "0x0000000000000000000000000000000000000000"; // Need actual WHYPE address
    const HyperIndexRouter = await ethers.getContractFactory("HyperIndexRouter");
    const router = await HyperIndexRouter.deploy(factoryAddress, WHYPE, {
      gasLimit: 5000000
    });
    await router.waitForDeployment();
    const routerAddress = await router.getAddress();
    console.log("✅ Router deployed to:", routerAddress);
    
    // Save deployment info
    const deploymentInfo = {
      network: "hypervm-testnet",
      chainId: 998,
      blockType: "BIG_BLOCKS",
      contracts: {
        factory: factoryAddress,
        router: routerAddress,
      },
      deployer: deployer.address,
      deploymentTime: new Date().toISOString(),
      blockNumber: block.number
    };
    
    console.log("\n📄 Deployment Summary:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    const fs = require('fs').promises;
    await fs.writeFile(
      'deployment-big-blocks.json',
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log("\n🎉 Deployment successful!");
    console.log("\n⚠️ Remember to switch back to Small Blocks for regular transactions!");
    
    return deploymentInfo;
    
  } catch (error) {
    console.error("\n❌ Deployment failed:", error.message);
    throw error;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("HyperEVM Big Blocks Deployment Script");
  console.log("=".repeat(60));
  
  // Step 1: Switch to Big Blocks
  const switched = await switchToBigBlocks();
  if (!switched) {
    console.error("Failed to switch to Big Blocks");
    process.exit(1);
  }
  
  // Step 2: Deploy contracts
  const deployment = await deployContracts();
  if (!deployment) {
    console.error("Deployment failed");
    process.exit(1);
  }
  
  // Step 3: Remind to switch back
  console.log("\n" + "=".repeat(60));
  console.log("⚠️ IMPORTANT: Switch back to Small Blocks for normal operations!");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });