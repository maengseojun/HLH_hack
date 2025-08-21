// scripts/fix-liquidity-v2.js
const { ethers } = require("hardhat");

async function main() {
  console.log("🔧 Fixing liquidity with explicit gas settings...");
  
  const [deployer] = await ethers.getSigners();
  
  const addresses = {
    router: "0xd41EB45855B002335ddE4f99d4EA8A6A0D8A8b96",
    hyperindex: "0x6065Ab1ec8334ab6099aF27aF145411902EAef40",
    usdc: "0x53aE8e677f34BC709148085381Ce2D4b6ceA1Fc3",
    pair: "0x5706084ad9Cac84393eaA1Eb265Db9b22bA63cd1"
  };
  
  const hyperindex = await ethers.getContractAt("HyperIndexToken", addresses.hyperindex);
  const usdc = await ethers.getContractAt("HyperIndexToken", addresses.usdc);
  const router = await ethers.getContractAt("HyperIndexRouter", addresses.router);
  
  // Big Block Gas Price 설정
  const bigBlockGasPrice = ethers.parseUnits("50", "gwei");
  const gasOptions = {
    gasPrice: bigBlockGasPrice,
    gasLimit: 5000000 // 5M gas
  };
  
  console.log("✅ Using Big Block gas settings");
  
  // Step 1: Check current allowances
  const hyperAllowance = await hyperindex.allowance(deployer.address, addresses.router);
  const usdcAllowance = await usdc.allowance(deployer.address, addresses.router);
  
  console.log(`Current allowances:`);
  console.log(`- HYPERINDEX: ${ethers.formatEther(hyperAllowance)}`);
  console.log(`- USDC: ${ethers.formatEther(usdcAllowance)}`);
  
  // Step 2: Approve if needed
  const liquidityAmount = ethers.parseEther("1000"); // Start with 1K
  
  if (hyperAllowance < liquidityAmount) {
    console.log("🔄 Approving HYPERINDEX...");
    const approveTx1 = await hyperindex.approve(addresses.router, liquidityAmount, gasOptions);
    await approveTx1.wait();
    console.log("✅ HYPERINDEX approved");
  }
  
  if (usdcAllowance < liquidityAmount) {
    console.log("🔄 Approving USDC...");
    const approveTx2 = await usdc.approve(addresses.router, liquidityAmount, gasOptions);
    await approveTx2.wait();
    console.log("✅ USDC approved");
  }
  
  // Step 3: Check pair contract
  console.log("\n🔍 Checking pair contract...");
  const pair = await ethers.getContractAt("HyperIndexPair", addresses.pair);
  
  try {
    const reserves = await pair.getReserves();
    console.log(`Pair reserves: ${reserves[0]}, ${reserves[1]}`);
  } catch (error) {
    console.log("⚠️ Pair not initialized or error:", error.message);
  }
  
  // Step 4: Add liquidity with very small amounts first
  console.log("\n💧 Adding minimal liquidity...");
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  
  try {
    // Try with 1 token each first
    const minAmount = ethers.parseEther("1");
    
    console.log("Attempting addLiquidity with 1 token each...");
    
    const tx = await router.addLiquidity(
      addresses.hyperindex,
      addresses.usdc,
      minAmount,
      minAmount,
      0, // Accept any amount (first liquidity)
      0, // Accept any amount (first liquidity)
      deployer.address,
      deadline,
      gasOptions
    );
    
    console.log("⏳ Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ SUCCESS! Gas used:", receipt.gasUsed.toString());
    
    // Check the pair after successful liquidity addition
    const newReserves = await pair.getReserves();
    console.log(`New reserves: ${ethers.formatEther(newReserves[0])}, ${ethers.formatEther(newReserves[1])}`);
    
  } catch (error) {
    console.error("❌ Still failed:", error.message);
    
    // Try direct approach - check if tokens are working
    console.log("\n🔍 Testing direct token transfers...");
    
    try {
      const transferTx = await hyperindex.transfer(addresses.pair, ethers.parseEther("1"), gasOptions);
      await transferTx.wait();
      console.log("✅ Direct transfer to pair successful");
      
      // Try calling mint directly
      const mintTx = await pair.mint(deployer.address, gasOptions);
      await mintTx.wait();
      console.log("✅ Direct mint successful");
      
    } catch (directError) {
      console.error("❌ Direct operations also failed:", directError.message);
    }
  }
}

main().catch(console.error);
