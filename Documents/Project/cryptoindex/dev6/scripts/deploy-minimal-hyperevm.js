const { ethers } = require("ethers");
require("dotenv").config();

async function deployMinimal() {
  console.log("🚀 HyperEVM Minimal Contract Deployment");
  console.log("======================================");
  
  const provider = new ethers.JsonRpcProvider(process.env.HYPEREVM_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  // MinimalContract 바이트코드 (매우 작음)
  const bytecode = "0x6080604052348015600f57600080fd5b50607c8061001e6000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c8063f8a8fd6d14602d575b600080fd5b60336047565b604051901515815260200160405180910390f35b60019056fea264697066735822122045678901234567890123456789012345678901234567890123456789012345640029";
  
  console.log("Deployer:", wallet.address);
  
  try {
    // 매우 간단한 트랜잭션
    const tx = {
      data: bytecode,
      gasLimit: 100000n, // 매우 낮은 가스
      gasPrice: 1000000n, // 0.001 gwei
    };
    
    console.log("Sending transaction...");
    const response = await wallet.sendTransaction(tx);
    console.log("TX Hash:", response.hash);
    
    const receipt = await response.wait();
    console.log("✅ Deployed to:", receipt.contractAddress);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    
    // Error 10007 특별 처리
    if (error.message.includes("10007")) {
      console.log("\n⚠️ Error 10007 감지됨!");
      console.log("HyperEVM 네트워크가 현재 트랜잭션을 처리할 수 없는 상태입니다.");
      console.log("\n🔍 가능한 해결 방법:");
      console.log("1. HyperEVM Discord/Telegram에서 네트워크 상태 확인");
      console.log("2. 다른 시간대에 재시도");
      console.log("3. HyperEVM 팀에 직접 문의");
      console.log("\n📞 HyperEVM Support:");
      console.log("- Discord: https://discord.gg/hyperliquid");
      console.log("- Docs: https://docs.hyperliquid.xyz");
    }
  }
}

deployMinimal();
