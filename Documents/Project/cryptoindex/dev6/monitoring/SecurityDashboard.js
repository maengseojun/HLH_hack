const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

/**
 * Real-time Security Monitoring Dashboard
 * Monitors all security metrics and provides alerts
 */
class SecurityDashboard {
    constructor(provider, contractAddresses) {
        this.provider = provider;
        this.contracts = {};
        this.metrics = {
            oracle: {
                priceUpdates: 0,
                manipulationAttempts: 0,
                failureCount: 0,
                lastUpdate: null,
                confidence: 0
            },
            liquidity: {
                vaultCount: 0,
                totalLiquidity: 0,
                emergencyActivations: 0,
                bankRunsPrevented: 0,
                activeRedemptions: 0
            },
            mev: {
                transactionsPrevented: 0,
                commitments: 0,
                reveals: 0,
                successRate: 0
            },
            security: {
                circuitBreakerTriggers: 0,
                emergencyPauses: 0,
                alertCount: 0,
                lastAlert: null
            }
        };
        
        this.alerts = [];
        this.alertCallbacks = [];
        
        this.initializeContracts(contractAddresses);
        this.setupEventListeners();
    }
    
    async initializeContracts(addresses) {
        try {
            // Initialize contract instances
            const contractABIs = await this.loadContractABIs();
            
            if (addresses.securityEnhancements) {
                this.contracts.securityEnhancements = new ethers.Contract(
                    addresses.securityEnhancements,
                    contractABIs.SecurityEnhancements,
                    this.provider
                );
            }
            
            if (addresses.oracleManager) {
                this.contracts.oracleManager = new ethers.Contract(
                    addresses.oracleManager,
                    contractABIs.EnhancedOracleManager,
                    this.provider
                );
            }
            
            if (addresses.liquidityProtection) {
                this.contracts.liquidityProtection = new ethers.Contract(
                    addresses.liquidityProtection,
                    contractABIs.LiquidityProtection,
                    this.provider
                );
            }
            
            console.log("✅ Security contracts initialized");
            
        } catch (error) {
            console.error("❌ Failed to initialize contracts:", error);
        }
    }
    
    async loadContractABIs() {
        // This would load the actual ABIs from artifacts
        // For now, we'll use minimal interfaces
        return {
            SecurityEnhancements: [
                "event CircuitBreakerTriggered(address indexed asset, uint256 priceDropPercent)",
                "event MEVAttackPrevented(address indexed user, bytes32 indexed commitHash)",
                "function paused() view returns (bool)",
                "function totalCircuitBreakerTriggers() view returns (uint256)"
            ],
            EnhancedOracleManager: [
                "event PriceUpdated(address indexed asset, uint256 price, uint256 confidence, uint256 sourceCount)",
                "event PriceManipulationDetected(address indexed asset, uint256 expectedPrice, uint256 reportedPrice)",
                "event OracleFailure(address indexed asset, address indexed oracle, string reason)",
                "function totalPriceUpdates() view returns (uint256)",
                "function totalManipulationAttempts() view returns (uint256)",
                "function totalOracleFailures() view returns (uint256)",
                "function getPrice(address asset) view returns (uint256 price, uint256 confidence, uint256 timestamp)"
            ],
            LiquidityProtection: [
                "event BankRunDetected(address indexed vault, uint256 redemptionPressure)",
                "event EmergencyProtocolActivated(address indexed vault, uint256 liquidityRatio)",
                "event GradualRedemptionQueued(address indexed user, address indexed vault, uint256 amount, bytes32 queueId)",
                "function totalEmergencyActivations() view returns (uint256)",
                "function totalBankRunsPrevented() view returns (uint256)",
                "function getActiveRedemptionCount() view returns (uint256)"
            ]
        };
    }
    
