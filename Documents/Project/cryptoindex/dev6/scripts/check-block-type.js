// scripts/check-block-type.js
const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 현재 블록 타입 확인 중...\n");
  
  const [signer] = await ethers.getSigners();
  console.log("계정:", signer.address);
  
  const block = await ethers.provider.getBlock("latest");
  const gasLimit = block.gasLimit;
  
  console.log("\n📊 블록 정보:");
  console.log("- 블록 번호:", block.number);
  console.log("- 가스 제한:", gasLimit.toString());
  
  if (gasLimit > 3000000) {
    console.log("\n🟢 현재 상태: BIG BLOCKS (30M gas)");
    console.log("✅ 대형 컨트랙트 배포 가능");
  } else {
    console.log("\n🔵 현재 상태: SMALL BLOCKS (2M gas)");
    console.log("⚡ 일반 거래에 최적화됨");
  }
  
  console.log("\n💡 전환 방법:");
  console.log("1. LayerZero CLI: npx @layerzerolabs/hyperliquid-composer set-block --size [big/small]");
  console.log("2. 웹: https://app.hyperliquid.xyz/ → Settings → Block Type");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
