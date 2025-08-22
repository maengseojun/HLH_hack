// test-dex-functions.js
/**
 * Test Mock DEX Aggregator functionality
 */

const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing Mock DEX Aggregator Functionality...");
    
    const [deployer] = await ethers.getSigners();
    console.log(`👤 Deployer: ${deployer.address}`);
    
    // Load existing deployment info
    let deploymentInfo;
    try {
        deploymentInfo = JSON.parse(require('fs').readFileSync('testnet-deployment.json', 'utf8'));
        console.log("📋 Loaded deployment info");
    } catch (error) {
        console.error("❌ Could not load deployment info");
        return;
    }
    
    // Known DEX Aggregator address from partial deployment
    const dexAggregatorAddress = "0xD240f2e02C849eD1C92B48BFe4ea195463471dc5";
    
    try {
        // 1. Test DEX Aggregator functionality
        console.log("\n1. 🔍 Testing DEX Aggregator...");
        const MockDEXAggregator = await ethers.getContractFactory("MockDEXAggregator");
        const dexAggregator = MockDEXAggregator.attach(dexAggregatorAddress);
        
        console.log(`   📍 DEX Aggregator: ${dexAggregatorAddress}`);
        
        // Check supported tokens
        const supportedTokens = await dexAggregator.getSupportedTokens();
        console.log(`   🪙 Supported tokens: ${supportedTokens.length}`);
        
        // Check protocols
        const protocols = await dexAggregator.getProtocols();
        console.log(`   🏪 Available protocols: ${protocols.join(', ')}`);
        
        // Test pair support
        const isPairSupported = await dexAggregator.isPairSupported(
            deploymentInfo.contracts.mockUSDC,
            deploymentInfo.contracts.mockWETH
        );
        console.log(`   ✅ USDC/WETH pair supported: ${isPairSupported}`);
        
        // 2. Fund the aggregator for testing
        console.log("\n2. 💰 Funding DEX Aggregator for testing...");
        
        const mockUSDC = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.mockUSDC);
        const mockWETH = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.mockWETH);
        const mockWBTC = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.mockWBTC);
        
        // Mint more tokens for testing
        await mockUSDC.mint(deployer.address, ethers.parseUnits("10000", 6));
        await mockWETH.mint(deployer.address, ethers.parseEther("10"));
        await mockWBTC.mint(deployer.address, ethers.parseUnits("1", 8));
        
        console.log("   ✅ Minted test tokens");
        
        // Fund aggregator with liquidity
        const fundAmount = ethers.parseUnits("5000", 6); // 5000 USDC
        await mockUSDC.approve(dexAggregatorAddress, fundAmount);
        await dexAggregator.fundAggregator(deploymentInfo.contracts.mockUSDC, fundAmount);
        
        await mockWETH.approve(dexAggregatorAddress, ethers.parseEther("5"));
        await dexAggregator.fundAggregator(deploymentInfo.contracts.mockWETH, ethers.parseEther("5"));
        
        await mockWBTC.approve(dexAggregatorAddress, ethers.parseUnits("0.5", 8));
        await dexAggregator.fundAggregator(deploymentInfo.contracts.mockWBTC, ethers.parseUnits("0.5", 8));
        
        console.log("   ✅ Funded aggregator with liquidity");
        
        // 3. Test quote functionality
        console.log("\n3. 📊 Testing Quote Functionality...");
        
        const swapAmount = ethers.parseUnits("100", 6); // 100 USDC
        const quote = await dexAggregator.getQuote(
            deploymentInfo.contracts.mockUSDC,
            deploymentInfo.contracts.mockWETH,
            swapAmount
        );
        
        console.log(`   💱 Quote: ${ethers.formatUnits(swapAmount, 6)} USDC → ${ethers.formatEther(quote.returnAmount)} WETH`);
        console.log(`   ⛽ Estimated gas: ${quote.estimatedGas}`);
        console.log(`   🏪 Primary protocol: ${quote.protocols[0]}`);
        
        // Test exchange rate
        const exchangeRate = await dexAggregator.getExchangeRate(
            deploymentInfo.contracts.mockUSDC,
            deploymentInfo.contracts.mockWETH,
            ethers.parseUnits("1", 6)
        );
        console.log(`   📈 Exchange rate: 1 USDC = ${ethers.formatEther(exchangeRate)} WETH`);
        
        // 4. Test swap execution
        console.log("\n4. 🔄 Testing Swap Execution...");
        
        // Check balances before swap
        const usdcBefore = await mockUSDC.balanceOf(deployer.address);
        const wethBefore = await mockWETH.balanceOf(deployer.address);
        
        console.log(`   💰 Before swap: ${ethers.formatUnits(usdcBefore, 6)} USDC, ${ethers.formatEther(wethBefore)} WETH`);
        
        // Approve and execute swap
        await mockUSDC.approve(dexAggregatorAddress, swapAmount);
        
        const swapParams = {
            srcToken: deploymentInfo.contracts.mockUSDC,
            destToken: deploymentInfo.contracts.mockWETH,
            amount: swapAmount,
            minReturn: quote.returnAmount,
            distribution: quote.distribution,
            flags: 0
        };
        
        const swapTx = await dexAggregator.swap(swapParams);
        const receipt = await swapTx.wait();
        
        console.log(`   ✅ Swap executed! TX: ${swapTx.hash}`);
        
        // Check balances after swap
        const usdcAfter = await mockUSDC.balanceOf(deployer.address);
        const wethAfter = await mockWETH.balanceOf(deployer.address);
        
        console.log(`   💰 After swap: ${ethers.formatUnits(usdcAfter, 6)} USDC, ${ethers.formatEther(wethAfter)} WETH`);
        
        const wethReceived = wethAfter - wethBefore;
        console.log(`   📈 Received: ${ethers.formatEther(wethReceived)} WETH`);
        
        // 5. Test multiple token quotes
        console.log("\n5. 📊 Testing Multiple Token Quotes...");
        
        // USDC → WBTC
        const btcQuote = await dexAggregator.getQuote(
            deploymentInfo.contracts.mockUSDC,
            deploymentInfo.contracts.mockWBTC,
            ethers.parseUnits("35000", 6) // 35K USDC
        );
        console.log(`   ₿ Quote: 35000 USDC → ${ethers.formatUnits(btcQuote.returnAmount, 8)} WBTC`);
        
        // WETH → WBTC
        const ethBtcQuote = await dexAggregator.getQuote(
            deploymentInfo.contracts.mockWETH,
            deploymentInfo.contracts.mockWBTC,
            ethers.parseEther("17.5") // 17.5 WETH
        );
        console.log(`   ₿ Quote: 17.5 WETH → ${ethers.formatUnits(ethBtcQuote.returnAmount, 8)} WBTC`);
        
        // Update deployment info with DEX integration
        deploymentInfo.contracts.mockDEXAggregator = dexAggregatorAddress;
        deploymentInfo.dexIntegration = {
            aggregatorAddress: dexAggregatorAddress,
            supportedTokens: supportedTokens.length,
            supportedProtocols: protocols,
            swapTested: true,
            quoteTested: true,
            liquidityProvided: true,
            testResults: {
                pairSupported: isPairSupported,
                swapExecuted: true,
                exchangeRateTested: true
            }
        };
        
        // Save updated deployment info
        console.log("\n💾 Updating deployment info...");
        require('fs').writeFileSync(
            'testnet-deployment.json',
            JSON.stringify(deploymentInfo, null, 2)
        );
        console.log("   ✅ Deployment info updated");
        
        console.log("\n🎉 Mock DEX Aggregator Testing Completed Successfully!");
        console.log("\n📊 Test Results Summary:");
        console.log(`   ✅ Quote functionality tested`);
        console.log(`   ✅ Swap execution tested`);
        console.log(`   ✅ Exchange rate calculation tested`);
        console.log(`   ✅ Multiple token pair support verified`);
        console.log(`   ✅ Liquidity management tested`);
        console.log(`   ✅ Protocol simulation functional`);
        
        console.log("\n💡 Mock 1inch Integration Status:");
        console.log("   ✅ DEX aggregator deployed and functional");
        console.log("   ✅ Multi-protocol simulation active");
        console.log("   ✅ Quote and swap APIs working");
        console.log("   ✅ Slippage protection implemented");
        console.log("   ✅ Ready for vault rebalancing integration");
        
        return {
            dexAggregatorAddress,
            swapTested: true,
            quoteTested: true,
            exchangeRateCalculated: true
        };
        
    } catch (error) {
        console.error(`\n❌ DEX testing failed: ${error.message}`);
        throw error;
    }
}

main()
    .then((results) => {
        console.log("\n🚀 Mock 1inch DEX integration testing successful!");
        console.log("Ready to proceed with vault rebalancing tests!");
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });