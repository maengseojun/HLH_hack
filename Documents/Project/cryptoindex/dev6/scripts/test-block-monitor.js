// scripts/test-block-monitor.js
/**
 * 🔍 HyperEVM Block Monitor & Performance Analyzer
 * 
 * Tests and monitors HyperEVM's dual block architecture:
 * - Small Blocks: 1s interval, 2M gas limit
 * - Big Blocks: 60s interval, 30M gas limit
 * 
 * Created: 2025-08-13
 */

const { ethers } = require("hardhat");
// Fallback HyperVM Block Manager (since TypeScript modules need compilation)
let HyperVMBlockManager;
try {
  HyperVMBlockManager = require('../lib/blockchain/hypervm-config').HyperVMBlockManager;
} catch (error) {
  console.log('⚠️ Using fallback HyperVM implementation');
  HyperVMBlockManager = {
    getInstance: () => ({
      async getOptimalTxOptions(type = 'swap') {
        return {
          gasPrice: 1,
          gasLimit: type === 'swap' ? 1500000 : 25000000,
          blockType: type === 'swap' ? 'small' : 'big',
          expectedConfirmationTime: type === 'swap' ? '1-2 seconds' : '60 seconds'
        };
      },
      async getCurrentBlockInfo() {
        const provider = new ethers.JsonRpcProvider('https://rpc.hyperliquid-testnet.xyz/evm');
        const block = await provider.getBlock('latest');
        if (!block) return null;
        
        const gasLimit = block.gasLimit;
        const isSmallBlock = gasLimit <= BigInt(3000000);
        
        return {
          number: block.number,
          timestamp: block.timestamp,
          gasLimit: gasLimit.toString(),
          gasUsed: block.gasUsed.toString(),
          blockType: isSmallBlock ? 'small' : 'big',
          utilization: Number(block.gasUsed * BigInt(100) / gasLimit) + '%'
        };
      }
    })
  };
}

class HyperVMBlockMonitor {
  constructor() {
    this.blockManager = null;
    this.provider = null;
    this.startTime = Date.now();
    this.blockStats = {
      small: { count: 0, totalGasUsed: 0, avgGasUsed: 0 },
      big: { count: 0, totalGasUsed: 0, avgGasUsed: 0 },
      total: 0,
      performance: {
        smallBlockRate: 0,
        bigBlockRate: 0,
        avgConfirmationTime: 0
      }
    };
  }

  async initialize() {
    console.log("🚀 Initializing HyperEVM Block Monitor...");
    
    // Initialize provider and block manager
    this.provider = new ethers.JsonRpcProvider('https://rpc.hyperliquid-testnet.xyz/evm');
    this.blockManager = HyperVMBlockManager.getInstance();
    
    // Get initial network info
    const network = await this.provider.getNetwork();
    console.log(`📡 Connected to Chain ID: ${network.chainId}`);
    
    // Get initial block info
    const currentBlock = await this.blockManager.getCurrentBlockInfo();
    if (currentBlock) {
      console.log(`📊 Current Block: #${currentBlock.number} (${currentBlock.blockType})`);
      console.log(`⛽ Gas: ${currentBlock.gasUsed}/${currentBlock.gasLimit} (${currentBlock.utilization})`);
    }
    
    return currentBlock;
  }

  async monitorBlocks(durationSeconds = 120) {
    console.log(`\n🔍 Monitoring blocks for ${durationSeconds} seconds...`);
    console.log("Expected pattern: ~1 small block per second, ~1 big block per minute\n");
    
    const monitorStart = Date.now();
    let lastBlockNumber = 0;
    let consecutiveSmallBlocks = 0;
    let timeSinceLastBigBlock = 0;
    
    const monitorInterval = setInterval(async () => {
      try {
        const blockInfo = await this.blockManager.getCurrentBlockInfo();
        if (!blockInfo) return;
        
        // New block detected
        if (blockInfo.number > lastBlockNumber) {
          lastBlockNumber = blockInfo.number;
          this.blockStats.total++;
          
          const gasUsed = parseInt(blockInfo.gasUsed);
          const timestamp = new Date().toLocaleTimeString();
          
          if (blockInfo.blockType === 'small') {
            this.blockStats.small.count++;
            this.blockStats.small.totalGasUsed += gasUsed;
            consecutiveSmallBlocks++;
            timeSinceLastBigBlock++;
            
            console.log(`⚡ [${timestamp}] Block #${blockInfo.number}: SMALL (${blockInfo.utilization}) - ${consecutiveSmallBlocks} consecutive small blocks`);
            
          } else {
            this.blockStats.big.count++;
            this.blockStats.big.totalGasUsed += gasUsed;
            consecutiveSmallBlocks = 0;
            timeSinceLastBigBlock = 0;
            
            console.log(`🔥 [${timestamp}] Block #${blockInfo.number}: BIG   (${blockInfo.utilization}) - Reset small block counter`);
          }
          
          // Calculate running averages
          this.blockStats.small.avgGasUsed = this.blockStats.small.count > 0 
            ? Math.floor(this.blockStats.small.totalGasUsed / this.blockStats.small.count) : 0;
          this.blockStats.big.avgGasUsed = this.blockStats.big.count > 0 
            ? Math.floor(this.blockStats.big.totalGasUsed / this.blockStats.big.count) : 0;
        }
        
        // Check if monitoring period is complete
        if (Date.now() - monitorStart >= durationSeconds * 1000) {
          clearInterval(monitorInterval);
          await this.generateReport(durationSeconds);
        }
        
      } catch (error) {
        console.error(`❌ Block monitoring error:`, error.message);
      }
    }, 1000); // Check every second
  }

