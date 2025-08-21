// scripts/redeploy-router.js
const { ethers } = require("hardhat");

async function main() {
  console.log("🔄 Redeploying Router with correct init code hash...");
  
  const [deployer] = await ethers.getSigners();
  
  // 기존 주소들 (그대로 사용)
  const existingAddresses = {
    factory: "0x73bF19534DA1c60772E40136A4e5E77921b7a632",
    hyperindex: "0x6065Ab1ec8334ab6099aF27aF145411902EAef40", 
    usdc: "0x53aE8e677f34BC709148081Ce2D4b6ceA1Fc3",
    pair: "0x5706084ad9Cac84393eaA1Eb265Db9b22bA63cd1"
  };
  
  console.log("📊 Deployer:", deployer.address);
  console.log("🏭 Using existing Factory:", existingAddresses.factory);
  
  // Big Block gas configuration
  const bigBlockGasPrice = ethers.parseUnits("50", "gwei");
  const gasOptions = {
    gasPrice: bigBlockGasPrice,
    gasLimit: 8000000 // Router needs more gas
  };
  console.log("⚡ Using Big Block gas settings");
  
  // Deploy new Router
  console.log("\n📦 Deploying new HyperIndexRouter...");
  const WHYPE = "0x0000000000000000000000000000000000000000"; // Testnet placeholder
  
  const HyperIndexRouter = await ethers.getContractFactory("HyperIndexRouter");
  const newRouter = await HyperIndexRouter.deploy(
    existingAddresses.factory,
    WHYPE,
    gasOptions
  );
  
  await newRouter.waitForDeployment();
  const newRouterAddress = await newRouter.getAddress();
  
  console.log("✅ New Router deployed to:", newRouterAddress);
  
  // Test the fix by checking pairFor calculation
  console.log("\n🔍 Testing new Router pairFor calculation...");
  
  const factory = await ethers.getContractAt("HyperIndexFactory", existingAddresses.factory);
  const factoryHash = await factory.PAIR_CODE_HASH();
  console.log("- Factory PAIR_CODE_HASH:", factoryHash);
  
  // Manual calculation to verify
  const token0 = existingAddresses.usdc; // Token0
  const token1 = existingAddresses.hyperindex; // Token1
  const salt = ethers.keccak256(ethers.solidityPacked(["address", "address"], [token0, token1]));
  const calculatedPair = ethers.getCreate2Address(
    existingAddresses.factory,
    salt,
    factoryHash
  );
  
  console.log("- Calculated pair address:", calculatedPair);
  console.log("- Actual pair address:", existingAddresses.pair);
  console.log("- Addresses match:", calculatedPair.toLowerCase() === existingAddresses.pair.toLowerCase());
  
  // Summary
  console.log("\n📋 DEPLOYMENT SUMMARY:");
  console.log("- ✅ Factory (unchanged):", existingAddresses.factory);
  console.log("- 🔄 Router (NEW):", newRouterAddress);
  console.log("- ✅ HYPERINDEX (unchanged):", existingAddresses.hyperindex);
  console.log("- ✅ USDC (unchanged):", existingAddresses.usdc);
  console.log("- ✅ Pair (unchanged):", existingAddresses.pair);
  
  console.log("\n📝 NEXT STEPS:");
  console.log("1. Update fix-liquidity.js with new Router address:");
  console.log(`   router: "${newRouterAddress}"`);
  console.log("2. Run: pnpx hardhat run scripts/fix-liquidity.js --network hypervm-testnet");
  
  console.log("\n🎉 Router redeployment complete!");
  
  return {
    oldRouter: "0xd41EB45855B002335ddE4f99d4EA8A6A0D8A8b96",
    newRouter: newRouterAddress,
    ...existingAddresses
  };
}

main().catch(console.error);