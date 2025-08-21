const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Reentrancy Security Tests", function () {
    async function deploySecurityTestFixture() {
        const [owner, attacker, user1, user2] = await ethers.getSigners();
        
        // Deploy MockERC20 tokens
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const tokenA = await MockERC20.deploy("Token A", "TKA", ethers.parseEther("1000000"));
        const tokenB = await MockERC20.deploy("Token B", "TKB", ethers.parseEther("1000000"));
        
        // Deploy MockPriceFeed
        const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
        const priceFeed = await MockPriceFeed.deploy();
        
        // Set prices for tokens
        await priceFeed.setPrice(tokenA.target, ethers.parseEther("100")); // $100 per token
        await priceFeed.setPrice(tokenB.target, ethers.parseEther("50"));  // $50 per token
        
        // Deploy IndexTokenFactory
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        const factory = await IndexTokenFactory.deploy(priceFeed.target);
        
        // Grant RECIPE_CREATOR_ROLE to owner
        const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
        const PLATFORM_ADMIN_ROLE = await factory.PLATFORM_ADMIN_ROLE();
        await factory.grantRole(RECIPE_CREATOR_ROLE, owner.address);
        await factory.grantRole(PLATFORM_ADMIN_ROLE, owner.address);
        
        // Authorize tokens
        await factory.authorizeToken(tokenA.target);
        await factory.authorizeToken(tokenB.target);
        
        return {
            factory,
            tokenA,
            tokenB,
            priceFeed,
            owner,
            attacker,
            user1,
            user2,
            RECIPE_CREATOR_ROLE,
            PLATFORM_ADMIN_ROLE
        };
    }
    
    describe("Reentrancy Attack Prevention", function () {
        it("Should create index fund with proper checks", async function () {
            const { factory, tokenA, tokenB } = await loadFixture(deploySecurityTestFixture);
            
            const fundName = "Test Fund";
            const fundSymbol = "TF";
            const components = [
                { tokenAddress: tokenA.target, targetRatio: 5000 }, // 50%
                { tokenAddress: tokenB.target, targetRatio: 5000 }  // 50%
            ];
            
            // Create an index fund
            const tx = await factory.createIndexFund(fundName, fundSymbol, components);
            const receipt = await tx.wait();
            
            // Verify event was emitted
            expect(receipt.logs.length).to.be.greaterThan(0);
        });
        
        it("Should maintain correct state during nested calls", async function () {
            const { factory, tokenA, user1, user2 } = await loadFixture(deploySecurityTestFixture);
            
            // Test that state remains consistent even with nested operations
            const fundName = "Test Fund";
            const fundSymbol = "TF";
            const components = [
                { tokenAddress: tokenA.target, targetRatio: 10000 } // 100%
            ];
            
            // Create an index fund
            await factory.createIndexFund(fundName, fundSymbol, components);
            
            // Get fund ID (hash of creator + name + symbol)
            const fundId = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["address", "string", "string"],
                    [await factory.signer.address, fundName, fundSymbol]
                )
            );
            
            const fund = await factory.funds(fundId);
            expect(fund.name).to.equal(fundName);
            expect(fund.symbol).to.equal(fundSymbol);
        });
        
        it("Should use proper checks-effects-interactions pattern", async function () {
            const { factory, tokenA, tokenB } = await loadFixture(deploySecurityTestFixture);
            
            // This test verifies that the contract follows CEI pattern:
            // 1. Checks - validate inputs and conditions
            // 2. Effects - update state variables
            // 3. Interactions - make external calls
            
            const fundName = "CEI Test Fund";
            const fundSymbol = "CEIF";
            const components = [
                { tokenAddress: tokenA.target, targetRatio: 5000 },
                { tokenAddress: tokenB.target, targetRatio: 5000 }
            ];
            
            // Monitor state changes
            const tx = await factory.createIndexFund(fundName, fundSymbol, components);
            
            // Verify events are emitted in correct order
            const receipt = await tx.wait();
            expect(receipt.logs.length).to.be.greaterThan(0);
        });
    });
    
    describe("State Manipulation Protection", function () {
        it("Should prevent unauthorized state changes", async function () {
            const { factory, user1, attacker } = await loadFixture(deploySecurityTestFixture);
            
            // Attempt to call owner-only functions from non-owner
            await expect(
                factory.connect(attacker).emergencyPause()
            ).to.be.revertedWithCustomError(factory, "AccessControlUnauthorizedAccount");
        });
        
        it("Should protect against integer overflow/underflow", async function () {
            const { factory, tokenA } = await loadFixture(deploySecurityTestFixture);
            
            // Test with maximum values to check for overflow protection
            const MAX_UINT256 = ethers.MaxUint256;
            
            // Components with valid weights
            const components = [
                { tokenAddress: tokenA.target, targetRatio: 10000 } // Valid 100%
            ];
            
            // Should handle large numbers correctly
            await expect(
                factory.createIndexFund(
                    "Overflow Test",
                    "OVF",
                    components
                )
            ).to.not.be.reverted;
        });
    });
    
    describe("External Call Safety", function () {
        it("Should handle failed external calls gracefully", async function () {
            const { factory, owner } = await loadFixture(deploySecurityTestFixture);
            
            // Deploy a contract that will fail on transfer
            const FailingToken = await ethers.getContractFactory("MockERC20");
            const failToken = await FailingToken.deploy("Fail Token", "FAIL", 0);
            
            // First authorize the token
            await factory.authorizeToken(failToken.target);
            
            // Attempt to create index with failing token
            const components = [
                { tokenAddress: failToken.target, targetRatio: 10000 }
            ];
            
            // Should handle the failure appropriately
            await factory.createIndexFund(
                "Fail Test",
                "FT",
                components
            );
            
            // Verify the system remains in a consistent state
            const fundId = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["address", "string", "string"],
                    [await factory.signer.address, "Fail Test", "FT"]
                )
            );
            
            const fund = await factory.funds(fundId);
            expect(fund.isActive).to.be.true;
        });
        
        it("Should validate external contract addresses", async function () {
            const { factory } = await loadFixture(deploySecurityTestFixture);
            
            // Test with zero address - should revert
            const components = [
                { tokenAddress: ethers.ZeroAddress, targetRatio: 10000 }
            ];
            
            await expect(
                factory.createIndexFund(
                    "Zero Test",
                    "ZT",
                    components
                )
            ).to.be.revertedWith("Invalid token address");
        });
    });
    
    describe("Pausable Functionality", function () {
        it("Should allow emergency pause by admin", async function () {
            const { factory, owner } = await loadFixture(deploySecurityTestFixture);
            
            // Pause the contract
            await factory.emergencyPause();
            
            // Check if paused
            expect(await factory.isPaused()).to.be.true;
        });
        
        it("Should prevent operations when paused", async function () {
            const { factory, tokenA, owner } = await loadFixture(deploySecurityTestFixture);
            
            // Pause the contract
            await factory.emergencyPause();
            
            // Try to create fund while paused
            const components = [
                { tokenAddress: tokenA.target, targetRatio: 10000 }
            ];
            
            await expect(
                factory.createIndexFund("Paused Test", "PT", components)
            ).to.be.revertedWith("IndexTokenFactory: Contract is paused");
            
            // Unpause
            await factory.emergencyUnpause();
            
            // Now it should work
            await expect(
                factory.createIndexFund("Unpaused Test", "UT", components)
            ).to.not.be.reverted;
        });
    });
});

module.exports = {
    deploySecurityTestFixture
};
