const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("========================================");
    console.log("🚀 Deploying Hyperliquid Integration");
    console.log("========================================\n");
    
    // Get deployer
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH\n");
    
    // Deploy Mock Tokens (for testing)
    console.log("📋 Deploying Mock Tokens...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    
    const HYPE = await MockERC20.deploy(
        "Hyperliquid Token",
        "HYPE",
        ethers.parseEther("1000000")
    );
    await HYPE.waitForDeployment();
    console.log("✅ HYPE Token:", await HYPE.getAddress());
    
    const USDC = await MockERC20.deploy(
        "USD Coin",
        "USDC",
        ethers.parseEther("1000000")
    );
    await USDC.waitForDeployment();
    console.log("✅ USDC Token:", await USDC.getAddress());
    
    // Deploy MockPriceFeed
    console.log("\n📋 Deploying Price Feed...");
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const priceFeed = await MockPriceFeed.deploy();
    await priceFeed.waitForDeployment();
    console.log("✅ Price Feed:", await priceFeed.getAddress());
    
    // Set initial prices
    await priceFeed.setPrice(await HYPE.getAddress(), ethers.parseEther("10"));
    await priceFeed.setPrice(await USDC.getAddress(), ethers.parseEther("1"));
    
    // Deploy MultiDEXAggregator
    console.log("\n📋 Deploying MultiDEX Aggregator...");
    const MultiDEXAggregator = await ethers.getContractFactory("MultiDEXAggregator");
    const aggregator = await MultiDEXAggregator.deploy(await priceFeed.getAddress());
    await aggregator.waitForDeployment();
    console.log("✅ Aggregator:", await aggregator.getAddress());
    
    // Deploy HyperliquidAdapter
    console.log("\n📋 Deploying Hyperliquid Adapter...");
    const HyperliquidAdapter = await ethers.getContractFactory("HyperliquidAdapter");
    const adapter = await HyperliquidAdapter.deploy(await aggregator.getAddress());
    await adapter.waitForDeployment();
    console.log("✅ Hyperliquid Adapter:", await adapter.getAddress());
    
    // Configure Hyperliquid (using mock addresses for now)
    console.log("\n⚙️ Configuring Hyperliquid...");
    
    // For testnet, we'll use mock addresses
    // In production, these would be actual Hyperliquid contracts
    const mockDEX = await HYPE.getAddress(); // Placeholder
    const mockOracle = await priceFeed.getAddress();
    const mockVault = await USDC.getAddress(); // Placeholder
    
    await adapter.configureHyperliquid(mockDEX, mockOracle, mockVault);
    console.log("✅ Hyperliquid configured");
    
    // Deploy SmartIndexVault with Hyperliquid integration
    console.log("\n📋 Deploying Smart Index Vault...");
    const SmartIndexVault = await ethers.getContractFactory("SmartIndexVault");
    const vault = await SmartIndexVault.deploy(
        await USDC.getAddress(),
        "Hyperliquid Index Vault",
        "HIVault"
    );
    await vault.waitForDeployment();
    console.log("✅ Smart Index Vault:", await vault.getAddress());
    
    // Deploy IndexTokenFactory
    console.log("\n📋 Deploying Index Token Factory...");
    const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
    const factory = await IndexTokenFactory.deploy(await priceFeed.getAddress());
    await factory.waitForDeployment();
    console.log("✅ Index Token Factory:", await factory.getAddress());
    
    // Grant roles
    console.log("\n⚙️ Setting up roles...");
    const OPERATOR_ROLE = await adapter.OPERATOR_ROLE();
    await adapter.grantRole(OPERATOR_ROLE, deployer.address);
    console.log("✅ Roles configured");
    
    // Save deployment info
    const deployment = {
        network: hre.network.name,
        chainId: (await ethers.provider.getNetwork()).chainId,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            HYPE: await HYPE.getAddress(),
            USDC: await USDC.getAddress(),
            priceFeed: await priceFeed.getAddress(),
            aggregator: await aggregator.getAddress(),
            adapter: await adapter.getAddress(),
            vault: await vault.getAddress(),
            factory: await factory.getAddress()
        }
    };
    
    console.log("\n========================================");
    console.log("✅ DEPLOYMENT COMPLETE!");
    console.log("========================================");
    console.log("\n📄 Deployment Summary:");
    console.log(JSON.stringify(deployment, null, 2));
    
    // Save to file
    const fs = require("fs");
    const filename = `deployments/hyperliquid-${hre.network.name}-${Date.now()}.json`;
    
    // Create deployments directory if it doesn't exist
    if (!fs.existsSync("deployments")) {
        fs.mkdirSync("deployments");
    }
    
    fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));
    console.log(`\n💾 Deployment saved to: ${filename}`);
    
    return deployment;
}

// Error handling
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
