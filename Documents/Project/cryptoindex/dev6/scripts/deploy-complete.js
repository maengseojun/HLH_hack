const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("========================================");
    console.log("🚀 Deploying Hyperliquid Index Platform");
    console.log("========================================\n");
    
    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH\n");
    
    // Deploy MockPriceFeed (for testnet)
    console.log("📋 Deploying MockPriceFeed...");
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const priceFeed = await MockPriceFeed.deploy();
    await priceFeed.waitForDeployment();
    console.log("✅ MockPriceFeed deployed to:", await priceFeed.getAddress());
    
    // Deploy IndexTokenFactory
    console.log("\n📋 Deploying IndexTokenFactory...");
    const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
    const factory = await IndexTokenFactory.deploy(await priceFeed.getAddress());
    await factory.waitForDeployment();
    console.log("✅ IndexTokenFactory deployed to:", await factory.getAddress());
    
    // Deploy Mock Tokens for testing
    console.log("\n📋 Deploying Mock Tokens...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    
    const tokenA = await MockERC20.deploy(
        "Mock Ethereum",
        "mETH",
        ethers.parseEther("1000000")
    );
    await tokenA.waitForDeployment();
    console.log("✅ Mock ETH deployed to:", await tokenA.getAddress());
    
    const tokenB = await MockERC20.deploy(
        "Mock Bitcoin",
        "mBTC",
        ethers.parseEther("1000000")
    );
    await tokenB.waitForDeployment();
    console.log("✅ Mock BTC deployed to:", await tokenB.getAddress());
    
    const tokenC = await MockERC20.deploy(
        "Mock USDC",
        "mUSDC",
        ethers.parseEther("1000000")
    );
    await tokenC.waitForDeployment();
    console.log("✅ Mock USDC deployed to:", await tokenC.getAddress());
    
    // Deploy SmartIndexVault
    console.log("\n📋 Deploying SmartIndexVault...");
    const SmartIndexVault = await ethers.getContractFactory("SmartIndexVault");
    const vault = await SmartIndexVault.deploy(
        await tokenC.getAddress(),
        "Index Vault Shares",
        "IVS"
    );
    await vault.waitForDeployment();
    console.log("✅ SmartIndexVault deployed to:", await vault.getAddress());
    
    // Deploy MultiDEXAggregator
    console.log("\n📋 Deploying MultiDEXAggregator...");
    const MultiDEXAggregator = await ethers.getContractFactory("MultiDEXAggregator");
    const aggregator = await MultiDEXAggregator.deploy(await priceFeed.getAddress());
    await aggregator.waitForDeployment();
    console.log("✅ MultiDEXAggregator deployed to:", await aggregator.getAddress());
    
    // Setup initial configuration
    console.log("\n========================================");
    console.log("⚙️  Configuring Contracts");
    console.log("========================================\n");
    
    // Set token prices in price feed
    console.log("Setting token prices...");
    await priceFeed.setPrice(await tokenA.getAddress(), ethers.parseEther("2000"));
    await priceFeed.setPrice(await tokenB.getAddress(), ethers.parseEther("40000"));
    await priceFeed.setPrice(await tokenC.getAddress(), ethers.parseEther("1"));
    console.log("✅ Token prices set");
    
    // Setup roles for factory
    console.log("\nSetting up factory roles...");
    const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
    const PLATFORM_ADMIN_ROLE = await factory.PLATFORM_ADMIN_ROLE();
    
    await factory.grantRole(RECIPE_CREATOR_ROLE, deployer.address);
    await factory.grantRole(PLATFORM_ADMIN_ROLE, deployer.address);
    console.log("✅ Factory roles configured");
    
    // Authorize tokens in factory
    console.log("\nAuthorizing tokens...");
    await factory.authorizeToken(await tokenA.getAddress());
    await factory.authorizeToken(await tokenB.getAddress());
    await factory.authorizeToken(await tokenC.getAddress());
    console.log("✅ Tokens authorized");
    
    // Setup vault roles
    console.log("\nSetting up vault roles...");
    const MANAGER_ROLE = await vault.MANAGER_ROLE();
    await vault.grantRole(MANAGER_ROLE, deployer.address);
    console.log("✅ Vault roles configured");
    
    // Create sample index fund
    console.log("\n========================================");
    console.log("📊 Creating Sample Index Fund");
    console.log("========================================\n");
    
    const fundName = "Crypto Index Top 3";
    const fundSymbol = "CIT3";
    const components = [
        { tokenAddress: await tokenA.getAddress(), targetRatio: 4000 }, // 40%
        { tokenAddress: await tokenB.getAddress(), targetRatio: 4000 }, // 40%
        { tokenAddress: await tokenC.getAddress(), targetRatio: 2000 }  // 20%
    ];
    
    console.log("Creating index fund:", fundName);
    await factory.createIndexFund(fundName, fundSymbol, components);
    console.log("✅ Sample index fund created");
    
    // Save deployment addresses
    const deploymentInfo = {
        network: hre.network.name,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            priceFeed: await priceFeed.getAddress(),
            factory: await factory.getAddress(),
            vault: await vault.getAddress(),
            aggregator: await aggregator.getAddress(),
            mockTokens: {
                ETH: await tokenA.getAddress(),
                BTC: await tokenB.getAddress(),
                USDC: await tokenC.getAddress()
            }
        },
        sampleFund: {
            name: fundName,
            symbol: fundSymbol,
            components: components
        }
    };
    
    // Write deployment info to file
    const fs = require("fs");
    const filename = `deployments-${hre.network.name}-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    
    console.log("\n========================================");
    console.log("✅ Deployment Complete!");
    console.log("========================================");
    console.log("\nDeployment info saved to:", filename);
    console.log("\nContract Addresses:");
    console.log("-------------------");
    console.log("PriceFeed:", deploymentInfo.contracts.priceFeed);
    console.log("Factory:", deploymentInfo.contracts.factory);
    console.log("Vault:", deploymentInfo.contracts.vault);
    console.log("Aggregator:", deploymentInfo.contracts.aggregator);
    console.log("\nMock Tokens:");
    console.log("------------");
    console.log("ETH:", deploymentInfo.contracts.mockTokens.ETH);
    console.log("BTC:", deploymentInfo.contracts.mockTokens.BTC);
    console.log("USDC:", deploymentInfo.contracts.mockTokens.USDC);
    
    // Verify contracts if not on localhost
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        console.log("\n========================================");
        console.log("📝 Preparing Contract Verification");
        console.log("========================================");
        console.log("\nRun the following commands to verify:");
        console.log(`npx hardhat verify --network ${hre.network.name} ${deploymentInfo.contracts.priceFeed}`);
        console.log(`npx hardhat verify --network ${hre.network.name} ${deploymentInfo.contracts.factory} ${deploymentInfo.contracts.priceFeed}`);
        console.log(`npx hardhat verify --network ${hre.network.name} ${deploymentInfo.contracts.vault} ${deploymentInfo.contracts.mockTokens.USDC} "Index Vault Shares" "IVS"`);
        console.log(`npx hardhat verify --network ${hre.network.name} ${deploymentInfo.contracts.aggregator} ${deploymentInfo.contracts.priceFeed}`);
    }
}

// Execute deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
