const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Basic Token Creation Test", function () {
    // 기본적인 토큰 생성 테스트
    async function deployBasicFixture() {
        const [owner, institution, user1] = await ethers.getSigners();
        
        // Deploy MockERC20 for testing
        const MockToken = await ethers.getContractFactory("MockERC20");
        const btc = await MockToken.deploy("Bitcoin", "BTC", 18);
        const eth = await MockToken.deploy("Ethereum", "ETH", 18);
        
        await btc.deployed();
        await eth.deployed();
        
        // Deploy IndexTokenFactory
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        const factory = await IndexTokenFactory.deploy(owner.address);
        await factory.deployed();
        
        // Authorize tokens
        await factory.authorizeToken(btc.address, true);
        await factory.authorizeToken(eth.address, true);
        
        // Grant recipe creator role
        const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
        await factory.grantRole(RECIPE_CREATOR_ROLE, institution.address);
        
        // Mint tokens to institution
        await btc.mint(institution.address, ethers.utils.parseEther("1000"));
        await eth.mint(institution.address, ethers.utils.parseEther("10000"));
        
        return { factory, btc, eth, owner, institution, user1 };
    }
    
    describe("Factory Deployment", function () {
        it("Should deploy factory with correct settings", async function () {
            const { factory, owner } = await loadFixture(deployBasicFixture);
            
            expect(await factory.feeRecipient()).to.equal(owner.address);
            expect(await factory.annualManagementFee()).to.equal(50);
        });
    });
    
    describe("Fund Creation", function () {
        it("K-Bank should create crypto index fund", async function () {
            const { factory, btc, eth, institution } = await loadFixture(deployBasicFixture);
            
            console.log("🏦 K-Bank creating crypto index fund...");
            
            const components = [
                {
                    tokenAddress: btc.address,
                    hyperliquidAssetIndex: 1,
                    targetRatio: 6000, // 60%
                    depositedAmount: 0
                },
                {
                    tokenAddress: eth.address,
                    hyperliquidAssetIndex: 2,
                    targetRatio: 4000, // 40%
                    depositedAmount: 0
                }
            ];
            
            const tx = await factory.connect(institution).createIndexFund(
                "K-Crypto Index",
                "KCRYPTO",
                components
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "FundCreated");
            
            expect(event).to.not.be.undefined;
            expect(event.args.name).to.equal("K-Crypto Index");
            
            const fundId = event.args.fundId;
            const fundInfo = await factory.getFundInfo(fundId);
            
            expect(fundInfo.creator).to.equal(institution.address);
            expect(fundInfo.isActive).to.be.true;
            expect(fundInfo.isIssued).to.be.false;
            
            console.log(`✅ Fund created with ID: ${fundId}`);
            console.log(`📊 Fund composition: BTC 60%, ETH 40%`);
        });
        
        it("Institution should deposit tokens", async function () {
            const { factory, btc, eth, institution } = await loadFixture(deployBasicFixture);
            
            // Create fund first
            const components = [
                { tokenAddress: btc.address, hyperliquidAssetIndex: 1, targetRatio: 6000, depositedAmount: 0 },
                { tokenAddress: eth.address, hyperliquidAssetIndex: 2, targetRatio: 4000, depositedAmount: 0 }
            ];
            
            const tx = await factory.connect(institution).createIndexFund("K-Crypto Index", "KCRYPTO", components);
            const fundId = (await tx.wait()).events.find(e => e.event === "FundCreated").args.fundId;
            
            console.log("💰 Institution depositing tokens...");
            
            // Deposit tokens
            const btcAmount = ethers.utils.parseEther("60"); // 60 BTC
            const ethAmount = ethers.utils.parseEther("400"); // 400 ETH
            
            await btc.connect(institution).approve(factory.address, btcAmount);
            await eth.connect(institution).approve(factory.address, ethAmount);
            
            await factory.connect(institution).depositComponentTokens(
                fundId,
                [btc.address, eth.address],
                [btcAmount, ethAmount]
            );
            
            const components2 = await factory.getFundComponents(fundId);
            expect(components2[0].depositedAmount).to.equal(btcAmount);
            expect(components2[1].depositedAmount).to.equal(ethAmount);
            
            console.log(`✅ Deposited: ${ethers.utils.formatEther(btcAmount)} BTC, ${ethers.utils.formatEther(ethAmount)} ETH`);
        });
        
        it("Platform admin should issue index tokens", async function () {
            const { factory, btc, eth, owner, institution } = await loadFixture(deployBasicFixture);
            
            // Create fund and deposit tokens
            const components = [
                { tokenAddress: btc.address, hyperliquidAssetIndex: 1, targetRatio: 6000, depositedAmount: 0 },
                { tokenAddress: eth.address, hyperliquidAssetIndex: 2, targetRatio: 4000, depositedAmount: 0 }
            ];
            
            const tx = await factory.connect(institution).createIndexFund("K-Crypto Index", "KCRYPTO", components);
            const fundId = (await tx.wait()).events.find(e => e.event === "FundCreated").args.fundId;
            
            const btcAmount = ethers.utils.parseEther("60");
            const ethAmount = ethers.utils.parseEther("400");
            
            await btc.connect(institution).approve(factory.address, btcAmount);
            await eth.connect(institution).approve(factory.address, ethAmount);
            
            await factory.connect(institution).depositComponentTokens(
                fundId, [btc.address, eth.address], [btcAmount, ethAmount]
            );
            
            console.log("🎯 Platform admin issuing index tokens...");
            
            // Issue index tokens
            const tokenSupply = ethers.utils.parseEther("100000"); // 100,000 tokens
            
            const issueTx = await factory.connect(owner).issueIndexToken(fundId, tokenSupply);
            const issueReceipt = await issueTx.wait();
            const issueEvent = issueReceipt.events.find(e => e.event === "IndexTokenIssued");
            
            expect(issueEvent).to.not.be.undefined;
            expect(issueEvent.args.tokenSupply).to.equal(tokenSupply);
            
            const fundInfo = await factory.getFundInfo(fundId);
            expect(fundInfo.isIssued).to.be.true;
            expect(fundInfo.totalSupply).to.equal(tokenSupply);
            
            console.log(`✅ Issued ${ethers.utils.formatEther(tokenSupply)} KCRYPTO tokens`);
            console.log(`📈 Token address: ${fundInfo.indexToken}`);
        });
    });
});