// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IPriceFeed.sol";
import "./EnhancedOracleManager.sol";

/**
 * @title SecurityEnhancements
 * @dev Critical security improvements based on 2nd verification checklist
 * @notice Implements oracle manipulation resistance, MEV protection, and liquidity crisis management
 */
contract SecurityEnhancements is AccessControl, ReentrancyGuard, Pausable {
    
    // Roles
    bytes32 public constant SECURITY_ADMIN_ROLE = keccak256("SECURITY_ADMIN_ROLE");
    bytes32 public constant ORACLE_MANAGER_ROLE = keccak256("ORACLE_MANAGER_ROLE");
    
    // Constants
    uint256 public constant MAX_PRICE_DEVIATION = 500; // 5%
    uint256 public constant MIN_COMMIT_BLOCKS = 2;
    uint256 public constant MAX_COMMIT_BLOCKS = 10;
    uint256 public constant GRADUAL_REDEMPTION_DAILY_LIMIT = 1000; // 10%
    
    // Oracle Security
    struct OracleConfig {
        IPriceFeed primaryOracle;    // Hyperliquid native oracle
        IPriceFeed[] backupOracles;  // Chainlink, Band Protocol, etc.
        uint256 maxDeviation;        // Maximum allowed price deviation
        uint256 updateThreshold;     // Minimum time between updates
        bool isActive;
    }
    
    struct PriceData {
        uint256 price;
        uint256 timestamp;
        uint256 confidence;
        bool isValid;
    }
    
    // MEV Protection - Commit-Reveal Scheme
    struct CommitReveal {
        bytes32 commitment;          // keccak256(amount + nonce + user)
        uint256 commitBlock;         // Block when commitment was made
        uint256 revealDeadline;      // Block deadline for reveal
        bool isRevealed;
        bool isExecuted;
    }
    
    // Gradual Redemption for Liquidity Crisis
    struct GradualRedemption {
        address user;
        address token;
        uint256 totalAmount;         // Total amount to redeem
        uint256 dailyLimit;          // Daily redemption limit
        uint256 completedAmount;     // Amount already redeemed
        uint256 startTime;           // When redemption started
        uint256 lastRedemptionTime;  // Last redemption timestamp
        bool isActive;
    }
    
    // Circuit Breaker for Emergency Situations
    struct CircuitBreaker {
        uint256 triggerThreshold;    // % drop that triggers circuit breaker
        uint256 cooldownPeriod;      // How long to pause trading
        uint256 lastTriggerTime;     // When last triggered
        bool isTriggered;
        bool isEnabled;
    }
    
    // State Variables
    mapping(address => OracleConfig) public oracleConfigs;
    mapping(address => PriceData) public latestPrices;
    mapping(bytes32 => CommitReveal) public commitReveals;
    mapping(address => GradualRedemption) public gradualRedemptions;
    mapping(address => CircuitBreaker) public circuitBreakers;
    
    // MEV Protection
    mapping(address => uint256) public lastSwapBlock;
    uint256 public minBlockDelay = 1;
    
    // Statistics
    uint256 public totalOracleManipulationAttempts;
    uint256 public totalMEVAttacksPrevented;
    uint256 public totalCircuitBreakerTriggers;
    
    // Events
    event OracleManipulationDetected(address indexed asset, uint256 expectedPrice, uint256 actualPrice);
    event MEVAttackPrevented(address indexed user, bytes32 indexed commitHash);
    event GradualRedemptionInitiated(address indexed user, address indexed token, uint256 totalAmount);
    event CircuitBreakerTriggered(address indexed asset, uint256 priceDropPercent);
    event PriceValidated(address indexed asset, uint256 price, uint256 confidence);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SECURITY_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_MANAGER_ROLE, msg.sender);
    }
    
    /**
     * @dev Get secure price with multi-oracle validation
     * @param asset The asset to get price for
     * @return price Validated price
     * @return confidence Confidence level (0-100)
     */
    function getSecurePrice(address asset) 
        external 
        view 
        returns (uint256 price, uint256 confidence) 
    {
        OracleConfig storage config = oracleConfigs[asset];
        require(config.isActive, "Oracle not configured for asset");

        EnhancedOracleManager manager = EnhancedOracleManager(address(config.primaryOracle));
        uint32 assetIndex = manager.assetToIndex(asset);
        require(assetIndex != 0, "Asset not registered in oracle manager");
        
        // Get primary price (Hyperliquid)
        uint256 primaryPrice = config.primaryOracle.getPrice(assetIndex);
        require(primaryPrice > 0, "Invalid primary price");
        
        if (config.backupOracles.length == 0) {
            return (primaryPrice, 50); // Lower confidence without backup oracles
        }
        
        // Validate against backup oracles
        uint256 validPrices = 1; // Primary is always counted
        uint256 priceSum = primaryPrice;
        
        for (uint i = 0; i < config.backupOracles.length; i++) {
            try config.backupOracles[i].getPrice(assetIndex) returns (uint256 backupPrice) {
                if (backupPrice > 0) {
                    uint256 deviation = _calculateDeviation(primaryPrice, backupPrice);
                    
                    if (deviation <= config.maxDeviation) {
                        priceSum += backupPrice;
                        validPrices++;
                    }
                }
            } catch {
                // Backup oracle failed, continue with others
                continue;
            }
        }
        
        // Calculate weighted average and confidence
        price = priceSum / validPrices;
        confidence = (validPrices * 100) / (config.backupOracles.length + 1);
        
        // Minimum confidence threshold
        require(confidence >= 60, "Price confidence too low");
    }
    
    /**
     * @dev Commit phase for MEV-protected transactions
     * @param commitment Hash of (amount, nonce, user address)
     */
    function commitTransaction(bytes32 commitment) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(commitment != bytes32(0), "Invalid commitment");
        require(commitReveals[commitment].commitBlock == 0, "Commitment already exists");
        require(
            block.number > lastSwapBlock[msg.sender] + minBlockDelay,
            "Too frequent transactions"
        );
        
        commitReveals[commitment] = CommitReveal({
            commitment: commitment,
            commitBlock: block.number,
            revealDeadline: block.number + MAX_COMMIT_BLOCKS,
            isRevealed: false,
            isExecuted: false
        });
        
        emit MEVAttackPrevented(msg.sender, commitment);
    }
    
    /**
     * @dev Reveal and execute MEV-protected transaction
     * @param amount The transaction amount
     * @param nonce Random nonce used in commitment
     */
    function revealAndExecute(uint256 amount, uint256 nonce) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        bytes32 commitment = keccak256(abi.encodePacked(amount, nonce, msg.sender));
        CommitReveal storage cr = commitReveals[commitment];
        
        require(cr.commitBlock > 0, "Invalid commitment");
        require(!cr.isRevealed, "Already revealed");
        require(block.number <= cr.revealDeadline, "Reveal deadline passed");
        require(
            block.number >= cr.commitBlock + MIN_COMMIT_BLOCKS,
            "Reveal too early"
        );
        
        cr.isRevealed = true;
        lastSwapBlock[msg.sender] = block.number;
        
        // Execute the protected transaction
        _executeProtectedTransaction(msg.sender, amount);
        
        cr.isExecuted = true;
    }
    
    /**
     * @dev Initialize gradual redemption for large amounts
     * @param token The token to redeem
     * @param totalAmount Total amount to redeem over time
     */
    function initiateGradualRedemption(address token, uint256 totalAmount) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(totalAmount > 0, "Invalid amount");
        require(!gradualRedemptions[msg.sender].isActive, "Redemption already active");
        
        uint256 dailyLimit = (totalAmount * GRADUAL_REDEMPTION_DAILY_LIMIT) / 10000;
        require(dailyLimit > 0, "Daily limit too small");
        
        gradualRedemptions[msg.sender] = GradualRedemption({
            user: msg.sender,
            token: token,
            totalAmount: totalAmount,
            dailyLimit: dailyLimit,
            completedAmount: 0,
            startTime: block.timestamp,
            lastRedemptionTime: 0,
            isActive: true
        });
        
        emit GradualRedemptionInitiated(msg.sender, token, totalAmount);
    }
    
    /**
     * @dev Execute daily redemption
     */
    function executeGradualRedemption() 
        external 
        nonReentrant 
        whenNotPaused 
    {
        GradualRedemption storage redemption = gradualRedemptions[msg.sender];
        require(redemption.isActive, "No active redemption");
        require(
            block.timestamp >= redemption.lastRedemptionTime + 1 days,
            "Daily limit not reset yet"
        );
        
        uint256 remainingAmount = redemption.totalAmount - redemption.completedAmount;
        uint256 redeemAmount = remainingAmount > redemption.dailyLimit ? 
            redemption.dailyLimit : remainingAmount;
        
        redemption.completedAmount += redeemAmount;
        redemption.lastRedemptionTime = block.timestamp;
        
        if (redemption.completedAmount >= redemption.totalAmount) {
            redemption.isActive = false;
        }
        
        // Execute actual redemption
        _executeRedemption(redemption.user, redemption.token, redeemAmount);
    }
    
    /**
     * @dev Check and trigger circuit breaker if needed
     * @param asset The asset to check
     * @param currentPrice Current asset price
     * @param previousPrice Previous asset price
     */
    function checkCircuitBreaker(
        address asset, 
        uint256 currentPrice, 
        uint256 previousPrice
    ) 
        external 
        onlyRole(SECURITY_ADMIN_ROLE) 
    {
        CircuitBreaker storage breaker = circuitBreakers[asset];
        if (!breaker.isEnabled || breaker.isTriggered) return;
        
        if (previousPrice > 0) {
            uint256 dropPercent = ((previousPrice - currentPrice) * 10000) / previousPrice;
            
            if (dropPercent >= breaker.triggerThreshold) {
                breaker.isTriggered = true;
                breaker.lastTriggerTime = block.timestamp;
                totalCircuitBreakerTriggers++;
                
                // Trigger emergency pause
                _pause();
                
                emit CircuitBreakerTriggered(asset, dropPercent);
            }
        }
    }
    
    /**
     * @dev Reset circuit breaker after cooldown period
     * @param asset The asset to reset circuit breaker for
     */
    function resetCircuitBreaker(address asset) 
        external 
        onlyRole(SECURITY_ADMIN_ROLE) 
    {
        CircuitBreaker storage breaker = circuitBreakers[asset];
        require(breaker.isTriggered, "Circuit breaker not triggered");
        require(
            block.timestamp >= breaker.lastTriggerTime + breaker.cooldownPeriod,
            "Cooldown period not finished"
        );
        
        breaker.isTriggered = false;
        _unpause();
    }
    
    // Internal Functions
    
    function _calculateDeviation(uint256 price1, uint256 price2) 
        internal 
        pure 
        returns (uint256) 
    {
        uint256 diff = price1 > price2 ? price1 - price2 : price2 - price1;
        return (diff * 10000) / price1;
    }
    
    function _executeProtectedTransaction(address user, uint256 amount) 
        internal 
    {
        // Implementation depends on specific transaction type
        // This is a placeholder for the actual transaction execution
    }
    
    function _executeRedemption(address user, address token, uint256 amount) 
        internal 
    {
        // Implementation depends on specific redemption mechanism
        // This is a placeholder for the actual redemption execution
    }
    
    // Admin Functions
    
    function configureOracle(
        address asset,
        IPriceFeed primaryOracle,
        IPriceFeed[] calldata backupOracles,
        uint256 maxDeviation
    ) 
        external 
        onlyRole(ORACLE_MANAGER_ROLE) 
    {
        oracleConfigs[asset] = OracleConfig({
            primaryOracle: primaryOracle,
            backupOracles: backupOracles,
            maxDeviation: maxDeviation,
            updateThreshold: 300, // 5 minutes
            isActive: true
        });
    }
    
    function configureCircuitBreaker(
        address asset,
        uint256 triggerThreshold,
        uint256 cooldownPeriod
    ) 
        external 
        onlyRole(SECURITY_ADMIN_ROLE) 
    {
        circuitBreakers[asset] = CircuitBreaker({
            triggerThreshold: triggerThreshold,
            cooldownPeriod: cooldownPeriod,
            lastTriggerTime: 0,
            isTriggered: false,
            isEnabled: true
        });
    }
    
    function setMinBlockDelay(uint256 _minBlockDelay) 
        external 
        onlyRole(SECURITY_ADMIN_ROLE) 
    {
        require(_minBlockDelay > 0 && _minBlockDelay <= 5, "Invalid block delay");
        minBlockDelay = _minBlockDelay;
    }
    
    function emergencyPause() external onlyRole(SECURITY_ADMIN_ROLE) {
        _pause();
    }
    
    function emergencyUnpause() external onlyRole(SECURITY_ADMIN_ROLE) {
        _unpause();
    }
}