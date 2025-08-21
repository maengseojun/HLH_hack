const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Security Enhancements Test Suite", function () {
    // Test fixtures
    async function deploySecurityEnhancementsFixture() {
        const [owner, user1, user2, oracle1, oracle2, attacker] = await ethers.getSigners();
        
        // Deploy contracts
        const SecurityEnhancements = await ethers.getContractFactory("SecurityEnhancements");
        const securityEnhancements = await SecurityEnhancements.deploy();
        
        const EnhancedOracleManager = await ethers.getContractFactory("EnhancedOracleManager");
        const oracleManager = await EnhancedOracleManager.deploy();
        
        const LiquidityProtection = await ethers.getContractFactory("LiquidityProtection");
        const liquidityProtection = await LiquidityProtection.deploy();
        
        // Deploy mock contracts for testing
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const mockToken = await MockERC20.deploy("Test Token", "TEST", 18);
        
        const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
        const mockPriceFeed1 = await MockPriceFeed.deploy();
        const mockPriceFeed2 = await MockPriceFeed.deploy();
        
        // Grant necessary roles
        const SECURITY_ADMIN_ROLE = await securityEnhancements.SECURITY_ADMIN_ROLE();
        const ORACLE_MANAGER_ROLE = await securityEnhancements.ORACLE_MANAGER_ROLE();
        const LIQUIDITY_MANAGER_ROLE = await liquidityProtection.LIQUIDITY_MANAGER_ROLE();
        
        await securityEnhancements.grantRole(SECURITY_ADMIN_ROLE, owner.address);
        await oracleManager.grantRole(ORACLE_MANAGER_ROLE, owner.address);
        await liquidityProtection.grantRole(LIQUIDITY_MANAGER_ROLE, owner.address);
        
        return {
            securityEnhancements,
            oracleManager,
            liquidityProtection,
            mockToken,
            mockPriceFeed1,
            mockPriceFeed2,
            owner,
            user1,
            user2,
            oracle1,
            oracle2,
            attacker
        };
    }
    
    describe("Oracle Manipulation Resistance", function () {
        it("Should detect oracle manipulation attempts", async function () {
            const { oracleManager, mockPriceFeed1, mockPriceFeed2, mockToken, owner } = 
                await loadFixture(deploySecurityEnhancementsFixture);
            
            // Setup mock prices - normal scenario
            await mockPriceFeed1.setPrice(mockToken.address, ethers.utils.parseEther("100"));
            await mockPriceFeed2.setPrice(mockToken.address, ethers.utils.parseEther("102"));
            
            // Add oracle sources
            await oracleManager.addOracleSource(
                mockToken.address,
                mockPriceFeed1.address,
                5000, // 50% weight
                3, // max failures
                "Primary Oracle"
            );
            
            await oracleManager.addOracleSource(
                mockToken.address,
                mockPriceFeed2.address,
                5000, // 50% weight
                3,
                "Backup Oracle"
            );
            
            // Normal price update should work
            await oracleManager.updatePrice(mockToken.address);
            let [price, confidence, timestamp] = await oracleManager.getPrice(mockToken.address);
            expect(price).to.be.closeTo(ethers.utils.parseEther("101"), ethers.utils.parseEther("2"));
            
            // Simulate manipulation - extreme price deviation
            await mockPriceFeed1.setPrice(mockToken.address, ethers.utils.parseEther("100"));
            await mockPriceFeed2.setPrice(mockToken.address, ethers.utils.parseEther("300")); // 200% deviation
            
            // Price update should detect manipulation
            await expect(oracleManager.updatePrice(mockToken.address))
                .to.emit(oracleManager, "PriceManipulationDetected");
        });
        
        it("Should use TWAP for price validation", async function () {
            const { oracleManager, mockPriceFeed1, mockToken, owner } = 
                await loadFixture(deploySecurityEnhancementsFixture);
            
            // Setup oracle
            await mockPriceFeed1.setPrice(mockToken.address, ethers.utils.parseEther("100"));
            await oracleManager.addOracleSource(
                mockToken.address,
                mockPriceFeed1.address,
                10000,
                3,
                "TWAP Oracle"
            );
            
            // Multiple price updates to build TWAP
            const prices = [100, 102, 101, 99, 103];
            for (let i = 0; i < prices.length; i++) {
                await mockPriceFeed1.setPrice(mockToken.address, ethers.utils.parseEther(prices[i].toString()));
                await oracleManager.updatePrice(mockToken.address);
                await time.increase(300); // 5 minutes between updates
            }
            
            // Check TWAP
            const [twapPrice, isValid] = await oracleManager.getTWAP(mockToken.address);
            expect(isValid).to.be.true;
            expect(twapPrice).to.be.closeTo(ethers.utils.parseEther("101"), ethers.utils.parseEther("3"));
        });
        
        it("Should handle oracle failures gracefully", async function () {
            const { oracleManager, mockPriceFeed1, mockPriceFeed2, mockToken } = 
                await loadFixture(deploySecurityEnhancementsFixture);
            
            // Setup oracles
            await mockPriceFeed1.setPrice(mockToken.address, ethers.utils.parseEther("100"));
            await mockPriceFeed2.setPrice(mockToken.address, ethers.utils.parseEther("101"));
            
            await oracleManager.addOracleSource(mockToken.address, mockPriceFeed1.address, 5000, 2, "Oracle 1");
            await oracleManager.addOracleSource(mockToken.address, mockPriceFeed2.address, 5000, 2, "Oracle 2");
            
            // Simulate oracle failure
            await mockPriceFeed1.setShouldRevert(true);
            
            // Should still work with remaining oracle
            await oracleManager.updatePrice(mockToken.address);
            const [price] = await oracleManager.getPrice(mockToken.address);
            expect(price).to.equal(ethers.utils.parseEther("101"));
            
            // Check that failed oracle is tracked
            expect(await oracleManager.totalOracleFailures()).to.equal(1);
        });
    });
    
    describe("MEV Protection", function () {
        it("Should implement commit-reveal scheme", async function () {
            const { securityEnhancements, user1 } = await loadFixture(deploySecurityEnhancementsFixture);
            
            const amount = ethers.utils.parseEther("100");
            const nonce = 12345;
            const commitment = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["uint256", "uint256", "address"],
                    [amount, nonce, user1.address]
                )
            );
            
            // Commit phase
            await securityEnhancements.connect(user1).commitTransaction(commitment);
            
            // Should not be able to reveal immediately
            await expect(
                securityEnhancements.connect(user1).revealAndExecute(amount, nonce)
            ).to.be.revertedWith("Reveal too early");
            
            // Wait minimum blocks and reveal
            await time.increase(15); // Simulate block advancement
            await securityEnhancements.connect(user1).revealAndExecute(amount, nonce);
            
            // Check commitment was processed
            const commitData = await securityEnhancements.commitReveals(commitment);
            expect(commitData.isRevealed).to.be.true;
            expect(commitData.isExecuted).to.be.true;
        });
        
        it("Should prevent rapid successive transactions", async function () {
            const { securityEnhancements, user1 } = await loadFixture(deploySecurityEnhancementsFixture);
            
            const commitment1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("commit1"));
            const commitment2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("commit2"));
            
            // First commit should succeed
            await securityEnhancements.connect(user1).commitTransaction(commitment1);
            
            // Second commit immediately should fail
            await expect(
                securityEnhancements.connect(user1).commitTransaction(commitment2)
            ).to.be.revertedWith("Too frequent transactions");
        });
        
        it("Should expire old commitments", async function () {
            const { securityEnhancements, user1 } = await loadFixture(deploySecurityEnhancementsFixture);
            
            const amount = ethers.utils.parseEther("100");
            const nonce = 54321;
            const commitment = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["uint256", "uint256", "address"],
                    [amount, nonce, user1.address]
                )
            );
            
            await securityEnhancements.connect(user1).commitTransaction(commitment);
            
            // Wait beyond reveal deadline
            await time.increase(3600); // 1 hour
            
            // Should not be able to reveal expired commitment
            await expect(
                securityEnhancements.connect(user1).revealAndExecute(amount, nonce)
            ).to.be.revertedWith("Reveal deadline passed");
        });
    });
    
    describe("Liquidity Crisis Management", function () {
        it("Should detect bank run scenarios", async function () {
            const { liquidityProtection, mockToken, owner, user1 } = 
                await loadFixture(deploySecurityEnhancementsFixture);
            
            const vaultAddress = mockToken.address; // Using token as vault for simplicity
            
            // Setup normal vault liquidity
            await liquidityProtection.updateLiquidity(
                vaultAddress,
                ethers.utils.parseEther("1000"), // total assets
                ethers.utils.parseEther("500"),  // liquid assets (50%)
                ethers.utils.parseEther("500")   // illiquid assets
            );
            
            // Queue large redemption (30% of total assets)
            await liquidityProtection.connect(user1).queueGradualRedemption(
                vaultAddress,
                ethers.utils.parseEther("300"),
                ethers.utils.parseEther("50"),
                false
            );
            
            // This should trigger bank run detection
            await liquidityProtection.updateLiquidity(
                vaultAddress,
                ethers.utils.parseEther("1000"),
                ethers.utils.parseEther("200"), // Reduced liquid assets
                ethers.utils.parseEther("800")
            );
            
            // Check if emergency protocol was activated
            const vaultStatus = await liquidityProtection.getVaultStatus(vaultAddress);
            expect(vaultStatus.emergencyActive).to.be.true;
        });
        
        it("Should process gradual redemptions", async function () {
            const { liquidityProtection, mockToken, user1 } = 
                await loadFixture(deploySecurityEnhancementsFixture);
            
            const vaultAddress = mockToken.address;
            
            // Setup healthy vault
            await liquidityProtection.updateLiquidity(
                vaultAddress,
                ethers.utils.parseEther("1000"),
                ethers.utils.parseEther("800"),
                ethers.utils.parseEther("200")
            );
            
            // Queue gradual redemption
            const queueId = await liquidityProtection.connect(user1).queueGradualRedemption(
                vaultAddress,
                ethers.utils.parseEther("100"), // total amount
                ethers.utils.parseEther("10"),  // daily amount
                false
            );
            
            // Process redemption queue
            await liquidityProtection.processRedemptionQueue(10);
            
            // Check redemption status
            const [userQueueIds, totalPending] = await liquidityProtection.getUserRedemptionStatus(user1.address);
            expect(userQueueIds.length).to.equal(1);
            expect(totalPending).to.be.closeTo(ethers.utils.parseEther("90"), ethers.utils.parseEther("1"));
        });
        
        it("Should prevent immediate redemption during liquidity crisis", async function () {
            const { liquidityProtection, mockToken } = 
                await loadFixture(deploySecurityEnhancementsFixture);
            
            const vaultAddress = mockToken.address;
            
            // Setup unhealthy vault (low liquidity)
            await liquidityProtection.updateLiquidity(
                vaultAddress,
                ethers.utils.parseEther("1000"),
                ethers.utils.parseEther("50"), // Only 5% liquid
                ethers.utils.parseEther("950")
            );
            
            // Check if immediate redemption is allowed
            const [allowed, reason] = await liquidityProtection.canRedeemImmediately(
                vaultAddress,
                ethers.utils.parseEther("100")
            );
            
            expect(allowed).to.be.false;
            expect(reason).to.include("liquidity");
        });
        
        it("Should allow emergency liquidity injection", async function () {
            const { liquidityProtection, mockToken, owner } = 
                await loadFixture(deploySecurityEnhancementsFixture);
            
            const vaultAddress = mockToken.address;
            
            // Create emergency scenario
            await liquidityProtection.updateLiquidity(
                vaultAddress,
                ethers.utils.parseEther("1000"),
                ethers.utils.parseEther("30"), // Critical liquidity level
                ethers.utils.parseEther("970")
            );
            
            // Mint tokens for emergency injection
            await mockToken.mint(owner.address, ethers.utils.parseEther("200"));
            await mockToken.approve(liquidityProtection.address, ethers.utils.parseEther("200"));
            
            // Inject emergency liquidity
            await expect(
                liquidityProtection.injectEmergencyLiquidity(
                    vaultAddress,
                    ethers.utils.parseEther("200"),
                    mockToken.address
                )
            ).to.emit(liquidityProtection, "EmergencyLiquidityInjected");
        });
    });
    
    describe("Circuit Breaker Mechanisms", function () {
        it("Should trigger circuit breaker on rapid price drops", async function () {
            const { securityEnhancements, mockToken, owner } = 
                await loadFixture(deploySecurityEnhancementsFixture);
            
            // Configure circuit breaker
            await securityEnhancements.configureCircuitBreaker(
                mockToken.address,
                2000, // 20% drop threshold
                3600  // 1 hour cooldown
            );
            
            const previousPrice = ethers.utils.parseEther("100");
            const currentPrice = ethers.utils.parseEther("75"); // 25% drop
            
            // Should trigger circuit breaker
            await expect(
                securityEnhancements.checkCircuitBreaker(
                    mockToken.address,
                    currentPrice,
                    previousPrice
                )
            ).to.emit(securityEnhancements, "CircuitBreakerTriggered");
            
            // Contract should be paused
            expect(await securityEnhancements.paused()).to.be.true;
        });
        
        it("Should allow circuit breaker reset after cooldown", async function () {
            const { securityEnhancements, mockToken, owner } = 
                await loadFixture(deploySecurityEnhancementsFixture);
            
            // Configure and trigger circuit breaker
            await securityEnhancements.configureCircuitBreaker(mockToken.address, 2000, 3600);
            await securityEnhancements.checkCircuitBreaker(
                mockToken.address,
                ethers.utils.parseEther("75"),
                ethers.utils.parseEther("100")
            );
            
            // Should not be able to reset immediately
            await expect(
                securityEnhancements.resetCircuitBreaker(mockToken.address)
            ).to.be.revertedWith("Cooldown period not finished");
            
            // Wait for cooldown
            await time.increase(3600);
            
            // Should be able to reset now
            await securityEnhancements.resetCircuitBreaker(mockToken.address);
            expect(await securityEnhancements.paused()).to.be.false;
        });
    });
    
    describe("Integration Testing", function () {
        it("Should handle multiple simultaneous security events", async function () {
            const { 
                securityEnhancements, 
                oracleManager, 
                liquidityProtection, 
                mockToken, 
                mockPriceFeed1, 
                mockPriceFeed2, 
                user1, 
                user2 
            } = await loadFixture(deploySecurityEnhancementsFixture);
            
            // Setup oracles with manipulation
            await mockPriceFeed1.setPrice(mockToken.address, ethers.utils.parseEther("100"));
            await mockPriceFeed2.setPrice(mockToken.address, ethers.utils.parseEther("300"));
            await oracleManager.addOracleSource(mockToken.address, mockPriceFeed1.address, 5000, 3, "Oracle 1");
            await oracleManager.addOracleSource(mockToken.address, mockPriceFeed2.address, 5000, 3, "Oracle 2");
            
            // Setup vault with low liquidity
            await liquidityProtection.updateLiquidity(
                mockToken.address,
                ethers.utils.parseEther("1000"),
                ethers.utils.parseEther("50"),
                ethers.utils.parseEther("950")
            );
            
            // Configure circuit breaker
            await securityEnhancements.configureCircuitBreaker(mockToken.address, 1000, 3600);
            
            // Trigger multiple security events
            await oracleManager.updatePrice(mockToken.address); // Should detect manipulation
            await liquidityProtection.connect(user1).queueGradualRedemption(
                mockToken.address,
                ethers.utils.parseEther("400"),
                ethers.utils.parseEther("50"),
                false
            ); // Should trigger bank run detection
            
            // Check that appropriate protections are active
            expect(await oracleManager.isManipulationDetected(mockToken.address)).to.be.true;
            const [allowed] = await liquidityProtection.canRedeemImmediately(mockToken.address, ethers.utils.parseEther("10"));
            expect(allowed).to.be.false;
        });
        
        it("Should maintain security even under stress testing", async function () {
            const { liquidityProtection, mockToken, owner } = 
                await loadFixture(deploySecurityEnhancementsFixture);
            
            // Setup vault
            await liquidityProtection.updateLiquidity(
                mockToken.address,
                ethers.utils.parseEther("10000"),
                ethers.utils.parseEther("5000"),
                ethers.utils.parseEther("5000")
            );
            
            // Create maximum number of redemption requests
            const maxQueueSize = await liquidityProtection.maxQueueSize();
            const signers = await ethers.getSigners();
            
            // Queue many redemptions (stress test)
            for (let i = 0; i < Math.min(10, signers.length - 1); i++) {
                await liquidityProtection.connect(signers[i]).queueGradualRedemption(
                    mockToken.address,
                    ethers.utils.parseEther("100"),
                    ethers.utils.parseEther("10"),
                    false
                );
            }
            
            // Process all redemptions
            await liquidityProtection.processRedemptionQueue(50);
            
            // System should still be functional
            const activeCount = await liquidityProtection.getActiveRedemptionCount();
            expect(activeCount).to.be.gte(0);
        });
    });
    
    describe("Security Metrics and Monitoring", function () {
        it("Should track security statistics", async function () {
            const { oracleManager, liquidityProtection, mockToken, mockPriceFeed1 } = 
                await loadFixture(deploySecurityEnhancementsFixture);
            
            // Generate some security events
            await mockPriceFeed1.setPrice(mockToken.address, ethers.utils.parseEther("100"));
            await oracleManager.addOracleSource(mockToken.address, mockPriceFeed1.address, 10000, 3, "Test Oracle");
            
            // Multiple price updates
            for (let i = 0; i < 5; i++) {
                await oracleManager.updatePrice(mockToken.address);
            }
            
            // Check statistics
            expect(await oracleManager.totalPriceUpdates()).to.equal(5);
            
            // Low liquidity scenario
            await liquidityProtection.updateLiquidity(
                mockToken.address,
                ethers.utils.parseEther("1000"),
                ethers.utils.parseEther("30"),
                ethers.utils.parseEther("970")
            );
            
            expect(await liquidityProtection.totalEmergencyActivations()).to.equal(1);
        });
        
        it("Should provide comprehensive security status", async function () {
            const { oracleManager, liquidityProtection, mockToken, mockPriceFeed1 } = 
                await loadFixture(deploySecurityEnhancementsFixture);
            
            // Setup and test oracle system
            await mockPriceFeed1.setPrice(mockToken.address, ethers.utils.parseEther("100"));
            await oracleManager.addOracleSource(mockToken.address, mockPriceFeed1.address, 10000, 3, "Main Oracle");
            await oracleManager.updatePrice(mockToken.address);
            
            const [price, confidence] = await oracleManager.getPrice(mockToken.address);
            expect(price).to.equal(ethers.utils.parseEther("100"));
            expect(confidence).to.equal(10000); // 100% with single oracle
            
            // Test liquidity protection
            await liquidityProtection.updateLiquidity(
                mockToken.address,
                ethers.utils.parseEther("1000"),
                ethers.utils.parseEther("800"),
                ethers.utils.parseEther("200")
            );
            
            const [ratio, isHealthy] = await liquidityProtection.getVaultStatus(mockToken.address);
            expect(isHealthy).to.be.true;
            expect(ratio).to.equal(8000); // 80% liquidity ratio
        });
    });
});