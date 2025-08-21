const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const CONSTANTS = require("../helpers/constants");
const utils = require("../helpers/utils");

describe("E2E Integration Tests", function () {
    async function deployE2EFixture() {
        const [owner, institution, user1, user2, user3] = await ethers.getSigners();
        
        // Deploy Mock Tokens
        const tokens = await utils.deployMockTokens(4);
        const [tokenA, tokenB, tokenC, tokenD] = tokens;
        
        // Deploy Mock Price Feed
        const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
        const priceFeed = await MockPriceFeed.deploy();
        
        // Set realistic prices
        await priceFeed.setPrice(tokenA.target, ethers.parseEther("2000")); // $2000 (like ETH)
        await priceFeed.setPrice(tokenB.target, ethers.parseEther("40000")); // $40000 (like BTC)
        await priceFeed.setPrice(tokenC.target, ethers.parseEther("1")); // $1 (like USDC)
        await priceFeed.setPrice(tokenD.target, ethers.parseEther("100")); // $100 (like SOL)
        
        // Deploy IndexTokenFactory
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        const factory = await IndexTokenFactory.deploy(priceFeed.target);
        
        // Deploy SmartIndexVault
        const SmartIndexVault = await ethers.getContractFactory("SmartIndexVault");
        const vault = await SmartIndexVault.deploy(
            tokenC.target, // USDC as base asset
            "Index Vault Shares",
            "IVS"
        );
        
        // Deploy SmartAggregator
        const SmartAggregator = await ethers.getContractFactory("SmartAggregator");
        const aggregator = await SmartAggregator.deploy(priceFeed.target);
        
        // Setup roles
        const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
        const PLATFORM_ADMIN_ROLE = await factory.PLATFORM_ADMIN_ROLE();
        await factory.grantRole(RECIPE_CREATOR_ROLE, institution.address);
        await factory.grantRole(PLATFORM_ADMIN_ROLE, owner.address);
        
        // Authorize tokens
        for (const token of tokens) {
            await factory.authorizeToken(token.target);
        }
        
        // Distribute tokens to users for testing
        for (const token of tokens) {
            await token.transfer(user1.address, ethers.parseEther("1000"));
            await token.transfer(user2.address, ethers.parseEther("1000"));
            await token.transfer(user3.address, ethers.parseEther("1000"));
        }
        
        return {
            factory,
            vault,
            aggregator,
            priceFeed,
            tokens,
            tokenA,
            tokenB,
            tokenC,
            tokenD,
            owner,
            institution,
            user1,
            user2,
            user3,
            RECIPE_CREATOR_ROLE,
            PLATFORM_ADMIN_ROLE
        };
    }
    
    describe("Complete Index Token Lifecycle", function () {
        it("Should complete full lifecycle: create, issue, trade, redeem", async function () {
            const { 
                factory, 
                vault, 
                tokenA, 
                tokenB, 
                tokenC,
                institution, 
                user1, 
                user2 
            } = await loadFixture(deployE2EFixture);
            
            // Step 1: Institution creates index fund
            const fundName = "Crypto Top 3";
            const fundSymbol = "CT3";
            const components = [
                { tokenAddress: tokenA.target, targetRatio: 4000 }, // 40% ETH-like
                { tokenAddress: tokenB.target, targetRatio: 4000 }, // 40% BTC-like
                { tokenAddress: tokenC.target, targetRatio: 2000 }  // 20% USDC
            ];
            
            await factory.connect(institution).createIndexFund(
                fundName,
                fundSymbol,
                components
            );
            
            // Get fund ID
            const fundId = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["address", "string", "string"],
                    [institution.address, fundName, fundSymbol]
                )
            );
            
            // Verify fund creation
            const fund = await factory.funds(fundId);
            expect(fund.name).to.equal(fundName);
            expect(fund.symbol).to.equal(fundSymbol);
            expect(fund.isActive).to.be.true;
            
            // Step 2: Issue index tokens
            const issueAmount = ethers.parseEther("10000");
            await factory.connect(institution).issueIndexToken(fundId, issueAmount);
            
            // Verify token issuance
            const updatedFund = await factory.funds(fundId);
            expect(updatedFund.isIssued).to.be.true;
            
            // Step 3: Users deposit into vault
            await tokenC.connect(user1).approve(vault.target, CONSTANTS.LARGE_AMOUNT);
            await vault.connect(user1).deposit(CONSTANTS.MEDIUM_AMOUNT, user1.address);
            
            const user1Shares = await vault.balanceOf(user1.address);
            expect(user1Shares).to.be.gt(0);
            
            // Step 4: Simulate yield generation
            await tokenC.transfer(vault.target, ethers.parseEther("100")); // Simulate yield
            
            // Step 5: Harvest yields
            const MANAGER_ROLE = await vault.MANAGER_ROLE();
            await vault.grantRole(MANAGER_ROLE, institution.address);
            await vault.connect(institution).harvest();
            
            // Step 6: User withdraws
            const assetsToWithdraw = await vault.previewRedeem(user1Shares / 2n);
            await vault.connect(user1).redeem(
                user1Shares / 2n,
                user1.address,
                user1.address
            );
            
            // Verify withdrawal
            const remainingShares = await vault.balanceOf(user1.address);
            expect(remainingShares).to.equal(user1Shares / 2n);
        });
        
        it("Should handle multiple users and rebalancing", async function () {
            const {
                factory,
                vault,
                tokenC,
                institution,
                user1,
                user2,
                user3
            } = await loadFixture(deployE2EFixture);
            
            // Multiple users deposit
            const depositAmount = ethers.parseEther("1000");
            
            for (const user of [user1, user2, user3]) {
                await tokenC.connect(user).approve(vault.target, depositAmount);
                await vault.connect(user).deposit(depositAmount, user.address);
            }
            
            // Check total assets
            const totalAssets = await vault.totalAssets();
            expect(totalAssets).to.be.gte(depositAmount * 3n);
            
            // Simulate time passing and yield generation
            await time.increase(30 * 24 * 60 * 60); // 30 days
            await tokenC.transfer(vault.target, ethers.parseEther("300")); // 10% yield
            
            // Each user should be able to withdraw with profit
            const user1Shares = await vault.balanceOf(user1.address);
            const user1Assets = await vault.previewRedeem(user1Shares);
            expect(user1Assets).to.be.gt(depositAmount); // Should have profit
        });
    });
    
    describe("Cross-Protocol Integration", function () {
        it("Should integrate aggregator with index token creation", async function () {
            const {
                factory,
                aggregator,
                tokenA,
                tokenB,
                tokenC,
                user1
            } = await loadFixture(deployE2EFixture);
            
            // User wants to swap tokens before creating index position
            const swapAmount = ethers.parseEther("100");
            
            // Find optimal route
            const route = await aggregator.findOptimalRoute(
                tokenA.target,
                tokenC.target,
                swapAmount
            );
            
            expect(route.path[0]).to.equal(tokenA.target);
            expect(route.path[route.path.length - 1]).to.equal(tokenC.target);
            expect(route.amounts[route.amounts.length - 1]).to.be.gt(0);
        });
        
        it("Should handle emergency situations correctly", async function () {
            const {
                factory,
                vault,
                aggregator,
                owner
            } = await loadFixture(deployE2EFixture);
            
            // Test emergency pause on all contracts
            await factory.emergencyPause();
            await vault.pause();
            await aggregator.pause();
            
            // Verify all are paused
            expect(await factory.isPaused()).to.be.true;
            expect(await vault.paused()).to.be.true;
            expect(await aggregator.paused()).to.be.true;
            
            // Test unpause
            await factory.emergencyUnpause();
            await vault.unpause();
            await aggregator.unpause();
            
            // Verify all are unpaused
            expect(await factory.isPaused()).to.be.false;
            expect(await vault.paused()).to.be.false;
            expect(await aggregator.paused()).to.be.false;
        });
    });
    
    describe("Fee Management", function () {
        it("Should correctly calculate and collect fees", async function () {
            const {
                vault,
                tokenC,
                owner,
                user1
            } = await loadFixture(deployE2EFixture);
            
            // Set fees
            await vault.setManagementFee(200); // 2%
            await vault.setPerformanceFee(2000); // 20%
            
            // User deposits
            const depositAmount = ethers.parseEther("10000");
            await tokenC.connect(user1).approve(vault.target, depositAmount);
            await vault.connect(user1).deposit(depositAmount, user1.address);
            
            // Simulate time passing (1 year)
            await time.increase(365 * 24 * 60 * 60);
            
            // Simulate 50% profit
            await tokenC.transfer(vault.target, ethers.parseEther("5000"));
            
            // Harvest fees
            const MANAGER_ROLE = await vault.MANAGER_ROLE();
            await vault.grantRole(MANAGER_ROLE, owner.address);
            
            const ownerBalanceBefore = await tokenC.balanceOf(owner.address);
            await vault.harvest();
            const ownerBalanceAfter = await tokenC.balanceOf(owner.address);
            
            // Owner should have received fees
            expect(ownerBalanceAfter).to.be.gt(ownerBalanceBefore);
        });
    });
    
    describe("Stress Testing", function () {
        it("Should handle high volume of transactions", async function () {
            const {
                factory,
                tokenA,
                institution
            } = await loadFixture(deployE2EFixture);
            
            // Create multiple index funds
            const fundPromises = [];
            for (let i = 0; i < 5; i++) {
                const components = [
                    { tokenAddress: tokenA.target, targetRatio: 10000 }
                ];
                
                fundPromises.push(
                    factory.connect(institution).createIndexFund(
                        `Fund ${i}`,
                        `F${i}`,
                        components
                    )
                );
            }
            
            await Promise.all(fundPromises);
            
            // Verify all funds were created
            for (let i = 0; i < 5; i++) {
                const fundId = ethers.keccak256(
                    ethers.AbiCoder.defaultAbiCoder().encode(
                        ["address", "string", "string"],
                        [institution.address, `Fund ${i}`, `F${i}`]
                    )
                );
                
                const fund = await factory.funds(fundId);
                expect(fund.isActive).to.be.true;
            }
        });
        
        it("Should maintain consistency under rapid state changes", async function () {
            const {
                vault,
                tokenC,
                user1,
                user2,
                user3
            } = await loadFixture(deployE2EFixture);
            
            const users = [user1, user2, user3];
            const depositAmount = ethers.parseEther("100");
            
            // Rapid deposits and withdrawals
            for (let i = 0; i < 3; i++) {
                // Deposits
                for (const user of users) {
                    await tokenC.connect(user).approve(vault.target, depositAmount);
                    await vault.connect(user).deposit(depositAmount, user.address);
                }
                
                // Withdrawals
                for (const user of users) {
                    const shares = await vault.balanceOf(user.address);
                    if (shares > 0) {
                        await vault.connect(user).redeem(
                            shares / 2n,
                            user.address,
                            user.address
                        );
                    }
                }
            }
            
            // Verify vault remains in consistent state
            const totalAssets = await vault.totalAssets();
            const totalSupply = await vault.totalSupply();
            
            if (totalSupply > 0) {
                expect(totalAssets).to.be.gt(0);
            }
        });
    });
});

module.exports = {
    deployE2EFixture
};
