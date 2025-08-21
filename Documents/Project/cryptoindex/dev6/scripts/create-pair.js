// scripts/create-pair.js
/**
 * Create HYPERINDEX-USDC pair and add initial liquidity
 * Created: 2025-08-11
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Creating HYPERINDEX-USDC pair and adding liquidity...");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // Contract addresses (update these from previous deployments)
  const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS;
  const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS;
  const HYPERINDEX_ADDRESS = process.env.HYPERINDEX_ADDRESS;
  const USDC_ADDRESS = process.env.USDC_ADDRESS;

  if (!FACTORY_ADDRESS || !ROUTER_ADDRESS || !HYPERINDEX_ADDRESS || !USDC_ADDRESS) {
    throw new Error("❌ Missing required contract addresses in environment variables");
  }

  console.log("Contract addresses:");
  console.log("- Factory:", FACTORY_ADDRESS);
  console.log("- Router:", ROUTER_ADDRESS);
  console.log("- HyperIndex:", HYPERINDEX_ADDRESS);
  console.log("- USDC:", USDC_ADDRESS);

  // Get contract instances
  const factory = await ethers.getContractAt("HyperIndexFactory", FACTORY_ADDRESS);
  const router = await ethers.getContractAt("HyperIndexRouter", ROUTER_ADDRESS);
  const hyperToken = await ethers.getContractAt("IERC20", HYPERINDEX_ADDRESS);
  const usdcToken = await ethers.getContractAt("IERC20", USDC_ADDRESS);

  // Check balances
  const hyperBalance = await hyperToken.balanceOf(deployer.address);
  const usdcBalance = await usdcToken.balanceOf(deployer.address);
  
  console.log("\n💰 Token Balances:");
  console.log("- HYPERINDEX:", ethers.formatEther(hyperBalance));
  console.log("- USDC:", ethers.formatEther(usdcBalance));

  const requiredHyper = ethers.parseEther("500");
  const requiredUsdc = ethers.parseEther("500");

  if (hyperBalance < requiredHyper) {
    throw new Error(`❌ Insufficient HYPERINDEX balance. Need ${ethers.formatEther(requiredHyper)}, have ${ethers.formatEther(hyperBalance)}`);
  }

  if (usdcBalance < requiredUsdc) {
    throw new Error(`❌ Insufficient USDC balance. Need ${ethers.formatEther(requiredUsdc)}, have ${ethers.formatEther(usdcBalance)}`);
  }

  // Step 1: Check if pair already exists
  console.log("\n🔍 Checking if pair exists...");
  let pairAddress = await factory.getPair(HYPERINDEX_ADDRESS, USDC_ADDRESS);
  
  if (pairAddress === "0x0000000000000000000000000000000000000000") {
    console.log("✨ Creating new pair...");
    
    const createPairTx = await factory.createPair(HYPERINDEX_ADDRESS, USDC_ADDRESS);
    const receipt = await createPairTx.wait();
    
    pairAddress = await factory.getPair(HYPERINDEX_ADDRESS, USDC_ADDRESS);
    console.log("✅ Pair created at:", pairAddress);
    console.log("Transaction hash:", receipt.hash);
  } else {
    console.log("✅ Pair already exists at:", pairAddress);
  }

  // Step 2: Approve tokens for router
  console.log("\n📝 Approving tokens for router...");
  
  const hyperApproval = await hyperToken.allowance(deployer.address, ROUTER_ADDRESS);
  const usdcApproval = await usdcToken.allowance(deployer.address, ROUTER_ADDRESS);

  console.log("Current allowances:");
  console.log("- HYPERINDEX:", ethers.formatEther(hyperApproval));
  console.log("- USDC:", ethers.formatEther(usdcApproval));

  if (hyperApproval < requiredHyper) {
    console.log("Approving HYPERINDEX...");
    const approveTx = await hyperToken.approve(ROUTER_ADDRESS, ethers.MaxUint256);
    await approveTx.wait();
    console.log("✅ HYPERINDEX approved");
  }

  if (usdcApproval < requiredUsdc) {
    console.log("Approving USDC...");
    const approveTx = await usdcToken.approve(ROUTER_ADDRESS, ethers.MaxUint256);
    await approveTx.wait();
    console.log("✅ USDC approved");
  }

  // Step 3: Add liquidity
  console.log("\n💧 Adding initial liquidity...");
  
  const liquidityParams = {
    tokenA: HYPERINDEX_ADDRESS,
    tokenB: USDC_ADDRESS,
    amountADesired: ethers.parseEther("500"), // 500 HYPERINDEX
    amountBDesired: ethers.parseEther("500"), // 500 USDC  
    amountAMin: ethers.parseEther("450"),     // Min 450 HYPERINDEX (10% slippage)
    amountBMin: ethers.parseEther("450"),     // Min 450 USDC (10% slippage)
    to: deployer.address,
    deadline: Math.floor(Date.now() / 1000) + 1200 // 20 minutes
  };

  console.log("Liquidity parameters:");
  console.log("- HYPERINDEX desired:", ethers.formatEther(liquidityParams.amountADesired));
  console.log("- USDC desired:", ethers.formatEther(liquidityParams.amountBDesired));
  console.log("- Min HYPERINDEX:", ethers.formatEther(liquidityParams.amountAMin));
  console.log("- Min USDC:", ethers.formatEther(liquidityParams.amountBMin));

  const addLiquidityTx = await router.addLiquidity(
    liquidityParams.tokenA,
    liquidityParams.tokenB,
    liquidityParams.amountADesired,
    liquidityParams.amountBDesired,
    liquidityParams.amountAMin,
    liquidityParams.amountBMin,
    liquidityParams.to,
    liquidityParams.deadline
  );

  const receipt = await addLiquidityTx.wait();
  console.log("✅ Liquidity added successfully!");
  console.log("Transaction hash:", receipt.hash);

  // Step 4: Verify liquidity was added
  console.log("\n🔍 Verifying liquidity...");
  
  const pair = await ethers.getContractAt("HyperIndexPair", pairAddress);
  const reserves = await pair.getReserves();
  const lpBalance = await pair.balanceOf(deployer.address);

  console.log("Pair reserves:");
  console.log("- Reserve 0:", ethers.formatEther(reserves[0]));
  console.log("- Reserve 1:", ethers.formatEther(reserves[1]));
  console.log("- LP tokens received:", ethers.formatEther(lpBalance));

  // Determine which token is token0 and token1
  const token0 = await pair.token0();
  const token1 = await pair.token1();
  
  console.log("Token order:");
  console.log("- Token 0:", token0);
  console.log("- Token 1:", token1);

  // Step 5: Test basic swap
  console.log("\n🔄 Testing basic swap...");
  
  try {
    // Get quote for 10 USDC -> HYPERINDEX
    const amounts = await router.getAmountsOut(
      ethers.parseEther("10"),
      [USDC_ADDRESS, HYPERINDEX_ADDRESS]
    );
    
    console.log("Swap quote (10 USDC -> HYPERINDEX):");
    console.log("- Input:", ethers.formatEther(amounts[0]), "USDC");
    console.log("- Output:", ethers.formatEther(amounts[1]), "HYPERINDEX");
    
    // Execute small test swap
    const swapTx = await router.swapExactTokensForTokens(
      ethers.parseEther("1"), // 1 USDC
      0, // Accept any amount of HYPERINDEX
      [USDC_ADDRESS, HYPERINDEX_ADDRESS],
      deployer.address,
      Math.floor(Date.now() / 1000) + 600 // 10 minutes
    );
    
    await swapTx.wait();
    console.log("✅ Test swap successful!");
    console.log("Swap transaction:", swapTx.hash);
    
  } catch (error) {
    console.log("⚠️ Test swap failed:", error.message);
  }

  // Save deployment info
  const deploymentInfo = {
    network: "hypervm-testnet",
    chainId: 998,
    pair: {
      address: pairAddress,
      token0: token0,
      token1: token1,
      initialLiquidity: {
        hyperindex: "500",
        usdc: "500"
      },
      deployer: deployer.address,
      creationTime: new Date().toISOString()
    },
    reserves: {
      reserve0: ethers.formatEther(reserves[0]),
      reserve1: ethers.formatEther(reserves[1])
    }
  };

  console.log("\n📄 Pair Creation Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Final update config hint
  console.log("\n⚙️ Final Steps:");
  console.log("1. Update HYPERVM_TESTNET_CONFIG.contracts.pair with:", pairAddress);
  console.log("2. Update hypervm-config.ts with all deployed addresses");
  console.log("3. Test HyperVMAMM integration");
  
  return {
    pairAddress,
    reserves: reserves,
    lpBalance: ethers.formatEther(lpBalance)
  };
}

main()
  .then((result) => {
    console.log(`\n🎉 Pair creation completed: ${result.pairAddress}`);
    console.log(`💧 LP tokens: ${result.lpBalance}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Pair creation failed:", error);
    process.exit(1);
  });