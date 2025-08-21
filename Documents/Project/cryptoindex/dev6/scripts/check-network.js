// scripts/check-network.js
/**
 * Check HyperEVM network details and limitations
 * Created: 2025-08-11
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Checking HyperEVM Testnet details...\n");
  
  try {
    const provider = ethers.provider;
    
    // Get network info
    const network = await provider.getNetwork();
    console.log("Network Info:");
    console.log("- Chain ID:", network.chainId.toString());
    console.log("- Name:", network.name || "Unknown");
    
    // Get latest block
    const block = await provider.getBlock("latest");
    console.log("\nLatest Block:");
    console.log("- Number:", block.number);
    console.log("- Gas Limit:", block.gasLimit.toString());
    console.log("- Gas Used:", block.gasUsed.toString());
    console.log("- Base Fee:", block.baseFeePerGas?.toString() || "N/A");
    
    // Get gas price
    const feeData = await provider.getFeeData();
    console.log("\nGas Pricing:");
    console.log("- Gas Price:", feeData.gasPrice?.toString());
    console.log("- Max Fee Per Gas:", feeData.maxFeePerGas?.toString() || "N/A");
    console.log("- Max Priority Fee:", feeData.maxPriorityFeePerGas?.toString() || "N/A");
    
    // Check account
    const [signer] = await ethers.getSigners();
    if (signer) {
      console.log("\nAccount Info:");
      console.log("- Address:", signer.address);
      const balance = await provider.getBalance(signer.address);
      console.log("- Balance:", ethers.formatEther(balance), "HYPE");
      
      // Get transaction count
      const nonce = await provider.getTransactionCount(signer.address);
      console.log("- Nonce:", nonce);
    }
    
    // Estimate deployment gas for different contract sizes
    console.log("\n📊 Testing deployment gas estimates...");
    
    // Small contract bytecode (approximate)
    const smallBytecode = "0x" + "60806040" + "00".repeat(100);
    try {
      const gasEstimate = await provider.estimateGas({
        data: smallBytecode
      });
      console.log("- Small contract gas estimate:", gasEstimate.toString());
    } catch (e) {
      console.log("- Small contract: Failed to estimate");
    }
    
    // Check if code size limit exists
    console.log("\n📏 Checking code size limits...");
    const maxCodeSize = 24576; // Standard EVM limit
    console.log("- Standard EVM max code size:", maxCodeSize, "bytes");
    console.log("- HyperEVM may have different limits");
    
    console.log("\n✅ Network check complete!");
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.code) {
      console.error("Error code:", error.code);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });