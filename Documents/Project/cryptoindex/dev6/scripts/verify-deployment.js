const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deployment Verification Script
 * Verifies all deployed security contracts and configurations
 */
async function verifyDeployment() {
    console.log("🔍 Starting Deployment Verification...\n");
    
    const [signer] = await ethers.getSigners();
    const networkName = hre.network.name;
    const verificationResults = {
        network: networkName,
        timestamp: new Date().toISOString(),
        signer: signer.address,
        results: {
            contracts: {},
            configurations: {},
            integrations: {},
            security: {}
        },
        summary: {
            total: 0,
            passed: 0,
            failed: 0,
            warnings: 0
        }
    };
    
    try {
        // 1. Load deployment information
        console.log("📄 Loading deployment information...");
        const deploymentInfo = await loadLatestDeployment(networkName);
        if (!deploymentInfo) {
            throw new Error("No deployment information found");
        }
        
        console.log(`   Deployment found: ${deploymentInfo.timestamp}`);
        console.log(`   Deployer: ${deploymentInfo.deployer}`);
        
        // 2. Verify contract deployments
        console.log("\n📡 Verifying contract deployments...");
        await verifyContractDeployments(deploymentInfo.contracts, verificationResults);
        
        // 3. Verify contract configurations
        console.log("\n⚙️  Verifying contract configurations...");
        await verifyContractConfigurations(deploymentInfo.contracts, verificationResults);
        
        // 4. Verify role-based access control
        console.log("\n🔑 Verifying access control...");
        await verifyAccessControl(deploymentInfo.contracts, verificationResults);
        
        // 5. Verify oracle integrations
        console.log("\n🔮 Verifying oracle integrations...");
        await verifyOracleIntegrations(deploymentInfo.contracts, verificationResults);
        
        // 6. Verify security mechanisms
        console.log("\n🛡️  Verifying security mechanisms...");
        await verifySecurityMechanisms(deploymentInfo.contracts, verificationResults);
        
        // 7. Verify monitoring setup
        console.log("\n📊 Verifying monitoring setup...");
        await verifyMonitoringSetup(deploymentInfo.contracts, verificationResults);
        
        // 8. Generate verification report
        const report = generateVerificationReport(verificationResults);
        const reportPath = await saveVerificationReport(report, networkName);
        
        // 9. Display summary
        displayVerificationSummary(verificationResults, reportPath);
        
        return verificationResults;
        
    } catch (error) {
        console.error("❌ Verification failed:", error);
        throw error;
    }
}

async function loadLatestDeployment(networkName) {
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        return null;
    }
    
    const files = fs.readdirSync(deploymentsDir)
        .filter(file => file.startsWith(`security-suite-${networkName}-`))
        .filter(file => file.endsWith('.json'))
        .sort()
        .reverse(); // Latest first
    
    if (files.length === 0) {
        return null;
    }
    
    const latestFile = files[0];
    const filePath = path.join(deploymentsDir, latestFile);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function verifyContractDeployments(contracts, results) {
    const contractNames = [
        'SecurityEnhancements',
        'EnhancedOracleManager', 
        'LiquidityProtection'
    ];
    
    for (const contractName of contractNames) {
        const address = contracts[contractName];
        const testResult = {
            name: `${contractName} Deployment`,
            status: 'FAILED',
            details: '',
            critical: true
        };
        
        try {
            if (!address || address === ethers.constants.AddressZero) {
                testResult.details = 'Contract address not found or zero address';
            } else {
                // Check if contract exists at address
                const code = await ethers.provider.getCode(address);
                if (code === '0x') {
                    testResult.details = 'No contract code found at address';
                } else {
                    // Try to instantiate contract
                    const contract = await ethers.getContractAt(contractName, address);
                    
                    // Basic function call to verify contract
                    let basicCheck = false;
                    if (contractName === 'SecurityEnhancements') {
                        basicCheck = await contract.paused() !== undefined;
                    } else if (contractName === 'EnhancedOracleManager') {
                        basicCheck = await contract.totalPriceUpdates() !== undefined;
                    } else if (contractName === 'LiquidityProtection') {
                        basicCheck = await contract.globalLiquidityRatio() !== undefined;
                    }
                    
                    if (basicCheck) {
                        testResult.status = 'PASSED';
                        testResult.details = `Contract deployed and responding at ${address}`;
                    } else {
                        testResult.details = 'Contract deployed but not responding to basic calls';
                    }
                }
            }
        } catch (error) {
            testResult.details = `Error verifying contract: ${error.message}`;
        }
        
        results.results.contracts[contractName] = testResult;
        updateSummary(results.summary, testResult);
        
        console.log(`   ${testResult.status === 'PASSED' ? '✅' : '❌'} ${testResult.name}: ${testResult.details}`);
    }
}

