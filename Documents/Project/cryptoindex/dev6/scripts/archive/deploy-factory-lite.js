// scripts/deploy-factory-lite.js
/**
 * Deploy HyperIndexFactoryLite to HyperEVM Testnet (Gas Optimized)
 * Created: 2025-08-11
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying HyperIndex contracts to HyperEVM Testnet (Gas Optimized)...");
  
  // Check if PRIVATE_KEY exists
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

  try {
    // Step 1: Deploy HyperIndexPair implementation
    console.log("\n📦 Step 1: Deploying HyperIndexPair implementation...");
    const HyperIndexPair = await ethers.getContractFactory("HyperIndexPair");
    const pairImplementation = await HyperIndexPair.deploy();
    await pairImplementation.waitForDeployment();
    const pairImplAddress = await pairImplementation.getAddress();
    console.log("✅ HyperIndexPair implementation deployed to:", pairImplAddress);

    // Step 2: Deploy Factory Lite
    console.log("\n📦 Step 2: Deploying HyperIndexFactoryLite...");
    const HyperIndexFactoryLite = await ethers.getContractFactory("HyperIndexFactoryLite");
    const factory = await HyperIndexFactoryLite.deploy(deployer.address);
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("✅ HyperIndexFactoryLite deployed to:", factoryAddress);

    // Step 3: Set pair implementation in factory
    console.log("\n🔧 Step 3: Setting pair implementation in factory...");
    const tx = await factory.setPairImplementation(pairImplAddress);
    await tx.wait();
    console.log("✅ Pair implementation set successfully");

    // Verify deployment
    console.log("\n🧪 Testing Factory functionality...");
    
    const allPairsLength = await factory.allPairsLength();
    console.log("Initial pairs count:", allPairsLength.toString());
    
    const owner = await factory.owner();
    console.log("Factory owner:", owner);
    
    const pairImpl = await factory.pairImplementation();
    console.log("Pair implementation:", pairImpl);

    // Save deployment info
    const deploymentInfo = {
      network: "hypervm-testnet",
      chainId: 998,
      contracts: {
        factory: factoryAddress,
        pairImplementation: pairImplAddress,
      },
      deployer: deployer.address,
      deploymentTime: new Date().toISOString()
    };

    console.log("\n📄 Deployment Summary:");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    // Save to file
    const fs = require('fs').promises;
    await fs.writeFile(
      'deployment-info.json',
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("✅ Deployment info saved to deployment-info.json");

    console.log("\n⚙️ Next Steps:");
    console.log("1. Deploy Router with factory address:", factoryAddress);
    console.log("2. Run: pnpx hardhat run scripts/deploy-router.js --network hypervm-testnet");
    
    return { factoryAddress, pairImplAddress };
    
  } catch (error) {
    console.error("\n❌ Deployment failed:", error.message);
    
    // Check if it's a gas issue
    if (error.message.includes("gas")) {
      console.log("\n💡 Suggestion: Try reducing contract size or increasing gas limit");
    }
    
    throw error;
  }
}

main()
  .then(({ factoryAddress, pairImplAddress }) => {
    console.log(`\n🎉 Deployment completed successfully!`);
    console.log(`Factory: ${factoryAddress}`);
    console.log(`Pair Implementation: ${pairImplAddress}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });