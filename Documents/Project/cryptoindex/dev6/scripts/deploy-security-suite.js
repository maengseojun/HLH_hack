const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy Security Enhancement Suite
 * Automated deployment script for all security modules
 */
async function main() {
    console.log("🚀 Starting Security Suite Deployment...\n");
    
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with account: ${deployer.address}`);
    console.log(`Account balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH\n`);
    
    const deployments = {};
    const networkName = hre.network.name;
    
    try {
        // 1. Deploy SecurityEnhancements
        console.log("📡 Deploying SecurityEnhancements...");
        const SecurityEnhancements = await ethers.getContractFactory("SecurityEnhancements");
        const securityEnhancements = await SecurityEnhancements.deploy();
        await securityEnhancements.deployed();
        deployments.SecurityEnhancements = securityEnhancements.address;
        console.log(`✅ SecurityEnhancements deployed to: ${securityEnhancements.address}`);
        
        // 2. Deploy EnhancedOracleManager
        console.log("\n📡 Deploying EnhancedOracleManager...");
        const EnhancedOracleManager = await ethers.getContractFactory("EnhancedOracleManager");
        const oracleManager = await EnhancedOracleManager.deploy();
        await oracleManager.deployed();
        deployments.EnhancedOracleManager = oracleManager.address;
        console.log(`✅ EnhancedOracleManager deployed to: ${oracleManager.address}`);
        
        // 3. Deploy LiquidityProtection
        console.log("\n📡 Deploying LiquidityProtection...");
        const LiquidityProtection = await ethers.getContractFactory("LiquidityProtection");
        const liquidityProtection = await LiquidityProtection.deploy();
        await liquidityProtection.deployed();
        deployments.LiquidityProtection = liquidityProtection.address;
        console.log(`✅ LiquidityProtection deployed to: ${liquidityProtection.address}`);
        
        // 4. Deploy Mock contracts for testing (testnet only)
        if (networkName.includes("testnet") || networkName === "hardhat") {
            console.log("\n📡 Deploying Mock Contracts...");
            
            const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
            const mockPriceFeed1 = await MockPriceFeed.deploy();
            const mockPriceFeed2 = await MockPriceFeed.deploy();
            await mockPriceFeed1.deployed();
            await mockPriceFeed2.deployed();
            
            deployments.MockPriceFeed1 = mockPriceFeed1.address;
            deployments.MockPriceFeed2 = mockPriceFeed2.address;
            console.log(`✅ MockPriceFeed1 deployed to: ${mockPriceFeed1.address}`);
            console.log(`✅ MockPriceFeed2 deployed to: ${mockPriceFeed2.address}`);
        }
        
        // 5. Initialize Security Configurations
        console.log("\n⚙️  Initializing Security Configurations...");
        
        // Configure circuit breaker for major assets
        const majorAssets = [
            // Add actual token addresses here when available
            // ethers.constants.AddressZero // Placeholder
        ];
        
        for (const asset of majorAssets) {
            if (asset !== ethers.constants.AddressZero) {
                await securityEnhancements.configureCircuitBreaker(
                    asset,
                    2000, // 20% drop threshold
                    3600  // 1 hour cooldown
                );
                console.log(`📊 Circuit breaker configured for asset: ${asset}`);
            }
        }
        
        // Set global liquidity ratio
        await liquidityProtection.setGlobalLiquidityRatio(1500); // 15%
        console.log(`💧 Global liquidity ratio set to 15%`);
        
        // 6. Grant necessary roles for integration
        console.log("\n🔑 Setting up Role-Based Access Control...");
        
        const SECURITY_ADMIN_ROLE = await securityEnhancements.SECURITY_ADMIN_ROLE();
        const ORACLE_ADMIN_ROLE = await oracleManager.ORACLE_ADMIN_ROLE();
        const LIQUIDITY_MANAGER_ROLE = await liquidityProtection.LIQUIDITY_MANAGER_ROLE();
        
        // Grant roles to deployer (can be changed later)
        await securityEnhancements.grantRole(SECURITY_ADMIN_ROLE, deployer.address);
        await oracleManager.grantRole(ORACLE_ADMIN_ROLE, deployer.address);
        await liquidityProtection.grantRole(LIQUIDITY_MANAGER_ROLE, deployer.address);
        
        console.log(`✅ Roles granted to deployer: ${deployer.address}`);
        
        // 7. Save deployment information
        const deploymentInfo = {
            network: networkName,
            deployer: deployer.address,
            timestamp: new Date().toISOString(),
            gasPrice: (await ethers.provider.getGasPrice()).toString(),
            contracts: deployments,
            configuration: {
                globalLiquidityRatio: "1500", // 15%
                circuitBreakerThreshold: "2000", // 20%
                circuitBreakerCooldown: "3600", // 1 hour
                minBlockDelay: "1",
                maxPriceDeviation: "500" // 5%
            }
        };
        
        // Create deployments directory if it doesn't exist
        const deploymentsDir = path.join(__dirname, "../deployments");
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }
        
        // Save deployment info
        const deploymentFile = path.join(deploymentsDir, `security-suite-${networkName}-${Date.now()}.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        
        console.log(`\n💾 Deployment information saved to: ${deploymentFile}`);
        
        // 8. Generate integration script
        const integrationScript = generateIntegrationScript(deployments);
        const integrationFile = path.join(deploymentsDir, `integration-${networkName}.js`);
        fs.writeFileSync(integrationFile, integrationScript);
        
        console.log(`📜 Integration script generated: ${integrationFile}`);
        
        // 9. Display summary
        console.log("\n" + "=".repeat(60));
        console.log("🎉 SECURITY SUITE DEPLOYMENT COMPLETED!");
        console.log("=".repeat(60));
        console.log("\n📋 Deployed Contracts:");
        Object.entries(deployments).forEach(([name, address]) => {
            console.log(`   ${name}: ${address}`);
        });
        
        console.log("\n⚠️  Next Steps:");
        console.log("   1. Verify contracts on block explorer");
        console.log("   2. Run comprehensive test suite");
        console.log("   3. Configure additional oracle sources");
        console.log("   4. Set up monitoring and alerting");
        console.log("   5. Conduct security audit");
        
        console.log("\n🧪 Test Command:");
        console.log(`   npx hardhat test test/security/SecurityEnhancementsTest.js --network ${networkName}`);
        
        return deployments;
        
    } catch (error) {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }
}