  async generateReport(duration) {
    console.log("\n" + "=".repeat(80));
    console.log("📊 HyperEVM Block Architecture Performance Report");
    console.log("=".repeat(80));
    
    const elapsedTime = duration;
    this.blockStats.performance.smallBlockRate = this.blockStats.small.count / elapsedTime;
    this.blockStats.performance.bigBlockRate = this.blockStats.big.count / elapsedTime;
    
    console.log(`⏱️  Monitoring Duration: ${duration} seconds`);
    console.log(`📈 Total Blocks Produced: ${this.blockStats.total}`);
    console.log(``);
    
    console.log(`⚡ SMALL BLOCKS (Expected: ~${duration} blocks at 1/second)`);
    console.log(`   Count: ${this.blockStats.small.count}`);
    console.log(`   Rate: ${this.blockStats.performance.smallBlockRate.toFixed(2)} blocks/second`);
    console.log(`   Avg Gas Used: ${this.blockStats.small.avgGasUsed.toLocaleString()}`);
    console.log(`   Performance: ${((this.blockStats.performance.smallBlockRate / 1.0) * 100).toFixed(1)}% of expected`);
    
    console.log(``);
    console.log(`🔥 BIG BLOCKS (Expected: ~${Math.floor(duration/60)} blocks at 1/minute)`);
    console.log(`   Count: ${this.blockStats.big.count}`);
    console.log(`   Rate: ${(this.blockStats.performance.bigBlockRate * 60).toFixed(2)} blocks/minute`);
    console.log(`   Avg Gas Used: ${this.blockStats.big.avgGasUsed.toLocaleString()}`);
    const expectedBigBlocks = Math.max(1, Math.floor(duration / 60));
    console.log(`   Performance: ${((this.blockStats.big.count / expectedBigBlocks) * 100).toFixed(1)}% of expected`);
    
    console.log("\n" + "=".repeat(80));
    
    // Performance Analysis
    console.log("🔬 PERFORMANCE ANALYSIS:");
    
    if (this.blockStats.performance.smallBlockRate >= 0.8) {
      console.log("✅ Small block production: EXCELLENT (≥0.8 blocks/second)");
    } else if (this.blockStats.performance.smallBlockRate >= 0.5) {
      console.log("⚠️  Small block production: MODERATE (0.5-0.8 blocks/second)");
    } else {
      console.log("❌ Small block production: POOR (<0.5 blocks/second)");
    }
    
    if (this.blockStats.big.count >= Math.floor(duration / 60)) {
      console.log("✅ Big block production: ON SCHEDULE");
    } else {
      console.log("⚠️  Big block production: BEHIND SCHEDULE");
    }
    
    // Gas Utilization Analysis
    const smallGasUtil = (this.blockStats.small.avgGasUsed / 2000000) * 100;
    const bigGasUtil = (this.blockStats.big.avgGasUsed / 30000000) * 100;
    
    console.log(`📊 Gas Utilization:`);
    console.log(`   Small Blocks: ${smallGasUtil.toFixed(1)}% (${this.blockStats.small.avgGasUsed.toLocaleString()}/2M)`);
    console.log(`   Big Blocks: ${bigGasUtil.toFixed(1)}% (${this.blockStats.big.avgGasUsed.toLocaleString()}/30M)`);
    
    console.log("\n" + "=".repeat(80));
    
    return this.blockStats;
  }

  async testOptimalGasSettings() {
    console.log("\n🧪 Testing Optimal Gas Settings...");
    
    try {
      const swapSettings = await this.blockManager.getOptimalTxOptions('swap');
      const deploySettings = await this.blockManager.getOptimalTxOptions('deploy');
      const complexSettings = await this.blockManager.getOptimalTxOptions('complex');
      
      console.log("⚡ Swap (Small Block):", swapSettings);
      console.log("🔥 Deploy (Big Block):", deploySettings);  
      console.log("🔥 Complex (Big Block):", complexSettings);
      
      return { swapSettings, deploySettings, complexSettings };
    } catch (error) {
      console.error("❌ Failed to get optimal gas settings:", error);
      return null;
    }
  }
}

async function main() {
  const monitor = new HyperVMBlockMonitor();
  
  try {
    // Initialize monitor
    await monitor.initialize();
    
    // Test gas settings
    await monitor.testOptimalGasSettings();
    
    // Monitor blocks for 2 minutes
    console.log("\n🚀 Starting 2-minute block monitoring session...");
    console.log("💡 This will help identify if AMM swaps are hitting Big Blocks (causing 60s delays)");
    
    await monitor.monitorBlocks(120); // 2 minutes
    
  } catch (error) {
    console.error("💥 Monitor failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log("\n🎉 Block monitoring completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Block monitoring failed:", error);
      process.exit(1);
    });
}

module.exports = { HyperVMBlockMonitor };