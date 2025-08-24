// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title SecurityManager
 * @dev Enhanced security manager with event tracking
 * Based on: Compound V3 Risk Management + Aave V3 Security Framework
 */
contract SecurityManager is AccessControl, Pausable {
    bytes32 public constant SECURITY_ADMIN = keccak256("SECURITY_ADMIN");
    bytes32 public constant EMERGENCY_ADMIN = keccak256("EMERGENCY_ADMIN");
    
    // 🔧 FIX 1: Missing security event counter
    uint256 private _securityEventCounter;
    
    // 🔧 FIX 2: Enhanced event tracking system
    struct SecurityEvent {
        uint256 id;
        address user;
        string eventType;
        uint256 timestamp;
        uint256 blockNumber;
        bytes32 txHash;
    }
    
    mapping(uint256 => SecurityEvent) public securityEvents;
    mapping(address => bool) public blacklistedAddresses;
    mapping(address => uint256) public userTransactionCount;
    mapping(address => uint256) public userTotalVolume;
    mapping(address => uint256) public lastTransactionTime;
    
    // Circuit breaker thresholds (based on Compound V3)
    uint256 public maxSingleTransaction = 1000000e6; // 1M USDC
    uint256 public maxHourlyVolume = 10000000e6;     // 10M USDC  
    uint256 public maxDailyVolume = 100000000e6;     // 100M USDC
    uint256 public priceDeviationThreshold = 1000;   // 10% in basis points
    
    event SecurityEventLogged(uint256 indexed eventId, address indexed user, string eventType);
    event AddressBlacklisted(address indexed user, string reason);
    event AddressWhitelisted(address indexed user);
    event CircuitBreakerTriggered(string reason, uint256 value, uint256 threshold);
    event EmergencyPause(address indexed admin, string reason);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SECURITY_ADMIN, msg.sender);
        _grantRole(EMERGENCY_ADMIN, msg.sender);
    }
    
    // ✅ FIX: Missing securityEventCounter function
    function securityEventCounter() external view returns (uint256) {
        return _securityEventCounter;
    }
    
    // ✅ FIX: Enhanced event logging system
    function logSecurityEvent(
        address user, 
        string memory eventType
    ) external onlyRole(SECURITY_ADMIN) {
        _securityEventCounter++;
        
        SecurityEvent memory newEvent = SecurityEvent({
            id: _securityEventCounter,
            user: user,
            eventType: eventType,
            timestamp: block.timestamp,
            blockNumber: block.number,
            txHash: blockhash(block.number - 1)
        });
        
        securityEvents[_securityEventCounter] = newEvent;
        emit SecurityEventLogged(_securityEventCounter, user, eventType);
    }
    
    // ✅ FIX: Volume tracking system (Aave V3 style)
    function updateUserMetrics(
        address user, 
        uint256 volume
    ) external onlyRole(SECURITY_ADMIN) {
        userTransactionCount[user]++;
        userTotalVolume[user] += volume;
        lastTransactionTime[user] = block.timestamp;
        
        // Circuit breaker checks
        if (volume > maxSingleTransaction) {
            emit CircuitBreakerTriggered("Single transaction limit", volume, maxSingleTransaction);
            _pause();
        }
    }
    
    // ✅ FIX: Blacklist management
    function blacklistAddress(
        address user, 
        string memory reason
    ) external onlyRole(SECURITY_ADMIN) {
        blacklistedAddresses[user] = true;
        logSecurityEvent(user, "BLACKLISTED");
        emit AddressBlacklisted(user, reason);
    }
    
    function whitelistAddress(address user) external onlyRole(SECURITY_ADMIN) {
        blacklistedAddresses[user] = false;
        logSecurityEvent(user, "WHITELISTED");
        emit AddressWhitelisted(user);
    }
    
    // ✅ FIX: Enhanced security checks
    function checkSecurity(address user) external view returns (bool) {
        if (blacklistedAddresses[user]) return false;
        if (paused()) return false;
        return true;
    }
    
    // Emergency controls (Compound V3 inspired)
    function emergencyPause(string memory reason) external onlyRole(EMERGENCY_ADMIN) {
        _pause();
        logSecurityEvent(msg.sender, "EMERGENCY_PAUSE");
        emit EmergencyPause(msg.sender, reason);
    }
    
    function emergencyUnpause() external onlyRole(EMERGENCY_ADMIN) {
        _unpause();
        logSecurityEvent(msg.sender, "EMERGENCY_UNPAUSE");
    }
    
    // ✅ FIX: Circuit breaker system
    function updateThresholds(
        uint256 _maxSingle,
        uint256 _maxHourly, 
        uint256 _maxDaily,
        uint256 _priceDeviation
    ) external onlyRole(SECURITY_ADMIN) {
        maxSingleTransaction = _maxSingle;
        maxHourlyVolume = _maxHourly;
        maxDailyVolume = _maxDaily;
        priceDeviationThreshold = _priceDeviation;
    }
}