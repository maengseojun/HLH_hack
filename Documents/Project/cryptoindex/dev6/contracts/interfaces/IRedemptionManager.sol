// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IPriceFeed.sol";
import "./IAMM.sol";
// import "./IOrderbook.sol"; // Temporarily disabled for compilation
import "./IMultiChainAggregator.sol";

/**
 * @title IRedemptionManager
 * @dev Interface for the enhanced redemption manager contract
 * Handles index token redemption with AMM, Orderbook, and Multi-Chain integration
 */
interface IRedemptionManager {
    
    // Enhanced Events for New Architecture
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
        uint256 totalValueReturned,
        RedemptionStrategy executedStrategy
    );
    
    event RedemptionFailed(
        uint256 indexed requestId,
        string reason,
        uint256 timestamp
    );
    
    event LiquidityValidationResult(
        uint256 indexed requestId,
        bool sufficient,
        string[] insufficientAssets,
        uint256[] shortfalls
    );
    
    event RoutingOptimized(
        uint256 indexed requestId,
        LiquidationRoute[] routes,
        uint256 totalExecutionCost,
        uint256 priceImpact
    );
    
    event CrossChainLiquidation(
        uint256 indexed requestId,
        uint32 assetIndex,
        uint256 amount,
        uint256 sourceChain,
        uint256 targetChain,
        bytes32 transactionHash
    );
    
    // Enhanced Enums and Structs for New Architecture
    enum RedemptionStrategy {
        OPTIMAL,           // Auto-select best combination
        AMM_ONLY,         // Use AMM pools only
        ORDERBOOK_ONLY,   // Use orderbook only
        MULTI_CHAIN,      // Include cross-chain options
        EMERGENCY         // Fast exit with higher slippage
    }
    
    enum RedemptionStatus {
        PENDING,
        VALIDATING,
        ROUTING,
        APPROVED,
        EXECUTING,
        COMPLETED,
        FAILED,
        CANCELLED
    }
    
    struct ComponentLiquidation {
        address tokenAddress;     // Component token address
        uint32 assetIndex;       // Asset index for price feed
        uint256 amount;          // Amount to liquidate
        uint256 receivedAmount;  // Actual amount received
        IPriceFeed.PriceSource source; // Liquidation source used
        uint256 priceImpact;     // Price impact incurred
        uint256 executionCost;   // Gas + fees
        uint256 chainId;         // Chain where liquidation occurred
    }
    
    struct LiquidationRoute {
        uint32 assetIndex;           // Asset to liquidate
        uint256 amount;              // Amount to liquidate
        IPriceFeed.PriceSource[] sources; // Execution sources
        uint256[] amounts;           // Amount per source
        uint256[] expectedPrices;    // Expected price per source
        uint256 totalPriceImpact;    // Total price impact
        uint256 estimatedGas;        // Estimated gas cost
        uint256 executionChain;      // Preferred execution chain
        bool requiresCrossChain;     // Whether cross-chain is needed
    }
    
    struct RedemptionRequest {
        uint256 id;
        address requester;
        bytes32 fundId;              // Index fund ID
        uint256 tokenAmount;         // Index tokens to redeem
        uint256 estimatedValue;      // Estimated redemption value
        RedemptionStrategy strategy; // Chosen strategy
        LiquidationRoute[] routes;   // Planned liquidation routes
        uint256 maxSlippage;         // Maximum acceptable slippage
        uint256 minReturnAmount;     // Minimum return expected
        uint256 timestamp;
        RedemptionStatus status;
        ComponentLiquidation[] liquidations; // Executed liquidations
        uint256 totalReturned;       // Total value returned
        string failureReason;
        uint256 deadline;            // Execution deadline
    }
    
    // Enhanced Core Functions
    function requestRedemption(
        bytes32 fundId,
        uint256 tokenAmount,
        RedemptionStrategy strategy,
        uint256 maxSlippage,
        uint256 minReturnAmount,
        uint256 deadline
    ) external returns (uint256 requestId);
    
    function executeRedemption(
        uint256 requestId
    ) external returns (bool success, uint256 totalReturned);
    
    function executeBatchRedemption(
        uint256[] memory requestIds
    ) external returns (bool[] memory successes, uint256[] memory totalReturned);
    
    function cancelRedemption(
        uint256 requestId
    ) external returns (bool success);
    
    // Strategy and Routing Functions
    function calculateOptimalRoute(
        bytes32 fundId,
        uint256 tokenAmount,
        RedemptionStrategy strategy,
        uint256 maxSlippage
    ) external view returns (LiquidationRoute[] memory routes, uint256 estimatedReturn);
    
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
    
    // Enhanced View Functions
    function getRedemptionRequest(
        uint256 requestId
    ) external view returns (RedemptionRequest memory);
    
    function getActiveRedemptions(
        address user
    ) external view returns (uint256[] memory requestIds);
    
    function getUserRedemptionHistory(
        address user,
        uint256 limit,
        uint256 offset
    ) external view returns (RedemptionRequest[] memory requests);
    
    function calculateRedemptionValue(
        bytes32 fundId,
        uint256 tokenAmount
    ) external view returns (uint256 totalValue, ComponentLiquidation[] memory breakdown);
    
    function isEligibleForRedemption(
        address user,
        bytes32 fundId,
        uint256 tokenAmount,
        RedemptionStrategy strategy
    ) external view returns (bool eligible, string memory reason);
    
    function checkLiquidityAvailability(
        bytes32 fundId,
        uint256 tokenAmount,
        RedemptionStrategy strategy
    ) external view returns (
        bool sufficient,
        string[] memory insufficientAssets,
        uint256[] memory shortfalls
    );
    
    // Analytics and Monitoring
    function getRedemptionStats(
        bytes32 fundId
    ) external view returns (
        uint256 totalRedemptions,
        uint256 totalValueRedeemed,
        uint256 averageSlippage,
        uint256 successRate
    );
    
    function getOptimalStrategyForAmount(
        bytes32 fundId,
        uint256 tokenAmount
    ) external view returns (RedemptionStrategy recommendedStrategy, string memory reason);
    
    // Enhanced Admin Functions
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
    
    // Enhanced State View Functions
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