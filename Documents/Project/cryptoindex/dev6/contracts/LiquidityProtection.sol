// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IRedemptionManager.sol";

/**
 * @title LiquidityProtection
 * @dev Advanced liquidity crisis management and bank run prevention
 * @notice Addresses critical liquidity risks identified in 2nd verification
 */
contract LiquidityProtection is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // Roles
    bytes32 public constant LIQUIDITY_MANAGER_ROLE = keccak256("LIQUIDITY_MANAGER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    
    // Constants
    uint256 public constant MAX_DAILY_REDEMPTION_RATE = 2000; // 20%
    uint256 public constant MIN_LIQUIDITY_BUFFER = 1000;      // 10%
    uint256 public constant BANK_RUN_THRESHOLD = 3000;        // 30%
    uint256 public constant EMERGENCY_LIQUIDITY_RATIO = 500;  // 5%
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant SECONDS_PER_DAY = 86400;
    
    // Structs
    struct VaultLiquidity {
        uint256 totalAssets;
        uint256 liquidAssets;           // Immediately available for redemption
        uint256 illiquidAssets;         // Locked in strategies/protocols
        uint256 pendingRedemptions;     // Total amount in redemption queue
        uint256 emergencyReserve;       // Emergency liquidity buffer
        uint256 lastUpdate;
        bool isHealthy;
    }
    
    struct DailyRedemptionData {
        uint256 totalRedemptions;       // Total redeemed today
        uint256 dailyLimit;            // Max redemptions allowed per day
        uint256 resetTimestamp;        // When daily limit resets
        uint256 redemptionCount;       // Number of redemption requests
        bool isLimited;                // Whether redemptions are rate-limited
    }
    
    struct GradualRedemptionQueue {
        address user;
        address vault;
        uint256 totalAmount;
        uint256 dailyAmount;
        uint256 completedAmount;
        uint256 nextRedemptionTime;
        uint256 priority;              // Higher priority processed first
        bool isActive;
        bool isEmergency;
    }
    
    struct LiquidityAlert {
        uint256 timestamp;
        string alertType;
        uint256 severity;              // 1-5 scale
        uint256 liquidityRatio;
        uint256 redemptionPressure;
        bool isResolved;
    }
    
    struct EmergencyProtocol {
        bool isActivated;
        uint256 activationTime;
        uint256 emergencyRatio;        // Min liquidity ratio to maintain
        uint256 maxDailyRedemption;    // Max % that can be redeemed per day
        uint256 cooldownPeriod;        // Time before normal operations resume
        address[] priorityUsers;       // Users with priority access
    }
    
    // State variables
    mapping(address => VaultLiquidity) public vaultLiquidity;
    mapping(address => DailyRedemptionData) public dailyRedemptions;
    mapping(bytes32 => GradualRedemptionQueue) public redemptionQueue;
    mapping(address => uint256) public userRedemptionPriority;
    mapping(address => LiquidityAlert[]) public liquidityAlerts;
    mapping(address => EmergencyProtocol) public emergencyProtocols;
    
    // Queue management
    bytes32[] public activeRedemptions;
    mapping(address => bytes32[]) public userActiveRedemptions;
    
    // Configuration
    uint256 public globalLiquidityRatio = 1500;           // 15% minimum liquidity
    uint256 public emergencyActivationThreshold = 800;   // 8% triggers emergency
    uint256 public maxQueueSize = 1000;                   // Max redemptions in queue
    uint256 public priorityUserDiscount = 500;           // 5% faster processing
    
    // Statistics
    uint256 public totalEmergencyActivations;
    uint256 public totalBankRunsPrevented;
    uint256 public totalGradualRedemptions;
    uint256 public totalLiquidityAlerts;
    
    // Events
    event LiquidityUpdated(address indexed vault, uint256 liquidRatio, bool isHealthy);
    event BankRunDetected(address indexed vault, uint256 redemptionPressure);
    event EmergencyProtocolActivated(address indexed vault, uint256 liquidityRatio);
    event GradualRedemptionQueued(address indexed user, address indexed vault, uint256 amount, bytes32 queueId);
    event RedemptionProcessed(bytes32 indexed queueId, uint256 amount, bool isCompleted);
    event LiquidityAlertTriggered(address indexed vault, string alertType, uint256 severity);
    event EmergencyLiquidityInjected(address indexed vault, uint256 amount);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(LIQUIDITY_MANAGER_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
    }
    
    /**
     * @dev Update vault liquidity metrics
     * @param vault The vault address
     * @param totalAssets Total vault assets
     * @param liquidAssets Liquid assets available for immediate redemption
     * @param illiquidAssets Assets locked in strategies
     */
    function updateLiquidity(
        address vault,
        uint256 totalAssets,
        uint256 liquidAssets,
        uint256 illiquidAssets
    ) 
        external 
        onlyRole(LIQUIDITY_MANAGER_ROLE) 
    {
        require(vault != address(0), "Invalid vault address");
        require(totalAssets > 0, "Invalid total assets");
        require(liquidAssets + illiquidAssets <= totalAssets, "Asset mismatch");
        
        VaultLiquidity storage liquidity = vaultLiquidity[vault];
        
        // Calculate liquidity ratio
        uint256 liquidityRatio = totalAssets > 0 ? (liquidAssets * BASIS_POINTS) / totalAssets : 0;
        
        // Update vault data
        liquidity.totalAssets = totalAssets;
        liquidity.liquidAssets = liquidAssets;
        liquidity.illiquidAssets = illiquidAssets;
        liquidity.lastUpdate = block.timestamp;
        
        // Check health status
        bool wasHealthy = liquidity.isHealthy;
        liquidity.isHealthy = liquidityRatio >= globalLiquidityRatio;
        
        // Trigger alerts if needed
        if (liquidityRatio < emergencyActivationThreshold && !emergencyProtocols[vault].isActivated) {
            _activateEmergencyProtocol(vault, liquidityRatio);
        } else if (liquidityRatio < globalLiquidityRatio) {
            _triggerLiquidityAlert(vault, "LOW_LIQUIDITY", 3, liquidityRatio);
        }
        
        // Check for bank run conditions
        uint256 redemptionPressure = _calculateRedemptionPressure(vault);
        if (redemptionPressure >= BANK_RUN_THRESHOLD) {
            _handleBankRunScenario(vault, redemptionPressure);
        }
        
        emit LiquidityUpdated(vault, liquidityRatio, liquidity.isHealthy);
    }
    
    /**
     * @dev Queue gradual redemption to prevent liquidity crisis
     * @param vault The vault to redeem from
     * @param amount Total amount to redeem
     * @param dailyAmount Maximum daily redemption amount
     * @param isEmergency Whether this is an emergency redemption
     */
    function queueGradualRedemption(
        address vault,
        uint256 amount,
        uint256 dailyAmount,
        bool isEmergency
    ) 
        external 
        nonReentrant 
        whenNotPaused 
        returns (bytes32 queueId) 
    {
        require(amount > 0, "Invalid amount");
        require(dailyAmount > 0 && dailyAmount <= amount, "Invalid daily amount");
        require(activeRedemptions.length < maxQueueSize, "Queue is full");
        
        // Check vault health
        VaultLiquidity memory liquidity = vaultLiquidity[vault];
        require(liquidity.totalAssets > 0, "Vault not tracked");
        
        // Calculate redemption ID
        queueId = keccak256(abi.encodePacked(msg.sender, vault, amount, block.timestamp));
        require(redemptionQueue[queueId].user == address(0), "Redemption already exists");
        
        // Determine priority
        uint256 priority = userRedemptionPriority[msg.sender];
        if (isEmergency) {
            priority += 1000; // Emergency boost
        }
        
        // Create redemption queue entry
        redemptionQueue[queueId] = GradualRedemptionQueue({
            user: msg.sender,
            vault: vault,
            totalAmount: amount,
            dailyAmount: dailyAmount,
            completedAmount: 0,
            nextRedemptionTime: block.timestamp,
            priority: priority,
            isActive: true,
            isEmergency: isEmergency
        });
        
        // Add to active queues
        activeRedemptions.push(queueId);
        userActiveRedemptions[msg.sender].push(queueId);
        
        // Update pending redemptions
        vaultLiquidity[vault].pendingRedemptions += amount;
        
        totalGradualRedemptions++;
        
        emit GradualRedemptionQueued(msg.sender, vault, amount, queueId);
        
        return queueId;
    }
    
    /**
     * @dev Process queued redemptions (called by keepers)
     * @param maxProcessCount Maximum number of redemptions to process
     */
    function processRedemptionQueue(uint256 maxProcessCount) 
        external 
        nonReentrant 
        onlyRole(LIQUIDITY_MANAGER_ROLE) 
    {
        require(maxProcessCount > 0, "Invalid process count");
        
        uint256 processed = 0;
        uint256 currentIndex = 0;
        
        while (processed < maxProcessCount && currentIndex < activeRedemptions.length) {
            bytes32 queueId = activeRedemptions[currentIndex];
            GradualRedemptionQueue storage redemption = redemptionQueue[queueId];
            
            if (!redemption.isActive) {
                // Remove inactive redemption from queue
                _removeFromActiveQueue(currentIndex);
                continue;
            }
            
            if (block.timestamp >= redemption.nextRedemptionTime) {
                bool completed = _processRedemption(queueId);
                processed++;
                
                if (completed) {
                    _removeFromActiveQueue(currentIndex);
                    continue;
                }
            }
            
            currentIndex++;
        }
    }
    
    /**
     * @dev Cancel queued redemption
     * @param queueId The redemption queue ID to cancel
     */
    function cancelGradualRedemption(bytes32 queueId) 
        external 
        nonReentrant 
    {
        GradualRedemptionQueue storage redemption = redemptionQueue[queueId];
        require(redemption.user == msg.sender, "Not authorized");
        require(redemption.isActive, "Redemption not active");
        
        // Update vault pending redemptions
        uint256 remainingAmount = redemption.totalAmount - redemption.completedAmount;
        vaultLiquidity[redemption.vault].pendingRedemptions -= remainingAmount;
        
        // Deactivate redemption
        redemption.isActive = false;
        
        // Remove from user's active list
        _removeFromUserActiveQueue(msg.sender, queueId);
    }
    
    /**
     * @dev Check if immediate redemption is allowed
     * @param vault The vault address
     * @param amount Redemption amount
     * @return allowed Whether immediate redemption is allowed
     * @return reason Reason if not allowed
     */
    function canRedeemImmediately(address vault, uint256 amount) 
        external 
        view 
        returns (bool allowed, string memory reason) 
    {
        VaultLiquidity memory liquidity = vaultLiquidity[vault];
        DailyRedemptionData memory dailyData = dailyRedemptions[vault];
        
        // Check vault health
        if (!liquidity.isHealthy) {
            return (false, "Vault liquidity unhealthy");
        }
        
        // Check if emergency protocol is active
        if (emergencyProtocols[vault].isActivated) {
            return (false, "Emergency protocol active");
        }
        
        // Check daily limit
        if (dailyData.isLimited) {
            uint256 availableToday = dailyData.dailyLimit - dailyData.totalRedemptions;
            if (amount > availableToday) {
                return (false, "Daily redemption limit exceeded");
            }
        }
        
        // Check if redemption would breach liquidity ratio
        uint256 newLiquidAssets = liquidity.liquidAssets > amount ? 
            liquidity.liquidAssets - amount : 0;
        uint256 newLiquidityRatio = liquidity.totalAssets > 0 ? 
            (newLiquidAssets * BASIS_POINTS) / liquidity.totalAssets : 0;
            
        if (newLiquidityRatio < globalLiquidityRatio) {
            return (false, "Would breach minimum liquidity ratio");
        }
        
        return (true, "");
    }
    
    /**
     * @dev Inject emergency liquidity
     * @param vault The vault to inject liquidity into
     * @param amount Amount of liquidity to inject
     * @param asset The asset to inject
     */
    function injectEmergencyLiquidity(
        address vault,
        uint256 amount,
        IERC20 asset
    ) 
        external 
        nonReentrant 
        onlyRole(EMERGENCY_ROLE) 
    {
        require(amount > 0, "Invalid amount");
        require(emergencyProtocols[vault].isActivated, "Emergency protocol not active");
        
        // Transfer emergency funds
        asset.safeTransferFrom(msg.sender, vault, amount);
        
        // Update vault liquidity
        vaultLiquidity[vault].liquidAssets += amount;
        vaultLiquidity[vault].emergencyReserve += amount;
        
        emit EmergencyLiquidityInjected(vault, amount);
    }
    
    /**
     * @dev Get vault liquidity status
     * @param vault The vault address
     * @return ratio Current liquidity ratio
     * @return isHealthy Whether vault is healthy
     * @return pendingRedemptions Amount in redemption queue
     * @return emergencyActive Whether emergency protocol is active
     */
    function getVaultStatus(address vault) 
        external 
        view 
        returns (
            uint256 ratio,
            bool isHealthy,
            uint256 pendingRedemptions,
            bool emergencyActive
        ) 
    {
        VaultLiquidity memory liquidity = vaultLiquidity[vault];
        
        ratio = liquidity.totalAssets > 0 ? 
            (liquidity.liquidAssets * BASIS_POINTS) / liquidity.totalAssets : 0;
        isHealthy = liquidity.isHealthy;
        pendingRedemptions = liquidity.pendingRedemptions;
        emergencyActive = emergencyProtocols[vault].isActivated;
    }
    
    /**
     * @dev Get redemption queue status for user
     * @param user The user address
     * @return queueIds Array of active redemption queue IDs
     * @return totalPending Total amount pending redemption
     */
    function getUserRedemptionStatus(address user) 
        external 
        view 
        returns (bytes32[] memory queueIds, uint256 totalPending) 
    {
        queueIds = userActiveRedemptions[user];
        
        for (uint i = 0; i < queueIds.length; i++) {
            GradualRedemptionQueue memory redemption = redemptionQueue[queueIds[i]];
            if (redemption.isActive) {
                totalPending += (redemption.totalAmount - redemption.completedAmount);
            }
        }
    }
    
    // Internal functions
    
    function _calculateRedemptionPressure(address vault) 
        internal 
        view 
        returns (uint256 pressure) 
    {
        VaultLiquidity memory liquidity = vaultLiquidity[vault];
        DailyRedemptionData memory dailyData = dailyRedemptions[vault];
        
        if (liquidity.totalAssets == 0) return 0;
        
        // Calculate as percentage of total assets
        uint256 totalRedemptionDemand = liquidity.pendingRedemptions + dailyData.totalRedemptions;
        pressure = (totalRedemptionDemand * BASIS_POINTS) / liquidity.totalAssets;
        
        return pressure;
    }
    
    function _activateEmergencyProtocol(address vault, uint256 liquidityRatio) internal {
        EmergencyProtocol storage protocol = emergencyProtocols[vault];
        
        protocol.isActivated = true;
        protocol.activationTime = block.timestamp;
        protocol.emergencyRatio = emergencyActivationThreshold;
        protocol.maxDailyRedemption = MAX_DAILY_REDEMPTION_RATE / 2; // Halve daily limit
        protocol.cooldownPeriod = 24 hours;
        
        totalEmergencyActivations++;
        
        // Pause the vault
        _pause();
        
        emit EmergencyProtocolActivated(vault, liquidityRatio);
    }
    
    function _handleBankRunScenario(address vault, uint256 redemptionPressure) internal {
        // Activate emergency protocol if not already active
        if (!emergencyProtocols[vault].isActivated) {
            VaultLiquidity memory liquidity = vaultLiquidity[vault];
            uint256 liquidityRatio = liquidity.totalAssets > 0 ? 
                (liquidity.liquidAssets * BASIS_POINTS) / liquidity.totalAssets : 0;
            _activateEmergencyProtocol(vault, liquidityRatio);
        }
        
        // Reduce daily redemption limits further
        emergencyProtocols[vault].maxDailyRedemption = MAX_DAILY_REDEMPTION_RATE / 4;
        
        totalBankRunsPrevented++;
        
        emit BankRunDetected(vault, redemptionPressure);
    }
    
    function _triggerLiquidityAlert(
        address vault,
        string memory alertType,
        uint256 severity,
        uint256 liquidityRatio
    ) internal {
        liquidityAlerts[vault].push(LiquidityAlert({
            timestamp: block.timestamp,
            alertType: alertType,
            severity: severity,
            liquidityRatio: liquidityRatio,
            redemptionPressure: _calculateRedemptionPressure(vault),
            isResolved: false
        }));
        
        totalLiquidityAlerts++;
        
        emit LiquidityAlertTriggered(vault, alertType, severity);
    }
    
    function _processRedemption(bytes32 queueId) 
        internal 
        returns (bool completed) 
    {
        GradualRedemptionQueue storage redemption = redemptionQueue[queueId];
        
        uint256 remainingAmount = redemption.totalAmount - redemption.completedAmount;
        uint256 redeemAmount = remainingAmount > redemption.dailyAmount ? 
            redemption.dailyAmount : remainingAmount;
        
        // Check vault liquidity
        VaultLiquidity storage liquidity = vaultLiquidity[redemption.vault];
        if (liquidity.liquidAssets < redeemAmount) {
            // Skip this redemption if insufficient liquidity
            redemption.nextRedemptionTime = block.timestamp + 1 hours; // Try again in 1 hour
            return false;
        }
        
        // Process redemption
        redemption.completedAmount += redeemAmount;
        redemption.nextRedemptionTime = block.timestamp + SECONDS_PER_DAY;
        
        // Update vault liquidity
        liquidity.liquidAssets -= redeemAmount;
        liquidity.pendingRedemptions -= redeemAmount;
        
        completed = redemption.completedAmount >= redemption.totalAmount;
        if (completed) {
            redemption.isActive = false;
        }
        
        emit RedemptionProcessed(queueId, redeemAmount, completed);
        
        return completed;
    }
    
    function _removeFromActiveQueue(uint256 index) internal {
        require(index < activeRedemptions.length, "Invalid index");
        
        activeRedemptions[index] = activeRedemptions[activeRedemptions.length - 1];
        activeRedemptions.pop();
    }
    
    function _removeFromUserActiveQueue(address user, bytes32 queueId) internal {
        bytes32[] storage userQueue = userActiveRedemptions[user];
        
        for (uint i = 0; i < userQueue.length; i++) {
            if (userQueue[i] == queueId) {
                userQueue[i] = userQueue[userQueue.length - 1];
                userQueue.pop();
                break;
            }
        }
    }
    
    // Admin functions
    
    function setGlobalLiquidityRatio(uint256 ratio) 
        external 
        onlyRole(LIQUIDITY_MANAGER_ROLE) 
    {
        require(ratio >= 500 && ratio <= 5000, "Invalid liquidity ratio");
        globalLiquidityRatio = ratio;
    }
    
    function setEmergencyActivationThreshold(uint256 threshold) 
        external 
        onlyRole(EMERGENCY_ROLE) 
    {
        require(threshold >= 200 && threshold <= 2000, "Invalid threshold");
        emergencyActivationThreshold = threshold;
    }
    
    function setUserPriority(address user, uint256 priority) 
        external 
        onlyRole(LIQUIDITY_MANAGER_ROLE) 
    {
        userRedemptionPriority[user] = priority;
    }
    
    function deactivateEmergencyProtocol(address vault) 
        external 
        onlyRole(EMERGENCY_ROLE) 
    {
        EmergencyProtocol storage protocol = emergencyProtocols[vault];
        require(protocol.isActivated, "Not activated");
        require(
            block.timestamp >= protocol.activationTime + protocol.cooldownPeriod,
            "Cooldown not finished"
        );
        
        // Check if vault is healthy enough to resume
        VaultLiquidity memory liquidity = vaultLiquidity[vault];
        uint256 liquidityRatio = liquidity.totalAssets > 0 ? 
            (liquidity.liquidAssets * BASIS_POINTS) / liquidity.totalAssets : 0;
        require(liquidityRatio >= globalLiquidityRatio, "Vault still unhealthy");
        
        protocol.isActivated = false;
        _unpause();
    }
    
    // View functions
    
    function getActiveRedemptionCount() external view returns (uint256) {
        return activeRedemptions.length;
    }
    
    function getLiquidityAlertCount(address vault) external view returns (uint256) {
        return liquidityAlerts[vault].length;
    }
    
    function getQueuePosition(bytes32 queueId) external view returns (uint256 position) {
        for (uint i = 0; i < activeRedemptions.length; i++) {
            if (activeRedemptions[i] == queueId) {
                return i + 1; // 1-indexed
            }
        }
        return 0; // Not found
    }
}