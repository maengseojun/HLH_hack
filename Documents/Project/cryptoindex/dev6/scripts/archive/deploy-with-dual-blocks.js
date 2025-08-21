// HyperEVM Dual Block 활용 배포 스크립트
const { ethers } = require("hardhat");

async function main() {
  console.log("🎯 HyperEVM Dual Block 배포 시작...");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 배포자:", deployer.address);
  
  // 블록 타입 확인
  const block = await ethers.provider.getBlock("latest");
  const isBigBlock = block.gasLimit > 3000000;
  
  console.log(`📊 현재 블록 상태:`);
  console.log(`- 가스 제한: ${block.gasLimit.toString()}`);
  console.log(`- 블록 타입: ${isBigBlock ? 'Big Blocks ✅' : 'Small Blocks'}`);
  
  if (isBigBlock) {
    console.log("🏭 Big Blocks로 대형 컨트랙트 배포...");
    // 복잡한 컨트랙트들 배포
    const Factory = await ethers.getContractFactory("HyperIndexFactory");
    const factory = await Factory.deploy(deployer.address, { gasLimit: 5000000 });
    await factory.waitForDeployment();
    console.log("✅ Factory:", await factory.getAddress());
  } else {
    console.log("⚡ Small Blocks로 간단한 거래 처리...");
    // 간단한 거래들만 처리
  }
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});
