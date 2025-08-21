const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Checking HyperEVM Testnet Connection...\n");
    
    try {
        // Get network info
        const network = await ethers.provider.getNetwork();
        console.log("📡 Network Info:");
        console.log("   Chain ID:", network.chainId);
        console.log("   Network Name:", network.name);
        
        // Get latest block
        const blockNumber = await ethers.provider.getBlockNumber();
        console.log("   Latest Block:", blockNumber);
        
        // Get signers
        const [signer] = await ethers.getSigners();
        console.log("\n👤 Account Info:");
        console.log("   Address:", signer.address);
        
        // Get balance
        const balance = await signer.getBalance();
        console.log("   Balance:", ethers.utils.formatEther(balance), "ETH");
        
        // Check if we have enough balance for deployment
        const minBalance = ethers.utils.parseEther("0.01"); // 0.01 ETH minimum
        if (balance.lt(minBalance)) {
            console.log("\n⚠️  WARNING: Low balance! You may need testnet tokens.");
            console.log("   Recommended: Get testnet tokens from HyperLiquid faucet");
        } else {
            console.log("\n✅ Balance looks good for testing!");
        }
        
        console.log("\n🚀 Ready for contract deployment and testing!");
        
    } catch (error) {
        console.error("\n❌ Connection failed:", error.message);
        console.log("\n🔧 Troubleshooting:");
        console.log("1. Check PRIVATE_KEY in .env.local");
        console.log("2. Verify RPC URL is correct");
        console.log("3. Ensure account has testnet tokens");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
