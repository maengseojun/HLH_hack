// scripts/test-rpc.js
/**
 * Test HyperEVM RPC Connection
 * Created: 2025-08-11
 */

const { ethers } = require("ethers");
require("dotenv").config();

async function testRPC() {
  console.log("🔍 Testing HyperEVM Testnet RPC Connection...\n");

  const rpcUrl = process.env.HYPERVM_TESTNET_RPC || "https://rpc.hyperliquid-testnet.xyz/evm";
  console.log("RPC URL:", rpcUrl);
  
  try {
    // Create provider
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Test 1: Get chain ID
    console.log("\n1. Testing eth_chainId...");
    const chainId = await provider.getNetwork().then(network => network.chainId);
    console.log("✅ Chain ID:", chainId.toString());
    
    // Test 2: Get block number
    console.log("\n2. Testing eth_blockNumber...");
    const blockNumber = await provider.getBlockNumber();
    console.log("✅ Current block:", blockNumber);
    
    // Test 3: Test with private key if available
    if (process.env.PRIVATE_KEY) {
      console.log("\n3. Testing wallet connection...");
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
      console.log("✅ Wallet address:", wallet.address);
      
      // Get balance
      const balance = await provider.getBalance(wallet.address);
      console.log("✅ Balance:", ethers.formatEther(balance), "HYPE");
    } else {
      console.log("\n⚠️ PRIVATE_KEY not found in .env - skipping wallet test");
    }
    
    console.log("\n✅ RPC connection successful!");
    
  } catch (error) {
    console.error("\n❌ RPC connection failed:");
    console.error("Error:", error.message);
    
    // Try alternative RPC URLs
    console.log("\n🔄 Trying alternative RPC URLs...");
    
    const alternativeUrls = [
      "https://api.hyperliquid-testnet.xyz/evm",
      "https://rpc.hyperliquid-testnet.xyz/evm", 
      "https://testnet.hyperliquid.xyz/evm"
    ];
    
    for (const url of alternativeUrls) {
      try {
        console.log(`\nTrying: ${url}`);
        const altProvider = new ethers.JsonRpcProvider(url);
        const chainId = await altProvider.getNetwork().then(network => network.chainId);
        console.log(`✅ Success! Chain ID: ${chainId}`);
        console.log(`👉 Use this RPC URL in your .env file:`);
        console.log(`HYPERVM_TESTNET_RPC=${url}`);
        break;
      } catch (err) {
        console.log(`❌ Failed: ${err.message}`);
      }
    }
  }
}

testRPC()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });