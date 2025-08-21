// HOOATS Integration Script
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🔗 HOOATS System Integration...\n");
  
  // Load deployment
  const files = fs.readdirSync('.').filter(f => f.startsWith('deployment-998-'));
  const deployment = JSON.parse(fs.readFileSync(files.sort().pop(), 'utf8'));
  
  console.log("✅ AMM Contracts:");
  console.log("- Factory:", deployment.contracts.factory);
  console.log("- Router:", deployment.contracts.router);
  console.log("- Pair:", deployment.contracts.pair);
  
  console.log("\n📊 Integration Steps:");
  console.log("1. Update lib/config/hypervm-config.ts with addresses");
  console.log("2. Start Redis: npm run redis");
  console.log("3. Run tests: npx ts-node tests/SecurityTestRunner.ts");
  console.log("4. Monitor TPS: node scripts/monitor-performance.js");
  
  console.log("\n🎯 HOOATS Features:");
  console.log("- Small orders → AMM (low slippage)");
  console.log("- Large orders → Orderbook (better price)");
  console.log("- Smart routing → Best execution");
  
  // Save config
  fs.writeFileSync(`hooats-config-${Date.now()}.json`, JSON.stringify({
    amm: deployment.contracts,
    orderbook: { redis: "localhost:6379" },
    target: { tps: 15000, latency: "1ms" }
  }, null, 2));
  
  console.log("\n✅ Integration ready!");
}

main().catch(console.error);
