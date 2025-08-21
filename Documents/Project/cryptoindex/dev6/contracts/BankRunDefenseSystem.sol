// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BankRunDefenseSystem
 * @dev Comprehensive bank run prevention and liquidity crisis management
 * @notice Implements gradual redemption, circuit breakers, and liquidity pools
 */
contract BankRunDefenseSystem is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // Roles
    bytes32 public constant RISK_MANAGER_ROLE = keccak256("RISK_MANAGER_ROLE");
    bytes32 public constant LIQUIDITY_PROVIDER_ROLE = keccak256("LIQUIDITY_PROVIDER_ROLE");
    
    // Redemption request structure
    struct RedemptionRequest {
        address user;
        address token;
        uint256 amount;
        uint256 requestTime;
        uint256 processTime;
        uint256 fulfilledAmount;
        RedemptionStatus status;
    }
    
    // Redemption status
    enum RedemptionStatus {
        PENDING,
        PROCESSING,
        PARTIALLY_FULFILLED,
        COMPLETED,
        CANCELLED
    }
    
    // Liquidity pool structure
    struct LiquidityPool {
        uint256 totalLiquidity;
        uint256 availableLiquidity;
        uint256 reservedLiquidity;
        uint256 utilizationRate;
        uint256 lastUpdateTime;
    }
    
    // Circuit breaker configuration
    struct CircuitBreaker {
        bool isActive;
        uint256 triggerThreshold;      // % of TVL that triggers breaker
        uint256 cooldownPeriod;         // Time before normal operations resume
        uint256 lastTriggerTime;
        uint256 consecutiveTriggers;
    }
    
    // Dynamic fee structure for redemptions
    struct DynamicFees {
        uint256 baseFee;               // Base redemption fee (basis points)
        uint256 surgeFee;              // Additional fee during high demand
        uint256 utilizationThreshold;  // Utilization rate that triggers surge
        uint256 maxFee;               // Maximum total fee
    }
    
    // State variables
    mapping(address => LiquidityPool) public liquidityPools;
    mapping(bytes32 => RedemptionRequest) public redemptionRequests;
    mapping(address => bytes32[]) public userRequests;
    mapping(address => CircuitBreaker) public circuitBreakers;
    mapping(address => DynamicFees) public dynamicFees;
    
    // Queue management
    bytes32[] public redemptionQueue;
    mapping(address => uint256) public dailyRedemptionLimits;
    mapping(address => mapping(uint256 => uint256)) public dailyRedemptionVolume;
    
    // Emergency liquidity reserve
    mapping(address => uint256) public emergencyReserves;
    uint256 public constant EMERGENCY_RESERVE_RATIO = 2000; // 20% of TVL
    
    // Constants
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MAX_QUEUE_SIZE = 1000;
    uint256 public constant DEFAULT_COOLDOWN = 3600; // 1 hour
    uint256 public constant MAX_DAILY_REDEMPTION_RATIO = 1000; // 10% of TVL
    
    // Events
    event RedemptionRequested(bytes32 indexed requestId, address user, uint256 amount);
    event RedemptionProcessed(bytes32 indexed requestId, uint256 fulfilledAmount);
    event CircuitBreakerTriggered(address token, uint256 utilizationRate);
    event LiquidityAdded(address token, uint256 amount);
    event EmergencyLiquidityUsed(address token, uint256 amount);
    event DynamicFeeApplied(address user, uint256 feeAmount);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RISK_MANAGER_ROLE, msg.sender);
    }
    
    /**
     * @dev Request redemption with queuing system
     */
    function requestRedemption(
        address token,
        uint256 amount
    ) external nonReentrant returns (bytes32 requestId) {
        require(amount > 0, "Invalid amount");
        require(!circuitBreakers[token].isActive, "Circuit breaker active");
        
        // Check daily limit
        uint256 today = block.timestamp / 86400;
        uint256 dailyVolume = dailyRedemptionVolume[token][today];
        uint256 dailyLimit = dailyRedemptionLimits[token];
        
        if (dailyLimit > 0) {
            require(dailyVolume + amount <= dailyLimit, "Daily limit exceeded");
        }
        
        // Calculate dynamic fee
        uint256 feeAmount = calculateDynamicFee(token, amount);
        uint256 netAmount = amount - feeAmount;
        
        // Create redemption request
        requestId = keccak256(abi.encodePacked(msg.sender, token, amount, block.timestamp));
        
        redemptionRequests[requestId] = RedemptionRequest({
            user: msg.sender,
            token: token,
            amount: netAmount,
            requestTime: block.timestamp,
            processTime: block.timestamp + calculateProcessingTime(token, amount),
            fulfilledAmount: 0,
            status: RedemptionStatus.PENDING
        });
        
        // Add to queue and user's requests
        redemptionQueue.push(requestId);
        userRequests[msg.sender].push(requestId);
        
        // Update daily volume
        dailyRedemptionVolume[token][today] += amount;
        
        // Reserve liquidity
        liquidityPools[token].reservedLiquidity += netAmount;
        
        // Check if circuit breaker should trigger
        checkCircuitBreaker(token);
        
        emit RedemptionRequested(requestId, msg.sender, netAmount);
        
        if (feeAmount > 0) {
            emit DynamicFeeApplied(msg.sender, feeAmount);
        }
        
        return requestId;
    }
    
    /**
     * @dev Process redemption queue
     */
    function processRedemptionQueue(uint256 maxProcessCount) external onlyRole(RISK_MANAGER_ROLE) {
        uint256 processed = 0;
        uint256 i = 0;
        
        while (i < redemptionQueue.length && processed < maxProcessCount) {
            bytes32 requestId = redemptionQueue[i];
            RedemptionRequest storage request = redemptionRequests[requestId];
            
            if (request.status == RedemptionStatus.PENDING && 
                block.timestamp >= request.processTime) {
                
                uint256 availableLiquidity = getAvailableLiquidity(request.token);
                
                if (availableLiquidity >= request.amount) {
                    // Full fulfillment
                    processFullRedemption(requestId);
                    processed++;
                } else if (availableLiquidity > 0) {
                    // Partial fulfillment
                    processPartialRedemption(requestId, availableLiquidity);
                    processed++;
                } else {
                    // No liquidity - check emergency reserve
                    if (useEmergencyReserve(request.token, request.amount)) {
                        processFullRedemption(requestId);
                        processed++;
                    }
                }
            }
            
            // Remove completed requests from queue
            if (request.status == RedemptionStatus.COMPLETED) {
                removeFromQueue(i);
            } else {
                i++;
            }
        }
    }
    
    /**
     * @dev Process full redemption
     */
    function processFullRedemption(bytes32 requestId) private {
        RedemptionRequest storage request = redemptionRequests[requestId];
        
        // Transfer tokens to user
        IERC20(request.token).safeTransfer(request.user, request.amount);
        
        // Update request
        request.fulfilledAmount = request.amount;
        request.status = RedemptionStatus.COMPLETED;
        
        // Update liquidity pool
        liquidityPools[request.token].availableLiquidity -= request.amount;
        liquidityPools[request.token].reservedLiquidity -= request.amount;
        
        emit RedemptionProcessed(requestId, request.amount);
    }
    
    /**
     * @dev Process partial redemption
     */
    function processPartialRedemption(bytes32 requestId, uint256 availableAmount) private {
        RedemptionRequest storage request = redemptionRequests[requestId];
        
        // Transfer available tokens to user
        IERC20(request.token).safeTransfer(request.user, availableAmount);
        
        // Update request
        request.fulfilledAmount += availableAmount;
        request.amount -= availableAmount;
        
        if (request.amount == 0) {
            request.status = RedemptionStatus.COMPLETED;
        } else {
            request.status = RedemptionStatus.PARTIALLY_FULFILLED;
            // Reschedule for next processing
            request.processTime = block.timestamp + calculateProcessingTime(request.token, request.amount);
        }
        
        // Update liquidity pool
        liquidityPools[request.token].availableLiquidity -= availableAmount;
        liquidityPools[request.token].reservedLiquidity -= availableAmount;
        
        emit RedemptionProcessed(requestId, availableAmount);
    }
    
    /**
     * @dev Calculate dynamic fee based on utilization
     */
    function calculateDynamicFee(address token, uint256 amount) public view returns (uint256) {
        DynamicFees memory fees = dynamicFees[token];
        LiquidityPool memory pool = liquidityPools[token];
        
        uint256 utilization = pool.totalLiquidity > 0 
            ? (pool.reservedLiquidity * BASIS_POINTS) / pool.totalLiquidity 
            : 0;
        
        uint256 feeRate = fees.baseFee;
        
        // Apply surge pricing if utilization is high
        if (utilization >= fees.utilizationThreshold) {
            uint256 surgeMultiplier = (utilization - fees.utilizationThreshold) * 2;
            uint256 surgeFee = (fees.surgeFee * surgeMultiplier) / BASIS_POINTS;
            feeRate += surgeFee;
        }
        
        // Cap at maximum fee
        if (feeRate > fees.maxFee) {
            feeRate = fees.maxFee;
        }
        
        return (amount * feeRate) / BASIS_POINTS;
    }
    
    /**
     * @dev Calculate processing time based on queue and amount
     */
    function calculateProcessingTime(address token, uint256 amount) public view returns (uint256) {
        LiquidityPool memory pool = liquidityPools[token];
        
        // Base processing time
        uint256 baseTime = 3600; // 1 hour
        
        // Add time based on queue length
        uint256 queuePenalty = (redemptionQueue.length * 600) / 100; // 6 minutes per 100 requests
        
        // Add time based on amount size relative to available liquidity
        uint256 sizePenalty = 0;
        if (pool.availableLiquidity > 0) {
            uint256 sizeRatio = (amount * BASIS_POINTS) / pool.availableLiquidity;
            sizePenalty = (sizeRatio * 3600) / BASIS_POINTS; // Up to 1 hour for large amounts
        }
        
        return baseTime + queuePenalty + sizePenalty;
    }
    
    /**
     * @dev Check and trigger circuit breaker if necessary
     */
    function checkCircuitBreaker(address token) private {
        LiquidityPool memory pool = liquidityPools[token];
        CircuitBreaker storage breaker = circuitBreakers[token];
        
        uint256 utilization = pool.totalLiquidity > 0
            ? (pool.reservedLiquidity * BASIS_POINTS) / pool.totalLiquidity
            : 0;
        
        if (utilization >= breaker.triggerThreshold && !breaker.isActive) {
            breaker.isActive = true;
            breaker.lastTriggerTime = block.timestamp;
            breaker.consecutiveTriggers++;
            
            emit CircuitBreakerTriggered(token, utilization);
        }
    }
    
    /**
     * @dev Reset circuit breaker after cooldown
     */
    function resetCircuitBreaker(address token) external onlyRole(RISK_MANAGER_ROLE) {
        CircuitBreaker storage breaker = circuitBreakers[token];
        
        require(breaker.isActive, "Not active");
        require(
            block.timestamp >= breaker.lastTriggerTime + breaker.cooldownPeriod,
            "Cooldown not complete"
        );
        
        breaker.isActive = false;
        
        // Increase cooldown if triggered multiple times
        if (breaker.consecutiveTriggers > 3) {
            breaker.cooldownPeriod = breaker.cooldownPeriod * 2;
        }
    }
    
    /**
     * @dev Add liquidity to pool
     */
    function addLiquidity(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "Invalid amount");
        
        // Transfer tokens from provider
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Update liquidity pool
        LiquidityPool storage pool = liquidityPools[token];
        pool.totalLiquidity += amount;
        pool.availableLiquidity += amount;
        pool.lastUpdateTime = block.timestamp;
        
        // Update utilization rate
        if (pool.totalLiquidity > 0) {
            pool.utilizationRate = (pool.reservedLiquidity * BASIS_POINTS) / pool.totalLiquidity;
        }
        
        emit LiquidityAdded(token, amount);
    }
    
    /**
     * @dev Use emergency reserve for critical redemptions
     */
    function useEmergencyReserve(address token, uint256 amount) private returns (bool) {
        uint256 reserve = emergencyReserves[token];
        
        if (reserve >= amount) {
            emergencyReserves[token] -= amount;
            emit EmergencyLiquidityUsed(token, amount);
            return true;
        }
        
        return false;
    }
    
    /**
     * @dev Get available liquidity for redemptions
     */
    function getAvailableLiquidity(address token) public view returns (uint256) {
        LiquidityPool memory pool = liquidityPools[token];
        
        if (pool.availableLiquidity > pool.reservedLiquidity) {
            return pool.availableLiquidity - pool.reservedLiquidity;
        }
        
        return 0;
    }
    
    /**
     * @dev Remove request from queue
     */
    function removeFromQueue(uint256 index) private {
        require(index < redemptionQueue.length, "Invalid index");
        
        redemptionQueue[index] = redemptionQueue[redemptionQueue.length - 1];
        redemptionQueue.pop();
    }
    
    /**
     * @dev Cancel redemption request
     */
    function cancelRedemption(bytes32 requestId) external nonReentrant {
        RedemptionRequest storage request = redemptionRequests[requestId];
        
        require(request.user == msg.sender, "Not request owner");
        require(request.status == RedemptionStatus.PENDING, "Cannot cancel");
        
        // Update request status
        request.status = RedemptionStatus.CANCELLED;
        
        // Release reserved liquidity
        liquidityPools[request.token].reservedLiquidity -= request.amount;
        
        // Remove from queue
        for (uint256 i = 0; i < redemptionQueue.length; i++) {
            if (redemptionQueue[i] == requestId) {
                removeFromQueue(i);
                break;
            }
        }
    }
    
    /**
     * @dev Configure circuit breaker
     */
    function configureCircuitBreaker(
        address token,
        uint256 triggerThreshold,
        uint256 cooldownPeriod
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(triggerThreshold <= 9000, "Threshold too high"); // Max 90%
        require(cooldownPeriod >= 600, "Cooldown too short"); // Min 10 minutes
        
        circuitBreakers[token] = CircuitBreaker({
            isActive: false,
            triggerThreshold: triggerThreshold,
            cooldownPeriod: cooldownPeriod,
            lastTriggerTime: 0,
            consecutiveTriggers: 0
        });
    }
    
    /**
     * @dev Configure dynamic fees
     */
    function configureDynamicFees(
        address token,
        uint256 baseFee,
        uint256 surgeFee,
        uint256 utilizationThreshold,
        uint256 maxFee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(maxFee <= 1000, "Fee too high"); // Max 10%
        
        dynamicFees[token] = DynamicFees({
            baseFee: baseFee,
            surgeFee: surgeFee,
            utilizationThreshold: utilizationThreshold,
            maxFee: maxFee
        });
    }
    
    /**
     * @dev Set daily redemption limit
     */
    function setDailyRedemptionLimit(address token, uint256 limit) external onlyRole(RISK_MANAGER_ROLE) {
        dailyRedemptionLimits[token] = limit;
    }
    
    /**
     * @dev Get queue status
     */
    function getQueueStatus() external view returns (uint256 queueLength, uint256 totalPending) {
        queueLength = redemptionQueue.length;
        
        for (uint256 i = 0; i < redemptionQueue.length; i++) {
            RedemptionRequest memory request = redemptionRequests[redemptionQueue[i]];
            if (request.status == RedemptionStatus.PENDING) {
                totalPending += request.amount;
            }
        }
    }
}
