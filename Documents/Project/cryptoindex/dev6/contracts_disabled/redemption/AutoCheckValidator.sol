// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// SafeMath not needed in Solidity 0.8+
import "../IndexTokenFactory.sol";
import "../interfaces/IIndexTokenFactory.sol";

/**
 * @title AutoCheckValidator
 * @dev Automated checklist validator for redemption requests
 * Performs comprehensive validation including limits, liquidity, and market stability
 */
contract AutoCheckValidator is AccessControl {
    // SafeMath usage removed (Solidity 0.8+ has built-in overflow checks)
    
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    
    // Core contracts
    IndexTokenFactory public immutable factory;
    
    // Configuration parameters (in basis points, 10000 = 100%)
    uint256 public maxSingleBurnRatio = 1000;      // 10% max single transaction
    uint256 public maxDailyBurnRatio = 2000;       // 20% max daily burn
    uint256 public volatilityThreshold = 500;      // 5% volatility threshold
    uint256 public minLiquidityRatio = 1000;       // 10% minimum liquidity buffer
    uint256 public maxWeeklyBurnRatio = 5000;      // 50% max weekly burn
    
    // State tracking
    mapping(bytes32 => mapping(uint256 => uint256)) public dailyBurnAmount;
    mapping(bytes32 => mapping(uint256 => uint256)) public weeklyBurnAmount;
    mapping(bytes32 => uint256) public lastNAVUpdate;
    mapping(bytes32 => uint256) public lastNAV;
    mapping(bytes32 => uint256) public totalBurnedAmount;
    mapping(bytes32 => bool) public fundEmergencyMode;
    
    // Events
    event ValidationFailed(
        bytes32 indexed fundId,
        uint256 tokenAmount,
        address requester,
        string reason
    );
    
    event ValidationPassed(
        bytes32 indexed fundId,
        uint256 tokenAmount,
        address requester
    );
    
    event ConfigurationUpdated(
        string parameter,
        uint256 oldValue,
        uint256 newValue
    );
    
    event EmergencyModeToggled(
        bytes32 indexed fundId,
        bool emergencyMode
    );
    
    /**
     * @dev Constructor
     */
    constructor(address _factory) {
        require(_factory != address(0), "Factory cannot be zero address");
        
        factory = IndexTokenFactory(_factory);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(VALIDATOR_ROLE, msg.sender);
    }
    
    /**
     * @dev Main validation function for redemption requests
     */
    function validateRedemption(
        bytes32 fundId,
        uint256 tokenAmount,
        address requester
    ) external returns (bool) {
        // Emergency mode check
        if (fundEmergencyMode[fundId]) {
            emit ValidationFailed(fundId, tokenAmount, requester, "Fund in emergency mode");
            return false;
        }
        
        // Get fund information
        (
            ,
            ,
            address creator,
            ,
            uint256 totalSupply,
            ,
            bool isActive,
            bool isIssued
        ) = factory.getFundInfo(fundId);
        
        // Check 1: Authorization and fund status
        if (!_validateAuthorization(creator, requester, isActive, isIssued)) {
            emit ValidationFailed(fundId, tokenAmount, requester, "Authorization failed");
            return false;
        }
        
        // Check 2: Asset sufficiency
        if (!_hasEnoughAssets(fundId, tokenAmount, totalSupply)) {
            emit ValidationFailed(fundId, tokenAmount, requester, "Insufficient assets");
            return false;
        }
        
        // Check 3: Single transaction limit
        if (!_isWithinSingleTransactionLimit(tokenAmount, totalSupply)) {
            emit ValidationFailed(fundId, tokenAmount, requester, "Single transaction limit exceeded");
            return false;
        }
        
        // Check 4: Daily burn limit
        if (!_isWithinDailyLimit(fundId, tokenAmount, totalSupply)) {
            emit ValidationFailed(fundId, tokenAmount, requester, "Daily burn limit exceeded");
            return false;
        }
        
        // Check 5: Weekly burn limit
        if (!_isWithinWeeklyLimit(fundId, tokenAmount, totalSupply)) {
            emit ValidationFailed(fundId, tokenAmount, requester, "Weekly burn limit exceeded");
            return false;
        }
        
        // Check 6: Market stability
        if (!_isMarketStable(fundId)) {
            emit ValidationFailed(fundId, tokenAmount, requester, "Market volatility too high");
            return false;
        }
        
        // Check 7: Liquidity buffer
        if (!_hasAdequateLiquidity(fundId, tokenAmount, totalSupply)) {
            emit ValidationFailed(fundId, tokenAmount, requester, "Insufficient liquidity buffer");
            return false;
        }
        
        // Update tracking data
        _updateBurnTracking(fundId, tokenAmount);
        
        emit ValidationPassed(fundId, tokenAmount, requester);
        return true;
    }
    
    /**
     * @dev Validate authorization and fund status
     */
    function _validateAuthorization(
        address creator,
        address requester,
        bool isActive,
        bool isIssued
    ) internal pure returns (bool) {
        return creator == requester && isActive && isIssued;
    }
    
    /**
     * @dev Check if fund has enough assets for redemption
     */
    function _hasEnoughAssets(
        bytes32 fundId,
        uint256 tokenAmount,
        uint256 totalSupply
    ) internal view returns (bool) {
        if (totalSupply == 0) return false;
        
        IIndexTokenFactory.ComponentToken[] memory components = factory.getFundComponents(fundId);
        uint256 burnRatio = tokenAmount.mul(1e18).div(totalSupply);
        
        for (uint i = 0; i < components.length; i++) {
            uint256 requiredAmount = components[i].depositedAmount.mul(burnRatio).div(1e18);
            uint256 availableAmount = IERC20(components[i].tokenAddress).balanceOf(address(factory));
            
            if (availableAmount < requiredAmount) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * @dev Check single transaction burn limit
     */
    function _isWithinSingleTransactionLimit(
        uint256 tokenAmount,
        uint256 totalSupply
    ) internal view returns (bool) {
        if (totalSupply == 0) return false;
        
        uint256 burnRatio = tokenAmount.mul(10000).div(totalSupply); // basis points
        return burnRatio <= maxSingleBurnRatio;
    }
    
    /**
     * @dev Check daily burn limit
     */
    function _isWithinDailyLimit(
        bytes32 fundId,
        uint256 tokenAmount,
        uint256 totalSupply
    ) internal view returns (bool) {
        if (totalSupply == 0) return false;
        
        uint256 today = block.timestamp / 86400;
        uint256 todayBurned = dailyBurnAmount[fundId][today];
        uint256 totalAfterBurn = todayBurned.add(tokenAmount);
        uint256 dailyBurnRatio = totalAfterBurn.mul(10000).div(totalSupply);
        
        return dailyBurnRatio <= maxDailyBurnRatio;
    }
    
    /**
     * @dev Check weekly burn limit
     */
    function _isWithinWeeklyLimit(
        bytes32 fundId,
        uint256 tokenAmount,
        uint256 totalSupply
    ) internal view returns (bool) {
        if (totalSupply == 0) return false;
        
        uint256 week = block.timestamp / (86400 * 7);
        uint256 weeklyBurned = weeklyBurnAmount[fundId][week];
        uint256 totalAfterBurn = weeklyBurned.add(tokenAmount);
        uint256 weeklyBurnRatio = totalAfterBurn.mul(10000).div(totalSupply);
        
        return weeklyBurnRatio <= maxWeeklyBurnRatio;
    }
    
    /**
     * @dev Check market stability through NAV volatility
     */
    function _isMarketStable(bytes32 fundId) internal view returns (bool) {
        if (lastNAVUpdate[fundId] == 0) return true; // First time passes
        
        uint256 currentNAV = factory.calculateNAV(fundId);
        uint256 previousNAV = lastNAV[fundId];
        uint256 timeDiff = block.timestamp.sub(lastNAVUpdate[fundId]);
        
        // Check volatility within the last hour
        if (timeDiff < 3600 && previousNAV > 0) {
            uint256 change = currentNAV > previousNAV ? 
                (currentNAV.sub(previousNAV)).mul(10000).div(previousNAV) :
                (previousNAV.sub(currentNAV)).mul(10000).div(previousNAV);
                
            return change <= volatilityThreshold;
        }
        
        return true;
    }
    
    /**
     * @dev Check if fund maintains adequate liquidity buffer
     */
    function _hasAdequateLiquidity(
        bytes32 fundId,
        uint256 tokenAmount,
        uint256 totalSupply
    ) internal view returns (bool) {
        if (totalSupply == 0) return false;
        
        // Ensure at least minLiquidityRatio remains after burn
        uint256 remainingSupply = totalSupply.sub(tokenAmount);
        uint256 liquidityRatio = remainingSupply.mul(10000).div(totalSupply);
        
        return liquidityRatio >= minLiquidityRatio;
    }
    
    /**
     * @dev Update burn tracking data
     */
    function _updateBurnTracking(bytes32 fundId, uint256 tokenAmount) internal {
        uint256 today = block.timestamp / 86400;
        uint256 week = block.timestamp / (86400 * 7);
        
        dailyBurnAmount[fundId][today] = dailyBurnAmount[fundId][today].add(tokenAmount);
        weeklyBurnAmount[fundId][week] = weeklyBurnAmount[fundId][week].add(tokenAmount);
        totalBurnedAmount[fundId] = totalBurnedAmount[fundId].add(tokenAmount);
        
        // Update NAV tracking
        lastNAV[fundId] = factory.calculateNAV(fundId);
        lastNAVUpdate[fundId] = block.timestamp;
    }
    
    /**
     * @dev Get detailed validation result with reasons
     */
    function getValidationDetails(
        bytes32 fundId,
        uint256 tokenAmount,
        address requester
    ) external view returns (
        bool isValid,
        string[] memory failedChecks,
        uint256 currentDailyBurn,
        uint256 currentWeeklyBurn,
        uint256 marketVolatility
    ) {
        string[] memory failures = new string[](10);
        uint256 failureCount = 0;
        
        // Get fund info
        (, , address creator, , uint256 totalSupply, , bool isActive, bool isIssued) = factory.getFundInfo(fundId);
        
        // Check authorization
        if (!_validateAuthorization(creator, requester, isActive, isIssued)) {
            failures[failureCount] = "Authorization failed";
            failureCount++;
        }
        
        // Check asset sufficiency
        if (!_hasEnoughAssets(fundId, tokenAmount, totalSupply)) {
            failures[failureCount] = "Insufficient assets";
            failureCount++;
        }
        
        // Check limits
        if (!_isWithinSingleTransactionLimit(tokenAmount, totalSupply)) {
            failures[failureCount] = "Single transaction limit exceeded";
            failureCount++;
        }
        
        if (!_isWithinDailyLimit(fundId, tokenAmount, totalSupply)) {
            failures[failureCount] = "Daily burn limit exceeded";
            failureCount++;
        }
        
        if (!_isWithinWeeklyLimit(fundId, tokenAmount, totalSupply)) {
            failures[failureCount] = "Weekly burn limit exceeded";
            failureCount++;
        }
        
        if (!_isMarketStable(fundId)) {
            failures[failureCount] = "Market volatility too high";
            failureCount++;
        }
        
        if (!_hasAdequateLiquidity(fundId, tokenAmount, totalSupply)) {
            failures[failureCount] = "Insufficient liquidity buffer";
            failureCount++;
        }
        
        // Prepare return arrays
        failedChecks = new string[](failureCount);
        for (uint i = 0; i < failureCount; i++) {
            failedChecks[i] = failures[i];
        }
        
        // Calculate current metrics
        uint256 today = block.timestamp / 86400;
        uint256 week = block.timestamp / (86400 * 7);
        currentDailyBurn = dailyBurnAmount[fundId][today];
        currentWeeklyBurn = weeklyBurnAmount[fundId][week];
        
        // Calculate volatility
        if (lastNAVUpdate[fundId] > 0 && lastNAV[fundId] > 0) {
            uint256 currentNAV = factory.calculateNAV(fundId);
            marketVolatility = currentNAV > lastNAV[fundId] ? 
                (currentNAV.sub(lastNAV[fundId])).mul(10000).div(lastNAV[fundId]) :
                (lastNAV[fundId].sub(currentNAV)).mul(10000).div(lastNAV[fundId]);
        }
        
        return (failureCount == 0, failedChecks, currentDailyBurn, currentWeeklyBurn, marketVolatility);
    }
    
    // Admin functions
    
    /**
     * @dev Set maximum single burn ratio
     */
    function setMaxSingleBurnRatio(uint256 _ratio) external onlyRole(ADMIN_ROLE) {
        require(_ratio <= 5000, "Ratio too high"); // Max 50%
        uint256 oldValue = maxSingleBurnRatio;
        maxSingleBurnRatio = _ratio;
        emit ConfigurationUpdated("maxSingleBurnRatio", oldValue, _ratio);
    }
    
    /**
     * @dev Set maximum daily burn ratio
     */
    function setMaxDailyBurnRatio(uint256 _ratio) external onlyRole(ADMIN_ROLE) {
        require(_ratio <= 8000, "Ratio too high"); // Max 80%
        uint256 oldValue = maxDailyBurnRatio;
        maxDailyBurnRatio = _ratio;
        emit ConfigurationUpdated("maxDailyBurnRatio", oldValue, _ratio);
    }
    
    /**
     * @dev Set volatility threshold
     */
    function setVolatilityThreshold(uint256 _threshold) external onlyRole(ADMIN_ROLE) {
        require(_threshold <= 2000, "Threshold too high"); // Max 20%
        uint256 oldValue = volatilityThreshold;
        volatilityThreshold = _threshold;
        emit ConfigurationUpdated("volatilityThreshold", oldValue, _threshold);
    }
    
    /**
     * @dev Set minimum liquidity ratio
     */
    function setMinLiquidityRatio(uint256 _ratio) external onlyRole(ADMIN_ROLE) {
        require(_ratio <= 5000, "Ratio too high"); // Max 50%
        uint256 oldValue = minLiquidityRatio;
        minLiquidityRatio = _ratio;
        emit ConfigurationUpdated("minLiquidityRatio", oldValue, _ratio);
    }
    
    /**
     * @dev Toggle emergency mode for a fund
     */
    function setFundEmergencyMode(bytes32 fundId, bool _emergencyMode) external onlyRole(ADMIN_ROLE) {
        fundEmergencyMode[fundId] = _emergencyMode;
        emit EmergencyModeToggled(fundId, _emergencyMode);
    }
    
    /**
     * @dev Force update NAV tracking (emergency use)
     */
    function forceUpdateNAV(bytes32 fundId) external onlyRole(ADMIN_ROLE) {
        lastNAV[fundId] = factory.calculateNAV(fundId);
        lastNAVUpdate[fundId] = block.timestamp;
    }
    
    // View functions
    
    /**
     * @dev Get current burn statistics for a fund
     */
    function getBurnStatistics(bytes32 fundId) external view returns (
        uint256 dailyBurned,
        uint256 weeklyBurned,
        uint256 totalBurned,
        uint256 lastUpdateTime
    ) {
        uint256 today = block.timestamp / 86400;
        uint256 week = block.timestamp / (86400 * 7);
        
        return (
            dailyBurnAmount[fundId][today],
            weeklyBurnAmount[fundId][week],
            totalBurnedAmount[fundId],
            lastNAVUpdate[fundId]
        );
    }
    
    /**
     * @dev Get current configuration
     */
    function getConfiguration() external view returns (
        uint256 maxSingle,
        uint256 maxDaily,
        uint256 maxWeekly,
        uint256 volatility,
        uint256 minLiquidity
    ) {
        return (
            maxSingleBurnRatio,
            maxDailyBurnRatio,
            maxWeeklyBurnRatio,
            volatilityThreshold,
            minLiquidityRatio
        );
    }
}