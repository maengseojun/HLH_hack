// scripts/simple-network-test.js
/**
 * Simple network connectivity test for HyperEVM testnet
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting HyperEVM Testnet Connection Test\n");
  
  try {
    const provider = ethers.provider;
    
    // Basic connectivity test
    console.log("1. 🔗 Testing network connectivity...");
    const network = await provider.getNetwork();
    console.log(`   ✅ Connected to Chain ID: ${network.chainId}`);
    
    // Block information
    console.log("\n2. 📦 Fetching latest block...");
    const block = await provider.getBlock("latest");
    console.log(`   ✅ Latest Block: #${block.number}`);
    console.log(`   ⛽ Gas Limit: ${block.gasLimit.toString()}`);
    
    // Account check
    console.log("\n3. 👤 Checking account...");
    const [signer] = await ethers.getSigners();
    if (signer) {
      console.log(`   ✅ Account: ${signer.address}`);
      const balance = await provider.getBalance(signer.address);
      console.log(`   💰 Balance: ${ethers.formatEther(balance)} HYPE`);
      
      if (parseFloat(ethers.formatEther(balance)) === 0) {
        console.log("   ⚠️  WARNING: Zero balance detected!");
        console.log("   💡 You may need testnet tokens from faucet");
      }
    } else {
      console.log("   ❌ No account configured");
      console.log("   💡 Please set PRIVATE_KEY in .env file");
    }
    
    // Gas price test
    console.log("\n4. ⛽ Testing gas pricing...");
    const feeData = await provider.getFeeData();
    console.log(`   ✅ Gas Price: ${feeData.gasPrice?.toString() || 'N/A'}`);
    
    // Simple transaction simulation
    console.log("\n5. 🔄 Testing transaction simulation...");
    if (signer && parseFloat(ethers.formatEther(await provider.getBalance(signer.address))) > 0) {
      try {
        const gasEstimate = await provider.estimateGas({
          to: signer.address,
          value: ethers.parseEther("0.001")
        });
        console.log(`   ✅ Self-transfer gas estimate: ${gasEstimate.toString()}`);
      } catch (e) {
        console.log(`   ⚠️  Gas estimation failed: ${e.message}`);
      }
    } else {
      console.log("   ⏭️  Skipped (no balance)");
    }
    
    console.log("\n🎉 Network test completed successfully!");
    console.log("💡 Ready for testnet deployment");
    
  } catch (error) {
    console.error("\n❌ Network test failed:");
    console.error(`   Error: ${error.message}`);
    
    if (error.message.includes("could not detect network")) {
      console.log("\n💡 Troubleshooting tips:");
      console.log("   1. Check internet connection");
      console.log("   2. Verify RPC URL is correct");
      console.log("   3. Try different RPC endpoint");
    }
    
    if (error.message.includes("private key")) {
      console.log("\n💡 Account setup:");
      console.log("   1. Create .env file with PRIVATE_KEY");
      console.log("   2. Get testnet HYPE from faucet");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });