// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IPriceFeed.sol";

/**
 * @title IRedemptionManager
 * @notice Interface for the Redemption Manager
 * @dev Handles index token redemption with multiple strategies
 */
interface IRedemptionManager {
    /**
     * @notice Redemption strategy enumeration
     */
    enum RedemptionStrategy {
        OPTIMAL,           // Automatically choose best route
        AMM_ONLY,          // Use only AMM
        ORDERBOOK_ONLY,    // Use only orderbook
        MULTI_CHAIN,       // Cross-chain redemption
        EMERGENCY          // Emergency liquidation
    }
    
    /**
     * @notice Redemption status enumeration
     */
    enum RedemptionStatus {
        PENDING,           // Waiting for execution
        VALIDATING,        // Being validated
        EXECUTING,         // Currently executing
        COMPLETED,         // Successfully completed
        FAILED,            // Execution failed
        CANCELLED          // Cancelled by user
    }
    
    /**
     * @notice Component liquidation details
     */
    struct ComponentLiquidation {
        address tokenAddress;
        uint32 assetIndex;
        uint256 amount;
        uint256 receivedAmount;
        IPriceFeed.PriceSource source;
        uint256 priceImpact;       // In basis points
        uint256 executionCost;     // Gas cost
        uint256 chainId;
    }
    
    /**
     * @notice Liquidation route information
     */
    struct LiquidationRoute {
        uint32 assetIndex;
        uint256 amount;
        IPriceFeed.PriceSource[] sources;
        uint256[] amounts;
        uint256[] expectedPrices;
        uint256 totalPriceImpact;
        uint256 estimatedGas;
        uint256 executionChain;
        bool requiresCrossChain;
    }
    
    /**
     * @notice Redemption request structure
     */
    struct RedemptionRequest {
        uint256 id;
        address requester;
        bytes32 fundId;
        uint256 tokenAmount;
        uint256 estimatedValue;
        RedemptionStrategy strategy;
        uint256 maxSlippage;
        uint256 minReturnAmount;
        uint256 timestamp;
        uint256 deadline;
        RedemptionStatus status;
        LiquidationRoute[] routes;
        ComponentLiquidation[] liquidations;
        uint256 totalReturned;
        string failureReason;
    }
    
    /**
     * @notice Events
     */
    event RedemptionRequested(
        address indexed requester,
        bytes32 indexed fundId,
        uint256 tokenAmount,
        uint256 requestId,
        RedemptionStrategy strategy,
        uint256 timestamp
    );
    
    event RedemptionExecuted(
        uint256 indexed requestId,
        bytes32 indexed fundId,
        uint256 tokenAmount,
        ComponentLiquidation[] liquidations,
        uint256 totalReturned,
        RedemptionStrategy strategy
    );
    
    event RedemptionFailed(
        uint256 indexed requestId,
        string reason,
        uint256 timestamp
    );
    
    event RedemptionCancelled(
        uint256 indexed requestId,
        address indexed requester,
        uint256 timestamp
    );
    
    /**
     * @notice Request redemption of index tokens
     * @param fundId Fund identifier
     * @param tokenAmount Amount of tokens to redeem
     * @param strategy Redemption strategy
     * @param maxSlippage Maximum allowed slippage (basis points)
     * @param minReturnAmount Minimum acceptable return amount
     * @param deadline Execution deadline
     * @return requestId Redemption request ID
     */
    function requestRedemption(
        bytes32 fundId,
        uint256 tokenAmount,
        RedemptionStrategy strategy,
        uint256 maxSlippage,
        uint256 minReturnAmount,
        uint256 deadline
    ) external returns (uint256 requestId);
    
    /**
     * @notice Execute a redemption request
     * @param requestId Request ID to execute
     * @return success True if successful
     * @return totalReturned Total amount returned
     */
    function executeRedemption(uint256 requestId) 
        external 
        returns (bool success, uint256 totalReturned);
    
    /**
     * @notice Execute multiple redemptions in batch
     * @param requestIds Array of request IDs
     * @return successes Array of success flags
     * @return totalReturned Array of returned amounts
     */
    function executeBatchRedemption(uint256[] memory requestIds)
        external
        returns (bool[] memory successes, uint256[] memory totalReturned);
    
    /**
     * @notice Cancel a pending redemption
     * @param requestId Request ID to cancel
     * @return success True if cancelled
     */
    function cancelRedemption(uint256 requestId) external returns (bool success);
    
    /**
     * @notice Calculate optimal liquidation route
     * @param fundId Fund identifier
     * @param tokenAmount Amount to redeem
     * @param strategy Redemption strategy
     * @param maxSlippage Maximum slippage
     * @return routes Optimal liquidation routes
     * @return estimatedReturn Estimated total return
     */
    function calculateOptimalRoute(
        bytes32 fundId,
        uint256 tokenAmount,
        RedemptionStrategy strategy,
        uint256 maxSlippage
    ) external view returns (
        LiquidationRoute[] memory routes,
        uint256 estimatedReturn
    );
    
    /**
     * @notice Preview redemption without executing
     * @param fundId Fund identifier
     * @param tokenAmount Amount to redeem
     * @param strategy Redemption strategy
     * @return estimatedReturn Estimated return amount
     * @return totalPriceImpact Total price impact
     * @return estimatedGasCost Estimated gas cost
     * @return preview Component liquidation preview
     */
    function previewRedemption(
        bytes32 fundId,
        uint256 tokenAmount,
        RedemptionStrategy strategy
    ) external view returns (
        uint256 estimatedReturn,
        uint256 totalPriceImpact,
        uint256 estimatedGasCost,
        ComponentLiquidation[] memory preview
    );
    
