// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IMultiChainAggregator
 * @dev Interface for Multi-Chain Asset Aggregator
 * @notice Manages cross-chain liquidity aggregation and asset bridging for index funds
 */
interface IMultiChainAggregator {
    
    // Supported Chain Information
    struct ChainInfo {
        uint256 chainId;          // Chain ID
        string name;              // Chain name (e.g., "Ethereum", "Arbitrum")
        bool isActive;            // Whether chain is active
        uint256 bridgeFee;        // Base bridge fee
        uint256 gasPrice;         // Average gas price
        uint256 blockTime;        // Average block time
        address bridgeContract;   // Bridge contract address
        uint256 lastUpdate;       // Last price/info update
    }
    
    // Asset Information Across Chains
    struct MultiChainAsset {
        uint32 assetIndex;        // Universal asset index
        string symbol;            // Asset symbol
        string name;              // Asset name
        mapping(uint256 => address) tokenAddresses; // chainId => token address
        mapping(uint256 => uint8) decimals;          // chainId => decimals
        mapping(uint256 => uint256) liquidity;       // chainId => available liquidity
        mapping(uint256 => uint256) prices;          // chainId => current price
        bool isSupported;         // Whether asset is supported
        uint256 totalLiquidity;   // Total liquidity across all chains
    }
    
    // Cross-Chain Liquidity Route
    struct LiquidityRoute {
        uint256 sourceChain;      // Source chain ID
        uint256 targetChain;      // Target chain ID
        address sourceToken;      // Source token address
        address targetToken;      // Target token address
        uint256 amount;           // Amount to bridge
        uint256 bridgeFee;        // Bridge fee
        uint256 gasCost;          // Estimated gas cost
        uint256 timeEstimate;     // Estimated completion time
        uint256 priceImpact;      // Estimated price impact
        address[] intermediates;  // Intermediate bridge contracts
        bytes routeData;          // Additional route data
    }
    
    // Aggregated Price Information
    struct AggregatedPrice {
        uint32 assetIndex;        // Asset index
        uint256 weightedPrice;    // Liquidity-weighted average price
        uint256 bestPrice;        // Best price across all chains
        uint256 worstPrice;       // Worst price across all chains
        uint256 totalLiquidity;   // Total available liquidity
        uint256 priceVariance;    // Price variance across chains
        uint256[] chainPrices;    // Prices on each chain
        uint256[] chainLiquidity; // Liquidity on each chain
        uint256 timestamp;        // Last update timestamp
    }
    
    /**
     * @dev Get aggregated price for an asset across all chains
     * @param assetIndex Universal asset index
     * @return aggregatedPrice Aggregated price information
     */
    function getAggregatedPrice(uint32 assetIndex) 
        external view returns (AggregatedPrice memory aggregatedPrice);
    
    /**
     * @dev Get best execution route for cross-chain trade
     * @param assetIndex Universal asset index
     * @param amount Amount to trade
     * @param sourceChain Source chain ID (0 for auto-select)
     * @param targetChain Target chain ID (0 for auto-select)
     * @return route Optimal liquidity route
     */
    function getBestRoute(
        uint32 assetIndex,
        uint256 amount,
        uint256 sourceChain,
        uint256 targetChain
    ) external view returns (LiquidityRoute memory route);
    
    /**
     * @dev Execute cross-chain asset acquisition for index fund
     * @param assetIndex Universal asset index
     * @param amount Amount needed
     * @param maxSlippage Maximum acceptable slippage (basis points)
     * @param targetChain Preferred target chain (0 for auto-select)
     * @param recipient Address to receive assets
     * @return executedAmount Amount actually acquired
     * @return totalCost Total cost including fees
     * @return executionChain Chain where assets were acquired
     */
    function acquireAsset(
        uint32 assetIndex,
        uint256 amount,
        uint256 maxSlippage,
        uint256 targetChain,
        address recipient
    ) external returns (
        uint256 executedAmount,
        uint256 totalCost,
        uint256 executionChain
    );
    
    /**
     * @dev Execute cross-chain asset liquidation for index fund
     * @param assetIndex Universal asset index
     * @param amount Amount to liquidate
     * @param minReturn Minimum acceptable return
     * @param preferredChain Preferred liquidation chain (0 for auto-select)
     * @param recipient Address to receive proceeds
     * @return liquidatedAmount Amount actually liquidated
     * @return totalReturn Total return after fees
     * @return liquidationChain Chain where liquidation occurred
     */
    function liquidateAsset(
        uint32 assetIndex,
        uint256 amount,
        uint256 minReturn,
        uint256 preferredChain,
        address recipient
    ) external returns (
        uint256 liquidatedAmount,
        uint256 totalReturn,
        uint256 liquidationChain
    );
    
