const { ethers } = require("ethers");
require("dotenv").config();

async function checkHyperEVMStatus() {
  console.log("🔍 HyperEVM Network Status Check");
  console.log("=================================");
  
  const provider = new ethers.JsonRpcProvider(process.env.HYPEREVM_RPC);
  
  try {
    // 1. 네트워크 상태 확인
    const network = await provider.getNetwork();
    console.log("Network Chain ID:", network.chainId);
    console.log("Network Name:", network.name);
    
    // 2. 최신 블록 확인
    const blockNumber = await provider.getBlockNumber();
    console.log("Latest Block:", blockNumber);
    
    const block = await provider.getBlock(blockNumber);
    console.log("Block Details:");
    console.log("  - Timestamp:", new Date(block.timestamp * 1000).toISOString());
    console.log("  - Gas Limit:", block.gasLimit.toString());
    console.log("  - Gas Used:", block.gasUsed.toString());
    console.log("  - Base Fee:", block.baseFeePerGas ? ethers.formatUnits(block.baseFeePerGas, "gwei") + " gwei" : "N/A");
    
    // 3. 가스 가격 확인
    const feeData = await provider.getFeeData();
    console.log("\nGas Prices:");
    console.log("  - Gas Price:", feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") + " gwei" : "N/A");
    console.log("  - Max Fee:", feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, "gwei") + " gwei" : "N/A");
    console.log("  - Priority Fee:", feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei") + " gwei" : "N/A");
    
    // 4. 계정 상태 확인
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const balance = await provider.getBalance(wallet.address);
    const nonce = await provider.getTransactionCount(wallet.address);
    
    console.log("\nAccount Status:");
    console.log("  - Address:", wallet.address);
    console.log("  - Balance:", ethers.formatEther(balance), "ETH");
    console.log("  - Nonce:", nonce);
    
    // 5. eth_call 테스트 (간단한 읽기 작업)
    console.log("\n🧪 Testing eth_call...");
    const testCall = await provider.call({
      to: "0x0000000000000000000000000000000000000000",
      data: "0x"
    });
    console.log("eth_call result:", testCall || "Success (empty response)");
    
  } catch (error) {
    console.error("❌ Status check failed:");
    console.error("Error:", error.message);
    if (error.code) console.error("Code:", error.code);
  }
}

checkHyperEVMStatus();
