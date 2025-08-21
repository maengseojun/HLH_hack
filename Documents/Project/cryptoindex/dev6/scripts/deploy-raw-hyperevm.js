const { ethers } = require("ethers");
require("dotenv").config();

async function deployWithRawTransaction() {
  console.log("🔧 HyperEVM Raw Transaction Deployment");
  console.log("=====================================");
  
  // SimpleTest 컨트랙트 바이트코드 (컴파일 후)
  const bytecode = "0x608060405234801561001057600080fd5b50602a60008190555060c7806100276000396000f3fe6080604052348015600f57600080fd5b506004361060325760003560e01c80633fa4f2451460375780635524107714604f575b600080fd5b603d6061565b60405190815260200160405180910390f35b605f605a3660046067565b600055565b005b60005490565b600060208284031215607857600080fd5b503591905056fea264697066735822122038e1a4c0c7b3d9e4f5a6b7c8d9e0f1a2b3c4d5e6f7081920a3b4c5d6e7f8091064736f6c63430008130033";
  
  const provider = new ethers.JsonRpcProvider(process.env.HYPEREVM_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log("Deployer:", wallet.address);
  
  try {
    // 잔액 확인
    const balance = await provider.getBalance(wallet.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");
    
    // Nonce 가져오기
    const nonce = await provider.getTransactionCount(wallet.address);
    console.log("Nonce:", nonce);
    
    // 가스 가격 확인
    const gasPrice = await provider.getFeeData();
    console.log("Gas Price:", ethers.formatUnits(gasPrice.gasPrice, "gwei"), "gwei");
    
    // 트랜잭션 생성
    const tx = {
      from: wallet.address,
      nonce: nonce,
      gasLimit: 500000n,
      gasPrice: ethers.parseUnits("0.1", "gwei"),
      data: bytecode,
      chainId: 998,
      value: 0n
    };
    
    console.log("\n📤 Sending raw transaction...");
    console.log("Transaction:", tx);
    
    // 트랜잭션 서명 및 전송
    const signedTx = await wallet.sendTransaction(tx);
    console.log("Transaction hash:", signedTx.hash);
    
    // 확인 대기
    console.log("⏳ Waiting for confirmation...");
    const receipt = await signedTx.wait();
    
    console.log("✅ Contract deployed!");
    console.log("Contract address:", receipt.contractAddress);
    console.log("Gas used:", receipt.gasUsed.toString());
    
  } catch (error) {
    console.error("❌ Raw transaction failed:");
    console.error("Error:", error.message);
    if (error.code) console.error("Code:", error.code);
    if (error.data) console.error("Data:", error.data);
    if (error.reason) console.error("Reason:", error.reason);
  }
}

deployWithRawTransaction();
