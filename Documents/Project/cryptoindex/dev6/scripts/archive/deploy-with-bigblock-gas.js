// bigBlockGasPrice를 사용한 배포
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Big Block Gas Price를 사용한 배포...");
  
  const [deployer] = await ethers.getSigners();
  console.log("배포자:", deployer.address);
  
  // Big Block용 가스 가격 설정
  const bigBlockGasPrice = ethers.parseUnits("50", "gwei");
  
  try {
    console.log("\n📦 Factory 배포 (Big Block Gas Price)...");
    const Factory = await ethers.getContractFactory("HyperIndexFactory");
    const factory = await Factory.deploy(deployer.address, {
      gasLimit: 10000000,
      gasPrice: bigBlockGasPrice // Big Block 트리거
    });
    
    await factory.waitForDeployment();
    console.log("✅ 배포 완료:", await factory.getAddress());
    
  } catch (error) {
    console.error("❌ 배포 실패:", error.message);
  }
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});