    setupEventListeners() {
        // Oracle events
        if (this.contracts.oracleManager) {
            this.contracts.oracleManager.on("PriceUpdated", (asset, price, confidence, sourceCount, event) => {
                this.handlePriceUpdate(asset, price, confidence, sourceCount, event);
            });
            
            this.contracts.oracleManager.on("PriceManipulationDetected", (asset, expectedPrice, reportedPrice, event) => {
                this.handleManipulationDetection(asset, expectedPrice, reportedPrice, event);
            });
            
            this.contracts.oracleManager.on("OracleFailure", (asset, oracle, reason, event) => {
                this.handleOracleFailure(asset, oracle, reason, event);
            });
        }
        
        // Liquidity events
        if (this.contracts.liquidityProtection) {
            this.contracts.liquidityProtection.on("BankRunDetected", (vault, redemptionPressure, event) => {
                this.handleBankRunDetection(vault, redemptionPressure, event);
            });
            
            this.contracts.liquidityProtection.on("EmergencyProtocolActivated", (vault, liquidityRatio, event) => {
                this.handleEmergencyActivation(vault, liquidityRatio, event);
            });
            
            this.contracts.liquidityProtection.on("GradualRedemptionQueued", (user, vault, amount, queueId, event) => {
                this.handleRedemptionQueued(user, vault, amount, queueId, event);
            });
        }
        
        // Security events
        if (this.contracts.securityEnhancements) {
            this.contracts.securityEnhancements.on("CircuitBreakerTriggered", (asset, priceDropPercent, event) => {
                this.handleCircuitBreakerTrigger(asset, priceDropPercent, event);
            });
            
            this.contracts.securityEnhancements.on("MEVAttackPrevented", (user, commitHash, event) => {
                this.handleMEVPrevention(user, commitHash, event);
            });
        }
        
        console.log("📡 Event listeners configured");
    }
    
    // Event Handlers
    
    handlePriceUpdate(asset, price, confidence, sourceCount, event) {
        this.metrics.oracle.priceUpdates++;
        this.metrics.oracle.lastUpdate = new Date();
        this.metrics.oracle.confidence = confidence;
        
        console.log(`📈 Price updated for ${asset}: ${ethers.utils.formatEther(price)} (${confidence/100}% confidence)`);
        
        // Check for low confidence
        if (confidence < 7000) { // Less than 70%
            this.createAlert("LOW_CONFIDENCE", "Oracle confidence below threshold", {
                asset,
                confidence: confidence / 100,
                threshold: 70
            });
        }
    }
    
    handleManipulationDetection(asset, expectedPrice, reportedPrice, event) {
        this.metrics.oracle.manipulationAttempts++;
        
        const deviation = Math.abs(
            (parseFloat(ethers.utils.formatEther(reportedPrice)) - parseFloat(ethers.utils.formatEther(expectedPrice))) 
            / parseFloat(ethers.utils.formatEther(expectedPrice))
        ) * 100;
        
        this.createAlert("MANIPULATION_DETECTED", "Oracle manipulation attempt detected", {
            asset,
            expectedPrice: ethers.utils.formatEther(expectedPrice),
            reportedPrice: ethers.utils.formatEther(reportedPrice),
            deviation: deviation.toFixed(2)
        }, "CRITICAL");
        
        console.log(`🚨 Oracle manipulation detected for ${asset}: ${deviation.toFixed(2)}% deviation`);
    }
    
    handleOracleFailure(asset, oracle, reason, event) {
        this.metrics.oracle.failureCount++;
        
        this.createAlert("ORACLE_FAILURE", "Oracle source failed", {
            asset,
            oracle,
            reason
        }, "HIGH");
        
        console.log(`⚠️  Oracle failure: ${oracle} for asset ${asset} - ${reason}`);
    }
    
    handleBankRunDetection(vault, redemptionPressure, event) {
        this.metrics.liquidity.bankRunsPrevented++;
        
        const pressurePercent = parseFloat(ethers.utils.formatUnits(redemptionPressure, 2)); // basis points to percent
        
        this.createAlert("BANK_RUN_DETECTED", "Bank run scenario detected", {
            vault,
            redemptionPressure: pressurePercent,
            threshold: 30
        }, "CRITICAL");
        
        console.log(`🚨 Bank run detected for vault ${vault}: ${pressurePercent}% redemption pressure`);
    }
    
    handleEmergencyActivation(vault, liquidityRatio, event) {
        this.metrics.liquidity.emergencyActivations++;
        
        const ratioPercent = parseFloat(ethers.utils.formatUnits(liquidityRatio, 2));
        
        this.createAlert("EMERGENCY_PROTOCOL", "Emergency protocol activated", {
            vault,
            liquidityRatio: ratioPercent,
            threshold: 8
        }, "CRITICAL");
        
        console.log(`🚨 Emergency protocol activated for vault ${vault}: ${ratioPercent}% liquidity ratio`);
    }
    
    handleRedemptionQueued(user, vault, amount, queueId, event) {
        this.metrics.liquidity.activeRedemptions++;
        
        console.log(`📋 Redemption queued: ${ethers.utils.formatEther(amount)} from ${vault}`);
    }
    
    handleCircuitBreakerTrigger(asset, priceDropPercent, event) {
        this.metrics.security.circuitBreakerTriggers++;
        
        const dropPercent = parseFloat(ethers.utils.formatUnits(priceDropPercent, 2));
        
        this.createAlert("CIRCUIT_BREAKER", "Circuit breaker triggered", {
            asset,
            priceDropPercent: dropPercent
        }, "HIGH");
        
        console.log(`🛑 Circuit breaker triggered for ${asset}: ${dropPercent}% price drop`);
    }
    