    /**
     * @dev Get total available liquidity for an asset across all chains
     * @param assetIndex Universal asset index
     * @return totalLiquidity Total liquidity amount
     * @return chainDistribution Liquidity distribution per chain
     */
    function getTotalLiquidity(uint32 assetIndex) 
        external view returns (
            uint256 totalLiquidity,
            uint256[] memory chainDistribution
        );
    
    /**
     * @dev Get supported chains information
     * @return chains Array of supported chain information
     */
    function getSupportedChains() external view returns (ChainInfo[] memory chains);
    
    /**
     * @dev Check if asset is supported on specific chain
     * @param assetIndex Universal asset index
     * @param chainId Chain ID to check
     * @return isSupported Whether asset is supported
     * @return tokenAddress Token address on that chain
     * @return currentLiquidity Current liquidity on that chain
     */
    function isAssetSupportedOnChain(uint32 assetIndex, uint256 chainId) 
        external view returns (
            bool isSupported,
            address tokenAddress,
            uint256 currentLiquidity
        );
    
    /**
     * @dev Calculate optimal asset distribution across chains for index fund
     * @param assetIndices Array of asset indices
     * @param targetAmounts Target amounts for each asset
     * @param riskTolerance Risk tolerance level (0-100)
     * @return distribution Optimal distribution per chain per asset
     * @return totalCost Total acquisition cost
     * @return executionTime Estimated total execution time
     */
    function calculateOptimalDistribution(
        uint32[] memory assetIndices,
        uint256[] memory targetAmounts,
        uint256 riskTolerance
    ) external view returns (
        uint256[][] memory distribution,
        uint256 totalCost,
        uint256 executionTime
    );
    
    /**
     * @dev Rebalance assets across chains for optimal liquidity
     * @param assetIndex Universal asset index
     * @param targetDistribution Target distribution percentages per chain
     * @param maxSlippage Maximum acceptable slippage per operation
     * @return success Whether rebalancing was successful
     * @return newDistribution Actual new distribution achieved
     * @return totalCost Total rebalancing cost
     */
    function rebalanceAsset(
        uint32 assetIndex,
        uint256[] memory targetDistribution,
        uint256 maxSlippage
    ) external returns (
        bool success,
        uint256[] memory newDistribution,
        uint256 totalCost
    );
    
    /**
     * @dev Emergency bridge asset to safety chain
     * @param assetIndex Universal asset index
     * @param amount Amount to bridge
     * @param sourceChain Source chain ID
     * @param safetyChain Target safety chain ID
     * @param recipient Recipient address
     * @return success Whether emergency bridge was successful
     * @return bridgedAmount Amount successfully bridged
     */
    function emergencyBridge(
        uint32 assetIndex,
        uint256 amount,
        uint256 sourceChain,
        uint256 safetyChain,
        address recipient
    ) external returns (bool success, uint256 bridgedAmount);
    
    // Events
    event AssetAcquired(
        uint32 indexed assetIndex,
        uint256 amount,
        uint256 cost,
        uint256 indexed executionChain,
        address indexed recipient
    );
    
    event AssetLiquidated(
        uint32 indexed assetIndex,
        uint256 amount,
        uint256 return_,
        uint256 indexed liquidationChain,
        address indexed recipient
    );
    
    event CrossChainBridge(
        uint32 indexed assetIndex,
        uint256 amount,
        uint256 indexed sourceChain,
        uint256 indexed targetChain,
        address recipient,
        bytes32 bridgeId
    );
    
    event ChainAdded(uint256 indexed chainId, string name, bool isActive);
    event ChainStatusUpdated(uint256 indexed chainId, bool isActive);
    event AssetSupportAdded(uint32 indexed assetIndex, uint256 indexed chainId, address tokenAddress);
    event AssetSupportRemoved(uint32 indexed assetIndex, uint256 indexed chainId);
    
    event LiquidityUpdated(
        uint32 indexed assetIndex,
        uint256 indexed chainId,
        uint256 newLiquidity,
        uint256 timestamp
    );
    
    event PriceUpdated(
        uint32 indexed assetIndex,
        uint256 indexed chainId,
        uint256 newPrice,
        uint256 timestamp
    );
}