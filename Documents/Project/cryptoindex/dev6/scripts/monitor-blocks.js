// scripts/monitor-blocks.js
const { ethers } = require("hardhat");

async function main() {
  console.log("📊 블록 모니터링 시작 (Ctrl+C로 종료)...\n");
  
  let lastBlockNumber = 0;
  
  setInterval(async () => {
    try {
      const block = await ethers.provider.getBlock("latest");
      
      if (block.number > lastBlockNumber) {
        const gasLimit = block.gasLimit;
        const blockType = gasLimit > 3000000 ? "BIG BLOCKS 🟢" : "SMALL BLOCKS 🔵";
        
        console.log(`블록 #${block.number} | 가스: ${gasLimit} | ${blockType} | 시간: ${new Date().toLocaleTimeString()}`);
        
        if (gasLimit > 3000000) {
          console.log("✅ BIG BLOCKS 활성화됨! 배포를 시작할 수 있습니다.\n");
        }
        
        lastBlockNumber = block.number;
      }
    } catch (error) {
      console.error("Error:", error.message);
    }
  }, 2000); // 2초마다 확인
}

main().catch(console.error);
