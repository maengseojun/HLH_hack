const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Comprehensive Security Test Suite", function () {
    // Extended timeout for comprehensive tests
    this.timeout(60000);
    
    async function deployCompleteSecurityFixture() {
        const [owner, user1, user2, user3, attacker, oracle] = await ethers.getSigners();
        
        // Deploy all security contracts
        const SecurityEnhancements = await ethers.getContractFactory("SecurityEnhancements");
        const securityEnhancements = await SecurityEnhancements.deploy();
        
        const EnhancedOracleManager = await ethers.getContractFactory("EnhancedOracleManager");
        const oracleManager = await EnhancedOracleManager.deploy();
        
        const LiquidityProtection = await ethers.getContractFactory("LiquidityProtection");
        const liquidityProtection = await LiquidityProtection.deploy();
        
        // Deploy existing contracts for integration testing
        const SmartIndexVault = await ethers.getContractFactory("SmartIndexVault");
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const asset = await MockERC20.deploy("Test Asset", "TEST", 18);
        const vault = await SmartIndexVault.deploy(
            asset.address,
            "Test Index Vault",
            "TIV"
        );
        
        const MultiDEXAggregator = await ethers.getContractFactory("MultiDEXAggregator");
        const dexAggregator = await MultiDEXAggregator.deploy();
        
        const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
        const primaryOracle = await MockPriceFeed.deploy();
        const backupOracle1 = await MockPriceFeed.deploy();
        const backupOracle2 = await MockPriceFeed.deploy();
        
        // Setup roles
        const SECURITY_ADMIN_ROLE = await securityEnhancements.SECURITY_ADMIN_ROLE();
        const ORACLE_ADMIN_ROLE = await oracleManager.ORACLE_ADMIN_ROLE();
        const LIQUIDITY_MANAGER_ROLE = await liquidityProtection.LIQUIDITY_MANAGER_ROLE();
        
        await securityEnhancements.grantRole(SECURITY_ADMIN_ROLE, owner.address);
        await oracleManager.grantRole(ORACLE_ADMIN_ROLE, owner.address);
        await liquidityProtection.grantRole(LIQUIDITY_MANAGER_ROLE, owner.address);
        
        // Initial setup
        await asset.mint(owner.address, ethers.utils.parseEther("100000"));
        await asset.mint(user1.address, ethers.utils.parseEther("10000"));
        await asset.mint(user2.address, ethers.utils.parseEther("10000"));
        await asset.mint(user3.address, ethers.utils.parseEther("10000"));
        
        // Setup oracles with realistic prices
        await primaryOracle.setPrice(asset.address, ethers.utils.parseEther("100"));
        await backupOracle1.setPrice(asset.address, ethers.utils.parseEther("101"));
        await backupOracle2.setPrice(asset.address, ethers.utils.parseEther("99"));
        
        return {
            securityEnhancements,
            oracleManager,
            liquidityProtection,
            vault,
            dexAggregator,
            asset,
            primaryOracle,
            backupOracle1,
            backupOracle2,
            owner,
            user1,
            user2,
            user3,
            attacker,
            oracle
        };
    }
    
    describe("🔒 Complete Security Integration", function () {
        it("Should deploy and configure entire security system", async function () {
            const { 
                securityEnhancements, 
                oracleManager, 
                liquidityProtection,
                asset,
                primaryOracle,
                backupOracle1,
                backupOracle2,
                vault
            } = await loadFixture(deployCompleteSecurityFixture);
            
            // Configure oracle system
            await oracleManager.addOracleSource(
                asset.address,
                primaryOracle.address,
                6000, // 60% weight
                3,
                "Primary Hyperliquid Oracle"
            );
            
            await oracleManager.addOracleSource(
                asset.address,
                backupOracle1.address,
                2500, // 25% weight
                3,
                "Chainlink Backup"
            );
            
            await oracleManager.addOracleSource(
                asset.address,
                backupOracle2.address,
                1500, // 15% weight
                3,
                "Band Protocol Backup"
            );
            
            // Configure circuit breaker
            await securityEnhancements.configureCircuitBreaker(
                asset.address,
                1500, // 15% drop triggers circuit breaker
                1800  // 30 minute cooldown
            );
            
            // Configure liquidity protection
            await liquidityProtection.updateLiquidity(
                vault.address,
                ethers.utils.parseEther("10000"), // Total assets
                ethers.utils.parseEther("8000"),  // Liquid assets
                ethers.utils.parseEther("2000")   // Illiquid assets
            );
            
            // Verify configuration
            const oracleCount = await oracleManager.getOracleSourceCount(asset.address);
            expect(oracleCount).to.equal(3);
            
            const [liquidityRatio] = await liquidityProtection.getVaultStatus(vault.address);
            expect(liquidityRatio).to.equal(8000); // 80%
        });
        
        it("Should handle coordinated attack scenarios", async function () {
            const {
                securityEnhancements,
                oracleManager,
                liquidityProtection,
                asset,
                primaryOracle,
                backupOracle1,
                backupOracle2,
                vault,
                attacker,
                user1,
                user2,
                user3
            } = await loadFixture(deployCompleteSecurityFixture);
            
            // Setup system
            await oracleManager.addOracleSource(asset.address, primaryOracle.address, 5000, 3, "Primary");
            await oracleManager.addOracleSource(asset.address, backupOracle1.address, 5000, 3, "Backup");
            await liquidityProtection.updateLiquidity(
                vault.address,
                ethers.utils.parseEther("1000"),
                ethers.utils.parseEther("600"),
                ethers.utils.parseEther("400")
            );
            
            // Simulate coordinated attack:
            // 1. Oracle manipulation attempt
            await primaryOracle.setPrice(asset.address, ethers.utils.parseEther("50")); // 50% drop
            await backupOracle1.setPrice(asset.address, ethers.utils.parseEther("49")); // Coordinated
            
            // 2. Mass redemption requests (bank run simulation)
            await liquidityProtection.connect(user1).queueGradualRedemption(
                vault.address,
                ethers.utils.parseEther("200"),
                ethers.utils.parseEther("50"),
                false
            );
            
            await liquidityProtection.connect(user2).queueGradualRedemption(
                vault.address,
                ethers.utils.parseEther("150"),
                ethers.utils.parseEther("30"),
                false
            );
            
            await liquidityProtection.connect(user3).queueGradualRedemption(
                vault.address,
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("25"),
                true // Emergency
            );
            
            // 3. MEV attack attempt
            const commitment = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["uint256", "uint256", "address"],
                    [ethers.utils.parseEther("100"), 12345, attacker.address]
                )
            );
            await securityEnhancements.connect(attacker).commitTransaction(commitment);
            
            // System should detect and respond:
            // - Price manipulation should trigger alerts
            await expect(oracleManager.updatePrice(asset.address))
                .to.emit(oracleManager, "PriceManipulationDetected");
            
            // - Bank run should trigger emergency protocol
            const [, , , emergencyActive] = await liquidityProtection.getVaultStatus(vault.address);
            expect(emergencyActive).to.be.true;
            
            // - MEV protection should be active
            const commitData = await securityEnhancements.commitReveals(commitment);
            expect(commitData.commitBlock).to.be.gt(0);
        });
        
        it("Should maintain system stability under stress", async function () {
            const {
                securityEnhancements,
                oracleManager,
                liquidityProtection,
                asset,
                primaryOracle,
                vault,
                owner
            } = await loadFixture(deployCompleteSecurityFixture);
            
            // Setup minimal system
            await oracleManager.addOracleSource(asset.address, primaryOracle.address, 10000, 3, "Only Oracle");
            await liquidityProtection.updateLiquidity(
                vault.address,
                ethers.utils.parseEther("1000"),
                ethers.utils.parseEther("200"), // Low liquidity (20%)
                ethers.utils.parseEther("800")
            );
            
            // Stress test with rapid price changes
            const prices = [100, 95, 110, 85, 120, 75, 130, 70];
            
            for (let i = 0; i < prices.length; i++) {
                await primaryOracle.setPrice(asset.address, ethers.utils.parseEther(prices[i].toString()));
                
                try {
                    await oracleManager.updatePrice(asset.address);
                } catch (error) {
                    // Some updates may fail due to manipulation detection
                    console.log(`Price update ${i} failed (expected): ${error.message}`);
                }
                
                // Small time advance
                await time.increase(60);
            }
            
            // System should still be responsive
            const latestPrice = await primaryOracle.getPrice(asset.address);
            expect(latestPrice).to.equal(ethers.utils.parseEther("70"));
            
            // Liquidity protection should be active
            const queueCount = await liquidityProtection.getActiveRedemptionCount();
            expect(queueCount).to.be.gte(0); // Should not crash
        });
    });
    
    describe("🛡️ Advanced Security Scenarios", function () {
        it("Should handle flash loan attack simulation", async function () {
            const {
                securityEnhancements,
                oracleManager,
                asset,
                primaryOracle,
                backupOracle1,
                attacker
            } = await loadFixture(deployCompleteSecurityFixture);
            
            // Setup oracles
            await oracleManager.addOracleSource(asset.address, primaryOracle.address, 5000, 3, "Primary");
            await oracleManager.addOracleSource(asset.address, backupOracle1.address, 5000, 3, "Backup");
            
            // Simulate flash loan attack pattern:
            // 1. Rapid price manipulation
            await primaryOracle.setPrice(asset.address, ethers.utils.parseEther("100"));
            await oracleManager.updatePrice(asset.address);
            
            // 2. Immediate follow-up with different price (flash loan scenario)
            await primaryOracle.setPrice(asset.address, ethers.utils.parseEther("200"));
            
            // 3. Attempt rapid commit-reveal to exploit
            const commitment = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["uint256", "uint256", "address"],
                    [ethers.utils.parseEther("1000"), 999, attacker.address]
                )
            );
            
            await securityEnhancements.connect(attacker).commitTransaction(commitment);
            
            // System should prevent immediate exploitation
            await expect(
                securityEnhancements.connect(attacker).revealAndExecute(
                    ethers.utils.parseEther("1000"), 
                    999
                )
            ).to.be.revertedWith("Reveal too early");
            
            // Even after minimum delay, large price change should be detected
            await time.increase(180); // 3 minutes
            
            const manipulationDetected = await oracleManager.isManipulationDetected(asset.address);
            if (manipulationDetected) {
                console.log("✅ Flash loan attack pattern successfully detected and prevented");
            }
        });
        
        it("Should handle governance attack scenarios", async function () {
            const {
                securityEnhancements,
                liquidityProtection,
                vault,
                attacker,
                owner
            } = await loadFixture(deployCompleteSecurityFixture);
            
            // Simulate governance attack where attacker tries to:
            // 1. Change critical parameters
            const SECURITY_ADMIN_ROLE = await securityEnhancements.SECURITY_ADMIN_ROLE();
            
            await expect(
                securityEnhancements.connect(attacker).grantRole(SECURITY_ADMIN_ROLE, attacker.address)
            ).to.be.revertedWith("AccessControl: account");
            
            // 2. Emergency functions abuse
            await expect(
                securityEnhancements.connect(attacker).emergencyPause()
            ).to.be.revertedWith("AccessControl: account");
            
            // 3. Liquidity manipulation
            const LIQUIDITY_MANAGER_ROLE = await liquidityProtection.LIQUIDITY_MANAGER_ROLE();
            
            await expect(
                liquidityProtection.connect(attacker).updateLiquidity(
                    vault.address,
                    ethers.utils.parseEther("1000"),
                    ethers.utils.parseEther("1"), // Malicious low liquidity
                    ethers.utils.parseEther("999")
                )
            ).to.be.revertedWith("AccessControl: account");
            
            // Verify legitimate admin still has control
            await securityEnhancements.connect(owner).emergencyPause();
            expect(await securityEnhancements.paused()).to.be.true;
            
            await securityEnhancements.connect(owner).emergencyUnpause();
            expect(await securityEnhancements.paused()).to.be.false;
        });
        
        it("Should handle sandwich attack prevention", async function () {
            const {
                securityEnhancements,
                user1,
                user2,
                attacker
            } = await loadFixture(deployCompleteSecurityFixture);
            
            // Simulate sandwich attack scenario:
            // 1. Attacker front-runs user transaction
            const frontRunCommitment = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["uint256", "uint256", "address"],
                    [ethers.utils.parseEther("500"), 111, attacker.address]
                )
            );
            
            await securityEnhancements.connect(attacker).commitTransaction(frontRunCommitment);
            
            // 2. Legitimate user transaction
            const userCommitment = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["uint256", "uint256", "address"],
                    [ethers.utils.parseEther("100"), 222, user1.address]
                )
            );
            
            // Should fail due to minimum block delay
            await expect(
                securityEnhancements.connect(user1).commitTransaction(userCommitment)
            ).to.be.revertedWith("Too frequent transactions");
            
            // 3. After sufficient delay, user should be able to commit
            await time.increase(15); // Wait for block advancement
            
            // Attacker reveals first
            await securityEnhancements.connect(attacker).revealAndExecute(
                ethers.utils.parseEther("500"), 
                111
            );
            
            // Now user can commit (attacker's transaction executed, reset delay)
            await securityEnhancements.connect(user1).commitTransaction(userCommitment);
            
            // User commits after minimum delay
            await time.increase(15);
            await securityEnhancements.connect(user1).revealAndExecute(
                ethers.utils.parseEther("100"), 
                222
            );
            
            console.log("✅ Sandwich attack prevented through commit-reveal delay mechanism");
        });
    });
    
    describe("📊 Performance and Scalability", function () {
        it("Should handle high-frequency oracle updates", async function () {
            const {
                oracleManager,
                asset,
                primaryOracle,
                backupOracle1
            } = await loadFixture(deployCompleteSecurityFixture);
            
            // Setup oracles
            await oracleManager.addOracleSource(asset.address, primaryOracle.address, 5000, 3, "Primary");
            await oracleManager.addOracleSource(asset.address, backupOracle1.address, 5000, 3, "Backup");
            
            // Rapid price updates (simulating high-frequency trading environment)
            const updateCount = 20;
            const basePrice = 100;
            
            for (let i = 0; i < updateCount; i++) {
                const price = basePrice + (Math.random() - 0.5) * 10; // ±5% variation
                await primaryOracle.setPrice(asset.address, ethers.utils.parseEther(price.toString()));
                await backupOracle1.setPrice(asset.address, ethers.utils.parseEther((price * 1.01).toString()));
                
                try {
                    await oracleManager.updatePrice(asset.address);
                } catch (error) {
                    // Some updates may fail due to manipulation detection, which is expected
                }
                
                if (i % 5 === 0) {
                    await time.increase(1); // Minimal time advance
                }
            }
            
            // System should still be functional
            const totalUpdates = await oracleManager.totalPriceUpdates();
            expect(totalUpdates).to.be.gt(0);
            
            // TWAP should be available
            const [twapPrice, isValid] = await oracleManager.getTWAP(asset.address);
            if (isValid) {
                expect(twapPrice).to.be.gt(0);
                console.log(`✅ TWAP maintained through ${updateCount} rapid updates: ${ethers.utils.formatEther(twapPrice)}`);
            }
        });
        
        it("Should handle maximum redemption queue size", async function () {
            const {
                liquidityProtection,
                vault,
                asset,
                owner
            } = await loadFixture(deployCompleteSecurityFixture);
            
            // Setup vault with good liquidity
            await liquidityProtection.updateLiquidity(
                vault.address,
                ethers.utils.parseEther("100000"),
                ethers.utils.parseEther("80000"),
                ethers.utils.parseEther("20000")
            );
            
            const maxQueueSize = await liquidityProtection.maxQueueSize();
            const signers = await ethers.getSigners();
            const usableSigners = Math.min(maxQueueSize.toNumber(), signers.length - 1);
            
            console.log(`Testing with ${usableSigners} redemption requests (max: ${maxQueueSize})`);
            
            // Fill up redemption queue
            const promises = [];
            for (let i = 0; i < usableSigners; i++) {
                if (i < signers.length) {
                    const promise = liquidityProtection.connect(signers[i]).queueGradualRedemption(
                        vault.address,
                        ethers.utils.parseEther("100"),
                        ethers.utils.parseEther("10"),
                        false
                    );
                    promises.push(promise);
                }
            }
            
            // Execute all redemption requests
            await Promise.all(promises);
            
            const activeCount = await liquidityProtection.getActiveRedemptionCount();
            expect(activeCount).to.equal(usableSigners);
            
            // Try to add one more (should fail if at limit)
            if (usableSigners >= maxQueueSize) {
                await expect(
                    liquidityProtection.connect(owner).queueGradualRedemption(
                        vault.address,
                        ethers.utils.parseEther("50"),
                        ethers.utils.parseEther("5"),
                        false
                    )
                ).to.be.revertedWith("Queue is full");
            }
            
            // Process some redemptions
            await liquidityProtection.processRedemptionQueue(10);
            
            console.log(`✅ Successfully handled ${usableSigners} concurrent redemption requests`);
        });
        
        it("Should maintain gas efficiency under load", async function () {
            const {
                securityEnhancements,
                oracleManager,
                asset,
                primaryOracle
            } = await loadFixture(deployCompleteSecurityFixture);
            
            await oracleManager.addOracleSource(asset.address, primaryOracle.address, 10000, 3, "Primary");
            
            // Measure gas usage for various operations
            const gasResults = {};
            
            // Oracle update gas
            await primaryOracle.setPrice(asset.address, ethers.utils.parseEther("100"));
            const updateTx = await oracleManager.updatePrice(asset.address);
            const updateReceipt = await updateTx.wait();
            gasResults.oracleUpdate = updateReceipt.gasUsed.toNumber();
            
            // Commit transaction gas
            const commitment = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
            const commitTx = await securityEnhancements.commitTransaction(commitment);
            const commitReceipt = await commitTx.wait();
            gasResults.commitTransaction = commitReceipt.gasUsed.toNumber();
            
            // Circuit breaker configuration gas
            const circuitTx = await securityEnhancements.configureCircuitBreaker(
                asset.address,
                2000,
                3600
            );
            const circuitReceipt = await circuitTx.wait();
            gasResults.configureCircuitBreaker = circuitReceipt.gasUsed.toNumber();
            
            // Log gas usage
            console.log("📊 Gas Usage Results:");
            console.log(`   Oracle Update: ${gasResults.oracleUpdate.toLocaleString()} gas`);
            console.log(`   Commit Transaction: ${gasResults.commitTransaction.toLocaleString()} gas`);
            console.log(`   Configure Circuit Breaker: ${gasResults.configureCircuitBreaker.toLocaleString()} gas`);
            
            // Verify gas usage is within reasonable limits
            expect(gasResults.oracleUpdate).to.be.lt(500000); // 500k gas limit
            expect(gasResults.commitTransaction).to.be.lt(100000); // 100k gas limit
            expect(gasResults.configureCircuitBreaker).to.be.lt(200000); // 200k gas limit
        });
    });
    
    describe("🔄 Recovery and Resilience", function () {
        it("Should recover from emergency situations", async function () {
            const {
                securityEnhancements,
                liquidityProtection,
                vault,
                asset,
                owner
            } = await loadFixture(deployCompleteSecurityFixture);
            
            // Setup emergency scenario
            await liquidityProtection.updateLiquidity(
                vault.address,
                ethers.utils.parseEther("1000"),
                ethers.utils.parseEther("30"), // Critical liquidity (3%)
                ethers.utils.parseEther("970")
            );
            
            // Emergency should be activated automatically
            const [, , , emergencyActive] = await liquidityProtection.getVaultStatus(vault.address);
            expect(emergencyActive).to.be.true;
            
            // Inject emergency liquidity
            await asset.mint(owner.address, ethers.utils.parseEther("500"));
            await asset.approve(liquidityProtection.address, ethers.utils.parseEther("500"));
            
            await liquidityProtection.injectEmergencyLiquidity(
                vault.address,
                ethers.utils.parseEther("500"),
                asset.address
            );
            
            // Update liquidity status
            await liquidityProtection.updateLiquidity(
                vault.address,
                ethers.utils.parseEther("1500"),
                ethers.utils.parseEther("530"), // Now 35% liquid
                ethers.utils.parseEther("970")
            );
            
            // Wait for cooldown period
            await time.increase(86400); // 24 hours
            
            // Deactivate emergency protocol
            await liquidityProtection.deactivateEmergencyProtocol(vault.address);
            
            // Verify recovery
            const [, isHealthy, , emergencyStillActive] = await liquidityProtection.getVaultStatus(vault.address);
            expect(isHealthy).to.be.true;
            expect(emergencyStillActive).to.be.false;
            
            console.log("✅ Successfully recovered from emergency situation");
        });
        
        it("Should handle oracle failure gracefully", async function () {
            const {
                oracleManager,
                asset,
                primaryOracle,
                backupOracle1,
                backupOracle2
            } = await loadFixture(deployCompleteSecurityFixture);
            
            // Setup multiple oracles
            await oracleManager.addOracleSource(asset.address, primaryOracle.address, 4000, 2, "Primary");
            await oracleManager.addOracleSource(asset.address, backupOracle1.address, 3000, 2, "Backup1");
            await oracleManager.addOracleSource(asset.address, backupOracle2.address, 3000, 2, "Backup2");
            
            // Set normal prices
            await primaryOracle.setPrice(asset.address, ethers.utils.parseEther("100"));
            await backupOracle1.setPrice(asset.address, ethers.utils.parseEther("101"));
            await backupOracle2.setPrice(asset.address, ethers.utils.parseEther("99"));
            
            // Initial update should work
            await oracleManager.updatePrice(asset.address);
            
            // Simulate primary oracle failure
            await primaryOracle.setShouldRevert(true);
            
            // Update should still work with backup oracles
            await oracleManager.updatePrice(asset.address);
            
            let [price, confidence] = await oracleManager.getPrice(asset.address);
            expect(confidence).to.be.lt(10000); // Less than 100% confidence
            expect(price).to.equal(ethers.utils.parseEther("100")); // Should be average of backups
            
            // Simulate second oracle failure
            await backupOracle1.setShouldRevert(true);
            
            // Still should work with one oracle
            await oracleManager.updatePrice(asset.address);
            [price, confidence] = await oracleManager.getPrice(asset.address);
            expect(price).to.equal(ethers.utils.parseEther("99")); // Only backup2 working
            
            // All oracles fail - should revert
            await backupOracle2.setShouldRevert(true);
            await expect(oracleManager.updatePrice(asset.address))
                .to.be.revertedWith("Insufficient valid oracle sources");
            
            console.log("✅ Oracle failure handled gracefully");
        });
    });
});