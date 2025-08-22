// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IPriceFeed.sol";

/**
 * @title SecurityManager
 * @dev Advanced security system with circuit breakers, anomaly detection, and emergency controls
 * @notice Monitors and protects the HyperIndex ecosystem from various attack vectors
 */
contract SecurityManager is AccessControl, ReentrancyGuard, Pausable {
    
    bytes32 public constant SECURITY_ADMIN_ROLE = keccak256("SECURITY_ADMIN_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant MONITOR_ROLE = keccak256("MONITOR_ROLE");
    
    // Circuit breaker thresholds
    uint256 public constant MAX_SINGLE_TRANSACTION = 1000000e18; // 1M tokens
    uint256 public constant MAX_HOURLY_VOLUME = 10000000e18; // 10M tokens per hour
    uint256 public constant MAX_DAILY_VOLUME = 100000000e18; // 100M tokens per day
    uint256 public constant PRICE_DEVIATION_THRESHOLD = 1000; // 10% price deviation
    uint256 public constant VELOCITY_THRESHOLD = 5000; // 50% velocity increase
    
    // Security states
    mapping(address => bool) public blacklistedAddresses;
    mapping(address => uint256) public userTransactionCount;
    mapping(address => uint256) public userVolumeToday;
    mapping(address => uint256) public lastTransactionTime;
    mapping(bytes32 => SecurityEvent) public securityEvents;
    mapping(address => VaultSecurityProfile) public vaultProfiles;
    
    // Time-based volume tracking
    mapping(uint256 => uint256) public hourlyVolume; // hour => volume
    mapping(uint256 => uint256) public dailyVolume; // day => volume
    
    // Price monitoring
    IPriceFeed public priceFeed;
    mapping(address => uint256) public lastRecordedPrices;
    mapping(address => uint256) public priceUpdateTimes;
    
    uint256 private securityEventCounter;
    uint256 public emergencyTimeout = 24 hours;
    bool public globalEmergencyMode = false;
    
    struct SecurityEvent {
        uint256 id;
        EventType eventType;
        address target;
        uint256 value;
        uint256 timestamp;
        string description;
        bool resolved;
    }
    
    struct VaultSecurityProfile {
        uint256 riskScore; // 0-100
        uint256 maxDailyVolume;
        uint256 maxTransactionSize;
        bool highRiskMode;
        uint256 suspiciousActivityCount;
        uint256 lastSecurityCheck;
    }
    
    enum EventType {
        LARGE_TRANSACTION,
        UNUSUAL_VELOCITY,
        PRICE_MANIPULATION,
        FLASHLOAN_ATTACK,
        REENTRANCY_ATTEMPT,
        BLACKLIST_TRIGGER,
        EMERGENCY_STOP
    }
    
    enum SecurityLevel {
        LOW,
        MEDIUM,
        HIGH,
        CRITICAL
    }
    
    // Events
    event SecurityEventTriggered(
        uint256 indexed eventId,
        EventType indexed eventType,
        address indexed target,
        uint256 value,
        string description
    );
    
    event CircuitBreakerTriggered(
        address indexed target,
        string reason,
        uint256 blockTime
    );
    
    event EmergencyModeActivated(
        address indexed activator,
        string reason,
        uint256 timestamp
    );
    
    event AddressBlacklisted(
        address indexed target,
        string reason,
        uint256 timestamp
    );
    
    event VaultSecurityProfileUpdated(
        address indexed vault,
        uint256 oldRiskScore,
        uint256 newRiskScore
    );
    
    constructor(address _priceFeed) {
        require(_priceFeed != address(0), "Invalid price feed");
        
        priceFeed = IPriceFeed(_priceFeed);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SECURITY_ADMIN_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        _grantRole(MONITOR_ROLE, msg.sender);
    }
    
    /**
     * @dev Pre-transaction security check
     * @param user User address
     * @param target Target contract
     * @param amount Transaction amount
     * @param operation Operation type
     * @return allowed Whether transaction is allowed
     * @return reason Reason if not allowed
     */
    function preTransactionCheck(
        address user,
        address target,
        uint256 amount,
        string memory operation
    ) external onlyRole(MONITOR_ROLE) returns (bool allowed, string memory reason) {
        // Check if globally paused
        if (paused() || globalEmergencyMode) {
            return (false, "System in emergency mode");
        }
        
        // Check blacklist
        if (blacklistedAddresses[user] || blacklistedAddresses[target]) {
            return (false, "Address blacklisted");
        }
        
        // Check circuit breakers
        if (!_checkCircuitBreakers(user, target, amount)) {
            return (false, "Circuit breaker triggered");
        }
        
        // Check for suspicious patterns
        if (_detectSuspiciousActivity(user, amount)) {
            _triggerSecurityEvent(
                EventType.UNUSUAL_VELOCITY,
                user,
                amount,
                "Suspicious transaction velocity detected"
            );
            return (false, "Suspicious activity detected");
        }
        
        // Check vault-specific limits
        VaultSecurityProfile memory profile = vaultProfiles[target];
        if (profile.maxTransactionSize > 0 && amount > profile.maxTransactionSize) {
            return (false, "Exceeds vault transaction limit");
        }
        
        // All checks passed
        return (true, "");
    }
    
    /**
     * @dev Post-transaction monitoring
     * @param user User address
     * @param target Target contract
     * @param amount Transaction amount
     * @param success Whether transaction succeeded
     */
    function postTransactionMonitor(
        address user,
        address target,
        uint256 amount,
        bool success
    ) external onlyRole(MONITOR_ROLE) {
        if (!success) return;
        
        // Update volume tracking
        _updateVolumeTracking(amount);
        
        // Update user metrics
        userTransactionCount[user]++;
        userVolumeToday[user] += amount;
        lastTransactionTime[user] = block.timestamp;
        
        // Update vault security profile
        _updateVaultSecurityProfile(target, amount);
        
        // Check for post-transaction anomalies
        _checkPostTransactionAnomalies(user, target, amount);
    }
    
    /**
     * @dev Monitor price movements for manipulation detection
     * @param token Token address
     * @param newPrice New price
     */
    function monitorPriceMovement(
        address token,
        uint256 newPrice
    ) external onlyRole(MONITOR_ROLE) {
        uint256 lastPrice = lastRecordedPrices[token];
        uint256 lastUpdate = priceUpdateTimes[token];
        
        if (lastPrice > 0 && block.timestamp - lastUpdate < 1 hours) {
            uint256 priceChange = newPrice > lastPrice ? 
                ((newPrice - lastPrice) * 10000) / lastPrice :
                ((lastPrice - newPrice) * 10000) / lastPrice;
            
            if (priceChange > PRICE_DEVIATION_THRESHOLD) {
                _triggerSecurityEvent(
                    EventType.PRICE_MANIPULATION,
                    token,
                    priceChange,
                    "Unusual price movement detected"
                );
                
                // Auto-pause high-risk operations
                if (priceChange > PRICE_DEVIATION_THRESHOLD * 2) {
                    _triggerCircuitBreaker(token, "Extreme price deviation");
                }
            }
        }
        
        lastRecordedPrices[token] = newPrice;
        priceUpdateTimes[token] = block.timestamp;
    }
    
    /**
     * @dev Detect potential flashloan attacks
     * @param user User address
     * @param borrowAmount Borrow amount
     * @param repayAmount Repay amount
     * @param duration Transaction duration
     */
    function detectFlashloanAttack(
        address user,
        uint256 borrowAmount,
        uint256 repayAmount,
        uint256 duration
    ) external onlyRole(MONITOR_ROLE) {
        // Suspicious if large amount borrowed and repaid in same block
        if (duration == 0 && borrowAmount > MAX_SINGLE_TRANSACTION / 10) {
            uint256 profit = repayAmount > borrowAmount ? repayAmount - borrowAmount : 0;
            
            if (profit > borrowAmount / 100) { // More than 1% profit
                _triggerSecurityEvent(
                    EventType.FLASHLOAN_ATTACK,
                    user,
                    profit,
                    "Potential flashloan attack detected"
                );
                
                // Immediate blacklist for suspected attack
                blacklistedAddresses[user] = true;
                emit AddressBlacklisted(user, "Flashloan attack", block.timestamp);
            }
        }
    }
    
    /**
     * @dev Emergency stop function
     * @param reason Reason for emergency stop
     */
    function emergencyStop(string memory reason) external onlyRole(EMERGENCY_ROLE) {
        globalEmergencyMode = true;
        _pause();
        
        _triggerSecurityEvent(
            EventType.EMERGENCY_STOP,
            msg.sender,
            0,
            reason
        );
        
        emit EmergencyModeActivated(msg.sender, reason, block.timestamp);
    }
    
    /**
     * @dev Resume operations after emergency
     */
    function resumeOperations() external onlyRole(SECURITY_ADMIN_ROLE) {
        require(globalEmergencyMode, "Not in emergency mode");
        
        globalEmergencyMode = false;
        _unpause();
    }
    
    /**
     * @dev Blacklist an address
     * @param target Address to blacklist
     * @param reason Reason for blacklisting
     */
    function blacklistAddress(
        address target,
        string memory reason
    ) external onlyRole(SECURITY_ADMIN_ROLE) {
        blacklistedAddresses[target] = true;
        emit AddressBlacklisted(target, reason, block.timestamp);
    }
    
    /**
     * @dev Remove address from blacklist
     * @param target Address to unblacklist
     */
    function unblacklistAddress(address target) external onlyRole(SECURITY_ADMIN_ROLE) {
        blacklistedAddresses[target] = false;
    }
    
    /**
     * @dev Update vault security profile
     * @param vault Vault address
     * @param maxDailyVolume Maximum daily volume
     * @param maxTransactionSize Maximum transaction size
     * @param riskScore Risk score (0-100)
     */
    function updateVaultSecurityProfile(
        address vault,
        uint256 maxDailyVolume,
        uint256 maxTransactionSize,
        uint256 riskScore
    ) external onlyRole(SECURITY_ADMIN_ROLE) {
        require(riskScore <= 100, "Invalid risk score");
        
        VaultSecurityProfile storage profile = vaultProfiles[vault];
        uint256 oldRiskScore = profile.riskScore;
        
        profile.maxDailyVolume = maxDailyVolume;
        profile.maxTransactionSize = maxTransactionSize;
        profile.riskScore = riskScore;
        profile.highRiskMode = riskScore >= 70;
        profile.lastSecurityCheck = block.timestamp;
        
        emit VaultSecurityProfileUpdated(vault, oldRiskScore, riskScore);
    }
    
    /**
     * @dev Internal function to check circuit breakers
     */
    function _checkCircuitBreakers(
        address user,
        address target,
        uint256 amount
    ) internal returns (bool) {
        // Check single transaction limit
        if (amount > MAX_SINGLE_TRANSACTION) {
            _triggerCircuitBreaker(target, "Single transaction limit exceeded");
            return false;
        }
        
        // Check hourly volume
        uint256 currentHour = block.timestamp / 1 hours;
        if (hourlyVolume[currentHour] + amount > MAX_HOURLY_VOLUME) {
            _triggerCircuitBreaker(target, "Hourly volume limit exceeded");
            return false;
        }
        
        // Check daily volume
        uint256 currentDay = block.timestamp / 1 days;
        if (dailyVolume[currentDay] + amount > MAX_DAILY_VOLUME) {
            _triggerCircuitBreaker(target, "Daily volume limit exceeded");
            return false;
        }
        
        // Check user-specific limits
        if (userVolumeToday[user] + amount > MAX_DAILY_VOLUME / 100) { // 1% of daily limit per user
            _triggerCircuitBreaker(user, "User daily limit exceeded");
            return false;
        }
        
        return true;
    }
    
    /**
     * @dev Detect suspicious activity patterns
     */
    function _detectSuspiciousActivity(address user, uint256 amount) internal view returns (bool) {
        // Check transaction velocity
        if (lastTransactionTime[user] > 0) {
            uint256 timeDiff = block.timestamp - lastTransactionTime[user];
            if (timeDiff < 60 && amount > MAX_SINGLE_TRANSACTION / 10) { // Large tx within 1 minute
                return true;
            }
        }
        
        // Check unusual volume spike
        uint256 avgVolume = userVolumeToday[user] / (userTransactionCount[user] + 1);
        if (amount > avgVolume * 10) { // 10x average volume
            return true;
        }
        
        return false;
    }
    
    /**
     * @dev Update volume tracking
     */
    function _updateVolumeTracking(uint256 amount) internal {
        uint256 currentHour = block.timestamp / 1 hours;
        uint256 currentDay = block.timestamp / 1 days;
        
        hourlyVolume[currentHour] += amount;
        dailyVolume[currentDay] += amount;
    }
    
    /**
     * @dev Update vault security profile based on activity
     */
    function _updateVaultSecurityProfile(address vault, uint256 amount) internal {
        VaultSecurityProfile storage profile = vaultProfiles[vault];
        
        // Increase risk score for large transactions
        if (amount > MAX_SINGLE_TRANSACTION / 2) {
            profile.riskScore = profile.riskScore + 5 > 100 ? 100 : profile.riskScore + 5;
        }
        
        // Update high risk mode
        profile.highRiskMode = profile.riskScore >= 70;
    }
    
    /**
     * @dev Check for post-transaction anomalies
     */
    function _checkPostTransactionAnomalies(
        address user,
        address target,
        uint256 amount
    ) internal {
        // Check for rapid successive transactions
        if (userTransactionCount[user] > 100 && 
            block.timestamp - lastTransactionTime[user] < 10 minutes) {
            
            _triggerSecurityEvent(
                EventType.UNUSUAL_VELOCITY,
                user,
                userTransactionCount[user],
                "High frequency trading detected"
            );
        }
    }
    
    /**
     * @dev Trigger a security event
     */
    function _triggerSecurityEvent(
        EventType eventType,
        address target,
        uint256 value,
        string memory description
    ) internal {
        uint256 eventId = ++securityEventCounter;
        
        securityEvents[bytes32(eventId)] = SecurityEvent({
            id: eventId,
            eventType: eventType,
            target: target,
            value: value,
            timestamp: block.timestamp,
            description: description,
            resolved: false
        });
        
        emit SecurityEventTriggered(eventId, eventType, target, value, description);
    }
    
    /**
     * @dev Trigger circuit breaker
     */
    function _triggerCircuitBreaker(address target, string memory reason) internal {
        // Add to temporary blacklist for 1 hour
        blacklistedAddresses[target] = true;
        
        emit CircuitBreakerTriggered(target, reason, block.timestamp);
        
        // Auto-remove after timeout (this would be handled by a keeper in production)
    }
    
    /**
     * @dev Get security event details
     * @param eventId Event identifier
     * @return event_ Security event details
     */
    function getSecurityEvent(uint256 eventId) external view returns (SecurityEvent memory event_) {
        return securityEvents[bytes32(eventId)];
    }
    
    /**
     * @dev Get vault security profile
     * @param vault Vault address
     * @return profile Vault security profile
     */
    function getVaultSecurityProfile(address vault) external view returns (VaultSecurityProfile memory profile) {
        return vaultProfiles[vault];
    }
    
    /**
     * @dev Check if address is blacklisted
     * @param target Address to check
     * @return blacklisted Whether address is blacklisted
     */
    function isBlacklisted(address target) external view returns (bool blacklisted) {
        return blacklistedAddresses[target];
    }
    
    /**
     * @dev Get current system security level
     * @return level Current security level
     */
    function getCurrentSecurityLevel() external view returns (SecurityLevel level) {
        if (globalEmergencyMode || paused()) {
            return SecurityLevel.CRITICAL;
        }
        
        uint256 currentHour = block.timestamp / 1 hours;
        uint256 volumePercentage = (hourlyVolume[currentHour] * 100) / MAX_HOURLY_VOLUME;
        
        if (volumePercentage >= 90) {
            return SecurityLevel.HIGH;
        } else if (volumePercentage >= 70) {
            return SecurityLevel.MEDIUM;
        } else {
            return SecurityLevel.LOW;
        }
    }
    
    /**
     * @dev Resolve a security event
     * @param eventId Event identifier
     */
    function resolveSecurityEvent(uint256 eventId) external onlyRole(SECURITY_ADMIN_ROLE) {
        SecurityEvent storage event_ = securityEvents[bytes32(eventId)];
        require(event_.id != 0, "Event not found");
        require(!event_.resolved, "Event already resolved");
        
        event_.resolved = true;
    }
}