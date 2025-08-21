// scripts/fix-liquidity.js
const { ethers } = require("hardhat");

async function main() {
  console.log("🔧 Fixing liquidity addition...");
  
  const [deployer] = await ethers.getSigners();
  
  // Big Block gas configuration
  const bigBlockGasPrice = ethers.parseUnits("50", "gwei");
  const gasOptions = {
    gasPrice: bigBlockGasPrice,
    gasLimit: 5000000
  };
  console.log("⚡ Using Big Block gas settings:", gasOptions);
  
  // 배포된 주소들 (Router 재배포됨)
  const addresses = {
    router: "0xD70399962f491c4d38f4ACf7E6a9345B0B9a3A7A",
    hyperindex: "0x6065Ab1ec8334ab6099aF27aF145411902EAef40",
    usdc: "0x53aE8e677f34BC709148085381Ce2D4b6ceA1Fc3",
    pair: "0x5706084ad9Cac84393eaA1Eb265Db9b22bA63cd1"
  };
  
  // Get contract instances
  const hyperindex = await ethers.getContractAt("HyperIndexToken", addresses.hyperindex);
  const usdc = await ethers.getContractAt("HyperIndexToken", addresses.usdc);
  const router = await ethers.getContractAt("HyperIndexRouter", addresses.router);
  
  console.log("✅ Connected to contracts");
  
  // Check balances
  const hyperBalance = await hyperindex.balanceOf(deployer.address);
  const usdcBalance = await usdc.balanceOf(deployer.address);
  
  console.log(`Balance - HYPERINDEX: ${ethers.formatEther(hyperBalance)}`);
  console.log(`Balance - USDC: ${ethers.formatEther(usdcBalance)}`);
  
  // Approve tokens
  const liquidityAmount = ethers.parseEther("100000"); // 100K each
  
  console.log("\n🔄 Approving tokens...");
  const approveTx1 = await hyperindex.approve(addresses.router, liquidityAmount, gasOptions);
  console.log("⏳ HYPERINDEX approve tx sent:", approveTx1.hash);
  await approveTx1.wait();
  console.log("✅ HYPERINDEX approved and confirmed");
  
  const approveTx2 = await usdc.approve(addresses.router, liquidityAmount, gasOptions);
  console.log("⏳ USDC approve tx sent:", approveTx2.hash);
  await approveTx2.wait();
  console.log("✅ USDC approved and confirmed");
  
  // Add liquidity with minimal amounts
  console.log("\n💧 Adding liquidity...");
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  
  try {
    const tx = await router.addLiquidity(
      addresses.usdc,        // Token0 (USDC)
      addresses.hyperindex,  // Token1 (HYPERINDEX)
      liquidityAmount,      // 100K USDC
      liquidityAmount,      // 100K HYPERINDEX  
      ethers.parseEther("90000"),  // Min 90K USDC
      ethers.parseEther("90000"),  // Min 90K HYPERINDEX
      deployer.address,
      deadline,
      gasOptions
    );
    
    console.log("⏳ Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Liquidity added! Gas used:", receipt.gasUsed.toString());
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    
    // Try smaller amounts
    console.log("\n🔄 Trying with smaller amounts...");
    const smallAmount = ethers.parseEther("1000"); // 1K each
    
    const tx2 = await router.addLiquidity(
      addresses.usdc,        // Token0 (USDC)
      addresses.hyperindex,  // Token1 (HYPERINDEX)
      smallAmount,          // USDC amount
      smallAmount,          // HYPERINDEX amount
      ethers.parseEther("900"),  // Min USDC
      ethers.parseEther("900"),  // Min HYPERINDEX
      deployer.address,
      deadline,
      gasOptions
    );
    
    console.log("⏳ Small liquidity transaction:", tx2.hash);
    await tx2.wait();
    console.log("✅ Small liquidity added successfully!");
  }
  
  console.log("\n🎉 Liquidity fix complete!");
}

main().catch(console.error);
