const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Improved Redemption System", function () {
    let indexTokenFactory;
    let redemptionManager;
    let chainVault;
    let priceFeed;
    let amm;
    let multiChainAggregator;
    let indexToken;
    let testToken1, testToken2;
    let owner, creator, user1, user2;
    let fundId;

    beforeEach(async function () {
        [owner, creator, user1, user2] = await ethers.getSigners();

        // Deploy mock contracts
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        testToken1 = await MockERC20.deploy("Test Token 1", "TT1", 18);
        testToken2 = await MockERC20.deploy("Test Token 2", "TT2", 18);

        const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
        priceFeed = await MockPriceFeed.deploy();

        const MockAMM = await ethers.getContractFactory("MockAMM");
        amm = await MockAMM.deploy();

        const MockMultiChainAggregator = await ethers.getContractFactory("MockMultiChainAggregator");
        multiChainAggregator = await MockMultiChainAggregator.deploy();

        // Deploy ChainVault
        const ChainVault = await ethers.getContractFactory("ChainVault");
        chainVault = await ChainVault.deploy();

        // Deploy IndexTokenFactory
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        indexTokenFactory = await IndexTokenFactory.deploy(priceFeed.address);

        // Deploy RedemptionManager with ChainVault
        const RedemptionManager = await ethers.getContractFactory("RedemptionManager");
        redemptionManager = await RedemptionManager.deploy(
            priceFeed.address,
            amm.address,
            multiChainAggregator.address,
            indexTokenFactory.address,
            chainVault.address
        );

        // Setup roles
        const RECIPE_CREATOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RECIPE_CREATOR_ROLE"));
        const PLATFORM_ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PLATFORM_ADMIN_ROLE"));
        const VAULT_MANAGER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("VAULT_MANAGER_ROLE"));
        const REDEMPTION_MANAGER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("REDEMPTION_MANAGER_ROLE"));

        await indexTokenFactory.grantRole(RECIPE_CREATOR_ROLE, creator.address);
        await indexTokenFactory.grantRole(PLATFORM_ADMIN_ROLE, owner.address);
        await chainVault.grantRole(VAULT_MANAGER_ROLE, owner.address);
        await chainVault.grantRole(REDEMPTION_MANAGER_ROLE, redemptionManager.address);

        // Authorize tokens
        await indexTokenFactory.authorizeToken(testToken1.address, true);
        await indexTokenFactory.authorizeToken(testToken2.address, true);
    });

    describe("1. Whole Unit Redemption Restriction", function () {
        it("should allow whole unit redemption", async function () {
            // Create and setup fund first
            await setupTestFund();
            
            // Try to redeem 1 whole token (1e18)
            const wholeToken = ethers.utils.parseEther("1");
            
            await expect(
                redemptionManager.connect(user1).requestRedemption(
                    fundId,
                    wholeToken,
                    0, // RedemptionStrategy.OPTIMAL
                    500, // 5% max slippage
                    0, // min return amount
                    Math.floor(Date.now() / 1000) + 3600 // 1 hour deadline
                )
            ).to.not.be.reverted;
        });

        it("should reject fractional unit redemption", async function () {
            await setupTestFund();
            
            // Try to redeem 1.5 tokens (1.5e18)
            const fractionalToken = ethers.utils.parseEther("1.5");
            
            await expect(
                redemptionManager.connect(user1).requestRedemption(
                    fundId,
                    fractionalToken,
                    0, // RedemptionStrategy.OPTIMAL
                    500, // 5% max slippage
                    0, // min return amount
                    Math.floor(Date.now() / 1000) + 3600 // 1 hour deadline
                )
            ).to.be.revertedWith("Index tokens can only be redeemed in whole units (1, 2, 3...)");
        });

        it("should reject small fractional amounts", async function () {
            await setupTestFund();
            
            // Try to redeem 0.1 tokens (0.1e18)
            const smallFractional = ethers.utils.parseEther("0.1");
            
            await expect(
                redemptionManager.connect(user1).requestRedemption(
                    fundId,
                    smallFractional,
                    0, // RedemptionStrategy.OPTIMAL
                    500, // 5% max slippage
                    0, // min return amount
                    Math.floor(Date.now() / 1000) + 3600 // 1 hour deadline
                )
            ).to.be.revertedWith("Index tokens can only be redeemed in whole units (1, 2, 3...)");
        });
    });

    describe("2. Chain Vault System", function () {
        it("should deposit tokens to vault successfully", async function () {
            await setupTestFund();
            
            const depositAmount = ethers.utils.parseEther("100");
            
            // Mint tokens to owner
            await testToken1.mint(owner.address, depositAmount);
            await testToken1.approve(chainVault.address, depositAmount);
            
            await expect(
                chainVault.depositTokens(fundId, testToken1.address, depositAmount)
            ).to.emit(chainVault, "TokensDeposited");
            
            const balance = await chainVault.getVaultBalance(fundId, testToken1.address);
            expect(balance.totalBalance).to.equal(depositAmount);
            expect(balance.availableBalance).to.equal(depositAmount);
        });

        it("should check vault balance sufficiency", async function () {
            await setupTestFund();
            
            const depositAmount = ethers.utils.parseEther("100");
            const requestAmount = ethers.utils.parseEther("50");
            
            // Deposit tokens
            await testToken1.mint(owner.address, depositAmount);
            await testToken1.approve(chainVault.address, depositAmount);
            await chainVault.depositTokens(fundId, testToken1.address, depositAmount);
            
            const hasSufficient = await chainVault.hasSufficientBalance(fundId, testToken1.address, requestAmount);
            expect(hasSufficient).to.be.true;
            
            const insufficientAmount = ethers.utils.parseEther("150");
            const hasInsufficient = await chainVault.hasSufficientBalance(fundId, testToken1.address, insufficientAmount);
            expect(hasInsufficient).to.be.false;
        });

        it("should support multiple chains", async function () {
            const supportedChains = await chainVault.getSupportedChains();
            expect(supportedChains.length).to.be.greaterThan(0);
            
            // Check if Ethereum (chainId: 1) is supported
            const ethereumInfo = await chainVault.getChainInfo(1);
            expect(ethereumInfo.chainId).to.equal(1);
            expect(ethereumInfo.isActive).to.be.true;
        });
    });

    describe("3. Native Token Direct Return", function () {
        it("should return native tokens directly from vault", async function () {
            await setupTestFundWithVault();
            
            const redeemAmount = ethers.utils.parseEther("1");
            
            // User should have index tokens
            const userIndexBalance = await indexToken.balanceOf(user1.address);
            expect(userIndexBalance).to.be.gte(redeemAmount);
            
            // Check initial native token balance
            const initialToken1Balance = await testToken1.balanceOf(user1.address);
            const initialToken2Balance = await testToken2.balanceOf(user1.address);
            
            // Request redemption
            await indexToken.connect(user1).approve(redemptionManager.address, redeemAmount);
            
            const tx = await redemptionManager.connect(user1).requestRedemption(
                fundId,
                redeemAmount,
                0, // RedemptionStrategy.OPTIMAL
                500, // 5% max slippage
                0, // min return amount
                Math.floor(Date.now() / 1000) + 3600 // 1 hour deadline
            );
            
            const receipt = await tx.wait();
            const requestId = receipt.events.find(e => e.event === "RedemptionRequested").args.requestId;
            
            // Execute redemption
            await redemptionManager.executeRedemption(requestId);
            
            // Check that user received native tokens
            const finalToken1Balance = await testToken1.balanceOf(user1.address);
            const finalToken2Balance = await testToken2.balanceOf(user1.address);
            
            expect(finalToken1Balance).to.be.gt(initialToken1Balance);
            expect(finalToken2Balance).to.be.gt(initialToken2Balance);
        });

        it("should fail if insufficient vault balance", async function () {
            await setupTestFund(); // Without vault setup
            
            const redeemAmount = ethers.utils.parseEther("1");
            
            await expect(
                redemptionManager.connect(user1).requestRedemption(
                    fundId,
                    redeemAmount,
                    0, // RedemptionStrategy.OPTIMAL
                    500, // 5% max slippage
                    0, // min return amount
                    Math.floor(Date.now() / 1000) + 3600 // 1 hour deadline
                )
            ).to.be.revertedWith("Insufficient vault balance for token");
        });
    });

    describe("4. Liquidity Availability Check", function () {
        it("should correctly identify liquidity shortfalls", async function () {
            await setupTestFund();
            
            const redeemAmount = ethers.utils.parseEther("1");
            
            const [sufficient, insufficientAssets, shortfalls] = await redemptionManager.checkLiquidityAvailability(
                fundId,
                redeemAmount,
                0 // RedemptionStrategy.OPTIMAL
            );
            
            expect(sufficient).to.be.false;
            expect(insufficientAssets.length).to.be.greaterThan(0);
            expect(shortfalls.length).to.equal(insufficientAssets.length);
        });

        it("should show sufficient liquidity when vault is properly funded", async function () {
            await setupTestFundWithVault();
            
            const redeemAmount = ethers.utils.parseEther("1");
            
            const [sufficient, insufficientAssets, shortfalls] = await redemptionManager.checkLiquidityAvailability(
                fundId,
                redeemAmount,
                0 // RedemptionStrategy.OPTIMAL
            );
            
            expect(sufficient).to.be.true;
            expect(insufficientAssets.length).to.equal(0);
            expect(shortfalls.length).to.equal(0);
        });
    });

    // Helper functions
    async function setupTestFund() {
        const components = [
            {
                tokenAddress: testToken1.address,
                hyperliquidAssetIndex: 1,
                targetRatio: 5000, // 50%
                depositedAmount: 0
            },
            {
                tokenAddress: testToken2.address,
                hyperliquidAssetIndex: 2,
                targetRatio: 5000, // 50%
                depositedAmount: 0
            }
        ];

        const tx = await indexTokenFactory.connect(creator).createIndexFund(
            "Test Index Fund",
            "TIF",
            components
        );
        
        const receipt = await tx.wait();
        fundId = receipt.events.find(e => e.event === "FundCreated").args.fundId;

        // Deposit component tokens
        const depositAmount = ethers.utils.parseEther("1000");
        
        await testToken1.mint(creator.address, depositAmount);
        await testToken2.mint(creator.address, depositAmount);
        await testToken1.connect(creator).approve(indexTokenFactory.address, depositAmount);
        await testToken2.connect(creator).approve(indexTokenFactory.address, depositAmount);
        
        await indexTokenFactory.connect(creator).depositComponentTokens(
            fundId,
            [testToken1.address, testToken2.address],
            [depositAmount, depositAmount]
        );

        // Issue index tokens
        const tokenSupply = ethers.utils.parseEther("100");
        await indexTokenFactory.issueIndexToken(fundId, tokenSupply);
        
        const fundInfo = await indexTokenFactory.getFundInfo(fundId);
        const IndexToken = await ethers.getContractFactory("IndexToken");
        indexToken = IndexToken.attach(fundInfo.indexTokenAddress);
        
        // Transfer some tokens to user1 for testing
        await indexToken.transfer(user1.address, ethers.utils.parseEther("10"));
    }

    async function setupTestFundWithVault() {
        await setupTestFund();
        
        // Deposit tokens to vault
        const vaultDepositAmount = ethers.utils.parseEther("500");
        
        await testToken1.mint(owner.address, vaultDepositAmount);
        await testToken2.mint(owner.address, vaultDepositAmount);
        await testToken1.approve(chainVault.address, vaultDepositAmount);
        await testToken2.approve(chainVault.address, vaultDepositAmount);
        
        await chainVault.depositTokens(fundId, testToken1.address, vaultDepositAmount);
        await chainVault.depositTokens(fundId, testToken2.address, vaultDepositAmount);
    }
});