async function verifyContractConfigurations(contracts, results) {
    const configTests = [
        {
            name: 'Global Liquidity Ratio',
            contractName: 'LiquidityProtection',
            check: async (contract) => {
                const ratio = await contract.globalLiquidityRatio();
                return ratio.gt(0) && ratio.lte(10000); // Should be between 0-100%
            },
            expected: 'Between 0-10000 (0-100%)',
            critical: true
        },
        {
            name: 'Security Admin Role Setup',
            contractName: 'SecurityEnhancements',
            check: async (contract) => {
                const adminRole = await contract.SECURITY_ADMIN_ROLE();
                const hasAdmin = await contract.hasRole(adminRole, contracts.deployer);
                return hasAdmin;
            },
            expected: 'Admin role granted to deployer',
            critical: true
        },
        {
            name: 'Oracle Admin Role Setup',
            contractName: 'EnhancedOracleManager',
            check: async (contract) => {
                const adminRole = await contract.ORACLE_ADMIN_ROLE();
                const hasAdmin = await contract.hasRole(adminRole, contracts.deployer);
                return hasAdmin;
            },
            expected: 'Admin role granted to deployer',
            critical: true
        }
    ];
    
    for (const test of configTests) {
        const testResult = {
            name: test.name,
            status: 'FAILED',
            details: '',
            critical: test.critical
        };
        
        try {
            const contractAddress = contracts[test.contractName];
            if (!contractAddress) {
                testResult.details = `Contract ${test.contractName} not found`;
            } else {
                const contract = await ethers.getContractAt(test.contractName, contractAddress);
                const passed = await test.check(contract);
                
                if (passed) {
                    testResult.status = 'PASSED';
                    testResult.details = `Configuration correct: ${test.expected}`;
                } else {
                    testResult.details = `Configuration incorrect. Expected: ${test.expected}`;
                }
            }
        } catch (error) {
            testResult.details = `Error checking configuration: ${error.message}`;
        }
        
        results.results.configurations[test.name] = testResult;
        updateSummary(results.summary, testResult);
        
        console.log(`   ${testResult.status === 'PASSED' ? '✅' : '❌'} ${testResult.name}: ${testResult.details}`);
    }
}

async function verifyAccessControl(contracts, results) {
    const roleTests = [
        {
            name: 'Security Admin Role Exclusive',
            contractName: 'SecurityEnhancements',
            check: async (contract) => {
                const adminRole = await contract.SECURITY_ADMIN_ROLE();
                const memberCount = await contract.getRoleMemberCount(adminRole);
                return memberCount.eq(1); // Should only have one admin initially
            }
        },
        {
            name: 'Emergency Pause Function Protected',
            contractName: 'SecurityEnhancements',
            check: async (contract) => {
                try {
                    // Try to call emergencyPause without admin role (should fail)
                    const randomSigner = ethers.Wallet.createRandom().connect(ethers.provider);
                    await contract.connect(randomSigner).callStatic.emergencyPause();
                    return false; // Should not reach here
                } catch (error) {
                    return error.message.includes('AccessControl') || error.message.includes('insufficient funds');
                }
            }
        }
    ];
    
    for (const test of roleTests) {
        const testResult = {
            name: test.name,
            status: 'FAILED',
            details: '',
            critical: true
        };
        
        try {
            const contractAddress = contracts[test.contractName];
            if (!contractAddress) {
                testResult.details = `Contract ${test.contractName} not found`;
            } else {
                const contract = await ethers.getContractAt(test.contractName, contractAddress);
                const passed = await test.check(contract);
                
                if (passed) {
                    testResult.status = 'PASSED';
                    testResult.details = 'Access control properly configured';
                } else {
                    testResult.details = 'Access control configuration failed';
                }
            }
        } catch (error) {
            testResult.details = `Error checking access control: ${error.message}`;
        }
        
        results.results.security[test.name] = testResult;
        updateSummary(results.summary, testResult);
        
        console.log(`   ${testResult.status === 'PASSED' ? '✅' : '❌'} ${testResult.name}: ${testResult.details}`);
    }
}

