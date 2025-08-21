// scripts/verify-usdc-contract.js
/**
 * 🔍 Verify USDC Contract on HyperEVM Testnet
 * Checks if the official USDC token is properly deployed
 */

const { ethers } = require("hardhat");

// Official Hyperliquid testnet USDC address
const USDC_ADDRESS = "0xd9CBEC81df392A88AEff575E962d149d57F4d6bc";

// Basic ERC20 ABI for verification
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)"
];

async function main() {
  console.log("🔍 Verifying USDC Contract on HyperEVM Testnet...\n");

  try {
    // Get provider
    const provider = ethers.provider;
    const network = await provider.getNetwork();
    console.log("📡 Connected to network:", network.name, "(Chain ID:", network.chainId.toString(), ")");

    // Check if contract exists
    const code = await provider.getCode(USDC_ADDRESS);
    if (code === "0x") {
      console.error("❌ No contract found at address:", USDC_ADDRESS);
      console.error("⚠️  WARNING: The USDC token may not be deployed on this network!");
      process.exit(1);
    }

    console.log("✅ Contract found at address:", USDC_ADDRESS);
    console.log("📝 Contract bytecode length:", code.length);

    // Create contract instance
    const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);

    // Verify token details
    console.log("\n📊 Token Details:");
    
    try {
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        usdcContract.name(),
        usdcContract.symbol(),
        usdcContract.decimals(),
        usdcContract.totalSupply()
      ]);

      console.log("  Name:", name);
      console.log("  Symbol:", symbol);
      console.log("  Decimals:", decimals);
      console.log("  Total Supply:", ethers.formatUnits(totalSupply, decimals));

      // Verify expected values
      if (symbol === "USDC" && decimals === 6) {
        console.log("\n✅ Token verification PASSED!");
        console.log("✅ This appears to be the correct USDC contract.");
        console.log("✅ Safe to proceed with bridging.");
      } else {
        console.log("\n⚠️  WARNING: Token details don't match expected USDC values!");
        console.log("Expected: Symbol=USDC, Decimals=6");
        console.log("Got: Symbol=" + symbol + ", Decimals=" + decimals);
      }

    } catch (error) {
      console.error("\n❌ Failed to read token details:", error.message);
      console.error("⚠️  This may not be a standard ERC20 token!");
    }

    // Get a test balance (optional)
    if (process.argv.length > 2) {
      const testAddress = process.argv[2];
      console.log("\n🔍 Checking balance for address:", testAddress);
      try {
        const balance = await usdcContract.balanceOf(testAddress);
        console.log("💰 Balance:", ethers.formatUnits(balance, 6), "USDC");
      } catch (error) {
        console.error("❌ Failed to check balance:", error.message);
      }
    }

  } catch (error) {
    console.error("\n❌ Verification failed:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log("\n✅ Verification complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script error:", error);
    process.exit(1);
  });