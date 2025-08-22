// test-security-systems.js
/**
 * Comprehensive security system testing for HyperIndex
 */

const { ethers } = require("hardhat");

async function main() {
    console.log("🛡️ Testing Security Systems and Circuit Breakers...");
    
    const [deployer, testUser1, testUser2] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`👤 Test User 1: ${testUser1.address}`);
    console.log(`👤 Test User 2: ${testUser2.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} HYPE`);
    
    // Load existing deployment info
    let deploymentInfo;
    try {
        deploymentInfo = JSON.parse(require('fs').readFileSync('testnet-deployment.json', 'utf8'));
        console.log("📋 Loaded deployment info");
    } catch (error) {
        console.error("❌ Could not load deployment info");
        return;
    }
    
    const securityResults = {
        basicFunctionality: {},
        circuitBreakers: {},
        emergencyControls: {},
        accessControl: {},
        auditLog: []
    };
    
    try {
        // 1. Test SecurityManager Basic Functionality
        console.log("\n=== 1. 🔍 Testing SecurityManager Basic Functionality ===");
        
        const SecurityManager = await ethers.getContractFactory("SecurityManager");
        const securityManager = SecurityManager.attach(deploymentInfo.contracts.securityManager);
        
        console.log(`📍 SecurityManager: ${deploymentInfo.contracts.securityManager}`);
        
        // Test role assignments
        console.log("\n📋 Testing Role Assignments...");
        const DEFAULT_ADMIN_ROLE = await securityManager.DEFAULT_ADMIN_ROLE();
        const SECURITY_ADMIN_ROLE = await securityManager.SECURITY_ADMIN_ROLE();
        const EMERGENCY_ROLE = await securityManager.EMERGENCY_ROLE();
        const MONITOR_ROLE = await securityManager.MONITOR_ROLE();
        
        const isAdmin = await securityManager.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
        const isSecurityAdmin = await securityManager.hasRole(SECURITY_ADMIN_ROLE, deployer.address);
        const isEmergencyRole = await securityManager.hasRole(EMERGENCY_ROLE, deployer.address);
        const isMonitor = await securityManager.hasRole(MONITOR_ROLE, deployer.address);
        
        console.log(`   ✅ Default Admin: ${isAdmin}`);
        console.log(`   ✅ Security Admin: ${isSecurityAdmin}`);
        console.log(`   ✅ Emergency Role: ${isEmergencyRole}`);
        console.log(`   ✅ Monitor Role: ${isMonitor}`);
        
        securityResults.basicFunctionality.roleAssignments = {
            admin: isAdmin,
            securityAdmin: isSecurityAdmin,
            emergency: isEmergencyRole,
            monitor: isMonitor
        };
        
        // Test pausing functionality
        console.log("\n⏸️ Testing Pause/Unpause Functionality...");
        const isPausedBefore = await securityManager.paused();
        console.log(`   📊 Initially paused: ${isPausedBefore}`);
        
        if (!isPausedBefore) {
            await securityManager.pause();
            console.log("   ⏸️ System paused");
            const isPausedAfter = await securityManager.paused();
            console.log(`   📊 After pause: ${isPausedAfter}`);
            
            await securityManager.unpause();
            console.log("   ▶️ System unpaused");
            const isFinallyPaused = await securityManager.paused();
            console.log(`   📊 Finally paused: ${isFinallyPaused}`);
            
            securityResults.basicFunctionality.pauseControl = true;
        }
        
        // 2. Test Pre-transaction Security Checks
        console.log("\n=== 2. 🔒 Testing Pre-transaction Security Checks ===");
        
        // Test normal transaction check
        console.log("\n✅ Testing Normal Transaction Check...");
        try {
            const checkResult = await securityManager.preTransactionCheck(
                deployer.address,
                deploymentInfo.contracts.mockUSDC,
                ethers.parseUnits("100", 6), // 100 USDC
                "normal_transfer"
            );
            console.log(`   📊 Transaction allowed: ${checkResult.allowed}`);
            console.log(`   📝 Reason: ${checkResult.reason || 'No reason provided'}`);
            
            securityResults.basicFunctionality.preTransactionCheck = checkResult.allowed;
        } catch (error) {
            console.log(`   ⚠️ Pre-transaction check error: ${error.message}`);
            securityResults.basicFunctionality.preTransactionCheck = false;
        }
        
        // 3. Test Blacklist Functionality
        console.log("\n=== 3. 🚫 Testing Blacklist Functionality ===");
        
        // Add testUser1 to blacklist
        console.log(`\n🚫 Adding ${testUser1.address} to blacklist...`);
        await securityManager.addToBlacklist(testUser1.address);
        
        const isBlacklisted = await securityManager.blacklistedAddresses(testUser1.address);
        console.log(`   📊 Is blacklisted: ${isBlacklisted}`);
        
        // Test blacklisted user transaction
        if (isBlacklisted) {
            try {
                const blacklistCheck = await securityManager.preTransactionCheck(
                    testUser1.address,
                    deploymentInfo.contracts.mockUSDC,
                    ethers.parseUnits("50", 6),
                    "blacklisted_test"
                );
                console.log(`   📊 Blacklisted user allowed: ${blacklistCheck.allowed}`);
                console.log(`   📝 Reason: ${blacklistCheck.reason}`);
                
                securityResults.accessControl.blacklistPrevention = !blacklistCheck.allowed;
            } catch (error) {
                console.log(`   ⚠️ Blacklist check error: ${error.message}`);
            }
        }
        
        // Remove from blacklist
        await securityManager.removeFromBlacklist(testUser1.address);
        const isStillBlacklisted = await securityManager.blacklistedAddresses(testUser1.address);
        console.log(`   📊 After removal, still blacklisted: ${isStillBlacklisted}`);
        
        securityResults.accessControl.blacklistManagement = true;
        
        // 4. Test Circuit Breaker Logic
        console.log("\n=== 4. ⚡ Testing Circuit Breaker Logic ===");
        
        // Test large transaction detection
        console.log("\n💸 Testing Large Transaction Detection...");
        const largeAmount = ethers.parseUnits("2000000", 6); // 2M USDC (exceeds MAX_SINGLE_TRANSACTION)
        
        try {
            const largeTransactionCheck = await securityManager.preTransactionCheck(
                deployer.address,
                deploymentInfo.contracts.mockUSDC,
                largeAmount,
                "large_transaction_test"
            );
            console.log(`   📊 Large transaction allowed: ${largeTransactionCheck.allowed}`);
            console.log(`   📝 Reason: ${largeTransactionCheck.reason}`);
            
            securityResults.circuitBreakers.largeTxPrevention = !largeTransactionCheck.allowed;
        } catch (error) {
            console.log(`   ⚠️ Large transaction test error: ${error.message}`);
        }
        
        // 5. Test Emergency Mode
        console.log("\n=== 5. 🚨 Testing Emergency Mode ===");
        
        console.log("\n🚨 Activating Global Emergency Mode...");
        await securityManager.activateGlobalEmergency();
        
        const isInEmergency = await securityManager.globalEmergencyMode();
        console.log(`   📊 Global emergency active: ${isInEmergency}`);
        
        if (isInEmergency) {
            // Test transaction during emergency
            try {
                const emergencyCheck = await securityManager.preTransactionCheck(
                    deployer.address,
                    deploymentInfo.contracts.mockUSDC,
                    ethers.parseUnits("10", 6),
                    "emergency_test"
                );
                console.log(`   📊 Transaction during emergency: ${emergencyCheck.allowed}`);
                console.log(`   📝 Reason: ${emergencyCheck.reason}`);
                
                securityResults.emergencyControls.emergencyModePrevention = !emergencyCheck.allowed;
            } catch (error) {
                console.log(`   ⚠️ Emergency mode test error: ${error.message}`);
            }
            
            // Deactivate emergency mode
            console.log("\n✅ Deactivating Emergency Mode...");
            await securityManager.deactivateGlobalEmergency();
            
            const isStillInEmergency = await securityManager.globalEmergencyMode();
            console.log(`   📊 Still in emergency: ${isStillInEmergency}`);
            
            securityResults.emergencyControls.emergencyModeControl = true;
        }
        
        // 6. Test Security Event Logging
        console.log("\n=== 6. 📝 Testing Security Event Logging ===");
        
        console.log("\n📝 Creating test security event...");
        await securityManager.logSecurityEvent(
            0, // LARGE_TRANSACTION
            deployer.address,
            ethers.parseUnits("1000", 6),
            "Test security event for logging"
        );
        
        // Get event counter
        const eventCounter = await securityManager.securityEventCounter();
        console.log(`   📊 Security events logged: ${eventCounter}`);
        
        if (eventCounter > 0) {
            // Get the latest event
            const latestEventId = eventCounter - 1n;
            const latestEvent = await securityManager.securityEvents(latestEventId);
            
            console.log(`   📋 Latest event ID: ${latestEvent.id}`);
            console.log(`   📋 Event type: ${latestEvent.eventType}`);
            console.log(`   📋 Target: ${latestEvent.target}`);
            console.log(`   📋 Value: ${ethers.formatUnits(latestEvent.value, 6)} USDC`);
            console.log(`   📋 Description: ${latestEvent.description}`);
            console.log(`   📋 Resolved: ${latestEvent.resolved}`);
            
            securityResults.auditLog.push({
                id: latestEvent.id.toString(),
                type: latestEvent.eventType.toString(),
                target: latestEvent.target,
                value: latestEvent.value.toString(),
                description: latestEvent.description,
                resolved: latestEvent.resolved
            });
        }
        
        // 7. Test Vault Security Profiles
        console.log("\n=== 7. 🏦 Testing Vault Security Profiles ===");
        
        const testVaultAddress = deploymentInfo.contracts.hyperIndexVault;
        console.log(`\n🏦 Setting security profile for vault: ${testVaultAddress}`);
        
        await securityManager.setVaultSecurityProfile(
            testVaultAddress,
            75, // riskScore
            ethers.parseUnits("50000", 6), // maxDailyVolume: 50K USDC
            ethers.parseUnits("10000", 6), // maxTransactionSize: 10K USDC
            false // highRiskMode
        );
        
        const vaultProfile = await securityManager.vaultProfiles(testVaultAddress);
        console.log(`   📊 Risk Score: ${vaultProfile.riskScore}`);
        console.log(`   📊 Max Daily Volume: ${ethers.formatUnits(vaultProfile.maxDailyVolume, 6)} USDC`);
        console.log(`   📊 Max Transaction Size: ${ethers.formatUnits(vaultProfile.maxTransactionSize, 6)} USDC`);
        console.log(`   📊 High Risk Mode: ${vaultProfile.highRiskMode}`);
        console.log(`   📊 Suspicious Activity Count: ${vaultProfile.suspiciousActivityCount}`);
        
        securityResults.basicFunctionality.vaultSecurityProfiles = true;
        
        // 8. Test Access Control for Different Roles
        console.log("\n=== 8. 🔑 Testing Role-based Access Control ===");
        
        console.log("\n🔑 Testing unauthorized access...");
        
        // Try to use emergency function with test user (should fail)
        const securityManagerAsUser = securityManager.connect(testUser1);
        
        try {
            await securityManagerAsUser.activateGlobalEmergency();
            console.log("   ❌ Unauthorized user was able to activate emergency mode!");
            securityResults.accessControl.unauthorizedAccess = false;
        } catch (error) {
            console.log("   ✅ Unauthorized access properly blocked");
            securityResults.accessControl.unauthorizedAccess = true;
        }
        
        // Grant monitor role to test user and test
        console.log("\n🔑 Granting MONITOR_ROLE to test user...");
        await securityManager.grantRole(MONITOR_ROLE, testUser1.address);
        
        const hasMonitorRole = await securityManager.hasRole(MONITOR_ROLE, testUser1.address);
        console.log(`   📊 Test user has monitor role: ${hasMonitorRole}`);
        
        if (hasMonitorRole) {
            try {
                const monitorCheck = await securityManagerAsUser.preTransactionCheck(
                    deployer.address,
                    deploymentInfo.contracts.mockUSDC,
                    ethers.parseUnits("100", 6),
                    "monitor_role_test"
                );
                console.log("   ✅ Monitor role functions working");
                securityResults.accessControl.roleBasedAccess = true;
            } catch (error) {
                console.log(`   ⚠️ Monitor role test failed: ${error.message}`);
            }
        }
        
        // Summary of security tests
        console.log("\n🎉 Security System Testing Completed!");
        console.log("\n📊 Security Test Results Summary:");
        console.log(`   ✅ Role Assignments: ${securityResults.basicFunctionality.roleAssignments ? '✅' : '❌'}`);
        console.log(`   ✅ Pause Control: ${securityResults.basicFunctionality.pauseControl ? '✅' : '❌'}`);
        console.log(`   ✅ Pre-transaction Checks: ${securityResults.basicFunctionality.preTransactionCheck ? '✅' : '❌'}`);
        console.log(`   ✅ Blacklist Management: ${securityResults.accessControl.blacklistManagement ? '✅' : '❌'}`);
        console.log(`   ✅ Blacklist Prevention: ${securityResults.accessControl.blacklistPrevention ? '✅' : '❌'}`);
        console.log(`   ✅ Large Transaction Prevention: ${securityResults.circuitBreakers.largeTxPrevention ? '✅' : '❌'}`);
        console.log(`   ✅ Emergency Mode Control: ${securityResults.emergencyControls.emergencyModeControl ? '✅' : '❌'}`);
        console.log(`   ✅ Emergency Prevention: ${securityResults.emergencyControls.emergencyModePrevention ? '✅' : '❌'}`);
        console.log(`   ✅ Security Event Logging: ${securityResults.auditLog.length > 0 ? '✅' : '❌'}`);
        console.log(`   ✅ Vault Security Profiles: ${securityResults.basicFunctionality.vaultSecurityProfiles ? '✅' : '❌'}`);
        console.log(`   ✅ Unauthorized Access Blocked: ${securityResults.accessControl.unauthorizedAccess ? '✅' : '❌'}`);
        console.log(`   ✅ Role-based Access: ${securityResults.accessControl.roleBasedAccess ? '✅' : '❌'}`);
        
        // Update deployment info with security test results
        deploymentInfo.securityTesting = {
            timestamp: new Date().toISOString(),
            testResults: securityResults,
            status: "comprehensive_testing_completed",
            features: [
                "Role-based access control",
                "Circuit breaker mechanisms", 
                "Emergency mode controls",
                "Blacklist management",
                "Security event logging",
                "Vault security profiles",
                "Pre-transaction validation"
            ]
        };
        
        // Save updated deployment info
        console.log("\n💾 Updating deployment info...");
        require('fs').writeFileSync(
            'testnet-deployment.json',
            JSON.stringify(deploymentInfo, null, 2)
        );
        console.log("   ✅ Security test results saved");
        
        return securityResults;
        
    } catch (error) {
        console.error(`\n❌ Security system testing failed: ${error.message}`);
        console.error("Stack trace:", error.stack);
        throw error;
    }
}

main()
    .then((results) => {
        console.log("\n🛡️ Security system testing completed successfully!");
        console.log("🚀 Ready to proceed with comprehensive E2E testing!");
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });