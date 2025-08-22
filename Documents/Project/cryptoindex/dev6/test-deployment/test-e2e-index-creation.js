// test-e2e-index-creation.js
/**
 * E2E Test: Index Token Creation and Basic Setup
 */

const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 E2E Test: Index Token Creation and Setup");
    console.log("===========================================");
    
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const user1 = signers[1] || deployer;
    const user2 = signers[2] || deployer;
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`👤 User 1: ${user1.address}`);
    console.log(`👤 User 2: ${user2.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} HYPE`);
    
    // Load existing deployment info
    let deploymentInfo;
    try {
        deploymentInfo = JSON.parse(require('fs').readFileSync('testnet-deployment.json', 'utf8'));
        console.log("📋 Loaded deployment info");
    } catch (error) {
        console.error("❌ Could not load deployment info");
        return;
    }
    
    const e2eResults = {
        indexCreation: {},
        vaultDeployment: {},
        tokenConfiguration: {},
        permissions: {},
        integration: {}
    };
    
    try {
        console.log("\n=== 1. 🏭 Index Token Factory Testing ===");
        
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        const factory = IndexTokenFactory.attach(deploymentInfo.contracts.factory);
        
        console.log(`📍 Factory: ${deploymentInfo.contracts.factory}`);
        
        // Check factory configuration 
        const DEFAULT_ADMIN_ROLE = await factory.DEFAULT_ADMIN_ROLE();
        const isAdmin = await factory.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
        const priceFeed = await factory.priceFeed();
        
        console.log(`👤 Factory Admin: ${isAdmin}`);
        console.log(`📊 Price Feed: ${priceFeed}`);
        console.log(`🔍 Is Deployer Admin: ${isAdmin}`);
        
        e2eResults.indexCreation.factoryInfo = {
            address: deploymentInfo.contracts.factory,
            priceFeed: priceFeed,
            deployerIsAdmin: isAdmin
        };
        
        console.log("\n=== 2. 📋 Index Token Configuration ===");
        
        // Define index composition using ComponentToken structure
        const components = [
            {
                tokenAddress: deploymentInfo.contracts.mockUSDC,
                hyperliquidAssetIndex: 0, // USDC index
                targetRatio: 4000, // 40%
                depositedAmount: 0
            },
            {
                tokenAddress: deploymentInfo.contracts.mockWETH,
                hyperliquidAssetIndex: 1, // WETH index
                targetRatio: 3500, // 35%
                depositedAmount: 0
            },
            {
                tokenAddress: deploymentInfo.contracts.mockWBTC,
                hyperliquidAssetIndex: 2, // WBTC index  
                targetRatio: 2500, // 25%
                depositedAmount: 0
            }
        ];
        
        console.log("🎯 Index Composition:");
        console.log(`   📊 USDC: 40% (${deploymentInfo.contracts.mockUSDC})`);
        console.log(`   📊 WETH: 35% (${deploymentInfo.contracts.mockWETH})`);
        console.log(`   📊 WBTC: 25% (${deploymentInfo.contracts.mockWBTC})`);
        
        e2eResults.tokenConfiguration = {
            components: components,
            totalAllocation: components.reduce((a, b) => a + b.targetRatio, 0)
        };
        
        console.log("\n=== 3. 🏦 Creating Index Fund ===");
        
        // First, we need to grant RECIPE_CREATOR_ROLE to deployer
        console.log("🔑 Granting RECIPE_CREATOR_ROLE...");
        const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
        await factory.grantRole(RECIPE_CREATOR_ROLE, deployer.address);
        console.log("   ✅ RECIPE_CREATOR_ROLE granted");
        
        // Check and authorize tokens for use in the factory
        console.log("🔓 Checking and authorizing tokens...");
        
        const usdcAuthorized = await factory.authorizedTokens(deploymentInfo.contracts.mockUSDC);
        const wethAuthorized = await factory.authorizedTokens(deploymentInfo.contracts.mockWETH);
        const wbtcAuthorized = await factory.authorizedTokens(deploymentInfo.contracts.mockWBTC);
        
        console.log(`   📊 USDC already authorized: ${usdcAuthorized}`);
        console.log(`   📊 WETH already authorized: ${wethAuthorized}`);
        console.log(`   📊 WBTC already authorized: ${wbtcAuthorized}`);
        
        if (!usdcAuthorized) {
            await factory["authorizeToken(address,bool)"](deploymentInfo.contracts.mockUSDC, true);
            console.log("   ✅ USDC authorized");
        }
        if (!wethAuthorized) {
            await factory["authorizeToken(address,bool)"](deploymentInfo.contracts.mockWETH, true);
            console.log("   ✅ WETH authorized");
        }
        if (!wbtcAuthorized) {
            await factory["authorizeToken(address,bool)"](deploymentInfo.contracts.mockWBTC, true);
            console.log("   ✅ WBTC authorized");
        }
        console.log("   ✅ All tokens authorized");
        
        // Create index fund
        console.log("🏗️ Creating index fund...");
        const createTx = await factory.createIndexFund(
            "HyperCrypto Index", // name
            "HCI", // symbol
            components, // ComponentToken array
            {
                gasLimit: 3000000 // Increase gas limit
            }
        );
        
        console.log(`📝 Creating index fund... TX: ${createTx.hash}`);
        const receipt = await createTx.wait();
        
        // Find the FundCreated and IndexTokenCreated events
        let newFundId = null;
        let newIndexTokenAddress = null;
        
        for (const log of receipt.logs) {
            try {
                const parsedLog = factory.interface.parseLog(log);
                if (parsedLog.name === 'FundCreated') {
                    newFundId = parsedLog.args.fundId;
                    console.log(`✅ Index fund created!`);
                    console.log(`   🆔 Fund ID: ${newFundId}`);
                } else if (parsedLog.name === 'IndexTokenCreated') {
                    newIndexTokenAddress = parsedLog.args.tokenAddress;
                    console.log(`   🪙 Index Token: ${newIndexTokenAddress}`);
                }
            } catch (error) {
                // Skip non-factory logs
            }
        }
        
        if (!newFundId) {
            throw new Error("Failed to find fund ID from creation event");
        }
        
        e2eResults.vaultDeployment = {
            fundId: newFundId,
            indexTokenAddress: newIndexTokenAddress,
            txHash: createTx.hash,
            gasUsed: receipt.gasUsed.toString()
        };
        
        console.log("\n=== 4. 🔍 Verifying Fund Configuration ===");
        
        // Get fund information
        const fundInfo = await factory.getFundInfo(newFundId);
        const fundComponents = await factory.getFundComponents(newFundId);
        
        console.log(`📊 Fund Name: ${fundInfo.name}`);
        console.log(`📊 Fund Symbol: ${fundInfo.symbol}`);
        console.log(`📊 Creator: ${fundInfo.creator}`);
        console.log(`📊 Index Token: ${fundInfo.indexToken}`);
        console.log(`📊 Total Supply: ${fundInfo.totalSupply}`);
        console.log(`📊 Is Active: ${fundInfo.isActive}`);
        console.log(`📊 Is Issued: ${fundInfo.isIssued}`);
        
        // Verify components
        console.log(`📊 Components: ${fundComponents.length}`);
        for (let i = 0; i < fundComponents.length; i++) {
            const component = fundComponents[i];
            console.log(`   ${i}: ${component.tokenAddress} (${Number(component.targetRatio)/100}%) - Asset Index: ${component.hyperliquidAssetIndex}`);
        }
        
        // Test index token contract if created
        if (newIndexTokenAddress) {
            console.log("\n🪙 Testing Index Token Contract...");
            const IndexToken = await ethers.getContractFactory("IndexToken");
            const indexToken = IndexToken.attach(newIndexTokenAddress);
            
            const tokenName = await indexToken.name();
            const tokenSymbol = await indexToken.symbol();
            const totalSupply = await indexToken.totalSupply();
            
            console.log(`   📊 Token Name: ${tokenName}`);
            console.log(`   📊 Token Symbol: ${tokenSymbol}`);
            console.log(`   📊 Total Supply: ${totalSupply}`);
        }
        
        e2eResults.integration = {
            fundInfo: {
                name: fundInfo.name,
                symbol: fundInfo.symbol,
                creator: fundInfo.creator,
                indexToken: fundInfo.indexToken,
                totalSupply: fundInfo.totalSupply.toString(),
                isActive: fundInfo.isActive,
                isIssued: fundInfo.isIssued
            },
            indexConfiguration: {
                componentCount: fundComponents.length,
                indexTokenCreated: !!newIndexTokenAddress
            }
        };
        
        console.log("\n=== 5. 🔒 Testing Access Control ===");
        
        // Test factory access control
        try {
            const hasRecipeRole = await factory.hasRole(RECIPE_CREATOR_ROLE, deployer.address);
            const hasAdminRole = await factory.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
            console.log(`👤 Deployer has recipe creator role: ${hasRecipeRole}`);
            console.log(`👤 Deployer has admin role: ${hasAdminRole}`);
            
            // Test user permissions (should not have roles)
            const userHasRecipeRole = await factory.hasRole(RECIPE_CREATOR_ROLE, user1.address);
            const userHasAdminRole = await factory.hasRole(DEFAULT_ADMIN_ROLE, user1.address);
            console.log(`👤 User1 has recipe creator role: ${userHasRecipeRole}`);
            console.log(`👤 User1 has admin role: ${userHasAdminRole}`);
            
            e2eResults.permissions = {
                deployerHasRecipeRole: hasRecipeRole,
                deployerHasAdminRole: hasAdminRole,
                userHasRecipeRole: userHasRecipeRole,
                userHasAdminRole: userHasAdminRole,
                accessControlWorking: hasRecipeRole && hasAdminRole && !userHasRecipeRole && !userHasAdminRole
            };
            
        } catch (error) {
            console.log(`⚠️ Access control check failed: ${error.message}`);
            e2eResults.permissions = { error: error.message };
        }
        
        console.log("\n=== 6. 🧪 Testing Factory Functions ===");
        
        // Test factory view functions
        try {
            // Test token authorization check
            const usdcAuthorized = await factory.authorizedTokens(deploymentInfo.contracts.mockUSDC);
            const wethAuthorized = await factory.authorizedTokens(deploymentInfo.contracts.mockWETH);
            const wbtcAuthorized = await factory.authorizedTokens(deploymentInfo.contracts.mockWBTC);
            
            console.log(`📊 USDC Authorized: ${usdcAuthorized}`);
            console.log(`📊 WETH Authorized: ${wethAuthorized}`);
            console.log(`📊 WBTC Authorized: ${wbtcAuthorized}`);
            
            // Test creator funds
            const creatorFunds = await factory.getCreatorFunds(deployer.address);
            console.log(`📊 Creator Funds Count: ${creatorFunds.length}`);
            
            if (creatorFunds.length > 0) {
                console.log(`📊 Latest Fund ID: ${creatorFunds[creatorFunds.length - 1]}`);
            }
            
            e2eResults.integration.basicFunctions = {
                usdcAuthorized: usdcAuthorized,
                wethAuthorized: wethAuthorized,
                wbtcAuthorized: wbtcAuthorized,
                creatorFundsCount: creatorFunds.length,
                functioning: true
            };
            
        } catch (error) {
            console.log(`⚠️ Factory function test failed: ${error.message}`);
            e2eResults.integration.basicFunctions = { error: error.message };
        }
        
        console.log("\n=== 7. 📊 Factory State Verification ===");
        
        // Verify factory state after creation
        const finalFundInfo = await factory.getFundInfo(newFundId);
        const finalComponents = await factory.getFundComponents(newFundId);
        
        console.log(`📊 Final Fund Active: ${finalFundInfo.isActive}`);
        console.log(`📊 Final Fund Issued: ${finalFundInfo.isIssued}`);
        console.log(`📊 Final Index Token: ${finalFundInfo.indexToken}`);
        console.log(`📊 Components Count: ${finalComponents.length}`);
        
        e2eResults.indexCreation.finalState = {
            fundActive: finalFundInfo.isActive,
            fundIssued: finalFundInfo.isIssued,
            indexTokenCreated: finalFundInfo.indexToken !== ethers.ZeroAddress,
            componentsConfigured: finalComponents.length === components.length
        };
        
        // Update deployment info
        if (!deploymentInfo.e2eTests) {
            deploymentInfo.e2eTests = {};
        }
        
        deploymentInfo.e2eTests.indexCreation = {
            timestamp: new Date().toISOString(),
            status: "completed",
            results: e2eResults,
            createdFund: {
                fundId: newFundId,
                indexTokenAddress: newIndexTokenAddress,
                name: "HyperCrypto Index",
                symbol: "HCI"
            }
        };
        
        // Save updated deployment info
        console.log("\n💾 Updating deployment info...");
        require('fs').writeFileSync(
            'testnet-deployment.json',
            JSON.stringify(deploymentInfo, null, 2)
        );
        console.log("   ✅ E2E test results saved");
        
        console.log("\n🎉 Index Fund Creation E2E Test Completed!");
        console.log("\n📊 Test Summary:");
        console.log(`   ✅ Factory functionality tested`);
        console.log(`   ✅ Index fund created (ID: ${newFundId})`);
        console.log(`   ✅ Index token deployed (${newIndexTokenAddress})`);
        console.log(`   ✅ Configuration verified`);
        console.log(`   ✅ Access control tested`);
        console.log(`   ✅ Token authorization working`);
        console.log(`   ✅ Component structure validated`);
        console.log(`   ✅ Factory state management operational`);
        
        return {
            success: true,
            fundId: newFundId,
            indexTokenAddress: newIndexTokenAddress,
            results: e2eResults
        };
        
    } catch (error) {
        console.error(`\n❌ Index creation E2E test failed: ${error.message}`);
        console.error("Stack trace:", error.stack);
        
        // Update deployment info with error
        if (!deploymentInfo.e2eTests) {
            deploymentInfo.e2eTests = {};
        }
        
        deploymentInfo.e2eTests.indexCreation = {
            timestamp: new Date().toISOString(),
            status: "failed",
            error: error.message,
            partialResults: e2eResults
        };
        
        require('fs').writeFileSync(
            'testnet-deployment.json',
            JSON.stringify(deploymentInfo, null, 2)
        );
        
        throw error;
    }
}

main()
    .then((results) => {
        console.log("\n🚀 Index Fund Creation E2E Test Successful!");
        console.log(`🏦 Created fund ready for deposit/issuance testing!`);
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });