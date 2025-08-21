const { ethers } = require("hardhat");

/**
 * Setup script for configuring the deployed IndexTokenFactory
 * Run this after deployment to set up initial configuration
 */
async function main() {
    console.log("⚙️ Setting up IndexTokenFactory configuration...\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("Setting up with account:", deployer.address);
    
    // Get factory address from deployment (update this with actual deployed address)
    const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || "";
    if (!FACTORY_ADDRESS) {
        throw new Error("Please set FACTORY_ADDRESS environment variable");
    }
    
    const factory = await ethers.getContractAt("IndexTokenFactory", FACTORY_ADDRESS);
    console.log("Connected to factory at:", FACTORY_ADDRESS);
    
    // Example token addresses for Hyperliquid (update with actual addresses)
    const tokenConfig = {
        "HYPE": {
            address: "0x...", // Update with actual HYPE token address
            assetIndex: 0,    // Update with actual Hyperliquid asset index
            name: "Hyperliquid Native Token"
        },
        "BTC": {
            address: "0x...", // Update with actual wrapped BTC address
            assetIndex: 1,
            name: "Bitcoin"
        },
        "ETH": {
            address: "0x...", // Update with actual wrapped ETH address
            assetIndex: 2,
            name: "Ethereum"
        },
        "USDC": {
            address: "0x...", // Update with actual USDC address
            assetIndex: 3,
            name: "USD Coin"
        }
    };
    
    console.log("\n🪙 Authorizing tokens...");
    for (const [symbol, config] of Object.entries(tokenConfig)) {
        if (config.address.startsWith("0x")) {
            try {
                console.log(`   Authorizing ${symbol} (${config.name})...`);
                const tx = await factory.authorizeToken(config.address, true);
                await tx.wait();
                console.log(`   ✅ ${symbol} authorized`);
            } catch (error) {
                console.log(`   ❌ Failed to authorize ${symbol}:`, error.message);
            }
        } else {
            console.log(`   ⏭️ Skipping ${symbol} (address not set)`);
        }
    }
    
    console.log("\n👥 Setting up recipe creators...");
    const recipeCreators = [
        {
            address: "0x...", // Add actual institution addresses
            name: "Example Institution 1"
        },
        {
            address: "0x...",
            name: "Example Institution 2"
        }
    ];
    
    for (const creator of recipeCreators) {
        if (creator.address.startsWith("0x") && creator.address.length === 42) {
            try {
                console.log(`   Granting role to ${creator.name}...`);
                const tx = await factory.grantRecipeCreatorRole(creator.address);
                await tx.wait();
                console.log(`   ✅ Role granted to ${creator.address}`);
            } catch (error) {
                console.log(`   ❌ Failed to grant role:`, error.message);
            }
        } else {
            console.log(`   ⏭️ Skipping ${creator.name} (invalid address)`);
        }
    }
    
    console.log("\n💰 Setting fee configuration...");
    try {
        // Set fees: 0.5% annual management fee, 0.1% issuance fee
        const tx = await factory.setFees(50, 10);
        await tx.wait();
        console.log("   ✅ Fees configured: 0.5% management, 0.1% issuance");
    } catch (error) {
        console.log("   ❌ Failed to set fees:", error.message);
    }
    
    console.log("\n📊 Current factory status:");
    console.log("==========================================");
    console.log("Factory Address:", FACTORY_ADDRESS);
    console.log("Annual Management Fee:", await factory.annualManagementFee(), "basis points");
    console.log("Issuance Fee:", await factory.issuanceFee(), "basis points");
    console.log("Fee Recipient:", await factory.feeRecipient());
    
    // Check roles
    const DEFAULT_ADMIN_ROLE = await factory.DEFAULT_ADMIN_ROLE();
    const hasAdminRole = await factory.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
    console.log("Deployer has admin role:", hasAdminRole);
    
    console.log("==========================================\n");
    
    console.log("✅ Setup completed!");
    console.log("\n📖 Next steps:");
    console.log("1. Update token addresses in tokenConfig with real addresses");
    console.log("2. Add real institution addresses to recipeCreators");
    console.log("3. Test fund creation with authorized institutions");
    console.log("4. Monitor contract events and functionality");
}

/**
 * Create a sample fund for testing
 */
async function createSampleFund() {
    const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS;
    if (!FACTORY_ADDRESS) {
        throw new Error("Please set FACTORY_ADDRESS environment variable");
    }
    
    const factory = await ethers.getContractAt("IndexTokenFactory", FACTORY_ADDRESS);
    const [deployer] = await ethers.getSigners();
    
    // Check if deployer has recipe creator role
    const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
    const hasRole = await factory.hasRole(RECIPE_CREATOR_ROLE, deployer.address);
    
    if (!hasRole) {
        console.log("⚠️ Deployer doesn't have RECIPE_CREATOR_ROLE. Granting role...");
        await factory.grantRecipeCreatorRole(deployer.address);
        console.log("✅ Role granted!");
    }
    
    // Sample components (update with real addresses and asset indices)
    const components = [
        {
            tokenAddress: "0x1234567890123456789012345678901234567890", // Mock BTC
            hyperliquidAssetIndex: 1,
            targetRatio: 4000, // 40%
            depositedAmount: 0
        },
        {
            tokenAddress: "0x2345678901234567890123456789012345678901", // Mock ETH
            hyperliquidAssetIndex: 2,
            targetRatio: 3000, // 30%
            depositedAmount: 0
        },
        {
            tokenAddress: "0x3456789012345678901234567890123456789012", // Mock SOL
            hyperliquidAssetIndex: 3,
            targetRatio: 3000, // 30%
            depositedAmount: 0
        }
    ];
    
    console.log("Creating sample fund...");
    const tx = await factory.createIndexFund(
        "Sample Crypto Index",
        "SCINDEX",
        components
    );
    
    const receipt = await tx.wait();
    const event = receipt.events.find(e => e.event === "FundCreated");
    const fundId = event.args.fundId;
    
    console.log("✅ Sample fund created with ID:", fundId);
    
    return fundId;
}

// Run main setup function
main()
    .then(() => {
        console.log("✅ Configuration completed!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Setup failed:", error);
        process.exit(1);
    });
