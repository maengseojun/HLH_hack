// test-deployment/check-connection.js
/**
 * Check HyperEVM testnet connection and generate test wallet if needed
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Checking HyperEVM Testnet Connection\n");
  
  try {
    // Test provider connection
    console.log("1. 🌐 Testing provider connection...");
    const network = await ethers.provider.getNetwork();
    console.log(`   ✅ Connected to Chain ID: ${network.chainId}`);
    
    if (network.chainId.toString() !== "998") {
      console.log("   ⚠️  Warning: Expected Chain ID 998 (HyperEVM Testnet)");
    }
    
    // Get latest block
    console.log("\n2. 📦 Fetching latest block...");
    const block = await ethers.provider.getBlock("latest");
    console.log(`   ✅ Latest Block: #${block.number}`);
    console.log(`   ⛽ Gas Limit: ${block.gasLimit.toString()}`);
    
    // Check gas price
    console.log("\n3. ⛽ Checking gas pricing...");
    const feeData = await ethers.provider.getFeeData();
    console.log(`   ✅ Gas Price: ${feeData.gasPrice?.toString() || 'N/A'}`);
    
    // Check if we have a configured account
    console.log("\n4. 👤 Checking account configuration...");
    try {
      const [signer] = await ethers.getSigners();
      if (signer) {
        console.log(`   ✅ Account: ${signer.address}`);
        
        const balance = await ethers.provider.getBalance(signer.address);
        console.log(`   💰 Balance: ${ethers.formatEther(balance)} HYPE`);
        
        if (parseFloat(ethers.formatEther(balance)) === 0) {
          console.log("\n   💡 To get testnet tokens:");
          console.log("   1. Visit: https://faucet.hyperliquid-testnet.xyz");
          console.log("   2. Enter your address:", signer.address);
          console.log("   3. Request HYPE tokens");
        } else {
          console.log("   ✅ Account has sufficient balance for testing");
        }
      }
    } catch (e) {
      console.log("   ❌ No account configured or invalid private key");
      console.log("\n   💡 To set up an account:");
      console.log("   1. Generate a new wallet");
      console.log("   2. Add PRIVATE_KEY to .env file");
      console.log("   3. Get testnet tokens from faucet");
      
      // Generate a test wallet
      console.log("\n   🆕 Generating test wallet for you:");
      const wallet = ethers.Wallet.createRandom();
      console.log("   Address:", wallet.address);
      console.log("   Private Key:", wallet.privateKey);
      console.log("\n   ⚠️  SAVE this private key safely!");
      console.log("   Add this to your .env file:");
      console.log(`   PRIVATE_KEY=${wallet.privateKey}`);
    }
    
    console.log("\n🎯 Next steps:");
    console.log("   1. ✅ Network connectivity confirmed");
    console.log("   2. 🔑 Set up account with PRIVATE_KEY");
    console.log("   3. 💰 Get testnet tokens from faucet");
    console.log("   4. 🚀 Deploy contracts to testnet");
    
  } catch (error) {
    console.error("\n❌ Connection failed:");
    console.error("   Error:", error.message);
    
    console.log("\n💡 Troubleshooting:");
    console.log("   1. Check internet connection");
    console.log("   2. Verify RPC URL: https://rpc.hyperliquid-testnet.xyz/evm");
    console.log("   3. Try alternative RPC if available");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });