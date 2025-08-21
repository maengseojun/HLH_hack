// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IRedemptionManager.sol";
import "./interfaces/IPriceFeed.sol";
import "./interfaces/IAMM.sol";
// import "./interfaces/IOrderbook.sol"; // Temporarily disabled for compilation
import "./interfaces/IMultiChainAggregator.sol";
import "./interfaces/IIndexTokenFactory.sol";
import "./interfaces/IChainVault.sol";

/**
 * @title RedemptionManager
 * @dev Enhanced redemption manager with AMM, Orderbook, and Multi-Chain integration
 * @notice Handles index token redemption with multiple liquidity sources and strategies
 */
contract RedemptionManager is AccessControl, ReentrancyGuard, IRedemptionManager {
    using SafeERC20 for IERC20;
    
    // Role definitions
    bytes32 public constant REDEMPTION_EXECUTOR_ROLE = keccak256("REDEMPTION_EXECUTOR_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    
    // Core contracts
    IPriceFeed public priceFeed;
    IAMM public amm;
    // IOrderbook public orderbook; // Temporarily disabled
    IMultiChainAggregator public multiChainAggregator;
    IIndexTokenFactory public indexTokenFactory;
    IChainVault public chainVault;
    
    // State variables
    mapping(uint256 => RedemptionRequest) private redemptionRequests;
    mapping(address => uint256[]) private userRedemptions;
    mapping(bytes32 => FundRedemptionLimits) private fundLimits;
    mapping(RedemptionStrategy => bool) private enabledStrategies;
    
    uint256 private nextRequestId = 1;
    bool public paused = false;
    
    // Configuration
    uint256 public defaultSlippageTolerance = 500;    // 5%
    uint256 public maxSlippageTolerance = 2000;       // 20%
    uint256 public executionDeadline = 3600;          // 1 hour
    uint256 public emergencySlippageTolerance = 5000; // 50%
    
    RedemptionStrategy[] public strategyPriorityOrder;
    
    // Fund-specific limits and settings
    struct FundRedemptionLimits {
        uint256 minimumAmount;     // Minimum redemption amount
        uint256 maximumAmount;     // Maximum redemption amount  
        uint256 dailyLimit;        // Daily redemption limit
        uint256 dailyRedeemed;     // Amount redeemed today
        uint256 lastResetDay;      // Last daily limit reset
        bool isActive;             // Whether redemptions are active
    }
    
    // Statistics tracking
    struct RedemptionStats {
        uint256 totalRedemptions;
        uint256 totalValueRedeemed;
        uint256 totalSlippage;
        uint256 successfulRedemptions;
    }
    
    mapping(bytes32 => RedemptionStats) private fundStats;
    RedemptionStats public globalStats;
    
    constructor(
        address _priceFeed,
        address _amm,
        address _multiChainAggregator,
        address _indexTokenFactory,
        address _chainVault
    ) {
        require(_priceFeed != address(0), "Invalid price feed");
        require(_amm != address(0), "Invalid AMM");
        require(_multiChainAggregator != address(0), "Invalid multi-chain aggregator");
        require(_indexTokenFactory != address(0), "Invalid index token factory");
        require(_chainVault != address(0), "Invalid chain vault");
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REDEMPTION_EXECUTOR_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        
        priceFeed = IPriceFeed(_priceFeed);
        amm = IAMM(_amm);
        // orderbook = IOrderbook(_orderbook); // Temporarily disabled
        multiChainAggregator = IMultiChainAggregator(_multiChainAggregator);
        indexTokenFactory = IIndexTokenFactory(_indexTokenFactory);
        chainVault = IChainVault(_chainVault);
        
        // Initialize enabled strategies
        enabledStrategies[RedemptionStrategy.OPTIMAL] = true;
        enabledStrategies[RedemptionStrategy.AMM_ONLY] = true;
        enabledStrategies[RedemptionStrategy.ORDERBOOK_ONLY] = true;
        enabledStrategies[RedemptionStrategy.MULTI_CHAIN] = true;
        enabledStrategies[RedemptionStrategy.EMERGENCY] = true;
        
        // Default strategy priority order
        strategyPriorityOrder.push(RedemptionStrategy.OPTIMAL);
        strategyPriorityOrder.push(RedemptionStrategy.AMM_ONLY);
        strategyPriorityOrder.push(RedemptionStrategy.ORDERBOOK_ONLY);
        strategyPriorityOrder.push(RedemptionStrategy.MULTI_CHAIN);
    }
    
    modifier whenNotPaused() {
        require(!paused, "Redemption paused");
        _;
    }
    
    modifier validStrategy(RedemptionStrategy strategy) {
        require(enabledStrategies[strategy], "Strategy not enabled");
        _;
    }
    
    modifier validRequestId(uint256 requestId) {
        require(requestId > 0 && requestId < nextRequestId, "Invalid request ID");
        _;
    }
    
    /**
     * @dev Request redemption of index tokens
     */
    function requestRedemption(
        bytes32 fundId,
        uint256 tokenAmount,
        RedemptionStrategy strategy,
        uint256 maxSlippage,
        uint256 minReturnAmount,
        uint256 deadline
    ) external override whenNotPaused validStrategy(strategy) nonReentrant returns (uint256 requestId) {
        require(tokenAmount > 0, "Amount must be positive");
        require(tokenAmount % 1e18 == 0, "Index tokens can only be redeemed in whole units (1, 2, 3...)");
        require(maxSlippage <= maxSlippageTolerance, "Slippage too high");
        require(deadline > block.timestamp, "Invalid deadline");
        
        // Check fund limits
        _checkFundLimits(fundId, tokenAmount);
        
        // Check eligibility
        (bool eligible, string memory reason) = _checkEligibility(msg.sender, fundId, tokenAmount, strategy);
        require(eligible, reason);
        
        requestId = nextRequestId++;
        
        // Calculate estimated value and routes
        (LiquidationRoute[] memory routes, uint256 estimatedReturn) = calculateOptimalRoute(
            fundId, tokenAmount, strategy, maxSlippage
        );
        
        // Create redemption request
        RedemptionRequest storage request = redemptionRequests[requestId];
        request.id = requestId;
        request.requester = msg.sender;
        request.fundId = fundId;
        request.tokenAmount = tokenAmount;
        request.estimatedValue = estimatedReturn;
        request.strategy = strategy;
        request.maxSlippage = maxSlippage;
        request.minReturnAmount = minReturnAmount;
        request.timestamp = block.timestamp;
        request.status = RedemptionStatus.PENDING;
        request.deadline = deadline;
        
        // Store routes (simplified for now)
        for (uint i = 0; i < routes.length && i < 10; i++) {
            request.routes.push(routes[i]);
        }
        
        userRedemptions[msg.sender].push(requestId);
        
        // Update daily limits
        _updateDailyLimits(fundId, tokenAmount);
        
        emit RedemptionRequested(
            msg.sender,
            fundId,
            tokenAmount,
            requestId,
            strategy,
            block.timestamp
        );
    }
    
    /**
     * @dev Execute a redemption request
     */
    function executeRedemption(uint256 requestId) 
        external 
        override 
        onlyRole(REDEMPTION_EXECUTOR_ROLE) 
        validRequestId(requestId) 
        nonReentrant 
        returns (bool success, uint256 totalReturned) 
    {
        RedemptionRequest storage request = redemptionRequests[requestId];
        require(request.status == RedemptionStatus.PENDING, "Request not pending");
        require(request.deadline > block.timestamp, "Request expired");
        
        request.status = RedemptionStatus.EXECUTING;
        
        try this._executeRedemptionInternal(requestId) returns (uint256 returned) {
            request.status = RedemptionStatus.COMPLETED;
            request.totalReturned = returned;
            totalReturned = returned;
            success = true;
            
            // Update statistics
            _updateStats(request.fundId, returned);
            
            emit RedemptionExecuted(
                requestId,
                request.fundId,
                request.tokenAmount,
                request.liquidations,
                returned,
                request.strategy
            );
            
        } catch Error(string memory reason) {
            request.status = RedemptionStatus.FAILED;
            request.failureReason = reason;
            success = false;
            
            emit RedemptionFailed(requestId, reason, block.timestamp);
        }
    }
    
    /**
     * @dev Internal execution logic (external for try-catch)
     * @notice Now uses direct native token return from vault instead of liquidation
     */
    function _executeRedemptionInternal(uint256 requestId) external returns (uint256 totalReturned) {
        require(msg.sender == address(this), "Internal function");
        
        RedemptionRequest storage request = redemptionRequests[requestId];
        
        // Get fund components
        IIndexTokenFactory.ComponentToken[] memory components = indexTokenFactory.getFundComponents(request.fundId);
        
        // Calculate proportional amounts to return
        (,,,address indexTokenAddress,,,,) = indexTokenFactory.getFundInfo(request.fundId);
        uint256 totalTokenSupply = IERC20(indexTokenAddress).totalSupply();
        
        // Check vault availability first
        for (uint i = 0; i < components.length; i++) {
            uint256 proportionalAmount = (components[i].depositedAmount * request.tokenAmount) / totalTokenSupply;
            
            if (proportionalAmount > 0) {
                require(
                    chainVault.hasSufficientBalance(request.fundId, components[i].tokenAddress, proportionalAmount),
                    string(abi.encodePacked("Insufficient vault balance for token: ", _addressToString(components[i].tokenAddress)))
                );
            }
        }
        
        // Execute direct token returns from vault
        for (uint i = 0; i < components.length; i++) {
            uint256 proportionalAmount = (components[i].depositedAmount * request.tokenAmount) / totalTokenSupply;
            
            if (proportionalAmount > 0) {
                // Directly withdraw native tokens from vault to user
                chainVault.withdrawTokens(
                    request.fundId,
                    components[i].tokenAddress,
                    proportionalAmount,
                    request.requester
                );
                
                totalReturned += proportionalAmount;
                
                // Record native token return (not liquidation)
                ComponentLiquidation memory tokenReturn = ComponentLiquidation({
                    tokenAddress: components[i].tokenAddress,
                    assetIndex: components[i].hyperliquidAssetIndex,
                    amount: proportionalAmount,
                    receivedAmount: proportionalAmount, // Direct 1:1 return
                    source: IPriceFeed.PriceSource.AMM, // Marked as vault return
                    priceImpact: 0, // No price impact for direct return
                    executionCost: 0, // No execution cost for direct return
                    chainId: block.chainid
                });
                
                request.liquidations.push(tokenReturn);
            }
        }
        
        // Burn the redeemed index tokens
        IERC20(indexTokenAddress).safeTransferFrom(request.requester, address(this), request.tokenAmount);
        
        // Note: In a complete implementation, you would call a burn function on the index token
        // This assumes the index token has a burn function that can be called by this contract
        
        require(totalReturned > 0, "No tokens returned");
    }
    
    /**
     * @dev Helper function to convert address to string for error messages
     */
    function _addressToString(address addr) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            str[2+i*2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3+i*2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }
        return string(str);
    }
    
    /**
     * @dev Check vault liquidity availability for redemption
     */
    function _checkVaultLiquidity(bytes32 fundId, uint256 tokenAmount) internal view returns (bool sufficient, string memory reason) {
        IIndexTokenFactory.ComponentToken[] memory components = indexTokenFactory.getFundComponents(fundId);
        (,,,address indexTokenAddress,,,,) = indexTokenFactory.getFundInfo(fundId);
        uint256 totalTokenSupply = IERC20(indexTokenAddress).totalSupply();
        
        for (uint i = 0; i < components.length; i++) {
            uint256 proportionalAmount = (components[i].depositedAmount * tokenAmount) / totalTokenSupply;
            
            if (proportionalAmount > 0) {
                if (!chainVault.hasSufficientBalance(fundId, components[i].tokenAddress, proportionalAmount)) {
                    return (false, string(abi.encodePacked("Insufficient vault balance for token: ", _addressToString(components[i].tokenAddress))));
                }
            }
        }
        
        return (true, "");
    }
    
    /**
     * @dev Calculate optimal liquidation route
     */
    function calculateOptimalRoute(
        bytes32 fundId,
        uint256 tokenAmount,
        RedemptionStrategy strategy,
        uint256 maxSlippage
    ) public view override returns (LiquidationRoute[] memory routes, uint256 estimatedReturn) {
        // Simplified route calculation
        // In real implementation, this would analyze liquidity across all sources
        
        IIndexTokenFactory.ComponentToken[] memory components = indexTokenFactory.getFundComponents(fundId);
        routes = new LiquidationRoute[](components.length);
        
        (,,,address indexTokenAddress,,,,) = indexTokenFactory.getFundInfo(fundId);
        uint256 totalTokenSupply = IERC20(indexTokenAddress).totalSupply();
        
        for (uint i = 0; i < components.length; i++) {
            uint256 proportionalAmount = (components[i].depositedAmount * tokenAmount) / totalTokenSupply;
            uint256 price = priceFeed.getPrice(components[i].hyperliquidAssetIndex);
            
            routes[i] = LiquidationRoute({
                assetIndex: components[i].hyperliquidAssetIndex,
                amount: proportionalAmount,
                sources: new IPriceFeed.PriceSource[](1),
                amounts: new uint256[](1),
                expectedPrices: new uint256[](1),
                totalPriceImpact: 50, // 0.5%
                estimatedGas: 100000, // 100k gas
                executionChain: block.chainid,
                requiresCrossChain: false
            });
            
            routes[i].sources[0] = IPriceFeed.PriceSource.AMM;
            routes[i].amounts[0] = proportionalAmount;
            routes[i].expectedPrices[0] = price;
            
            estimatedReturn += proportionalAmount * price / 1e18;
        }
    }
    
    // Helper functions
    
    function _checkFundLimits(bytes32 fundId, uint256 amount) internal view {
        FundRedemptionLimits memory limits = fundLimits[fundId];
        if (limits.isActive) {
            require(amount >= limits.minimumAmount, "Below minimum amount");
            require(amount <= limits.maximumAmount, "Above maximum amount");
            
            // Check daily limits
            uint256 currentDay = block.timestamp / 86400;
            if (limits.lastResetDay == currentDay) {
                require(limits.dailyRedeemed + amount <= limits.dailyLimit, "Daily limit exceeded");
            }
        }
    }
    
    function _updateDailyLimits(bytes32 fundId, uint256 amount) internal {
        FundRedemptionLimits storage limits = fundLimits[fundId];
        uint256 currentDay = block.timestamp / 86400;
        
        if (limits.lastResetDay != currentDay) {
            limits.dailyRedeemed = 0;
            limits.lastResetDay = currentDay;
        }
        
        limits.dailyRedeemed += amount;
    }
    
    function _updateStats(bytes32 fundId, uint256 valueRedeemed) internal {
        fundStats[fundId].totalRedemptions++;
        fundStats[fundId].totalValueRedeemed += valueRedeemed;
        fundStats[fundId].successfulRedemptions++;
        
        globalStats.totalRedemptions++;
        globalStats.totalValueRedeemed += valueRedeemed;
        globalStats.successfulRedemptions++;
    }
    
    // View functions implementation will continue in next part...
    
    /**
     * @dev Get redemption request details
     */
    function getRedemptionRequest(uint256 requestId) 
        external 
        view 
        override 
        validRequestId(requestId) 
        returns (RedemptionRequest memory) 
    {
        return redemptionRequests[requestId];
    }
    
    /**
     * @dev Get active redemptions for a user
     */
    function getActiveRedemptions(address user) 
        external 
        view 
        override 
        returns (uint256[] memory requestIds) 
    {
        uint256[] memory allRequests = userRedemptions[user];
        uint256 activeCount = 0;
        
        // Count active requests
        for (uint i = 0; i < allRequests.length; i++) {
            RedemptionStatus status = redemptionRequests[allRequests[i]].status;
            if (status == RedemptionStatus.PENDING || 
                status == RedemptionStatus.VALIDATING || 
                status == RedemptionStatus.EXECUTING) {
                activeCount++;
            }
        }
        
        // Build active requests array
        requestIds = new uint256[](activeCount);
        uint256 index = 0;
        for (uint i = 0; i < allRequests.length; i++) {
            RedemptionStatus status = redemptionRequests[allRequests[i]].status;
            if (status == RedemptionStatus.PENDING || 
                status == RedemptionStatus.VALIDATING || 
                status == RedemptionStatus.EXECUTING) {
                requestIds[index++] = allRequests[i];
            }
        }
    }
    
    // Placeholder implementations for remaining interface functions
    
    function executeBatchRedemption(uint256[] memory requestIds) 
        external 
        override 
        returns (bool[] memory successes, uint256[] memory totalReturned) 
    {
        // Implementation needed
        successes = new bool[](requestIds.length);
        totalReturned = new uint256[](requestIds.length);
    }
    
    function cancelRedemption(uint256 requestId) external override returns (bool success) {
        // Implementation needed
        return false;
    }
    
    function previewRedemption(bytes32 fundId, uint256 tokenAmount, RedemptionStrategy strategy) 
        external 
        view 
        override 
        returns (uint256 estimatedReturn, uint256 totalPriceImpact, uint256 estimatedGasCost, ComponentLiquidation[] memory preview) 
    {
        // Implementation needed
        preview = new ComponentLiquidation[](0);
    }
    
    function getUserRedemptionHistory(address user, uint256 limit, uint256 offset) 
        external 
        view 
        override 
        returns (RedemptionRequest[] memory requests) 
    {
        // Implementation needed
        requests = new RedemptionRequest[](0);
    }
    
    function calculateRedemptionValue(bytes32 fundId, uint256 tokenAmount) 
        external 
        view 
        override 
        returns (uint256 totalValue, ComponentLiquidation[] memory breakdown) 
    {
        // Implementation needed
        breakdown = new ComponentLiquidation[](0);
    }
    
    function isEligibleForRedemption(address user, bytes32 fundId, uint256 tokenAmount, RedemptionStrategy strategy) 
        external 
        view 
        override 
        returns (bool eligible, string memory reason) 
    {
        return _checkEligibility(user, fundId, tokenAmount, strategy);
    }
    
    function _checkEligibility(address user, bytes32 fundId, uint256 tokenAmount, RedemptionStrategy strategy) 
        internal 
        view 
        returns (bool eligible, string memory reason) 
    {
        // Basic eligibility check
        if (paused) {
            return (false, "Redemption paused");
        }
        
        if (!enabledStrategies[strategy]) {
            return (false, "Strategy not enabled");
        }
        
        // Check if user has enough index tokens
        (,,,address indexTokenAddress,,,,) = indexTokenFactory.getFundInfo(fundId);
        if (indexTokenAddress != address(0)) {
            uint256 userBalance = IERC20(indexTokenAddress).balanceOf(user);
            if (userBalance < tokenAmount) {
                return (false, "Insufficient index token balance");
            }
        }
        
        // Check vault liquidity availability
        (bool liquidityAvailable, string memory liquidityReason) = _checkVaultLiquidity(fundId, tokenAmount);
        if (!liquidityAvailable) {
            return (false, liquidityReason);
        }
        
        return (true, "");
    }
    
    function checkLiquidityAvailability(bytes32 fundId, uint256 tokenAmount, RedemptionStrategy strategy) 
        external 
        view 
        override 
        returns (bool sufficient, string[] memory insufficientAssets, uint256[] memory shortfalls) 
    {
        IIndexTokenFactory.ComponentToken[] memory components = indexTokenFactory.getFundComponents(fundId);
        (,,,address indexTokenAddress,,,,) = indexTokenFactory.getFundInfo(fundId);
        uint256 totalTokenSupply = IERC20(indexTokenAddress).totalSupply();
        
        // Count insufficient assets
        uint256 insufficientCount = 0;
        string[] memory tempAssets = new string[](components.length);
        uint256[] memory tempShortfalls = new uint256[](components.length);
        
        for (uint i = 0; i < components.length; i++) {
            uint256 proportionalAmount = (components[i].depositedAmount * tokenAmount) / totalTokenSupply;
            
            if (proportionalAmount > 0) {
                IChainVault.VaultBalance memory balance = chainVault.getVaultBalance(fundId, components[i].tokenAddress);
                
                if (balance.availableBalance < proportionalAmount) {
                    tempAssets[insufficientCount] = _addressToString(components[i].tokenAddress);
                    tempShortfalls[insufficientCount] = proportionalAmount - balance.availableBalance;
                    insufficientCount++;
                }
            }
        }
        
        sufficient = (insufficientCount == 0);
        
        // Resize arrays to actual insufficient count
        insufficientAssets = new string[](insufficientCount);
        shortfalls = new uint256[](insufficientCount);
        
        for (uint i = 0; i < insufficientCount; i++) {
            insufficientAssets[i] = tempAssets[i];
            shortfalls[i] = tempShortfalls[i];
        }
    }
    
    function getRedemptionStats(bytes32 fundId) 
        external 
        view 
        override 
        returns (uint256 totalRedemptions, uint256 totalValueRedeemed, uint256 averageSlippage, uint256 successRate) 
    {
        RedemptionStats memory stats = fundStats[fundId];
        totalRedemptions = stats.totalRedemptions;
        totalValueRedeemed = stats.totalValueRedeemed;
        averageSlippage = stats.totalRedemptions > 0 ? stats.totalSlippage / stats.totalRedemptions : 0;
        successRate = stats.totalRedemptions > 0 ? (stats.successfulRedemptions * 10000) / stats.totalRedemptions : 0;
    }
    
    function getOptimalStrategyForAmount(bytes32 fundId, uint256 tokenAmount) 
        external 
        view 
        override 
        returns (RedemptionStrategy recommendedStrategy, string memory reason) 
    {
        // Simple logic for now
        if (tokenAmount < 1000e18) {
            recommendedStrategy = RedemptionStrategy.AMM_ONLY;
            reason = "Small amount, AMM is most efficient";
        } else {
            recommendedStrategy = RedemptionStrategy.OPTIMAL;
            reason = "Large amount, optimal routing recommended";
        }
    }
    
    // Admin functions
    
    function setPriceFeed(address _priceFeed) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_priceFeed != address(0), "Invalid address");
        priceFeed = IPriceFeed(_priceFeed);
    }
    
    function setAMM(address _amm) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_amm != address(0), "Invalid address");
        amm = IAMM(_amm);
    }
    
    function setOrderbook(address _orderbook) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_orderbook != address(0), "Invalid address");
        // orderbook = IOrderbook(_orderbook); // Temporarily disabled
    }
    
    function setMultiChainAggregator(address _aggregator) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_aggregator != address(0), "Invalid address");
        multiChainAggregator = IMultiChainAggregator(_aggregator);
    }
    
    function setIndexTokenFactory(address _factory) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_factory != address(0), "Invalid address");
        indexTokenFactory = IIndexTokenFactory(_factory);
    }
    
    function setChainVault(address _chainVault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_chainVault != address(0), "Invalid address");
        chainVault = IChainVault(_chainVault);
    }
    
    function setMinimumRedemptionAmount(bytes32 fundId, uint256 amount) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        fundLimits[fundId].minimumAmount = amount;
    }
    
    function setMaximumRedemptionAmount(bytes32 fundId, uint256 amount) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        fundLimits[fundId].maximumAmount = amount;
    }
    
    function setDefaultSlippageTolerance(uint256 tolerance) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(tolerance <= maxSlippageTolerance, "Exceeds maximum");
        defaultSlippageTolerance = tolerance;
    }
    
    function setMaxSlippageTolerance(uint256 tolerance) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(tolerance <= 10000, "Cannot exceed 100%");
        maxSlippageTolerance = tolerance;
    }
    
    function setExecutionDeadline(uint256 deadline) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        executionDeadline = deadline;
    }
    
    function enableRedemptionStrategy(RedemptionStrategy strategy, bool enabled) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        enabledStrategies[strategy] = enabled;
    }
    
    function setStrategyPriorityOrder(RedemptionStrategy[] memory strategies) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        delete strategyPriorityOrder;
        for (uint i = 0; i < strategies.length; i++) {
            strategyPriorityOrder.push(strategies[i]);
        }
    }
    
    function setEmergencySlippageTolerance(uint256 tolerance) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        emergencySlippageTolerance = tolerance;
    }
    
    function emergencyPause() external override onlyRole(EMERGENCY_ROLE) {
        paused = true;
    }
    
    function emergencyUnpause() external override onlyRole(EMERGENCY_ROLE) {
        paused = false;
    }
    
    function emergencyLiquidatePosition(bytes32 fundId, uint32 assetIndex, uint256 amount, address recipient) 
        external 
        override 
        onlyRole(EMERGENCY_ROLE) 
    {
        // Emergency liquidation implementation
        // This would bypass normal redemption flow
    }
    
    // View functions for admin state
    
    function isPaused() external view override returns (bool) {
        return paused;
    }
    
    function getPriceFeed() external view override returns (address) {
        return address(priceFeed);
    }
    
    function getAMM() external view override returns (address) {
        return address(amm);
    }
    
    function getOrderbook() external view override returns (address) {
        return address(0); // return address(orderbook); // Temporarily disabled
    }
    
    function getMultiChainAggregator() external view override returns (address) {
        return address(multiChainAggregator);
    }
    
    function getIndexTokenFactory() external view override returns (address) {
        return address(indexTokenFactory);
    }
    
    function getMinimumRedemptionAmount(bytes32 fundId) external view override returns (uint256) {
        return fundLimits[fundId].minimumAmount;
    }
    
    function getMaximumRedemptionAmount(bytes32 fundId) external view override returns (uint256) {
        return fundLimits[fundId].maximumAmount;
    }
    
    function getDefaultSlippageTolerance() external view override returns (uint256) {
        return defaultSlippageTolerance;
    }
    
    function getMaxSlippageTolerance() external view override returns (uint256) {
        return maxSlippageTolerance;
    }
    
    function getExecutionDeadline() external view override returns (uint256) {
        return executionDeadline;
    }
    
    function isStrategyEnabled(RedemptionStrategy strategy) external view override returns (bool) {
        return enabledStrategies[strategy];
    }
    
    function getStrategyPriorityOrder() external view override returns (RedemptionStrategy[] memory) {
        return strategyPriorityOrder;
    }
    
    function getTotalRedemptions() external view override returns (uint256) {
        return globalStats.totalRedemptions;
    }
    
    function getTotalValueRedeemed() external view override returns (uint256) {
        return globalStats.totalValueRedeemed;
    }
    
    function getChainVault() external view returns (address) {
        return address(chainVault);
    }
}