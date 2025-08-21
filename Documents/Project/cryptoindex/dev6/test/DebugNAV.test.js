const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Debug NAV Calculation", function () {
    async function deployDebugFixture() {
        const [owner, kbank] = await ethers.getSigners();
        
        // Deploy MockL1Read
        const MockL1Read = await ethers.getContractFactory("MockL1Read");
        const mockL1Read = await MockL1Read.deploy();
        
        // Deploy mock tokens with different decimals  
        const MockToken = await ethers.getContractFactory("MockERC20");
        const btc = await MockToken.deploy("Bitcoin", "BTC", 18);
        const usdc = await MockToken.deploy("USD Coin", "USDC", 6);
        
        // Deploy IndexTokenFactory
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        const factory = await IndexTokenFactory.deploy(owner.address);
        
        // Set mock L1Read for testing
        await factory.setL1ReadAddress(mockL1Read.target);
        
        // Authorize tokens
        await factory.authorizeToken(btc.target, true);
        await factory.authorizeToken(usdc.target, true);
        
        // Grant recipe creator role
        const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
        await factory.grantRole(RECIPE_CREATOR_ROLE, kbank.address);
        
        // Mint tokens
        await btc.mint(kbank.address, ethers.parseEther("100"));
        await usdc.mint(kbank.address, ethers.parseUnits("5000000", 6));
        
        return { factory, btc, usdc, mockL1Read, owner, kbank };
    }
    
    it("Should debug NAV calculation step by step", async function () {
        const { factory, btc, usdc, mockL1Read, owner, kbank } = await loadFixture(deployDebugFixture);
        
        console.log("\\n🔍 === Debug NAV Calculation ===");
        
        // Create simple 50/50 fund
        const components = [
            { tokenAddress: btc.target, hyperliquidAssetIndex: 1, targetRatio: 5000, depositedAmount: 0 }, // BTC 50%
            { tokenAddress: usdc.target, hyperliquidAssetIndex: 3, targetRatio: 5000, depositedAmount: 0 } // USDC 50%
        ];
        
        const createTx = await factory.connect(kbank).createIndexFund("Debug Fund", "DEBUG", components);
        const fundId = (await createTx.wait()).logs.find(log => {
            try { return factory.interface.parseLog(log).name === "FundCreated"; } catch { return false; }
        });
        const fundIdValue = factory.interface.parseLog(fundId).args.fundId;
        
        // Simple deposits: 
        // 1 BTC @ $45,000 = $45,000
        // 45,000 USDC @ $1 = $45,000  
        // Total = $90,000
        const btcAmount = ethers.parseEther("1");      // 1 BTC  
        const usdcAmount = ethers.parseUnits("45000", 6); // 45,000 USDC
        
        console.log(`🪙 BTC deposit: ${ethers.formatEther(btcAmount)} BTC`);
        console.log(`💵 USDC deposit: ${ethers.formatUnits(usdcAmount, 6)} USDC`);
        
        // Check mock prices
        const btcPrice = await mockL1Read.getSpotPrice(1);
        const usdcPrice = await mockL1Read.getSpotPrice(3);
        console.log(`📊 BTC price: $${ethers.formatEther(btcPrice)}`);
        console.log(`📊 USDC price: $${ethers.formatEther(usdcPrice)}`);
        
        // Expected values:
        const expectedBTCValue = btcAmount * btcPrice / ethers.parseEther("1");
        const expectedUSDCValue = usdcAmount * usdcPrice / ethers.parseEther("1");
        const expectedTotalValue = expectedBTCValue + expectedUSDCValue;
        
        console.log(`💰 Expected BTC value: $${ethers.formatEther(expectedBTCValue)}`);
        console.log(`💰 Expected USDC value: $${ethers.formatEther(expectedUSDCValue)}`);  
        console.log(`💰 Expected total value: $${ethers.formatEther(expectedTotalValue)}`);
        
        // Deposit tokens
        await btc.connect(kbank).approve(factory.target, btcAmount);
        await usdc.connect(kbank).approve(factory.target, usdcAmount);
        await factory.connect(kbank).depositComponentTokens(fundIdValue, [btc.target, usdc.target], [btcAmount, usdcAmount]);
        
        // Issue tokens
        const tokenSupply = ethers.parseEther("1000"); // 1000 tokens
        await factory.connect(owner).issueIndexToken(fundIdValue, tokenSupply);
        
        // Calculate NAV
        const nav = await factory.calculateNAV(fundIdValue);
        const expectedNAVPerToken = expectedTotalValue / tokenSupply * ethers.parseEther("1");
        
        console.log(`📈 Actual NAV: $${ethers.formatEther(nav)} per token`);
        console.log(`🎯 Expected NAV: $${ethers.formatEther(expectedNAVPerToken)} per token`);
        
        // Get fund components to check depositedAmount  
        const fundComponents = await factory.getFundComponents(fundIdValue);
        console.log(`🔍 BTC deposited amount: ${ethers.formatEther(fundComponents[0].depositedAmount)}`);
        console.log(`🔍 USDC deposited amount: ${ethers.formatUnits(fundComponents[1].depositedAmount, 6)}`);
        
        // Check balance in factory contract
        console.log(`🏭 BTC balance in factory: ${ethers.formatEther(await btc.balanceOf(factory.target))}`);
        console.log(`🏭 USDC balance in factory: ${ethers.formatUnits(await usdc.balanceOf(factory.target), 6)}`);
    });
});