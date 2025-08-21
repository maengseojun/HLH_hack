const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("IndexTokenFactory", function () {
    // Fixture for deploying contracts
    async function deployFactoryFixture() {
        const [owner, institution1, institution2, user1, user2] = await ethers.getSigners();
        
        // Deploy mock tokens for testing
        const MockToken = await ethers.getContractFactory("MockERC20");
        const btc = await MockToken.deploy("Bitcoin", "BTC", 18);
        const eth = await MockToken.deploy("Ethereum", "ETH", 18);
        const usdc = await MockToken.deploy("USD Coin", "USDC", 6);
        const sol = await MockToken.deploy("Solana", "SOL", 9);
        
        await btc.deployed();
        await eth.deployed();
        await usdc.deployed();
        await sol.deployed();
        
        // Deploy IndexTokenFactory
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        const factory = await IndexTokenFactory.deploy(owner.address);
        await factory.deployed();
        
        // Authorize tokens
        await factory.authorizeToken(btc.address, true);
        await factory.authorizeToken(eth.address, true);
        await factory.authorizeToken(usdc.address, true);
        await factory.authorizeToken(sol.address, true);
        
        // Grant recipe creator role to institutions
        const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
        await factory.grantRole(RECIPE_CREATOR_ROLE, institution1.address);
        await factory.grantRole(RECIPE_CREATOR_ROLE, institution2.address);
        
        // Mint tokens to institutions for testing
        await btc.mint(institution1.address, ethers.utils.parseEther("100"));
        await eth.mint(institution1.address, ethers.utils.parseEther("1000"));
        await usdc.mint(institution1.address, ethers.utils.parseUnits("100000", 6));
        await sol.mint(institution1.address, ethers.utils.parseUnits("10000", 9));
        
        return {
            factory,
            btc,
            eth,
            usdc,
            sol,
            owner,
            institution1,
            institution2,
            user1,
            user2
        };
    }
    
    describe("Deployment", function () {
        it("Should deploy with correct initial settings", async function () {
            const { factory, owner } = await loadFixture(deployFactoryFixture);
            
            expect(await factory.feeRecipient()).to.equal(owner.address);
            expect(await factory.annualManagementFee()).to.equal(50); // 0.5%
            expect(await factory.issuanceFee()).to.equal(10); // 0.1%
            
            // Check admin role
            const DEFAULT_ADMIN_ROLE = await factory.DEFAULT_ADMIN_ROLE();
            expect(await factory.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
        });
        
        it("Should not deploy with zero address fee recipient", async function () {
            const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
            
            await expect(
                IndexTokenFactory.deploy(ethers.constants.AddressZero)
            ).to.be.revertedWith("Fee recipient cannot be zero");
        });
    });
    
    describe("Token Authorization", function () {
        it("Should allow admin to authorize tokens", async function () {
            const { factory, btc, owner } = await loadFixture(deployFactoryFixture);
            
            expect(await factory.authorizedTokens(btc.address)).to.be.true;
            
            // Deauthorize token
            await factory.authorizeToken(btc.address, false);
            expect(await factory.authorizedTokens(btc.address)).to.be.false;
            
            // Re-authorize
            await factory.authorizeToken(btc.address, true);
            expect(await factory.authorizedTokens(btc.address)).to.be.true;
        });
        
        it("Should not allow non-admin to authorize tokens", async function () {
            const { factory, btc, user1 } = await loadFixture(deployFactoryFixture);
            
            await expect(
                factory.connect(user1).authorizeToken(btc.address, true)
            ).to.be.reverted;
        });
    });
    
    describe("Fund Creation", function () {
        it("Should allow institutions to create funds", async function () {
            const { factory, btc, eth, institution1 } = await loadFixture(deployFactoryFixture);
            
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
            
            const tx = await factory.connect(institution1).createIndexFund(
                "BTC-ETH Index",
                "BTCETH",
                components
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "FundCreated");
            
            expect(event).to.not.be.undefined;
            expect(event.args.name).to.equal("BTC-ETH Index");
            expect(event.args.creator).to.equal(institution1.address);
            
            const fundId = event.args.fundId;
            const fundInfo = await factory.getFundInfo(fundId);
            
            expect(fundInfo.name).to.equal("BTC-ETH Index");
            expect(fundInfo.symbol).to.equal("BTCETH");
            expect(fundInfo.creator).to.equal(institution1.address);
            expect(fundInfo.isActive).to.be.true;
            expect(fundInfo.isIssued).to.be.false;
        });
        
        it("Should not allow non-institutions to create funds", async function () {
            const { factory, btc, eth, user1 } = await loadFixture(deployFactoryFixture);
            
            const components = [
                {
                    tokenAddress: btc.address,
                    hyperliquidAssetIndex: 1,
                    targetRatio: 10000, // 100%
                    depositedAmount: 0
                }
            ];
            
            await expect(
                factory.connect(user1).createIndexFund("Test Fund", "TEST", components)
            ).to.be.reverted;
        });
        
        it("Should validate component ratios sum to 100%", async function () {
            const { factory, btc, eth, institution1 } = await loadFixture(deployFactoryFixture);
            
            const invalidComponents = [
                {
                    tokenAddress: btc.address,
                    hyperliquidAssetIndex: 1,
                    targetRatio: 6000, // 60%
                    depositedAmount: 0
                },
                {
                    tokenAddress: eth.address,
                    hyperliquidAssetIndex: 2,
                    targetRatio: 3000, // 30% - Total = 90%
                    depositedAmount: 0
                }
            ];
            
            await expect(
                factory.connect(institution1).createIndexFund(
                    "Invalid Fund",
                    "INVALID",
                    invalidComponents
                )
            ).to.be.revertedWith("Total ratio must be 100%");
        });
        
        it("Should not allow unauthorized tokens in components", async function () {
            const { factory, institution1 } = await loadFixture(deployFactoryFixture);
            
            // Deploy unauthorized token
            const MockToken = await ethers.getContractFactory("MockERC20");
            const unauthorizedToken = await MockToken.deploy("Unauthorized", "UNAUTH", 18);
            await unauthorizedToken.deployed();
            
            const components = [
                {
                    tokenAddress: unauthorizedToken.address,
                    hyperliquidAssetIndex: 99,
                    targetRatio: 10000, // 100%
                    depositedAmount: 0
                }
            ];
            
            await expect(
                factory.connect(institution1).createIndexFund(
                    "Invalid Fund",
                    "INVALID",
                    components
                )
            ).to.be.revertedWith("Token not authorized");
        });
    });
    
    describe("Token Deposits", function () {
        let fundId;
        
        beforeEach(async function () {
            const { factory, btc, eth, institution1 } = await loadFixture(deployFactoryFixture);
            
            const components = [
                {
                    tokenAddress: btc.address,
                    hyperliquidAssetIndex: 1,
                    targetRatio: 6000,
                    depositedAmount: 0
                },
                {
                    tokenAddress: eth.address,
                    hyperliquidAssetIndex: 2,
                    targetRatio: 4000,
                    depositedAmount: 0
                }
            ];
            
            const tx = await factory.connect(institution1).createIndexFund(
                "BTC-ETH Index",
                "BTCETH",
                components
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "FundCreated");
            fundId = event.args.fundId;
            
            this.fundId = fundId;
            this.factory = factory;
            this.btc = btc;
            this.eth = eth;
            this.institution1 = institution1;
        });
        
        it("Should allow fund creators to deposit component tokens", async function () {
            const { factory, btc, eth, institution1 } = await loadFixture(deployFactoryFixture);
            const fundId = this.fundId;
            
            // Approve tokens for transfer
            await btc.connect(institution1).approve(factory.address, ethers.utils.parseEther("10"));
            await eth.connect(institution1).approve(factory.address, ethers.utils.parseEther("100"));
            
            // Deposit tokens
            await expect(
                factory.connect(institution1).depositComponentTokens(
                    fundId,
                    [btc.address, eth.address],
                    [ethers.utils.parseEther("10"), ethers.utils.parseEther("100")]
                )
            ).to.emit(factory, "TokensDeposited");
            
            // Check component deposits
            const components = await factory.getFundComponents(fundId);
            expect(components[0].depositedAmount).to.equal(ethers.utils.parseEther("10"));
            expect(components[1].depositedAmount).to.equal(ethers.utils.parseEther("100"));
        });
        
        it("Should not allow non-creators to deposit tokens", async function () {
            const { factory, btc, user1 } = await loadFixture(deployFactoryFixture);
            const fundId = this.fundId;
            
            await expect(
                factory.connect(user1).depositComponentTokens(
                    fundId,
                    [btc.address],
                    [ethers.utils.parseEther("10")]
                )
            ).to.be.revertedWith("Only fund creator can deposit");
        });
    });
    
    describe("Fee Management", function () {
        it("Should allow admin to set fees within limits", async function () {
            const { factory, owner } = await loadFixture(deployFactoryFixture);
            
            await factory.connect(owner).setFees(100, 25); // 1% management, 0.25% issuance
            
            expect(await factory.annualManagementFee()).to.equal(100);
            expect(await factory.issuanceFee()).to.equal(25);
        });
        
        it("Should not allow fees above maximum", async function () {
            const { factory, owner } = await loadFixture(deployFactoryFixture);
            
            await expect(
                factory.connect(owner).setFees(300, 10) // 3% management (too high)
            ).to.be.revertedWith("Management fee too high");
            
            await expect(
                factory.connect(owner).setFees(50, 100) // 1% issuance (too high)
            ).to.be.revertedWith("Issuance fee too high");
        });
    });
});