    handleMEVPrevention(user, commitHash, event) {
        this.metrics.mev.transactionsPrevented++;
        
        console.log(`🛡️  MEV attack prevented for user ${user}`);
    }
    
    // Alert Management
    
    createAlert(type, message, data = {}, severity = "MEDIUM") {
        const alert = {
            id: this.generateAlertId(),
            type,
            message,
            data,
            severity,
            timestamp: new Date(),
            resolved: false
        };
        
        this.alerts.unshift(alert); // Add to beginning
        this.metrics.security.alertCount++;
        this.metrics.security.lastAlert = new Date();
        
        // Keep only last 100 alerts
        if (this.alerts.length > 100) {
            this.alerts = this.alerts.slice(0, 100);
        }
        
        // Notify callbacks
        this.alertCallbacks.forEach(callback => {
            try {
                callback(alert);
            } catch (error) {
                console.error("Alert callback error:", error);
            }
        });
        
        // Auto-save alerts
        this.saveAlerts();
        
        return alert;
    }
    
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    onAlert(callback) {
        this.alertCallbacks.push(callback);
    }
    
    // Data Collection and Analysis
    
    async updateMetrics() {
        try {
            // Update oracle metrics
            if (this.contracts.oracleManager) {
                this.metrics.oracle.priceUpdates = parseInt(
                    (await this.contracts.oracleManager.totalPriceUpdates()).toString()
                );
                this.metrics.oracle.manipulationAttempts = parseInt(
                    (await this.contracts.oracleManager.totalManipulationAttempts()).toString()
                );
                this.metrics.oracle.failureCount = parseInt(
                    (await this.contracts.oracleManager.totalOracleFailures()).toString()
                );
            }
            
            // Update liquidity metrics
            if (this.contracts.liquidityProtection) {
                this.metrics.liquidity.emergencyActivations = parseInt(
                    (await this.contracts.liquidityProtection.totalEmergencyActivations()).toString()
                );
                this.metrics.liquidity.bankRunsPrevented = parseInt(
                    (await this.contracts.liquidityProtection.totalBankRunsPrevented()).toString()
                );
                this.metrics.liquidity.activeRedemptions = parseInt(
                    (await this.contracts.liquidityProtection.getActiveRedemptionCount()).toString()
                );
            }
            
            // Update security metrics
            if (this.contracts.securityEnhancements) {
                this.metrics.security.circuitBreakerTriggers = parseInt(
                    (await this.contracts.securityEnhancements.totalCircuitBreakerTriggers()).toString()
                );
            }
            
        } catch (error) {
            console.error("Error updating metrics:", error);
        }
    }
    
    // Health Assessment
    
    getSystemHealth() {
        const health = {
            overall: "HEALTHY",
            score: 100,
            issues: []
        };
        
        // Check oracle health
        if (this.metrics.oracle.manipulationAttempts > 0) {
            health.score -= 20;
            health.issues.push("Oracle manipulation detected");
        }
        
        if (this.metrics.oracle.confidence < 7000) {
            health.score -= 15;
            health.issues.push("Low oracle confidence");
        }
        
        // Check liquidity health
        if (this.metrics.liquidity.emergencyActivations > 0) {
            health.score -= 30;
            health.issues.push("Emergency protocols active");
        }
        
        if (this.metrics.liquidity.bankRunsPrevented > 0) {
            health.score -= 25;
            health.issues.push("Bank run scenarios detected");
        }
        
        // Check security health
        if (this.metrics.security.circuitBreakerTriggers > 0) {
            health.score -= 20;
            health.issues.push("Circuit breakers triggered");
        }
        
        // Determine overall status
        if (health.score >= 90) health.overall = "HEALTHY";
        else if (health.score >= 70) health.overall = "WARNING";
        else if (health.score >= 50) health.overall = "DEGRADED";
        else health.overall = "CRITICAL";
        
        return health;
    }
    
    // Reporting and Export
    
    generateReport() {
        const health = this.getSystemHealth();
        const recentAlerts = this.alerts.slice(0, 10);
        
        return {
            timestamp: new Date(),
            health,
            metrics: this.metrics,
            recentAlerts,
            recommendations: this.generateRecommendations()
        };
    }
    
