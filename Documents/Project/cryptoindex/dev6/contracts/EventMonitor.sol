// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title EventMonitor
 * @dev Central event monitoring and alerting system for HyperIndex ecosystem
 * @notice Monitors critical events and triggers alerts for Discord/Webhook notifications
 */
contract EventMonitor is AccessControl, Pausable {
    
    bytes32 public constant MONITOR_ROLE = keccak256("MONITOR_ROLE");
    bytes32 public constant ALERT_MANAGER_ROLE = keccak256("ALERT_MANAGER_ROLE");
    
    // Alert severity levels
    enum AlertSeverity {
        INFO,
        WARNING,
        CRITICAL,
        EMERGENCY
    }
    
    // Alert types
    enum AlertType {
        VAULT_CREATED,
        VAULT_PAUSED,
        REBALANCE_EXECUTED,
        REBALANCE_FAILED,
        CROSS_CHAIN_MESSAGE,
        FEE_COLLECTED,
        KEEPER_UPKEEP,
        EMERGENCY_ACTION,
        SYSTEM_ERROR
    }
    
    struct Alert {
        uint256 id;
        AlertType alertType;
        AlertSeverity severity;
        address source;
        string message;
        bytes data;
        uint256 timestamp;
        bool acknowledged;
    }
    
    struct AlertRule {
        AlertType alertType;
        AlertSeverity minSeverity;
        bool isActive;
        uint256 cooldownPeriod;
        uint256 lastTriggered;
        string webhookUrl;
        bool enableDiscord;
        bool enableEmail;
    }
    
    // Alert storage
    mapping(uint256 => Alert) public alerts;
    mapping(AlertType => AlertRule) public alertRules;
    mapping(address => bool) public authorizedSources;
    
    uint256 public nextAlertId = 1;
    uint256 public constant MAX_ALERTS = 10000; // Maximum alerts to store
    
    // Discord webhook configuration
    string public discordWebhookUrl;
    bool public discordEnabled = false;
    
    // Email configuration
    string public emailWebhookUrl;
    bool public emailEnabled = false;
    
    // Events
    event AlertTriggered(
        uint256 indexed alertId,
        AlertType indexed alertType,
        AlertSeverity indexed severity,
        address source,
        string message
    );
    
    event AlertAcknowledged(
        uint256 indexed alertId,
        address indexed acknowledgedBy,
        uint256 timestamp
    );
    
    event AlertRuleUpdated(
        AlertType indexed alertType,
        AlertSeverity minSeverity,
        bool isActive,
        uint256 cooldownPeriod
    );
    
    event SourceAuthorized(address indexed source, bool authorized);
    
    event NotificationSent(
        uint256 indexed alertId,
        string notificationType,
        bool success
    );
    
    event ConfigurationUpdated(
        string configType,
        string value,
        bool enabled
    );
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MONITOR_ROLE, msg.sender);
        _grantRole(ALERT_MANAGER_ROLE, msg.sender);
        
        // Initialize default alert rules
        _initializeDefaultAlertRules();
    }
    
    /**
     * @dev Initialize default alert rules
     */
    function _initializeDefaultAlertRules() internal {
        // Vault events
        alertRules[AlertType.VAULT_CREATED] = AlertRule({
            alertType: AlertType.VAULT_CREATED,
            minSeverity: AlertSeverity.INFO,
            isActive: true,
            cooldownPeriod: 0,
            lastTriggered: 0,
            webhookUrl: "",
            enableDiscord: true,
            enableEmail: false
        });
        
        alertRules[AlertType.VAULT_PAUSED] = AlertRule({
            alertType: AlertType.VAULT_PAUSED,
            minSeverity: AlertSeverity.WARNING,
            isActive: true,
            cooldownPeriod: 300, // 5 minutes
            lastTriggered: 0,
            webhookUrl: "",
            enableDiscord: true,
            enableEmail: true
        });
        
        // Rebalancing events
        alertRules[AlertType.REBALANCE_EXECUTED] = AlertRule({
            alertType: AlertType.REBALANCE_EXECUTED,
            minSeverity: AlertSeverity.INFO,
            isActive: true,
            cooldownPeriod: 60, // 1 minute
            lastTriggered: 0,
            webhookUrl: "",
            enableDiscord: true,
            enableEmail: false
        });
        
        alertRules[AlertType.REBALANCE_FAILED] = AlertRule({
            alertType: AlertType.REBALANCE_FAILED,
            minSeverity: AlertSeverity.CRITICAL,
            isActive: true,
            cooldownPeriod: 0,
            lastTriggered: 0,
            webhookUrl: "",
            enableDiscord: true,
            enableEmail: true
        });
        
        // Cross-chain events
        alertRules[AlertType.CROSS_CHAIN_MESSAGE] = AlertRule({
            alertType: AlertType.CROSS_CHAIN_MESSAGE,
            minSeverity: AlertSeverity.INFO,
            isActive: true,
            cooldownPeriod: 30, // 30 seconds
            lastTriggered: 0,
            webhookUrl: "",
            enableDiscord: false,
            enableEmail: false
        });
        
        // Fee events
        alertRules[AlertType.FEE_COLLECTED] = AlertRule({
            alertType: AlertType.FEE_COLLECTED,
            minSeverity: AlertSeverity.INFO,
            isActive: true,
            cooldownPeriod: 3600, // 1 hour
            lastTriggered: 0,
            webhookUrl: "",
            enableDiscord: true,
            enableEmail: false
        });
        
        // Emergency events
        alertRules[AlertType.EMERGENCY_ACTION] = AlertRule({
            alertType: AlertType.EMERGENCY_ACTION,
            minSeverity: AlertSeverity.EMERGENCY,
            isActive: true,
            cooldownPeriod: 0,
            lastTriggered: 0,
            webhookUrl: "",
            enableDiscord: true,
            enableEmail: true
        });
    }
    
    /**
     * @dev Trigger an alert
     * @param alertType Type of alert
     * @param severity Alert severity
     * @param message Alert message
     * @param data Additional data
     */
    function triggerAlert(
        AlertType alertType,
        AlertSeverity severity,
        string calldata message,
        bytes calldata data
    ) external whenNotPaused {
        require(authorizedSources[msg.sender], "EventMonitor: unauthorized source");
        
        AlertRule storage rule = alertRules[alertType];
        
        // Check if alert rule is active
        if (!rule.isActive) {
            return;
        }
        
        // Check minimum severity
        if (severity < rule.minSeverity) {
            return;
        }
        
        // Check cooldown period
        if (rule.cooldownPeriod > 0 && 
            block.timestamp < rule.lastTriggered + rule.cooldownPeriod) {
            return;
        }
        
        // Create alert
        uint256 alertId = nextAlertId++;
        
        alerts[alertId] = Alert({
            id: alertId,
            alertType: alertType,
            severity: severity,
            source: msg.sender,
            message: message,
            data: data,
            timestamp: block.timestamp,
            acknowledged: false
        });
        
        // Update rule trigger time
        rule.lastTriggered = block.timestamp;
        
        // Clean up old alerts if needed
        if (nextAlertId > MAX_ALERTS) {
            _cleanupOldAlerts();
        }
        
        // Send notifications
        _sendNotifications(alertId, rule);
        
        emit AlertTriggered(alertId, alertType, severity, msg.sender, message);
    }
    
    /**
     * @dev Send notifications for an alert
     * @param alertId Alert ID
     * @param rule Alert rule
     */
    function _sendNotifications(uint256 alertId, AlertRule storage rule) internal {
        Alert storage alert = alerts[alertId];
        
        // Send Discord notification
        if (rule.enableDiscord && discordEnabled && bytes(discordWebhookUrl).length > 0) {
            bool success = _sendDiscordNotification(alert);
            emit NotificationSent(alertId, "discord", success);
        }
        
        // Send email notification
        if (rule.enableEmail && emailEnabled && bytes(emailWebhookUrl).length > 0) {
            bool success = _sendEmailNotification(alert);
            emit NotificationSent(alertId, "email", success);
        }
        
        // Send to custom webhook if specified
        if (bytes(rule.webhookUrl).length > 0) {
            bool success = _sendWebhookNotification(alert, rule.webhookUrl);
            emit NotificationSent(alertId, "webhook", success);
        }
    }
    
    /**
     * @dev Send Discord notification (placeholder)
     * @param alert Alert to send
     * @return success Whether notification was sent successfully
     */
    function _sendDiscordNotification(Alert memory alert) internal pure returns (bool success) {
        // In a real implementation, this would make an HTTP call to Discord webhook
        // For now, we'll just return true to indicate the notification was "sent"
        return true;
    }
    
    /**
     * @dev Send email notification (placeholder)
     * @param alert Alert to send
     * @return success Whether notification was sent successfully
     */
    function _sendEmailNotification(Alert memory alert) internal pure returns (bool success) {
        // In a real implementation, this would make an HTTP call to email service
        // For now, we'll just return true to indicate the notification was "sent"
        return true;
    }
    
    /**
     * @dev Send webhook notification (placeholder)
     * @param alert Alert to send
     * @param webhookUrl Webhook URL
     * @return success Whether notification was sent successfully
     */
    function _sendWebhookNotification(Alert memory alert, string memory webhookUrl) 
        internal 
        pure 
        returns (bool success) 
    {
        // In a real implementation, this would make an HTTP call to the webhook
        // For now, we'll just return true to indicate the notification was "sent"
        return true;
    }
    
    /**
     * @dev Acknowledge an alert
     * @param alertId Alert ID to acknowledge
     */
    function acknowledgeAlert(uint256 alertId) external onlyRole(ALERT_MANAGER_ROLE) {
        require(alertId < nextAlertId, "EventMonitor: invalid alert ID");
        require(!alerts[alertId].acknowledged, "EventMonitor: alert already acknowledged");
        
        alerts[alertId].acknowledged = true;
        
        emit AlertAcknowledged(alertId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Batch acknowledge multiple alerts
     * @param alertIds Array of alert IDs to acknowledge
     */
    function batchAcknowledgeAlerts(uint256[] calldata alertIds) 
        external 
        onlyRole(ALERT_MANAGER_ROLE) 
    {
        for (uint256 i = 0; i < alertIds.length; i++) {
            uint256 alertId = alertIds[i];
            if (alertId < nextAlertId && !alerts[alertId].acknowledged) {
                alerts[alertId].acknowledged = true;
                emit AlertAcknowledged(alertId, msg.sender, block.timestamp);
            }
        }
    }
    
    /**
     * @dev Update alert rule
     * @param alertType Alert type to update
     * @param minSeverity Minimum severity
     * @param isActive Whether rule is active
     * @param cooldownPeriod Cooldown period in seconds
     * @param webhookUrl Custom webhook URL
     * @param enableDiscord Enable Discord notifications
     * @param enableEmail Enable email notifications
     */
    function updateAlertRule(
        AlertType alertType,
        AlertSeverity minSeverity,
        bool isActive,
        uint256 cooldownPeriod,
        string calldata webhookUrl,
        bool enableDiscord,
        bool enableEmail
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        AlertRule storage rule = alertRules[alertType];
        
        rule.minSeverity = minSeverity;
        rule.isActive = isActive;
        rule.cooldownPeriod = cooldownPeriod;
        rule.webhookUrl = webhookUrl;
        rule.enableDiscord = enableDiscord;
        rule.enableEmail = enableEmail;
        
        emit AlertRuleUpdated(alertType, minSeverity, isActive, cooldownPeriod);
    }
    
    /**
     * @dev Authorize/deauthorize alert source
     * @param source Source address
     * @param authorized Whether to authorize
     */
    function authorizeSource(address source, bool authorized) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(source != address(0), "EventMonitor: invalid source");
        
        authorizedSources[source] = authorized;
        emit SourceAuthorized(source, authorized);
    }
    
    /**
     * @dev Configure Discord webhook
     * @param webhookUrl Discord webhook URL
     * @param enabled Whether Discord notifications are enabled
     */
    function configureDiscord(string calldata webhookUrl, bool enabled) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        discordWebhookUrl = webhookUrl;
        discordEnabled = enabled;
        
        emit ConfigurationUpdated("discord", webhookUrl, enabled);
    }
    
    /**
     * @dev Configure email webhook
     * @param webhookUrl Email webhook URL
     * @param enabled Whether email notifications are enabled
     */
    function configureEmail(string calldata webhookUrl, bool enabled) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        emailWebhookUrl = webhookUrl;
        emailEnabled = enabled;
        
        emit ConfigurationUpdated("email", webhookUrl, enabled);
    }
    
    /**
     * @dev Get alert by ID
     * @param alertId Alert ID
     * @return alert Alert struct
     */
    function getAlert(uint256 alertId) external view returns (Alert memory alert) {
        require(alertId < nextAlertId, "EventMonitor: invalid alert ID");
        return alerts[alertId];
    }
    
    /**
     * @dev Get recent alerts
     * @param limit Maximum number of alerts to return
     * @return recentAlerts Array of recent alerts
     */
    function getRecentAlerts(uint256 limit) 
        external 
        view 
        returns (Alert[] memory recentAlerts) 
    {
        uint256 startId = nextAlertId > limit ? nextAlertId - limit : 1;
        uint256 count = nextAlertId - startId;
        
        recentAlerts = new Alert[](count);
        
        for (uint256 i = 0; i < count; i++) {
            recentAlerts[i] = alerts[startId + i];
        }
    }
    
    /**
     * @dev Get unacknowledged alerts
     * @param limit Maximum number of alerts to return
     * @return unackedAlerts Array of unacknowledged alerts
     */
    function getUnacknowledgedAlerts(uint256 limit) 
        external 
        view 
        returns (Alert[] memory unackedAlerts) 
    {
        // Count unacknowledged alerts
        uint256 count = 0;
        for (uint256 i = 1; i < nextAlertId && count < limit; i++) {
            if (!alerts[i].acknowledged) {
                count++;
            }
        }
        
        unackedAlerts = new Alert[](count);
        uint256 index = 0;
        
        for (uint256 i = 1; i < nextAlertId && index < count; i++) {
            if (!alerts[i].acknowledged) {
                unackedAlerts[index] = alerts[i];
                index++;
            }
        }
    }
    
    /**
     * @dev Clean up old alerts to prevent storage bloat
     */
    function _cleanupOldAlerts() internal {
        // Remove oldest 1000 alerts
        for (uint256 i = 1; i <= 1000; i++) {
            delete alerts[i];
        }
        
        // Shift remaining alerts down
        for (uint256 i = 1001; i < nextAlertId; i++) {
            alerts[i - 1000] = alerts[i];
            delete alerts[i];
        }
        
        nextAlertId -= 1000;
    }
    
    /**
     * @dev Get monitoring statistics
     * @return totalAlerts Total alerts generated
     * @return unacknowledgedCount Number of unacknowledged alerts
     * @return criticalCount Number of critical/emergency alerts in last 24h
     * @return lastAlertTime Timestamp of last alert
     */
    function getMonitoringStats() external view returns (
        uint256 totalAlerts,
        uint256 unacknowledgedCount,
        uint256 criticalCount,
        uint256 lastAlertTime
    ) {
        totalAlerts = nextAlertId - 1;
        
        uint256 oneDayAgo = block.timestamp - 86400; // 24 hours
        
        for (uint256 i = 1; i < nextAlertId; i++) {
            Alert storage alert = alerts[i];
            
            if (!alert.acknowledged) {
                unacknowledgedCount++;
            }
            
            if (alert.timestamp > oneDayAgo && 
                (alert.severity == AlertSeverity.CRITICAL || alert.severity == AlertSeverity.EMERGENCY)) {
                criticalCount++;
            }
            
            if (alert.timestamp > lastAlertTime) {
                lastAlertTime = alert.timestamp;
            }
        }
    }
    
    /**
     * @dev Emergency pause function
     */
    function emergencyPause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Emergency unpause function
     */
    function emergencyUnpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}