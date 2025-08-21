const hre = require("hardhat");

async function main() {
  console.log("🚀 HyperEVM Simple Test Deployment");
  console.log("==================================");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  
  // 잔액 확인
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH");
  
  // 네트워크 정보
  const network = await deployer.provider.getNetwork();
  console.log("Network:", network.name, "Chain ID:", network.chainId);
  
  try {
    console.log("\n📝 Deploying SimpleTest contract...");
    
    // 매우 간단한 컨트랙트 배포
    const SimpleTest = await hre.ethers.getContractFactory("SimpleTest");
    
    // 가스 설정을 최소화
    const deployTx = await SimpleTest.deploy({
      gasLimit: 500000, // 낮은 가스 리밋
      gasPrice: hre.ethers.parseUnits("0.1", "gwei"), // 0.1 gwei
    });
    
    console.log("Transaction hash:", deployTx.deploymentTransaction().hash);
    console.log("Waiting for confirmation...");
    
    await deployTx.waitForDeployment();
    const address = await deployTx.getAddress();
    
    console.log("✅ SimpleTest deployed to:", address);
    
    // 컨트랙트 테스트
    console.log("\n🧪 Testing contract...");
    const value = await deployTx.getValue();
    console.log("Initial value:", value.toString());
    
    console.log("\n✅ Deployment successful!");
    
  } catch (error) {
    console.error("\n❌ Deployment failed:");
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    if (error.error) {
      console.error("Error details:", error.error);
    }
    if (error.transaction) {
      console.error("Transaction:", error.transaction);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