function generateIntegrationScript(deployments) {
    return `
// Integration script for Security Suite
// Generated automatically during deployment

const { ethers } = require("hardhat");

async function integrateSecuritySuite() {
    console.log("🔗 Integrating Security Suite with existing contracts...");
    
    const [signer] = await ethers.getSigners();
    
    // Get contract instances
    const securityEnhancements = await ethers.getContractAt(
        "SecurityEnhancements", 
        "${deployments.SecurityEnhancements}"
    );
    const oracleManager = await ethers.getContractAt(
        "EnhancedOracleManager", 
        "${deployments.EnhancedOracleManager}"
    );
    const liquidityProtection = await ethers.getContractAt(
        "LiquidityProtection", 
        "${deployments.LiquidityProtection}"
    );
    
    // Example integration with existing vault
    // Replace VAULT_ADDRESS with actual vault address
    const VAULT_ADDRESS = "0x..."; // TODO: Set actual vault address
    
    // Configure oracle for vault's underlying asset
    // const ASSET_ADDRESS = "0x..."; // TODO: Set actual asset address
    // await oracleManager.addOracleSource(
    //     ASSET_ADDRESS,
    //     "0x...", // Primary oracle address
    //     10000,   // 100% weight
    //     3,       // Max failures
    //     "Primary Oracle"
    // );
    
    // Initialize vault liquidity tracking
    // await liquidityProtection.updateLiquidity(
    //     VAULT_ADDRESS,
    //     ethers.utils.parseEther("1000"), // Total assets
    //     ethers.utils.parseEther("800"),  // Liquid assets
    //     ethers.utils.parseEther("200")   // Illiquid assets
    // );
    
    console.log("✅ Integration completed!");
}

// Export for use in other scripts
module.exports = { integrateSecuritySuite };

// Run if called directly
if (require.main === module) {
    integrateSecuritySuite()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
`;
}

// Export for use in other scripts
module.exports = { main };

// Run if called directly
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}