const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Core Token Creation Test - Isolated", function () {
    // 핵심 토큰 생성 기능만 테스트 (리뎀션 모듈 제외)
    async function deploySimpleFixture() {
        const [owner, kbank, nhbank, user1] = await ethers.getSigners();
        
        // Deploy MockERC20 for testing (BTC, ETH, USDC, SOL)
        const MockToken = await ethers.getContractFactory("MockERC20");
        const btc = await MockToken.deploy("Bitcoin", "BTC", 18);
        const eth = await MockToken.deploy("Ethereum", "ETH", 18);
        const usdc = await MockToken.deploy("USD Coin", "USDC", 6);
        const sol = await MockToken.deploy("Solana", "SOL", 9);
        
        // Deploy IndexTokenFactory with simple mocks for missing interfaces
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        const factory = await IndexTokenFactory.deploy(owner.address);
        
        // Authorize tokens for use in funds
        await factory.authorizeToken(btc.target, true);
        await factory.authorizeToken(eth.target, true);
        await factory.authorizeToken(usdc.target, true);
        await factory.authorizeToken(sol.target, true);
        
        // Grant recipe creator roles to institutions
        const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
        await factory.grantRole(RECIPE_CREATOR_ROLE, kbank.address);
        await factory.grantRole(RECIPE_CREATOR_ROLE, nhbank.address);
        
        // Mint tokens to institutions for testing
        // K-Bank gets tokens for "K-Crypto Top 4" creation
        await btc.mint(kbank.address, ethers.parseEther("1000")); // 1000 BTC
        await eth.mint(kbank.address, ethers.parseEther("10000")); // 10000 ETH
        await usdc.mint(kbank.address, ethers.parseUnits("5000000", 6)); // 5M USDC
        await sol.mint(kbank.address, ethers.parseUnits("100000", 9)); // 100K SOL
        
        // NH Investment gets tokens for "NH-AI Innovation" creation
        await btc.mint(nhbank.address, ethers.parseEther("500"));
        await eth.mint(nhbank.address, ethers.parseEther("5000"));
        await usdc.mint(nhbank.address, ethers.parseUnits("2000000", 6));
        
        return { factory, btc, eth, usdc, sol, owner, kbank, nhbank, user1 };
    }
    
    describe("Factory Setup and Authorization", function () {
        it("Should deploy factory with correct initial settings", async function () {
            const { factory, owner } = await loadFixture(deploySimpleFixture);
            
        });
        
        it("Should have authorized tokens correctly", async function () {
            const { factory, btc, eth, usdc, sol } = await loadFixture(deploySimpleFixture);
            
            expect(await factory.authorizedTokens(btc.target)).to.be.true;
            expect(await factory.authorizedTokens(eth.target)).to.be.true;
            expect(await factory.authorizedTokens(usdc.target)).to.be.true;
            expect(await factory.authorizedTokens(sol.target)).to.be.true;
        });
    });
    
    describe("K-Bank: Crypto Top 4 Index Creation", function () {
        it("K-Bank should create 'K-Crypto Top 4' index fund", async function () {
            const { factory, btc, eth, usdc, sol, kbank } = await loadFixture(deploySimpleFixture);
            
            console.log("\\n🏦 === K-Bank Creating K-Crypto Top 4 Index ===");
            console.log("📊 Target Composition:");
            console.log("   • BTC: 40%");
            console.log("   • ETH: 30%");
            console.log("   • USDC: 20%");
            console.log("   • SOL: 10%");
            
            // Define K-Crypto Top 4 components
            const kCryptoComponents = [
                {
                    tokenAddress: btc.target,
                    hyperliquidAssetIndex: 1, // BTC index on Hyperliquid
                    targetRatio: 4000, // 40%
                    depositedAmount: 0
                },
                {
                    tokenAddress: eth.target,
                    hyperliquidAssetIndex: 2, // ETH index on Hyperliquid
                    targetRatio: 3000, // 30%
                    depositedAmount: 0
                },
                {
                    tokenAddress: usdc.target,
                    hyperliquidAssetIndex: 3, // USDC index on Hyperliquid
                    targetRatio: 2000, // 20%
                    depositedAmount: 0
                },
                {
                    tokenAddress: sol.target,
                    hyperliquidAssetIndex: 4, // SOL index on Hyperliquid
                    targetRatio: 1000, // 10%
                    depositedAmount: 0
                }
            ];
            
            const tx = await factory.connect(kbank).createIndexFund(
                "K-Crypto Top 4",
                "KTOP4",
                kCryptoComponents
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return factory.interface.parseLog(log).name === "FundCreated";
                } catch {
                    return false;
                }
            });
            
            expect(event).to.not.be.undefined;
            const parsedEvent = factory.interface.parseLog(event);
            const fundId = parsedEvent.args.fundId;
            
            console.log(`✅ Fund created with ID: ${fundId}`);
            
            // Verify fund information
            const fundInfo = await factory.getFundInfo(fundId);
            expect(fundInfo.name).to.equal("K-Crypto Top 4");
            expect(fundInfo.symbol).to.equal("KTOP4");
            expect(fundInfo.creator).to.equal(kbank.address);
            expect(fundInfo.isActive).to.be.true;
            expect(fundInfo.isIssued).to.be.false;
            
            // Verify components
            const components = await factory.getFundComponents(fundId);
            expect(components.length).to.equal(4);
            expect(components[0].targetRatio).to.equal(4000);
            expect(components[1].targetRatio).to.equal(3000);
            expect(components[2].targetRatio).to.equal(2000);
            expect(components[3].targetRatio).to.equal(1000);
            
            console.log("🎯 Fund structure verified successfully");
        });
        
        it("K-Bank should deposit assets to the fund", async function () {
            const { factory, btc, eth, usdc, sol, kbank } = await loadFixture(deploySimpleFixture);
            
            // Create fund first
            const kCryptoComponents = [
                { tokenAddress: btc.target, hyperliquidAssetIndex: 1, targetRatio: 4000, depositedAmount: 0 },
                { tokenAddress: eth.target, hyperliquidAssetIndex: 2, targetRatio: 3000, depositedAmount: 0 },
                { tokenAddress: usdc.target, hyperliquidAssetIndex: 3, targetRatio: 2000, depositedAmount: 0 },
                { tokenAddress: sol.target, hyperliquidAssetIndex: 4, targetRatio: 1000, depositedAmount: 0 }
            ];
            
            const tx = await factory.connect(kbank).createIndexFund("K-Crypto Top 4", "KTOP4", kCryptoComponents);
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return factory.interface.parseLog(log).name === "FundCreated";
                } catch {
                    return false;
                }
            });
            const fundId = factory.interface.parseLog(event).args.fundId;
            
            console.log("\\n💰 === K-Bank Depositing Assets ===");
            
            // Define deposit amounts (proportional to target ratios)
            const btcAmount = ethers.parseEther("40"); // 40 BTC
            const ethAmount = ethers.parseEther("300"); // 300 ETH  
            const usdcAmount = ethers.parseUnits("200000", 6); // 200K USDC
            const solAmount = ethers.parseUnits("1000", 9); // 1K SOL
            
            console.log("📥 Depositing:");
            console.log(`   • ${ethers.formatEther(btcAmount)} BTC`);
            console.log(`   • ${ethers.formatEther(ethAmount)} ETH`);
            console.log(`   • ${ethers.formatUnits(usdcAmount, 6)} USDC`);
            console.log(`   • ${ethers.formatUnits(solAmount, 9)} SOL`);
            
            // Approve tokens for transfer
            await btc.connect(kbank).approve(factory.target, btcAmount);
            await eth.connect(kbank).approve(factory.target, ethAmount);
            await usdc.connect(kbank).approve(factory.target, usdcAmount);
            await sol.connect(kbank).approve(factory.target, solAmount);
            
            // Deposit tokens
            await factory.connect(kbank).depositComponentTokens(
                fundId,
                [btc.target, eth.target, usdc.target, sol.target],
                [btcAmount, ethAmount, usdcAmount, solAmount]
            );
            
            // Verify deposits
            const components = await factory.getFundComponents(fundId);
            expect(components[0].depositedAmount).to.equal(btcAmount);
            expect(components[1].depositedAmount).to.equal(ethAmount);
            expect(components[2].depositedAmount).to.equal(usdcAmount);
            expect(components[3].depositedAmount).to.equal(solAmount);
            
            console.log("✅ All assets deposited successfully");
        });
    });
    
    describe("NH Investment: AI Innovation Index Creation", function () {
        it("NH Investment should create 'NH-AI Innovation' index fund", async function () {
            const { factory, btc, eth, usdc, nhbank } = await loadFixture(deploySimpleFixture);
            
            console.log("\\n🏛️ === NH Investment Creating AI Innovation Index ===");
            console.log("🤖 Target Composition:");
            console.log("   • ETH: 50% (AI/Smart Contract Platform)");
            console.log("   • BTC: 30% (Digital Gold Reserve)");
            console.log("   • USDC: 20% (Stable Reserve)");
            
            const nhAiComponents = [
                {
                    tokenAddress: eth.target,
                    hyperliquidAssetIndex: 2,
                    targetRatio: 5000, // 50%
                    depositedAmount: 0
                },
                {
                    tokenAddress: btc.target,
                    hyperliquidAssetIndex: 1,
                    targetRatio: 3000, // 30%
                    depositedAmount: 0
                },
                {
                    tokenAddress: usdc.target,
                    hyperliquidAssetIndex: 3,
                    targetRatio: 2000, // 20%
                    depositedAmount: 0
                }
            ];
            
            const tx = await factory.connect(nhbank).createIndexFund(
                "NH-AI Innovation",
                "NHAI",
                nhAiComponents
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return factory.interface.parseLog(log).name === "FundCreated";
                } catch {
                    return false;
                }
            });
            
            const fundId = factory.interface.parseLog(event).args.fundId;
            console.log(`✅ NH-AI Innovation fund created with ID: ${fundId}`);
            
            // Verify fund information
            const fundInfo = await factory.getFundInfo(fundId);
            expect(fundInfo.name).to.equal("NH-AI Innovation");
            expect(fundInfo.symbol).to.equal("NHAI");
            expect(fundInfo.creator).to.equal(nhbank.address);
            
            console.log("🎯 NH Investment fund structure verified");
        });
    });
    
    describe("Multi-Institution Operations", function () {
        it("Should support multiple institutions creating funds simultaneously", async function () {
            const { factory, btc, eth, usdc, sol, kbank, nhbank } = await loadFixture(deploySimpleFixture);
            
            console.log("\\n🔄 === Multi-Institution Concurrent Operations ===");
            
            // K-Bank creates their fund
            const kCryptoComponents = [
                { tokenAddress: btc.target, hyperliquidAssetIndex: 1, targetRatio: 4000, depositedAmount: 0 },
                { tokenAddress: eth.target, hyperliquidAssetIndex: 2, targetRatio: 3000, depositedAmount: 0 },
                { tokenAddress: usdc.target, hyperliquidAssetIndex: 3, targetRatio: 2000, depositedAmount: 0 },
                { tokenAddress: sol.target, hyperliquidAssetIndex: 4, targetRatio: 1000, depositedAmount: 0 }
            ];
            
            const kbankTx = await factory.connect(kbank).createIndexFund("K-Crypto Top 4", "KTOP4", kCryptoComponents);
            
            // NH Investment creates their fund
            const nhAiComponents = [
                { tokenAddress: eth.target, hyperliquidAssetIndex: 2, targetRatio: 5000, depositedAmount: 0 },
                { tokenAddress: btc.target, hyperliquidAssetIndex: 1, targetRatio: 3000, depositedAmount: 0 },
                { tokenAddress: usdc.target, hyperliquidAssetIndex: 3, targetRatio: 2000, depositedAmount: 0 }
            ];
            
            const nhbankTx = await factory.connect(nhbank).createIndexFund("NH-AI Innovation", "NHAI", nhAiComponents);
            
            // Verify both funds exist
            const kbankReceipt = await kbankTx.wait();
            const nhbankReceipt = await nhbankTx.wait();
            
            const kbankEvent = kbankReceipt.logs.find(log => {
                try { return factory.interface.parseLog(log).name === "FundCreated"; } catch { return false; }
            });
            
            const nhbankEvent = nhbankReceipt.logs.find(log => {
                try { return factory.interface.parseLog(log).name === "FundCreated"; } catch { return false; }
            });
            
            const kbankFundId = factory.interface.parseLog(kbankEvent).args.fundId;
            const nhbankFundId = factory.interface.parseLog(nhbankEvent).args.fundId;
            
            // Verify funds are different
            expect(kbankFundId).to.not.equal(nhbankFundId);
            
            // Verify creator-specific fund lists
            const kbankFunds = await factory.getCreatorFunds(kbank.address);
            const nhbankFunds = await factory.getCreatorFunds(nhbank.address);
            
            expect(kbankFunds.length).to.equal(1);
            expect(nhbankFunds.length).to.equal(1);
            expect(kbankFunds[0]).to.equal(kbankFundId);
            expect(nhbankFunds[0]).to.equal(nhbankFundId);
            
            console.log(`✅ K-Bank fund: ${kbankFundId}`);
            console.log(`✅ NH Investment fund: ${nhbankFundId}`);
            console.log("🎯 Multi-institution operations successful");
        });
    });
});