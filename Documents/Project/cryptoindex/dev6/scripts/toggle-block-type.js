// scripts/toggle-block-type.js
require("dotenv").config();
const { execSync } = require("child_process");

const blockSize = process.argv[2] || 'big';
const privateKey = process.env.PRIVATE_KEY;

if (!privateKey) {
  console.error("❌ PRIVATE_KEY not found in .env file");
  process.exit(1);
}

console.log(`🔄 Switching to ${blockSize.toUpperCase()} blocks...`);

try {
  const command = `npx @layerzerolabs/hyperliquid-composer set-block --size ${blockSize} --network testnet --private-key ${privateKey}`;
  execSync(command, { stdio: 'inherit' });
  console.log(`✅ Successfully switched to ${blockSize.toUpperCase()} blocks!`);
} catch (error) {
  console.error("❌ Failed to switch blocks:", error.message);
  console.log("\n📝 Please try manual method:");
  console.log("1. Visit https://app.hyperliquid.xyz/");
  console.log("2. Go to Settings → EVM Settings");
  console.log(`3. Select ${blockSize.toUpperCase()} Blocks`);
}
