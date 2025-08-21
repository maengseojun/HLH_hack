const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Token Issuance and NAV Test", function () {
    // 토큰 발행 및 NAV 계산 테스트
    async function deployWithNAVFixture() {
        const [owner, kbank, nhbank, user1] = await ethers.getSigners();
        
        // Deploy MockL1Read for price feeds
        const MockL1Read = await ethers.getContractFactory("MockL1Read");
        const mockL1Read = await MockL1Read.deploy();
        
        // Deploy mock tokens
        const MockToken = await ethers.getContractFactory("MockERC20");
        const btc = await MockToken.deploy("Bitcoin", "BTC", 18);
        const eth = await MockToken.deploy("Ethereum", "ETH", 18);
        const usdc = await MockToken.deploy("USD Coin", "USDC", 6);
        const sol = await MockToken.deploy("Solana", "SOL", 9);
        
        // Deploy IndexTokenFactory
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        const factory = await IndexTokenFactory.deploy(owner.address);
        
        // Set mock L1Read for testing
        await factory.setL1ReadAddress(mockL1Read.target);
        
        // Authorize tokens
        await factory.authorizeToken(btc.target, true);
        await factory.authorizeToken(eth.target, true);
        await factory.authorizeToken(usdc.target, true);
        await factory.authorizeToken(sol.target, true);
        
        // Grant recipe creator role
        const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
        await factory.grantRole(RECIPE_CREATOR_ROLE, kbank.address);
        
        // Mint tokens to K-Bank
        await btc.mint(kbank.address, ethers.parseEther("1000"));
        await eth.mint(kbank.address, ethers.parseEther("10000"));
        await usdc.mint(kbank.address, ethers.parseUnits("5000000", 6));
        await sol.mint(kbank.address, ethers.parseUnits("100000", 9));
        
        return { factory, btc, eth, usdc, sol, mockL1Read, owner, kbank, nhbank, user1 };
    }
    
    describe("Token Issuance Process", function () {
        it("Should complete full token issuance cycle with NAV calculation", async function () {
            const { factory, btc, eth, usdc, sol, mockL1Read, owner, kbank } = await loadFixture(deployWithNAVFixture);
            
            console.log("\\n🏦 === K-Bank Complete Token Issuance Cycle ===");
            
            // Step 1: Create Index Fund
            console.log("📋 Step 1: Creating K-Crypto Top 4 Index Fund");
            const kCryptoComponents = [
                { tokenAddress: btc.target, hyperliquidAssetIndex: 1, targetRatio: 4000, depositedAmount: 0 }, // BTC 40%
                { tokenAddress: eth.target, hyperliquidAssetIndex: 2, targetRatio: 3000, depositedAmount: 0 }, // ETH 30%
                { tokenAddress: usdc.target, hyperliquidAssetIndex: 3, targetRatio: 2000, depositedAmount: 0 }, // USDC 20%
                { tokenAddress: sol.target, hyperliquidAssetIndex: 4, targetRatio: 1000, depositedAmount: 0 }  // SOL 10%
            ];
            
            const createTx = await factory.connect(kbank).createIndexFund("K-Crypto Top 4", "KTOP4", kCryptoComponents);
            const createReceipt = await createTx.wait();
            const createEvent = createReceipt.logs.find(log => {
                try { return factory.interface.parseLog(log).name === "FundCreated"; } catch { return false; }
            });
            const fundId = factory.interface.parseLog(createEvent).args.fundId;
            console.log(`   ✅ Fund ID: ${fundId}`);
            
            // Step 2: Deposit Assets
            console.log("💰 Step 2: Depositing Assets");
            const btcAmount = ethers.parseEther("40");      // 40 BTC
            const ethAmount = ethers.parseEther("400");     // 400 ETH  
            const usdcAmount = ethers.parseUnits("1000000", 6); // 1M USDC
            const solAmount = ethers.parseUnits("10000", 9);    // 10K SOL
            
            // At current mock prices:
            // BTC: 40 * $45,000 = $1,800,000
            // ETH: 400 * $2,500 = $1,000,000  
            // USDC: 1,000,000 * $1 = $1,000,000
            // SOL: 10,000 * $100 = $1,000,000
            // Total fund value: $4,800,000
            
            console.log("   💸 Deposit amounts:");
            console.log(`     • ${ethers.formatEther(btcAmount)} BTC ($${(40 * 45000).toLocaleString()})`);
            console.log(`     • ${ethers.formatEther(ethAmount)} ETH ($${(400 * 2500).toLocaleString()})`);
            console.log(`     • ${ethers.formatUnits(usdcAmount, 6)} USDC ($${ethers.formatUnits(usdcAmount, 6)})`);
            console.log(`     • ${ethers.formatUnits(solAmount, 9)} SOL ($${(10000 * 100).toLocaleString()})`);
            console.log(`     📊 Total Fund Value: $4,800,000`);
            
            await btc.connect(kbank).approve(factory.target, btcAmount);
            await eth.connect(kbank).approve(factory.target, ethAmount);
            await usdc.connect(kbank).approve(factory.target, usdcAmount);
            await sol.connect(kbank).approve(factory.target, solAmount);
            
            await factory.connect(kbank).depositComponentTokens(
                fundId,
                [btc.target, eth.target, usdc.target, sol.target],
                [btcAmount, ethAmount, usdcAmount, solAmount]
            );
            console.log("   ✅ All assets deposited successfully");
            
            // Step 3: Issue Index Tokens
            console.log("🎯 Step 3: Issuing Index Tokens");
            const tokenSupply = ethers.parseEther("100000"); // 100,000 KTOP4 tokens
            
            const issueTx = await factory.connect(owner).issueIndexToken(fundId, tokenSupply);
            const issueReceipt = await issueTx.wait();
            const issueEvent = issueReceipt.logs.find(log => {
                try { return factory.interface.parseLog(log).name === "IndexTokenIssued"; } catch { return false; }
            });
            
            expect(issueEvent).to.not.be.undefined;
            const indexTokenAddress = factory.interface.parseLog(issueEvent).args.tokenAddress;
            
            console.log(`   ✅ Issued ${ethers.formatEther(tokenSupply)} KTOP4 tokens`);
            console.log(`   🏷️  Token Contract: ${indexTokenAddress}`);
            
            // Step 4: Verify Fund Information
            const fundInfo = await factory.getFundInfo(fundId);
            expect(fundInfo.isIssued).to.be.true;
            expect(fundInfo.totalSupply).to.equal(tokenSupply);
            expect(fundInfo.indexToken).to.equal(indexTokenAddress);
            
            // Step 5: Calculate and Verify NAV
            console.log("📈 Step 4: NAV Calculation");
            const nav = await factory.calculateNAV(fundId);
            const expectedNAV = ethers.parseEther("48"); // $4,800,000 / 100,000 tokens = $48 per token
            
            console.log(`   💎 Current NAV: $${ethers.formatEther(nav)} per token`);
            console.log(`   🎯 Expected NAV: $${ethers.formatEther(expectedNAV)} per token`);
            
            // Allow for small precision differences
            const navDifference = nav > expectedNAV ? nav - expectedNAV : expectedNAV - nav;
            const tolerance = ethers.parseEther("0.01"); // $0.01 tolerance
            expect(navDifference).to.be.lte(tolerance);
            
            // Step 6: Test Index Token Contract
            console.log("🏭 Step 5: Testing Index Token Contract");
            const IndexToken = await ethers.getContractFactory("IndexToken");
            const indexToken = IndexToken.attach(indexTokenAddress);
            
            expect(await indexToken.name()).to.equal("K-Crypto Top 4");
            expect(await indexToken.symbol()).to.equal("KTOP4");
            expect(await indexToken.totalSupply()).to.equal(tokenSupply);
            expect(await indexToken.balanceOf(factory.target)).to.equal(tokenSupply); // All tokens held by factory initially
            
            const tokenNav = await indexToken.getNavPerToken();
            expect(tokenNav).to.equal(nav);
            
            console.log(`   📜 Token Name: ${await indexToken.name()}`);
            console.log(`   🔤 Token Symbol: ${await indexToken.symbol()}`);
            console.log(`   📊 Total Supply: ${ethers.formatEther(await indexToken.totalSupply())}`);
            console.log(`   💰 NAV per Token: $${ethers.formatEther(tokenNav)}`);
            
            console.log("\\n🎉 === Token Issuance Cycle Completed Successfully ===");
        });
        
        it("Should handle price changes and recalculate NAV correctly", async function () {
            const { factory, btc, eth, usdc, sol, mockL1Read, owner, kbank } = await loadFixture(deployWithNAVFixture);
            
            console.log("\\n📊 === NAV Recalculation with Price Changes ===");
            
            // Create and issue fund (simplified setup)
            const components = [
                { tokenAddress: btc.target, hyperliquidAssetIndex: 1, targetRatio: 5000, depositedAmount: 0 }, // BTC 50%
                { tokenAddress: eth.target, hyperliquidAssetIndex: 2, targetRatio: 5000, depositedAmount: 0 }  // ETH 50%
            ];
            
            const createTx = await factory.connect(kbank).createIndexFund("Crypto Duo", "DUO", components);
            const fundId = (await createTx.wait()).logs.find(log => {
                try { return factory.interface.parseLog(log).name === "FundCreated"; } catch { return false; }
            });
            const fundIdValue = factory.interface.parseLog(fundId).args.fundId;
            
            // Deposit equal value amounts
            const btcAmount = ethers.parseEther("10");  // 10 BTC @ $45,000 = $450,000
            const ethAmount = ethers.parseEther("180"); // 180 ETH @ $2,500 = $450,000
            // Total: $900,000
            
            await btc.connect(kbank).approve(factory.target, btcAmount);
            await eth.connect(kbank).approve(factory.target, ethAmount);
            await factory.connect(kbank).depositComponentTokens(fundIdValue, [btc.target, eth.target], [btcAmount, ethAmount]);
            
            const tokenSupply = ethers.parseEther("1000"); // 1000 tokens
            await factory.connect(owner).issueIndexToken(fundIdValue, tokenSupply);
            
            // Initial NAV: $900,000 / 1000 = $900 per token
            const initialNAV = await factory.calculateNAV(fundIdValue);
            console.log(`   📊 Initial NAV: $${ethers.formatEther(initialNAV)} per token`);
            
            // Scenario 1: BTC price increases 20%
            console.log("   🚀 Scenario 1: BTC price +20%");
            await mockL1Read.setMockPrice(1, ethers.parseEther("54000")); // BTC: $45,000 -> $54,000
            
            const navAfterBTCIncrease = await factory.calculateNAV(fundIdValue);
            // New calculation: (10 BTC * $54,000) + (180 ETH * $2,500) = $540,000 + $450,000 = $990,000
            // NAV = $990,000 / 1000 = $990 per token
            console.log(`     💰 New NAV: $${ethers.formatEther(navAfterBTCIncrease)} per token`);
            expect(navAfterBTCIncrease).to.be.gt(initialNAV);
            
            // Scenario 2: ETH price decreases 10%
            console.log("   📉 Scenario 2: ETH price -10%");
            await mockL1Read.setMockPrice(2, ethers.parseEther("2250")); // ETH: $2,500 -> $2,250
            
            const navAfterETHDecrease = await factory.calculateNAV(fundIdValue);
            // New calculation: (10 BTC * $54,000) + (180 ETH * $2,250) = $540,000 + $405,000 = $945,000
            // NAV = $945,000 / 1000 = $945 per token
            console.log(`     💰 New NAV: $${ethers.formatEther(navAfterETHDecrease)} per token`);
            expect(navAfterETHDecrease).to.be.lt(navAfterBTCIncrease);
            
            console.log("   ✅ NAV calculation correctly reflects price changes");
        });
    });
});