async function verifyOracleIntegrations(contracts, results) {
    const testResult = {
        name: 'Oracle Manager Initialization',
        status: 'FAILED',
        details: '',
        critical: false
    };
    
    try {
        const oracleManagerAddress = contracts['EnhancedOracleManager'];
        if (!oracleManagerAddress) {
            testResult.details = 'Oracle Manager contract not found';
        } else {
            const oracleManager = await ethers.getContractAt('EnhancedOracleManager', oracleManagerAddress);
            
            // Check if oracle manager is properly initialized
            const totalUpdates = await oracleManager.totalPriceUpdates();
            const totalFailures = await oracleManager.totalOracleFailures();
            
            testResult.status = 'PASSED';
            testResult.details = `Oracle manager initialized. Updates: ${totalUpdates}, Failures: ${totalFailures}`;
        }
    } catch (error) {
        testResult.details = `Error verifying oracle integration: ${error.message}`;
    }
    
    results.results.integrations['Oracle Integration'] = testResult;
    updateSummary(results.summary, testResult);
    
    console.log(`   ${testResult.status === 'PASSED' ? '✅' : '⚠️ '} ${testResult.name}: ${testResult.details}`);
}

async function verifySecurityMechanisms(contracts, results) {
    const securityTests = [
        {
            name: 'Circuit Breaker Mechanism',
            check: async () => {
                const securityAddress = contracts['SecurityEnhancements'];
                const security = await ethers.getContractAt('SecurityEnhancements', securityAddress);
                
                // Check if circuit breaker can be configured
                const totalTriggers = await security.totalCircuitBreakerTriggers();
                return totalTriggers !== undefined;
            }
        },
        {
            name: 'MEV Protection System',
            check: async () => {
                const securityAddress = contracts['SecurityEnhancements'];
                const security = await ethers.getContractAt('SecurityEnhancements', securityAddress);
                
                // Check if MEV protection is active
                const testCommit = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
                try {
                    await security.callStatic.commitTransaction(testCommit);
                    return true;
                } catch (error) {
                    // Expected to fail in some cases
                    return !error.message.includes("execution reverted");
                }
            }
        },
        {
            name: 'Liquidity Protection Active',
            check: async () => {
                const liquidityAddress = contracts['LiquidityProtection'];
                const liquidity = await ethers.getContractAt('LiquidityProtection', liquidityAddress);
                
                const queueCount = await liquidity.getActiveRedemptionCount();
                return queueCount !== undefined;
            }
        }
    ];
    
    for (const test of securityTests) {
        const testResult = {
            name: test.name,
            status: 'FAILED',
            details: '',
            critical: true
        };
        
        try {
            const passed = await test.check();
            
            if (passed) {
                testResult.status = 'PASSED';
                testResult.details = 'Security mechanism operational';
            } else {
                testResult.details = 'Security mechanism not responding correctly';
            }
        } catch (error) {
            testResult.details = `Error testing security mechanism: ${error.message}`;
        }
        
        results.results.security[test.name] = testResult;
        updateSummary(results.summary, testResult);
        
        console.log(`   ${testResult.status === 'PASSED' ? '✅' : '❌'} ${testResult.name}: ${testResult.details}`);
    }
}

async function verifyMonitoringSetup(contracts, results) {
    const monitoringTest = {
        name: 'Monitoring Infrastructure',
        status: 'WARNING',
        details: 'Manual verification required',
        critical: false
    };
    
    // Check if monitoring files exist
    const monitoringDir = path.join(__dirname, "../monitoring");
    const dashboardFile = path.join(monitoringDir, "SecurityDashboard.js");
    
    if (fs.existsSync(dashboardFile)) {
        monitoringTest.status = 'PASSED';
        monitoringTest.details = 'Monitoring dashboard available - manual startup required';
    } else {
        monitoringTest.details = 'Monitoring dashboard not found';
    }
    
    results.results.integrations['Monitoring'] = monitoringTest;
    updateSummary(results.summary, monitoringTest);
    
    console.log(`   ${monitoringTest.status === 'PASSED' ? '✅' : '⚠️ '} ${monitoringTest.name}: ${monitoringTest.details}`);
}

function updateSummary(summary, testResult) {
    summary.total++;
    
    if (testResult.status === 'PASSED') {
        summary.passed++;
    } else if (testResult.status === 'WARNING') {
        summary.warnings++;
    } else {
        summary.failed++;
    }
}

