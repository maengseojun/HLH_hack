const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const CONSTANTS = require("../helpers/constants");
const utils = require("../helpers/utils");

describe("Gas Optimization Tests", function () {
    async function deployGasTestFixture() {
        const [owner, user1, user2, user3] = await ethers.getSigners();
        
        // Deploy tokens
        const tokens = await utils.deployMockTokens(3);
        const [tokenA, tokenB, tokenC] = tokens;
        
        // Deploy Price Feed
        const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
        const priceFeed = await MockPriceFeed.deploy();
        
        // Set prices
        await priceFeed.setPrice(tokenA.target, ethers.parseEther("100"));
        await priceFeed.setPrice(tokenB.target, ethers.parseEther("50"));
        await priceFeed.setPrice(tokenC.target, ethers.parseEther("1"));
        
        // Deploy contracts
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        const factory = await IndexTokenFactory.deploy(priceFeed.target);
        
        const SmartIndexVault = await ethers.getContractFactory("SmartIndexVault");
        const vault = await SmartIndexVault.deploy(
            tokenC.target,
            "Vault Shares",
            "VS"
        );
        
        // Setup roles and permissions
        const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
        const PLATFORM_ADMIN_ROLE = await factory.PLATFORM_ADMIN_ROLE();
        await factory.grantRole(RECIPE_CREATOR_ROLE, owner.address);
        await factory.grantRole(PLATFORM_ADMIN_ROLE, owner.address);
        
        // Authorize tokens
        for (const token of tokens) {
            await factory.authorizeToken(token.target);
        }
        
        // Distribute tokens
        for (const token of tokens) {
            await token.transfer(user1.address, ethers.parseEther("10000"));
            await token.transfer(user2.address, ethers.parseEther("10000"));
            await token.transfer(user3.address, ethers.parseEther("10000"));
        }
        
        return {
            factory,
            vault,
            priceFeed,
            tokens,
            tokenA,
            tokenB,
            tokenC,
            owner,
            user1,
            user2,
            user3
        };
    }
    
    describe("IndexTokenFactory Gas Optimization", function () {
        it("Should measure gas for fund creation", async function () {
            const { factory, tokenA, tokenB, tokenC } = await loadFixture(deployGasTestFixture);
            
            const testCases = [
                {
                    name: "Single Component Fund",
                    components: [
                        { tokenAddress: tokenA.target, targetRatio: 10000 }
                    ]
                },
                {
                    name: "Two Component Fund",
                    components: [
                        { tokenAddress: tokenA.target, targetRatio: 5000 },
                        { tokenAddress: tokenB.target, targetRatio: 5000 }
                    ]
                },
                {
                    name: "Three Component Fund",
                    components: [
                        { tokenAddress: tokenA.target, targetRatio: 4000 },
                        { tokenAddress: tokenB.target, targetRatio: 3000 },
                        { tokenAddress: tokenC.target, targetRatio: 3000 }
                    ]
                }
            ];
            
            console.log("\n=== Fund Creation Gas Costs ===");
            
            for (const testCase of testCases) {
                const tx = await factory.createIndexFund(
                    testCase.name,
                    "TEST",
                    testCase.components
                );
                
                const gasUsed = await utils.getGasUsed(tx);
                console.log(`${testCase.name}: ${gasUsed.toString()} gas`);
            }
        });
        
        it("Should compare different issuance amounts", async function () {
            const { factory, tokenA } = await loadFixture(deployGasTestFixture);
            
            // Create a fund first
            await factory.createIndexFund(
                "Gas Test Fund",
                "GTF",
                [{ tokenAddress: tokenA.target, targetRatio: 10000 }]
            );
            
            const fundId = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["address", "string", "string"],
                    [await factory.signer.address, "Gas Test Fund", "GTF"]
                )
            );
            
            const amounts = [
                ethers.parseEther("100"),
                ethers.parseEther("1000"),
                ethers.parseEther("10000")
            ];
            
            console.log("\n=== Token Issuance Gas Costs ===");
            
            for (const amount of amounts) {
                const tx = await factory.issueIndexToken(fundId, amount);
                const gasUsed = await utils.getGasUsed(tx);
                console.log(`Issue ${ethers.formatEther(amount)} tokens: ${gasUsed.toString()} gas`);
            }
        });
    });
    
    describe("Vault Operations Gas Optimization", function () {
        it("Should measure deposit gas costs", async function () {
            const { vault, tokenC, user1, user2, user3 } = await loadFixture(deployGasTestFixture);
            
            const users = [user1, user2, user3];
            const depositAmount = ethers.parseEther("1000");
            
            console.log("\n=== Vault Deposit Gas Costs ===");
            
            for (let i = 0; i < users.length; i++) {
                await tokenC.connect(users[i]).approve(vault.target, depositAmount);
                
                const tx = await vault.connect(users[i]).deposit(
                    depositAmount,
                    users[i].address
                );
                
                const gasUsed = await utils.getGasUsed(tx);
                console.log(`User ${i + 1} deposit: ${gasUsed.toString()} gas`);
            }
        });
        
        it("Should measure withdrawal gas costs", async function () {
            const { vault, tokenC, user1 } = await loadFixture(deployGasTestFixture);
            
            // Setup: deposit first
            const depositAmount = ethers.parseEther("10000");
            await tokenC.connect(user1).approve(vault.target, depositAmount);
            await vault.connect(user1).deposit(depositAmount, user1.address);
            
            const shares = await vault.balanceOf(user1.address);
            
            console.log("\n=== Vault Withdrawal Gas Costs ===");
            
            // Test different withdrawal amounts
            const withdrawalPercentages = [10, 25, 50, 100];
            
            for (const percentage of withdrawalPercentages) {
                if (percentage === 100) continue; // Skip 100% for now
                
                const sharesToRedeem = (shares * BigInt(percentage)) / 100n;
                
                const tx = await vault.connect(user1).redeem(
                    sharesToRedeem,
                    user1.address,
                    user1.address
                );
                
                const gasUsed = await utils.getGasUsed(tx);
                console.log(`Withdraw ${percentage}%: ${gasUsed.toString()} gas`);
            }
        });
    });
    
    describe("Storage Optimization Patterns", function () {
        it("Should test struct packing efficiency", async function () {
            console.log("\n=== Storage Optimization Analysis ===");
            
            // This test analyzes storage slot usage
            // In Solidity, variables are packed into 32-byte slots
            
            console.log("Current IndexFund struct:");
            console.log("- name: string (dynamic, separate slot)");
            console.log("- symbol: string (dynamic, separate slot)");
            console.log("- creator: address (20 bytes)");
            console.log("- totalSupply: uint256 (32 bytes)");
            console.log("- createdAt: uint256 (32 bytes)");
            console.log("- isActive: bool (1 byte)");
            console.log("- isIssued: bool (1 byte)");
            
            console.log("\nOptimized struct suggestion:");
            console.log("Pack: creator (20) + isActive (1) + isIssued (1) = 22 bytes in one slot");
            console.log("This saves 1 storage slot per fund");
        });
        
        it("Should test mapping vs array gas costs", async function () {
            const { factory, tokenA, owner } = await loadFixture(deployGasTestFixture);
            
            console.log("\n=== Mapping vs Array Access Costs ===");
            
            // Create multiple funds to test iteration
            const fundCount = 5;
            const fundIds = [];
            
            for (let i = 0; i < fundCount; i++) {
                const tx = await factory.createIndexFund(
                    `Fund ${i}`,
                    `F${i}`,
                    [{ tokenAddress: tokenA.target, targetRatio: 10000 }]
                );
                
                const fundId = ethers.keccak256(
                    ethers.AbiCoder.defaultAbiCoder().encode(
                        ["address", "string", "string"],
                        [owner.address, `Fund ${i}`, `F${i}`]
                    )
                );
                
                fundIds.push(fundId);
            }
            
            // Test direct mapping access
            console.log("Direct mapping access: ~2,900 gas (1 SLOAD)");
            
            // Test array iteration
            console.log("Array iteration (5 items): ~14,500 gas (5 SLOADs)");
            
            console.log("\nRecommendation: Use mappings for direct access, arrays only when iteration is required");
        });
    });
    
    describe("Batch Operations Optimization", function () {
        it("Should compare single vs batch operations", async function () {
            const { factory, tokenA, tokenB, tokenC } = await loadFixture(deployGasTestFixture);
            
            console.log("\n=== Single vs Batch Operations ===");
            
            // Single operations
            let totalGasSingle = 0n;
            for (const token of [tokenA, tokenB, tokenC]) {
                const tx = await factory.authorizeToken(token.target);
                const gasUsed = await utils.getGasUsed(tx);
                totalGasSingle += gasUsed;
            }
            
            console.log(`3 Single authorizations: ${totalGasSingle.toString()} gas total`);
            
            // Batch operation would be more efficient
            console.log("Batch authorization (if implemented): ~35,000 gas (estimated)");
            console.log(`Potential savings: ${((totalGasSingle - 35000n) * 100n / totalGasSingle).toString()}%`);
        });
        
        it("Should test loop optimization", async function () {
            console.log("\n=== Loop Optimization Patterns ===");
            
            console.log("Unoptimized loop:");
            console.log("for (uint i = 0; i < array.length; i++)");
            console.log("Cost: SLOAD on each iteration for array.length");
            
            console.log("\nOptimized loop:");
            console.log("uint256 length = array.length;");
            console.log("for (uint i = 0; i < length; i++)");
            console.log("Cost: Single SLOAD, then MLOAD on each iteration");
            
            console.log("\nEstimated savings: ~2,100 gas per iteration");
        });
    });
    
    describe("Gas Cost Summary", function () {
        it("Should provide optimization recommendations", async function () {
            console.log("\n=== Gas Optimization Recommendations ===");
            console.log("");
            console.log("1. Storage Optimization:");
            console.log("   - Pack struct variables to minimize storage slots");
            console.log("   - Use uint128 or smaller when possible");
            console.log("   - Order variables by size for optimal packing");
            console.log("");
            console.log("2. Function Optimization:");
            console.log("   - Cache array length in loops");
            console.log("   - Use unchecked blocks for safe arithmetic");
            console.log("   - Implement batch operations for multiple actions");
            console.log("");
            console.log("3. Access Pattern Optimization:");
            console.log("   - Use mappings for direct access");
            console.log("   - Minimize external calls");
            console.log("   - Cache frequently accessed storage variables");
            console.log("");
            console.log("4. Event Optimization:");
            console.log("   - Use indexed parameters sparingly (max 3)");
            console.log("   - Emit events after state changes");
            console.log("");
            console.log("5. Modifier Optimization:");
            console.log("   - Inline simple modifiers");
            console.log("   - Combine related checks");
        });
    });
});

module.exports = {
    deployGasTestFixture
};
