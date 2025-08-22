// deploy-dex-integration.js
/**
 * Deploy 1inch-style DEX integration for HyperIndex
 */

const { ethers } = require("hardhat");

async function main() {
    console.log("🔄 Deploying DEX Integration (1inch-style) Components...");
    
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} HYPE`);
    
    // Load existing deployment info
    let deploymentInfo;
    try {
        deploymentInfo = JSON.parse(require('fs').readFileSync('testnet-deployment.json', 'utf8'));
        console.log("📋 Loaded existing deployment info");
    } catch (error) {
        console.error("❌ Could not load deployment info:", error.message);
        process.exit(1);
    }
    
    try {
        // 1. Deploy Mock DEX Aggregator
        console.log("\n1. 🔄 Deploying Mock DEX Aggregator...");
        const MockDEXAggregator = await ethers.getContractFactory("MockDEXAggregator");
        const dexAggregator = await MockDEXAggregator.deploy(deploymentInfo.contracts.mockPriceFeed);
        await dexAggregator.waitForDeployment();
        const dexAggregatorAddress = await dexAggregator.getAddress();
        console.log(`   ✅ Mock DEX Aggregator: ${dexAggregatorAddress}`);
        
        // 2. Configure supported tokens
        console.log("\n2. ⚙️ Configuring supported tokens...");
        
        // Add USDC
        await dexAggregator.addSupportedToken(
            deploymentInfo.contracts.mockUSDC,
            6,
            "USDC"
        );
        console.log("   ✅ Added USDC support");
        
        // Add WETH
        await dexAggregator.addSupportedToken(
            deploymentInfo.contracts.mockWETH,
            18,
            "WETH"
        );
        console.log("   ✅ Added WETH support");
        
        // Add WBTC
        await dexAggregator.addSupportedToken(
            deploymentInfo.contracts.mockWBTC,
            8,
            "WBTC"
        );
        console.log("   ✅ Added WBTC support");
        
        // 3. Fund the aggregator with tokens for swapping
        console.log("\n3. 💰 Funding DEX Aggregator...");
        
        const mockUSDC = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.mockUSDC);
        const mockWETH = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.mockWETH);
        const mockWBTC = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.mockWBTC);
        
        // Mint tokens to deployer first
        await mockUSDC.mint(deployer.address, ethers.parseUnits("50000", 6)); // 50K USDC
        await mockWETH.mint(deployer.address, ethers.parseEther("100")); // 100 WETH
        await mockWBTC.mint(deployer.address, ethers.parseUnits("5", 8)); // 5 WBTC
        
        // Fund the aggregator
        await mockUSDC.approve(dexAggregatorAddress, ethers.parseUnits("30000", 6));
        await dexAggregator.fundAggregator(deploymentInfo.contracts.mockUSDC, ethers.parseUnits("30000", 6));
        
        await mockWETH.approve(dexAggregatorAddress, ethers.parseEther("50"));
        await dexAggregator.fundAggregator(deploymentInfo.contracts.mockWETH, ethers.parseEther("50"));
        
        await mockWBTC.approve(dexAggregatorAddress, ethers.parseUnits("3", 8));
        await dexAggregator.fundAggregator(deploymentInfo.contracts.mockWBTC, ethers.parseUnits("3", 8));
        
        console.log("   ✅ Funded aggregator with liquidity");
        
        // 4. Deploy RebalancingVault
        console.log("\n4. 🏦 Deploying Rebalancing Vault...");
        const RebalancingVault = await ethers.getContractFactory("RebalancingVault");
        const rebalancingVault = await RebalancingVault.deploy(
            deploymentInfo.contracts.mockUSDC, // Use USDC as base asset
            "HyperIndex Rebalancing Vault",
            "HIRV"
        );
        await rebalancingVault.waitForDeployment();
        const rebalancingVaultAddress = await rebalancingVault.getAddress();
        console.log(`   ✅ Rebalancing Vault: ${rebalancingVaultAddress}`);
        
        // 5. Initialize RebalancingVault
        console.log("\n5. ⚙️ Initializing Rebalancing Vault...");
        
        const underlyingTokens = [
            deploymentInfo.contracts.mockUSDC,
            deploymentInfo.contracts.mockWETH,
            deploymentInfo.contracts.mockWBTC
        ];
        
        const targetAllocations = [4000, 3000, 3000]; // 40% USDC, 30% WETH, 30% WBTC
        
        await rebalancingVault.initialize(
            deploymentInfo.contracts.mockUSDC,
            2, // Index token ID
            deployer.address,
            "HyperIndex Rebalancing Vault",
            "HIRV",
            deploymentInfo.contracts.mockLayerZeroEndpoint,
            underlyingTokens,
            targetAllocations
        );
        
        // Set DEX aggregator
        await rebalancingVault.setDEXAggregator(dexAggregatorAddress);
        console.log("   ✅ Vault initialized and DEX aggregator set");
        
        // 6. Test DEX functionality
        console.log("\n6. 🧪 Testing DEX Functionality...");
        
        // Test quote functionality
        const swapAmount = ethers.parseUnits("1000", 6); // 1000 USDC
        const quote = await dexAggregator.getQuote(
            deploymentInfo.contracts.mockUSDC,
            deploymentInfo.contracts.mockWETH,
            swapAmount
        );
        
        console.log(`   📊 Quote: ${ethers.formatUnits(swapAmount, 6)} USDC → ${ethers.formatEther(quote.returnAmount)} WETH`);
        console.log(`   ⛽ Estimated gas: ${quote.estimatedGas}`);
        console.log(`   🏪 Protocols: ${quote.protocols.join(', ')}`);
        
        // Test swap execution
        console.log("\n   🔄 Testing swap execution...");
        
        // Approve tokens for swap
        await mockUSDC.approve(dexAggregatorAddress, swapAmount);
        
        const swapParams = {
            srcToken: deploymentInfo.contracts.mockUSDC,
            destToken: deploymentInfo.contracts.mockWETH,
            amount: swapAmount,
            minReturn: quote.returnAmount,
            distribution: quote.distribution,
            flags: 0
        };
        
        const swapResult = await dexAggregator.swap(swapParams);
        const receipt = await swapResult.wait();
        
        console.log(`   ✅ Swap executed! TX: ${swapResult.hash}`);
        console.log(`   📈 Actual return: ${ethers.formatEther(quote.returnAmount)} WETH`);
        
        // 7. Test rebalancing functionality
        console.log("\n7. 🎯 Testing Rebalancing Functionality...");
        
        // Fund the vault with some tokens
        await mockUSDC.mint(rebalancingVaultAddress, ethers.parseUnits("5000", 6));
        await mockWETH.mint(rebalancingVaultAddress, ethers.parseEther("2"));
        await mockWBTC.mint(rebalancingVaultAddress, ethers.parseUnits("0.1", 8));
        console.log("   💰 Funded vault with test tokens");
        
        // Check if rebalancing is needed
        const rebalanceCheck = await rebalancingVault.checkRebalanceNeeded();
        console.log(`   📊 Rebalancing needed: ${rebalanceCheck.needed}`);
        if (rebalanceCheck.needed) {
            console.log(`   🔄 From: ${rebalanceCheck.fromToken}`);
            console.log(`   🎯 To: ${rebalanceCheck.toToken}`);
            console.log(`   💸 Amount: ${ethers.formatEther(rebalanceCheck.amount)}`);
        }
        
        // Get current allocations
        const allocations = await rebalancingVault.getAllocationRatios();
        console.log("   📊 Current allocations:");
        for (let i = 0; i < allocations.tokens.length; i++) {
            let symbol = "Unknown";
            if (allocations.tokens[i] === deploymentInfo.contracts.mockUSDC) symbol = "USDC";
            if (allocations.tokens[i] === deploymentInfo.contracts.mockWETH) symbol = "WETH";
            if (allocations.tokens[i] === deploymentInfo.contracts.mockWBTC) symbol = "WBTC";
            
            console.log(`     ${symbol}: ${allocations.currentRatios[i]/100}% current, ${allocations.targetRatios[i]/100}% target`);
        }
        
        // 8. Test supported protocols
        console.log("\n8. 🏪 Testing Supported Protocols...");
        const protocols = await dexAggregator.getProtocols();
        console.log(`   📋 Available protocols: ${protocols.join(', ')}`);
        
        const supportedTokens = await dexAggregator.getSupportedTokens();
        console.log(`   🪙 Supported tokens: ${supportedTokens.length}`);
        
        // Test pair support
        const isPairSupported = await dexAggregator.isPairSupported(
            deploymentInfo.contracts.mockUSDC,
            deploymentInfo.contracts.mockWETH
        );
        console.log(`   ✅ USDC/WETH pair supported: ${isPairSupported}`);
        
        // Update deployment info
        deploymentInfo.contracts.mockDEXAggregator = dexAggregatorAddress;
        deploymentInfo.contracts.rebalancingVault = rebalancingVaultAddress;
        
        deploymentInfo.dexIntegration = {
            aggregatorAddress: dexAggregatorAddress,
            rebalancingVaultAddress: rebalancingVaultAddress,
            supportedTokens: supportedTokens.length,
            supportedProtocols: protocols,
            swapTested: true,
            quoteTested: true,
            liquidityProvided: true
        };
        
        // Save updated deployment info
        console.log("\n💾 Updating deployment info...");
        require('fs').writeFileSync(
            'testnet-deployment.json',
            JSON.stringify(deploymentInfo, null, 2)
        );
        console.log("   ✅ Deployment info updated");
        
        console.log("\n🎉 DEX Integration Deployment Completed!");
        console.log("\n📊 Components Summary:");
        console.log(`   Mock DEX Aggregator: ${dexAggregatorAddress}`);
        console.log(`   Rebalancing Vault: ${rebalancingVaultAddress}`);
        console.log(`   Supported Tokens: ${supportedTokens.length}`);
        console.log(`   Supported Protocols: ${protocols.length}`);
        console.log(`   Liquidity Provided: ✅`);
        console.log(`   Swap Functionality: ✅ Tested`);
        console.log(`   Quote Functionality: ✅ Tested`);
        
        console.log("\n💡 Next Steps:");
        console.log("   1. Test security systems and circuit breakers");
        console.log("   2. Run comprehensive E2E testing");
        console.log("   3. Perform stress testing and benchmarks");
        console.log("   4. Monitor rebalancing performance");
        
    } catch (error) {
        console.error("\n❌ DEX integration deployment failed:", error.message);
        console.error("Stack trace:", error.stack);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });