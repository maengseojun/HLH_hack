const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying Hyperliquid Index Token Platform...\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH\n");
    
    // Deploy IndexTokenFactory
    console.log("📦 Deploying IndexTokenFactory...");
    const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
    
    // Use deployer as initial fee recipient (can be changed later)
    const feeRecipient = process.env.FEE_RECIPIENT_ADDRESS || deployer.address;
    const factory = await IndexTokenFactory.deploy(feeRecipient);
    
    await factory.deployed();
    console.log("✅ IndexTokenFactory deployed to:", factory.address);
    console.log("   Fee recipient:", feeRecipient);
    
    // Setup initial configuration
    console.log("\n🔧 Setting up initial configuration...");
    
    // Authorize some common tokens (you'll need to update these addresses for actual deployment)
    const commonTokens = [
        // Add actual token addresses here
        // "0x...", // WETH
        // "0x...", // WBTC
        // "0x...", // USDC
    ];
    
    for (const token of commonTokens) {
        if (token && token.startsWith("0x")) {
            console.log("   Authorizing token:", token);
            await factory.authorizeToken(token, true);
        }
    }
    
    // Grant recipe creator roles if specified in environment
    const recipeCreators = process.env.RECIPE_CREATORS?.split(',') || [];
    for (const creator of recipeCreators) {
        if (creator && creator.startsWith("0x")) {
            console.log("   Granting RECIPE_CREATOR_ROLE to:", creator);
            await factory.grantRecipeCreatorRole(creator);
        }
    }
    
    console.log("\n📋 Deployment Summary:");
    console.log("==========================================");
    console.log("IndexTokenFactory:", factory.address);
    console.log("Deployer:", deployer.address);
    console.log("Fee Recipient:", feeRecipient);
    console.log("Network:", network.name);
    console.log("==========================================\n");
    
    // Save deployment info
    const deploymentInfo = {
        network: network.name,
        chainId: network.config.chainId,
        contracts: {
            IndexTokenFactory: factory.address
        },
        deployer: deployer.address,
        feeRecipient: feeRecipient,
        deployedAt: new Date().toISOString(),
        blockNumber: await ethers.provider.getBlockNumber()
    };
    
    // You can save this to a file if needed
    console.log("💾 Deployment info:", JSON.stringify(deploymentInfo, null, 2));
    
    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n📖 Next steps:");
    console.log("1. Verify contracts on block explorer");
    console.log("2. Update frontend configuration with contract addresses");
    console.log("3. Grant RECIPE_CREATOR_ROLE to authorized institutions");
    console.log("4. Authorize tokens that can be used in index funds");
    console.log("5. Test with small fund creation and token issuance");
    
    return factory.address;
}

main()
    .then((factoryAddress) => {
        console.log("\n✅ All done! Factory address:", factoryAddress);
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    });