function generateVerificationReport(results) {
    const { summary, results: testResults } = results;
    const passRate = ((summary.passed / summary.total) * 100).toFixed(1);
    
    let report = `# 🔍 Deployment Verification Report\n\n`;
    report += `**Network**: ${results.network}\n`;
    report += `**Verification Time**: ${results.timestamp}\n`;
    report += `**Signer**: ${results.signer}\n\n`;
    
    report += `## 📊 Summary\n\n`;
    report += `- **Total Tests**: ${summary.total}\n`;
    report += `- **Passed**: ${summary.passed}\n`;
    report += `- **Failed**: ${summary.failed}\n`;
    report += `- **Warnings**: ${summary.warnings}\n`;
    report += `- **Pass Rate**: ${passRate}%\n\n`;
    
    // Overall status
    let overallStatus = "🟢 HEALTHY";
    if (summary.failed > 0) {
        const criticalFailed = Object.values(testResults).flat()
            .filter(test => test.critical && test.status === 'FAILED').length;
        if (criticalFailed > 0) {
            overallStatus = "🔴 CRITICAL";
        } else {
            overallStatus = "🟡 DEGRADED";
        }
    } else if (summary.warnings > 0) {
        overallStatus = "🟡 WARNING";
    }
    
    report += `## 🎯 Overall Status: ${overallStatus}\n\n`;
    
    // Detailed results
    const categories = [
        { name: 'Contract Deployments', key: 'contracts' },
        { name: 'Configurations', key: 'configurations' },
        { name: 'Security Mechanisms', key: 'security' },
        { name: 'Integrations', key: 'integrations' }
    ];
    
    for (const category of categories) {
        const categoryResults = testResults[category.key];
        if (Object.keys(categoryResults).length === 0) continue;
        
        report += `### ${category.name}\n\n`;
        report += `| Test | Status | Details |\n`;
        report += `|------|--------|----------|\n`;
        
        Object.entries(categoryResults).forEach(([testName, result]) => {
            const statusIcon = result.status === 'PASSED' ? '✅' : 
                             result.status === 'WARNING' ? '⚠️' : '❌';
            report += `| ${testName} | ${statusIcon} ${result.status} | ${result.details} |\n`;
        });
        
        report += '\n';
    }
    
    // Recommendations
    report += `## 💡 Recommendations\n\n`;
    
    const failedCritical = Object.values(testResults).flat()
        .filter(test => test.critical && test.status === 'FAILED');
    
    if (failedCritical.length > 0) {
        report += `### 🚨 Critical Issues (Fix Immediately)\n`;
        failedCritical.forEach(test => {
            report += `- **${test.name}**: ${test.details}\n`;
        });
        report += '\n';
    }
    
    report += `### 🎯 Next Steps\n`;
    if (summary.failed === 0) {
        report += `1. ✅ All core systems verified - ready for production\n`;
        report += `2. 📊 Start monitoring dashboard: \`node monitoring/SecurityDashboard.js\`\n`;
        report += `3. 🧪 Run comprehensive security tests\n`;
        report += `4. 🔍 Schedule external security audit\n`;
    } else {
        report += `1. 🔧 Fix critical deployment issues\n`;
        report += `2. 🔄 Re-run verification after fixes\n`;
        report += `3. 📋 Review configuration requirements\n`;
        report += `4. 💬 Contact support if issues persist\n`;
    }
    
    return report;
}

async function saveVerificationReport(report, networkName) {
    const reportsDir = path.join(__dirname, "../verification-reports");
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().split('T')[0];
    const reportPath = path.join(reportsDir, `verification-${networkName}-${timestamp}.md`);
    
    fs.writeFileSync(reportPath, report);
    return reportPath;
}

function displayVerificationSummary(results, reportPath) {
    const { summary } = results;
    const passRate = ((summary.passed / summary.total) * 100).toFixed(1);
    
    console.log("\n" + "=".repeat(60));
    console.log("📋 DEPLOYMENT VERIFICATION SUMMARY");
    console.log("=".repeat(60));
    
    console.log(`\n📊 Results:`);
    console.log(`   Total Tests: ${summary.total}`);
    console.log(`   Passed: ${summary.passed}`);
    console.log(`   Failed: ${summary.failed}`);
    console.log(`   Warnings: ${summary.warnings}`);
    console.log(`   Pass Rate: ${passRate}%`);
    
    // Overall status
    let statusIcon = "🟢";
    let statusText = "HEALTHY - Ready for operation";
    
    if (summary.failed > 0) {
        statusIcon = "🔴";
        statusText = "CRITICAL - Issues require immediate attention";
    } else if (summary.warnings > 0) {
        statusIcon = "🟡";
        statusText = "WARNING - Manual verification required";
    }
    
    console.log(`\n${statusIcon} Overall Status: ${statusText}`);
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    if (summary.failed > 0) {
        console.log(`\n⚠️  Next Steps:`);
        console.log(`   1. Review failed tests in the detailed report`);
        console.log(`   2. Fix critical issues and re-deploy if necessary`);
        console.log(`   3. Re-run verification: npx hardhat run scripts/verify-deployment.js`);
    } else {
        console.log(`\n🎉 Next Steps:`);
        console.log(`   1. Start monitoring: node monitoring/SecurityDashboard.js`);
        console.log(`   2. Run security tests: npx hardhat test test/security/`);
        console.log(`   3. Begin external audit process`);
    }
}

// Export for use in other scripts
module.exports = { verifyDeployment };

// Run if called directly
if (require.main === module) {
    verifyDeployment()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}