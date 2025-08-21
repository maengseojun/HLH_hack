// scripts/check-hyperswap.js
/**
 * Check HyperSwap deployment on HyperEVM to understand their approach
 * Created: 2025-08-11
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Analyzing existing DEXs on HyperEVM...\n");
  
  const provider = ethers.provider;
  
  // Known HyperSwap addresses (if available)
  // These are example addresses - need to find actual ones
  const knownContracts = [
    // Add known contract addresses here if you have them
  ];
  
  console.log("📊 Checking deployment patterns...");
  
  // Check recent blocks for contract deployments
  const latestBlock = await provider.getBlockNumber();
  console.log("Latest block:", latestBlock);
  
  // Look for recent contract creation transactions
  console.log("\n🔎 Searching for recent contract deployments...");
  
  for (let i = latestBlock - 100; i < latestBlock; i++) {
    const block = await provider.getBlock(i);
    if (block && block.transactions.length > 0) {
      for (const txHash of block.transactions) {
        const tx = await provider.getTransaction(txHash);
        if (tx && tx.to === null) { // Contract creation
          const receipt = await provider.getTransactionReceipt(txHash);
          if (receipt && receipt.contractAddress) {
            console.log(`Contract deployed at block ${i}:`);
            console.log(`  Address: ${receipt.contractAddress}`);
            console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
            
            // Check contract code size
            const code = await provider.getCode(receipt.contractAddress);
            console.log(`  Code size: ${code.length / 2} bytes`);
          }
        }
      }
    }
  }
  
  console.log("\n💡 Insights:");
  console.log("1. Check if other DEXs use proxy patterns");
  console.log("2. Look for minimal proxy deployments");
  console.log("3. Consider using pre-deployed libraries");
  
  // Test standard Uniswap V2 deployment
  console.log("\n🧪 Testing standard deployment approach...");
  
  try {
    // Try deploying with different gas settings
    const [deployer] = await ethers.getSigners();
    
    // Get fee data
    const feeData = await provider.getFeeData();
    console.log("Network fee data:");
    console.log("  Gas Price:", feeData.gasPrice?.toString());
    console.log("  Max Fee:", feeData.maxFeePerGas?.toString());
    
    // Try to estimate gas for simple deployment
    const TestSimple = await ethers.getContractFactory("TestSimple");
    const deployTx = TestSimple.getDeployTransaction();
    
    try {
      const gasEstimate = await provider.estimateGas({
        from: deployer.address,
        data: deployTx.data
      });
      console.log("TestSimple gas estimate:", gasEstimate.toString());
    } catch (e) {
      console.log("Gas estimation failed:", e.message);
    }
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  });