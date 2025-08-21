// scripts/debug-contracts.js  
const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Debugging contract states...");
  
  const [deployer] = await ethers.getSigners();
  const addresses = {
    factory: "0x73bF19534DA1c60772E40136A4e5E77921b7a632",
    router: "0xd41EB45855B002335ddE4f99d4EA8A6A0D8A8b96",
    hyperindex: "0x6065Ab1ec8334ab6099aF27aF145411902EAef40",
    usdc: "0x53aE8e677f34BC709148085381Ce2D4b6ceA1Fc3",
    pair: "0x5706084ad9Cac84393eaA1Eb265Db9b22bA63cd1"
  };
  
  // Check Factory
  const factory = await ethers.getContractAt("HyperIndexFactory", addresses.factory);
  const pairFromFactory = await factory.getPair(addresses.hyperindex, addresses.usdc);
  console.log("Factory says pair is at:", pairFromFactory);
  console.log("Expected pair address:", addresses.pair);
  console.log("Pair addresses match:", pairFromFactory === addresses.pair);
  
  // Check token balances
  const hyperindex = await ethers.getContractAt("HyperIndexToken", addresses.hyperindex);
  const usdc = await ethers.getContractAt("HyperIndexToken", addresses.usdc);
  
  const hyperBalance = await hyperindex.balanceOf(deployer.address);
  const usdcBalance = await usdc.balanceOf(deployer.address);
  
  console.log("\nToken Balances:");
  console.log("- HYPERINDEX:", ethers.formatEther(hyperBalance));
  console.log("- USDC:", ethers.formatEther(usdcBalance));
  
  // Check pair state
  try {
    const pair = await ethers.getContractAt("HyperIndexPair", addresses.pair);
    const token0 = await pair.token0();
    const token1 = await pair.token1();
    
    console.log("\nPair Configuration:");
    console.log("- Token0:", token0);
    console.log("- Token1:", token1);
    console.log("- HYPERINDEX is token0:", token0.toLowerCase() === addresses.hyperindex.toLowerCase());
    console.log("- USDC is token1:", token1.toLowerCase() === addresses.usdc.toLowerCase());
    
    const reserves = await pair.getReserves();
    console.log("- Reserves:", ethers.formatEther(reserves[0]), ethers.formatEther(reserves[1]));
    
  } catch (error) {
    console.error("❌ Pair error:", error.message);
  }
  
  
  // Check allowances after recent approve transactions
  const hyperAllowance = await hyperindex.allowance(deployer.address, addresses.router);
  const usdcAllowance = await usdc.allowance(deployer.address, addresses.router);
  console.log("\nToken Allowances to Router:");
  console.log("- HYPERINDEX:", ethers.formatEther(hyperAllowance));
  console.log("- USDC:", ethers.formatEther(usdcAllowance));
  
  // Check if amounts are sufficient for liquidity
  const testAmount = ethers.parseEther("1000");
  console.log("\nAllowance Check for 1000 each:");
  console.log("- HYPERINDEX sufficient:", hyperAllowance >= testAmount);
  console.log("- USDC sufficient:", usdcAllowance >= testAmount);
  
  // Check router contract code
  const routerCode = await deployer.provider.getCode(addresses.router);
  console.log("\nRouter Contract:");
  console.log("- Has code:", routerCode !== "0x");
  console.log("- Code length:", routerCode.length);
  
  
  // *** ROOT CAUSE CHECK: Verify pairFor calculation ***
  console.log("\n🔍 ROOT CAUSE CHECK: pairFor calculation");
  
  const factoryContract = await ethers.getContractAt("HyperIndexFactory", addresses.factory);
  
  // Get init code hash from factory
  const initCodeHash = await factoryContract.PAIR_CODE_HASH();
  console.log("- Factory INIT_CODE_PAIR_HASH:", initCodeHash);
  
  // Calculate what pairFor should return using HyperIndexLibrary logic
  const token0 = addresses.usdc; // We know USDC is token0
  const token1 = addresses.hyperindex; // HYPERINDEX is token1
  
  // Simulate pairFor calculation
  const salt = ethers.keccak256(ethers.solidityPacked(["address", "address"], [token0, token1]));
  const calculatedPair = ethers.getCreate2Address(
    addresses.factory,
    salt,
    initCodeHash
  );
  
  console.log("- Calculated pair address:", calculatedPair);
  console.log("- Actual pair address:", addresses.pair);
  console.log("- Addresses match:", calculatedPair.toLowerCase() === addresses.pair.toLowerCase());
  
  if (calculatedPair.toLowerCase() !== addresses.pair.toLowerCase()) {
    console.log("❌ FOUND ROOT CAUSE: pairFor calculation mismatch!");
    console.log("   HyperIndexLibrary.pairFor() returns wrong address");
    console.log("   This causes Router to send tokens to non-existent address");
  } else {
    console.log("✅ pairFor calculation is correct");
  }
  
  console.log("\n✅ Debug complete");
}

main().catch(console.error);
