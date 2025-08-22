// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./HyperIndexVault.sol";
import "./interfaces/IDEXAggregator.sol";

/**
 * @title RebalancingVault
 * @dev HyperIndexVault with automatic rebalancing via DEX aggregator
 * @notice Extends HyperIndexVault with 1inch-style DEX integration for rebalancing
 */
contract RebalancingVault is HyperIndexVault {
    
    IDEXAggregator public dexAggregator;
    
    // Rebalancing configuration
    uint256 public maxSlippageBps = 200; // 2% max slippage
    uint256 public minSwapAmount = 1e18; // Minimum swap amount (1 token unit)
    uint256 public rebalanceGasLimit = 500000; // Gas limit for rebalancing
    
    // Rebalancing strategy
    struct RebalanceStrategy {
        bool autoRebalanceEnabled;
        uint256 rebalanceInterval; // Minimum time between rebalances
        uint256 deviationThresholdBps; // Minimum deviation to trigger rebalance
        uint256 maxSingleSwapBps; // Maximum single swap as % of total portfolio
    }
    
    RebalanceStrategy public strategy;
    
    // Swap tracking
    struct SwapRecord {
        address fromToken;
        address toToken;
        uint256 amountIn;
        uint256 amountOut;
        uint256 timestamp;
        string protocol;
    }
    
    SwapRecord[] public swapHistory;
    mapping(address => uint256) public tokenSwapVolume; // Total volume swapped per token
    
    // Events
    event DEXAggregatorUpdated(address indexed oldAggregator, address indexed newAggregator);
    event AutoRebalanceExecuted(
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut,
        string protocol
    );
    event RebalanceStrategyUpdated(
        bool autoEnabled,
        uint256 interval,
        uint256 deviationThreshold,
        uint256 maxSingleSwap
    );
    event SwapExecuted(
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut,
        address indexed initiator
    );
    
    modifier onlyWhenRebalanceEnabled() {
        require(strategy.autoRebalanceEnabled, "Auto rebalance disabled");
        _;
    }
    
    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol
    ) HyperIndexVault(_asset, _name, _symbol) {
        // Initialize default strategy
        strategy = RebalanceStrategy({
            autoRebalanceEnabled: true,
            rebalanceInterval: 1 hours,
            deviationThresholdBps: 500, // 5%
            maxSingleSwapBps: 1000 // 10%
        });
    }
    
    /**
     * @dev Set DEX aggregator
     */
    function setDEXAggregator(address _dexAggregator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_dexAggregator != address(0), "Invalid aggregator address");
        
        address oldAggregator = address(dexAggregator);
        dexAggregator = IDEXAggregator(_dexAggregator);
        
        emit DEXAggregatorUpdated(oldAggregator, _dexAggregator);
    }
    
    /**
     * @dev Enhanced auto-rebalancing with DEX integration
     */
    function autoRebalance() public override onlyWhenRebalanceEnabled {
        require(address(dexAggregator) != address(0), "DEX aggregator not set");
        require(
            block.timestamp >= lastRebalanceTime + strategy.rebalanceInterval,
            "Too soon to rebalance"
        );
        
        (bool needed, address fromToken, address toToken, uint256 amount) = checkRebalanceNeeded();
        
        if (!needed) {
            return;
        }
        
        // Limit swap size
        uint256 totalPortfolioValue = _getTotalPortfolioValue();
        uint256 maxSwapValue = (totalPortfolioValue * strategy.maxSingleSwapBps) / 10000;
        
        if (amount > maxSwapValue) {
            amount = maxSwapValue;
        }
        
        if (amount < minSwapAmount) {
            return; // Amount too small to swap
        }
        
        // Execute rebalance via DEX
        _executeRebalanceSwap(fromToken, toToken, amount);
        
        lastRebalanceTime = block.timestamp;
    }
    
    /**
     * @dev Execute rebalance swap via DEX aggregator
     */
    function _executeRebalanceSwap(
        address fromToken,
        address toToken,
        uint256 amount
    ) internal {
        require(address(dexAggregator) != address(0), "DEX aggregator not set");
        
        // Check if pair is supported
        require(dexAggregator.isPairSupported(fromToken, toToken), "Pair not supported");
        
        // Get current balance
        uint256 availableBalance = IERC20(fromToken).balanceOf(address(this));
        if (amount > availableBalance) {
            amount = availableBalance;
        }
        
        if (amount == 0) {
            return;
        }
        
        // Get quote
        IDEXAggregator.QuoteResult memory quote = dexAggregator.getQuote(
            fromToken,
            toToken,
            amount
        );
        
        // Calculate minimum return with slippage protection
        uint256 minReturn = (quote.returnAmount * (10000 - maxSlippageBps)) / 10000;
        
        // Approve DEX aggregator
        IERC20(fromToken).approve(address(dexAggregator), amount);
        
        // Prepare swap parameters
        IDEXAggregator.SwapParams memory params = IDEXAggregator.SwapParams({
            srcToken: fromToken,
            destToken: toToken,
            amount: amount,
            minReturn: minReturn,
            distribution: quote.distribution,
            flags: 0
        });
        
        // Execute swap
        IDEXAggregator.SwapResult memory result = dexAggregator.swap(params);
        
        // Record swap
        _recordSwap(fromToken, toToken, amount, result.returnAmount, result.protocol);
        
        emit AutoRebalanceExecuted(
            fromToken,
            toToken,
            amount,
            result.returnAmount,
            result.protocol
        );
    }
    
    /**
     * @dev Manual swap function for portfolio management
     */
    function executeManualSwap(
        address fromToken,
        address toToken,
        uint256 amount,
        uint256 minReturn
    ) external onlyRole(MANAGER_ROLE) nonReentrant {
        require(address(dexAggregator) != address(0), "DEX aggregator not set");
        require(amount > 0, "Amount must be positive");
        require(_findTokenIndex(fromToken) != type(uint256).max, "From token not in portfolio");
        require(_findTokenIndex(toToken) != type(uint256).max, "To token not in portfolio");
        
        // Check available balance
        uint256 availableBalance = IERC20(fromToken).balanceOf(address(this));
        require(amount <= availableBalance, "Insufficient balance");
        
        // Get quote
        IDEXAggregator.QuoteResult memory quote = dexAggregator.getQuote(
            fromToken,
            toToken,
            amount
        );
        
        require(quote.returnAmount >= minReturn, "Return amount too low");
        
        // Approve and execute swap
        IERC20(fromToken).approve(address(dexAggregator), amount);
        
        IDEXAggregator.SwapParams memory params = IDEXAggregator.SwapParams({
            srcToken: fromToken,
            destToken: toToken,
            amount: amount,
            minReturn: minReturn,
            distribution: quote.distribution,
            flags: 0
        });
        
        IDEXAggregator.SwapResult memory result = dexAggregator.swap(params);
        
        // Record swap
        _recordSwap(fromToken, toToken, amount, result.returnAmount, result.protocol);
        
        emit SwapExecuted(fromToken, toToken, amount, result.returnAmount, msg.sender);
    }
    
    /**
     * @dev Get swap quote for manual verification
     */
    function getSwapQuote(
        address fromToken,
        address toToken,
        uint256 amount
    ) external view returns (IDEXAggregator.QuoteResult memory) {
        require(address(dexAggregator) != address(0), "DEX aggregator not set");
        return dexAggregator.getQuote(fromToken, toToken, amount);
    }
    
    /**
     * @dev Enhanced rebalance check with improved logic
     */
    function checkRebalanceNeeded() 
        public 
        view 
        override 
        returns (bool needed, address fromToken, address toToken, uint256 amount) 
    {
        uint256 totalValue = _getTotalPortfolioValue();
        if (totalValue == 0) {
            return (false, address(0), address(0), 0);
        }
        
        uint256 maxDeviation = 0;
        uint256 fromIdx = 0;
        uint256 toIdx = 0;
        
        // Find the largest deviation
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            uint256 currentRatio = _getCurrentRatio(i);
            uint256 targetRatio = targetAllocations[i];
            
            if (currentRatio > targetRatio) {
                uint256 deviation = currentRatio - targetRatio;
                if (deviation > maxDeviation && deviation >= strategy.deviationThresholdBps) {
                    maxDeviation = deviation;
                    fromIdx = i;
                    
                    // Find the most under-allocated token to swap to
                    uint256 maxUnderAllocation = 0;
                    for (uint256 j = 0; j < underlyingTokens.length; j++) {
                        if (i == j) continue;
                        
                        uint256 otherCurrentRatio = _getCurrentRatio(j);
                        uint256 otherTargetRatio = targetAllocations[j];
                        
                        if (otherTargetRatio > otherCurrentRatio) {
                            uint256 underAllocation = otherTargetRatio - otherCurrentRatio;
                            if (underAllocation > maxUnderAllocation) {
                                maxUnderAllocation = underAllocation;
                                toIdx = j;
                            }
                        }
                    }
                }
            }
        }
        
        if (maxDeviation >= strategy.deviationThresholdBps && toIdx != fromIdx) {
            fromToken = underlyingTokens[fromIdx];
            toToken = underlyingTokens[toIdx];
            amount = (maxDeviation * totalValue) / 10000;
            needed = true;
        }
        
        return (needed, fromToken, toToken, amount);
    }
    
    /**
     * @dev Record swap for analytics
     */
    function _recordSwap(
        address fromToken,
        address toToken,
        uint256 amountIn,
        uint256 amountOut,
        string memory protocol
    ) internal {
        swapHistory.push(SwapRecord({
            fromToken: fromToken,
            toToken: toToken,
            amountIn: amountIn,
            amountOut: amountOut,
            timestamp: block.timestamp,
            protocol: protocol
        }));
        
        tokenSwapVolume[fromToken] += amountIn;
    }
    
    /**
     * @dev Update rebalancing strategy
     */
    function updateRebalanceStrategy(
        bool autoEnabled,
        uint256 interval,
        uint256 deviationThreshold,
        uint256 maxSingleSwap
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(interval >= 10 minutes, "Interval too short");
        require(deviationThreshold >= 100, "Threshold too low"); // Min 1%
        require(deviationThreshold <= 2000, "Threshold too high"); // Max 20%
        require(maxSingleSwap <= 2000, "Max swap too high"); // Max 20%
        
        strategy.autoRebalanceEnabled = autoEnabled;
        strategy.rebalanceInterval = interval;
        strategy.deviationThresholdBps = deviationThreshold;
        strategy.maxSingleSwapBps = maxSingleSwap;
        
        emit RebalanceStrategyUpdated(autoEnabled, interval, deviationThreshold, maxSingleSwap);
    }
    
    /**
     * @dev Set maximum slippage for swaps
     */
    function setMaxSlippage(uint256 _maxSlippageBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_maxSlippageBps <= 1000, "Slippage too high"); // Max 10%
        maxSlippageBps = _maxSlippageBps;
        emit MaxSlippageUpdated(_maxSlippageBps);
    }
    
    /**
     * @dev Get swap history count
     */
    function getSwapHistoryCount() external view returns (uint256) {
        return swapHistory.length;
    }
    
    /**
     * @dev Get swap history entry
     */
    function getSwapHistory(uint256 index) external view returns (SwapRecord memory) {
        require(index < swapHistory.length, "Index out of bounds");
        return swapHistory[index];
    }
    
    /**
     * @dev Get total swap volume for a token
     */
    function getTokenSwapVolume(address token) external view returns (uint256) {
        return tokenSwapVolume[token];
    }
    
    /**
     * @dev Emergency function to disable auto-rebalancing
     */
    function emergencyDisableRebalancing() external onlyRole(EMERGENCY_ROLE) {
        strategy.autoRebalanceEnabled = false;
        emit EmergencyRebalanceDisabled(block.timestamp);
    }
    
    // Additional events
    event RebalanceError(address indexed fromToken, address indexed toToken, uint256 amount, string reason);
    event MaxSlippageUpdated(uint256 newSlippage);
    event EmergencyRebalanceDisabled(uint256 timestamp);
}