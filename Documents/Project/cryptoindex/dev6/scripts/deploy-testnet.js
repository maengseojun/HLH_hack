const hre = require("hardhat");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Color codes for console output
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    red: "\x1b[31m"
};

async function main() {
    console.log(`${colors.bright}${colors.blue}========================================${colors.reset}`);
    console.log(`${colors.bright}🚀 Testnet Deployment Script${colors.reset}`);
    console.log(`${colors.bright}Network: ${colors.yellow}${hre.network.name}${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}========================================${colors.reset}\n`);
    
    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log(`${colors.bright}Deployer:${colors.reset} ${deployer.address}`);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`${colors.bright}Balance:${colors.reset} ${ethers.formatEther(balance)} ETH\n`);
    
    // Check minimum balance
    const minBalance = ethers.parseEther("0.1");
    if (balance < minBalance) {
        console.log(`${colors.red}❌ Insufficient balance. Need at least 0.1 ETH${colors.reset}`);
        process.exit(1);
    }
    
    const contracts = {};
    const gasUsed = {};
    
    try {
        // 1. Deploy Price Feed
        console.log(`${colors.yellow}📋 Deploying MockPriceFeed...${colors.reset}`);
        const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
        const priceFeed = await MockPriceFeed.deploy();
        await priceFeed.waitForDeployment();
        contracts.priceFeed = await priceFeed.getAddress();
        gasUsed.priceFeed = (await priceFeed.deploymentTransaction().wait()).gasUsed;
        console.log(`${colors.green}✅ PriceFeed deployed to:${colors.reset} ${contracts.priceFeed}`);
        console.log(`   Gas used: ${gasUsed.priceFeed.toString()}\n`);
        
        // 2. Deploy IndexTokenFactory
        console.log(`${colors.yellow}📋 Deploying IndexTokenFactory...${colors.reset}`);
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        const factory = await IndexTokenFactory.deploy(contracts.priceFeed);
        await factory.waitForDeployment();
        contracts.factory = await factory.getAddress();
        gasUsed.factory = (await factory.deploymentTransaction().wait()).gasUsed;
        console.log(`${colors.green}✅ Factory deployed to:${colors.reset} ${contracts.factory}`);
        console.log(`   Gas used: ${gasUsed.factory.toString()}\n`);
        
        // 3. Deploy Test Tokens
        console.log(`${colors.yellow}📋 Deploying Test Tokens...${colors.reset}`);
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        
        const tokens = [
            { name: "Wrapped Ether", symbol: "WETH", price: "2000" },
            { name: "Wrapped Bitcoin", symbol: "WBTC", price: "40000" },
            { name: "USD Coin", symbol: "USDC", price: "1" }
        ];
        
        contracts.tokens = {};
        
        for (const token of tokens) {
            const contract = await MockERC20.deploy(
                token.name,
                token.symbol,
                ethers.parseEther("1000000")
            );
            await contract.waitForDeployment();
            const address = await contract.getAddress();
            contracts.tokens[token.symbol] = address;
            
            // Set price
            await priceFeed.setPrice(address, ethers.parseEther(token.price));
            console.log(`${colors.green}✅ ${token.symbol} deployed to:${colors.reset} ${address}`);
        }
        console.log();
        
        // 4. Deploy SmartIndexVault
        console.log(`${colors.yellow}📋 Deploying SmartIndexVault...${colors.reset}`);
        const SmartIndexVault = await ethers.getContractFactory("SmartIndexVault");
        const vault = await SmartIndexVault.deploy(
            contracts.tokens.USDC,
            "Index Vault Shares",
            "IVS"
        );
        await vault.waitForDeployment();
        contracts.vault = await vault.getAddress();
        gasUsed.vault = (await vault.deploymentTransaction().wait()).gasUsed;
        console.log(`${colors.green}✅ Vault deployed to:${colors.reset} ${contracts.vault}`);
        console.log(`   Gas used: ${gasUsed.vault.toString()}\n`);
        
        // 5. Deploy MultiDEXAggregator
        console.log(`${colors.yellow}📋 Deploying MultiDEXAggregator...${colors.reset}`);
        const MultiDEXAggregator = await ethers.getContractFactory("MultiDEXAggregator");
        const aggregator = await MultiDEXAggregator.deploy(contracts.priceFeed);
        await aggregator.waitForDeployment();
        contracts.aggregator = await aggregator.getAddress();
        gasUsed.aggregator = (await aggregator.deploymentTransaction().wait()).gasUsed;
        console.log(`${colors.green}✅ Aggregator deployed to:${colors.reset} ${contracts.aggregator}`);
        console.log(`   Gas used: ${gasUsed.aggregator.toString()}\n`);
        
        // 6. Configure Contracts
        console.log(`${colors.yellow}⚙️  Configuring contracts...${colors.reset}`);
        
        // Setup factory roles
        const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
        const PLATFORM_ADMIN_ROLE = await factory.PLATFORM_ADMIN_ROLE();
        await factory.grantRole(RECIPE_CREATOR_ROLE, deployer.address);
        await factory.grantRole(PLATFORM_ADMIN_ROLE, deployer.address);
        console.log(`${colors.green}✅ Factory roles configured${colors.reset}`);
        
        // Authorize tokens
        for (const symbol of Object.keys(contracts.tokens)) {
            await factory.authorizeToken(contracts.tokens[symbol]);
        }
        console.log(`${colors.green}✅ Tokens authorized${colors.reset}`);
        
        // Setup vault roles
        const MANAGER_ROLE = await vault.MANAGER_ROLE();
        await vault.grantRole(MANAGER_ROLE, deployer.address);
        console.log(`${colors.green}✅ Vault roles configured${colors.reset}\n`);
        
        // 7. Create Sample Index Fund
        console.log(`${colors.yellow}📊 Creating sample index fund...${colors.reset}`);
        const fundName = "DeFi Blue Chip Index";
        const fundSymbol = "DBI";
        const components = [
            { tokenAddress: contracts.tokens.WETH, targetRatio: 5000 },  // 50%
            { tokenAddress: contracts.tokens.WBTC, targetRatio: 3000 },  // 30%
            { tokenAddress: contracts.tokens.USDC, targetRatio: 2000 }   // 20%
        ];
        
        const createTx = await factory.createIndexFund(fundName, fundSymbol, components);
        await createTx.wait();
        console.log(`${colors.green}✅ Index fund created: ${fundName} (${fundSymbol})${colors.reset}\n`);
        
        // Calculate total gas used
        const totalGas = Object.values(gasUsed).reduce((sum, gas) => sum + gas, 0n);
        
        // Save deployment info
        const deploymentInfo = {
            network: hre.network.name,
            chainId: (await ethers.provider.getNetwork()).chainId,
            deployer: deployer.address,
            timestamp: new Date().toISOString(),
            contracts: contracts,
            gasUsed: {
                priceFeed: gasUsed.priceFeed.toString(),
                factory: gasUsed.factory.toString(),
                vault: gasUsed.vault.toString(),
                aggregator: gasUsed.aggregator.toString(),
                total: totalGas.toString()
            },
            sampleFund: {
                name: fundName,
                symbol: fundSymbol,
                components: components
            }
        };
        
        // Save to file
        const filename = `deployments/${hre.network.name}-${Date.now()}.json`;
        const dir = path.dirname(filename);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
        
        // Print summary
        console.log(`${colors.bright}${colors.blue}========================================${colors.reset}`);
        console.log(`${colors.bright}${colors.green}✅ DEPLOYMENT SUCCESSFUL!${colors.reset}`);
        console.log(`${colors.bright}${colors.blue}========================================${colors.reset}\n`);
        
        console.log(`${colors.bright}📊 Deployment Summary:${colors.reset}`);
        console.log(`${colors.bright}Network:${colors.reset} ${hre.network.name}`);
        console.log(`${colors.bright}Chain ID:${colors.reset} ${deploymentInfo.chainId}`);
        console.log(`${colors.bright}Total Gas Used:${colors.reset} ${totalGas.toString()}`);
        console.log(`${colors.bright}Deployment File:${colors.reset} ${filename}\n`);
        
        console.log(`${colors.bright}📝 Contract Addresses:${colors.reset}`);
        console.log(`PriceFeed:    ${contracts.priceFeed}`);
        console.log(`Factory:      ${contracts.factory}`);
        console.log(`Vault:        ${contracts.vault}`);
        console.log(`Aggregator:   ${contracts.aggregator}`);
        console.log(`WETH Token:   ${contracts.tokens.WETH}`);
        console.log(`WBTC Token:   ${contracts.tokens.WBTC}`);
        console.log(`USDC Token:   ${contracts.tokens.USDC}\n`);
        
        // Verification commands
        if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
            console.log(`${colors.bright}🔍 To verify contracts, run:${colors.reset}`);
            console.log(`npx hardhat verify --network ${hre.network.name} ${contracts.priceFeed}`);
            console.log(`npx hardhat verify --network ${hre.network.name} ${contracts.factory} ${contracts.priceFeed}`);
            console.log(`npx hardhat verify --network ${hre.network.name} ${contracts.vault} ${contracts.tokens.USDC} "Index Vault Shares" "IVS"`);
            console.log(`npx hardhat verify --network ${hre.network.name} ${contracts.aggregator} ${contracts.priceFeed}`);
        }
        
    } catch (error) {
        console.log(`${colors.red}❌ Deployment failed:${colors.reset}`);
        console.error(error);
        process.exit(1);
    }
}

// Execute deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