    /**
     * @notice Get redemption request details
     * @param requestId Request ID
     * @return request Full request details
     */
    function getRedemptionRequest(uint256 requestId)
        external
        view
        returns (RedemptionRequest memory request);
    
    /**
     * @notice Get user's redemption history
     * @param user User address
     * @param limit Maximum number of records
     * @param offset Starting offset
     * @return requests Array of redemption requests
     */
    function getUserRedemptionHistory(
        address user,
        uint256 limit,
        uint256 offset
    ) external view returns (RedemptionRequest[] memory requests);
    
    /**
     * @notice Get active redemptions for user
     * @param user User address
     * @return requestIds Array of active request IDs
     */
    function getActiveRedemptions(address user)
        external
        view
        returns (uint256[] memory requestIds);
    
    /**
     * @notice Calculate redemption value
     * @param fundId Fund identifier
     * @param tokenAmount Amount to redeem
     * @return totalValue Total value in USDC
     * @return breakdown Component breakdown
     */
    function calculateRedemptionValue(
        bytes32 fundId,
        uint256 tokenAmount
    ) external view returns (
        uint256 totalValue,
        ComponentLiquidation[] memory breakdown
    );
    
    /**
     * @notice Check if user is eligible for redemption
     * @param user User address
     * @param fundId Fund identifier
     * @param tokenAmount Amount to redeem
     * @param strategy Redemption strategy
     * @return eligible True if eligible
     * @return reason Reason if not eligible
     */
    function isEligibleForRedemption(
        address user,
        bytes32 fundId,
        uint256 tokenAmount,
        RedemptionStrategy strategy
    ) external view returns (bool eligible, string memory reason);
    
    /**
     * @notice Check liquidity availability
     * @param fundId Fund identifier
     * @param tokenAmount Amount to redeem
     * @param strategy Redemption strategy
     * @return sufficient True if sufficient liquidity
     * @return insufficientAssets Assets with insufficient liquidity
     * @return shortfalls Shortfall amounts
     */
    function checkLiquidityAvailability(
        bytes32 fundId,
        uint256 tokenAmount,
        RedemptionStrategy strategy
    ) external view returns (
        bool sufficient,
        string[] memory insufficientAssets,
        uint256[] memory shortfalls
    );
    
    /**
     * @notice Get redemption statistics
     * @param fundId Fund identifier
     * @return totalRedemptions Total number of redemptions
     * @return totalValueRedeemed Total value redeemed
     * @return averageSlippage Average slippage (basis points)
     * @return successRate Success rate (basis points)
     */
    function getRedemptionStats(bytes32 fundId)
        external
        view
        returns (
            uint256 totalRedemptions,
            uint256 totalValueRedeemed,
            uint256 averageSlippage,
            uint256 successRate
        );
    
    /**
     * @notice Get optimal strategy for amount
     * @param fundId Fund identifier
     * @param tokenAmount Amount to redeem
     * @return recommendedStrategy Recommended strategy
     * @return reason Reason for recommendation
     */
    function getOptimalStrategyForAmount(
        bytes32 fundId,
        uint256 tokenAmount
    ) external view returns (
        RedemptionStrategy recommendedStrategy,
        string memory reason
    );
    
    // Admin functions
    
    function setPriceFeed(address priceFeed) external;
    function setAMM(address amm) external;
    function setOrderbook(address orderbook) external;
    function setMultiChainAggregator(address aggregator) external;
    function setIndexTokenFactory(address factory) external;
    function setMinimumRedemptionAmount(bytes32 fundId, uint256 amount) external;
    function setMaximumRedemptionAmount(bytes32 fundId, uint256 amount) external;
    function setDefaultSlippageTolerance(uint256 tolerance) external;
    function setMaxSlippageTolerance(uint256 tolerance) external;
    function setExecutionDeadline(uint256 deadline) external;
    function enableRedemptionStrategy(RedemptionStrategy strategy, bool enabled) external;
    function setStrategyPriorityOrder(RedemptionStrategy[] memory strategies) external;
    function setEmergencySlippageTolerance(uint256 tolerance) external;
    function emergencyPause() external;
    function emergencyUnpause() external;
    function emergencyLiquidatePosition(
        bytes32 fundId,
        uint32 assetIndex,
        uint256 amount,
        address recipient
    ) external;
    
    // View functions for admin
    
    function isPaused() external view returns (bool);
    function getPriceFeed() external view returns (address);
    function getAMM() external view returns (address);
    function getOrderbook() external view returns (address);
    function getMultiChainAggregator() external view returns (address);
    function getIndexTokenFactory() external view returns (address);
    function getMinimumRedemptionAmount(bytes32 fundId) external view returns (uint256);
    function getMaximumRedemptionAmount(bytes32 fundId) external view returns (uint256);
    function getDefaultSlippageTolerance() external view returns (uint256);
    function getMaxSlippageTolerance() external view returns (uint256);
    function getExecutionDeadline() external view returns (uint256);
    function isStrategyEnabled(RedemptionStrategy strategy) external view returns (bool);
    function getStrategyPriorityOrder() external view returns (RedemptionStrategy[] memory);
    function getTotalRedemptions() external view returns (uint256);
    function getTotalValueRedeemed() external view returns (uint256);
}