    generateRecommendations() {
        const recommendations = [];
        
        if (this.metrics.oracle.manipulationAttempts > 0) {
            recommendations.push({
                priority: "HIGH",
                title: "Review Oracle Configuration",
                description: "Multiple manipulation attempts detected. Consider adding more oracle sources or adjusting deviation thresholds."
            });
        }
        
        if (this.metrics.liquidity.emergencyActivations > 0) {
            recommendations.push({
                priority: "CRITICAL",
                title: "Address Liquidity Issues",
                description: "Emergency protocols have been activated. Inject liquidity or review redemption limits."
            });
        }
        
        if (this.metrics.oracle.failureCount > 5) {
            recommendations.push({
                priority: "MEDIUM",
                title: "Oracle Reliability Review",
                description: "High oracle failure count. Review oracle source reliability and consider replacements."
            });
        }
        
        return recommendations;
    }
    
    saveMetrics() {
        const metricsDir = path.join(__dirname, "metrics");
        if (!fs.existsSync(metricsDir)) {
            fs.mkdirSync(metricsDir, { recursive: true });
        }
        
        const filename = `metrics-${new Date().toISOString().split('T')[0]}.json`;
        const filepath = path.join(metricsDir, filename);
        
        fs.writeFileSync(filepath, JSON.stringify({
            timestamp: new Date(),
            metrics: this.metrics,
            health: this.getSystemHealth()
        }, null, 2));
    }
    
    saveAlerts() {
        const alertsDir = path.join(__dirname, "alerts");
        if (!fs.existsSync(alertsDir)) {
            fs.mkdirSync(alertsDir, { recursive: true });
        }
        
        const filename = `alerts-${new Date().toISOString().split('T')[0]}.json`;
        const filepath = path.join(alertsDir, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(this.alerts, null, 2));
    }
    
    // Cleanup
    
    stop() {
        // Remove all event listeners
        if (this.contracts.oracleManager) {
            this.contracts.oracleManager.removeAllListeners();
        }
        if (this.contracts.liquidityProtection) {
            this.contracts.liquidityProtection.removeAllListeners();
        }
        if (this.contracts.securityEnhancements) {
            this.contracts.securityEnhancements.removeAllListeners();
        }
        
        console.log("🛑 Security monitoring stopped");
    }
}

// CLI Interface
async function startMonitoring() {
    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL || "http://localhost:8545");
    
    // Load contract addresses from deployment file
    const deploymentPath = path.join(__dirname, "../deployments");
    let contractAddresses = {};
    
    try {
        const files = fs.readdirSync(deploymentPath);
        const latestDeployment = files
            .filter(file => file.startsWith("security-suite-"))
            .sort()
            .pop();
        
        if (latestDeployment) {
            const deploymentData = JSON.parse(
                fs.readFileSync(path.join(deploymentPath, latestDeployment), 'utf8')
            );
            contractAddresses = deploymentData.contracts;
        }
    } catch (error) {
        console.warn("⚠️  Could not load deployment addresses, using environment variables");
        contractAddresses = {
            securityEnhancements: process.env.SECURITY_ENHANCEMENTS_ADDRESS,
            oracleManager: process.env.ORACLE_MANAGER_ADDRESS,
            liquidityProtection: process.env.LIQUIDITY_PROTECTION_ADDRESS
        };
    }
    
    const dashboard = new SecurityDashboard(provider, contractAddresses);
    
    // Setup alert notifications
    dashboard.onAlert((alert) => {
        console.log(`\n🚨 SECURITY ALERT [${alert.severity}]:`);
        console.log(`   Type: ${alert.type}`);
        console.log(`   Message: ${alert.message}`);
        console.log(`   Time: ${alert.timestamp}`);
        console.log(`   Data:`, alert.data);
        
        // Here you could send notifications via email, Slack, Discord, etc.
    });
    
    // Periodic metric updates
    setInterval(async () => {
        await dashboard.updateMetrics();
        dashboard.saveMetrics();
        
        const health = dashboard.getSystemHealth();
        console.log(`\n📊 System Health: ${health.overall} (${health.score}/100)`);
        
        if (health.issues.length > 0) {
            console.log("   Issues:", health.issues.join(", "));
        }
        
    }, 30000); // Every 30 seconds
    
    // Generate daily reports
    setInterval(() => {
        const report = dashboard.generateReport();
        console.log("\n📈 Daily Security Report Generated");
        console.log("   Metrics saved to ./monitoring/metrics/");
        console.log("   Alerts saved to ./monitoring/alerts/");
    }, 86400000); // Every 24 hours
    
    console.log("🚀 Security monitoring dashboard started");
    console.log("📊 Monitoring contracts:", Object.keys(contractAddresses).join(", "));
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log("\n🛑 Shutting down security monitoring...");
        dashboard.stop();
        process.exit(0);
    });
    
    return dashboard;
}

// Export for library use
module.exports = { SecurityDashboard, startMonitoring };

// Run CLI if executed directly
if (require.main === module) {
    startMonitoring().catch(console.error);
}