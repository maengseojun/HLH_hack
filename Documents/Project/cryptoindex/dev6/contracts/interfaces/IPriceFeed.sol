// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IPriceFeed
 * @dev Unified price feed interface for AMM + Orderbook + External Oracle integration
 * @notice Replaces IL1Read to support multiple liquidity sources and price aggregation
 */
interface IPriceFeed {
    
    // Price Source Types
    enum PriceSource {
        AMM,           // Automated Market Maker
        ORDERBOOK,     // Offchain Orderbook
        ORACLE,        // External Oracle (Chainlink, etc.)
        AGGREGATED     // Weighted average of multiple sources
    }
    
    // Price Data Structure
    struct PriceData {
        uint256 price;          // Price in USDC (scaled by 1e18)
        uint256 timestamp;      // Last update timestamp
        uint256 confidence;     // Confidence score (0-10000, 10000 = 100%)
        PriceSource source;     // Primary price source
        bool isStale;          // True if price is older than threshold
    }
    
    // Liquidity Information
    struct LiquidityInfo {
        uint256 ammLiquidity;      // Available AMM liquidity
        uint256 orderbookDepth;    // Orderbook depth (top 5 levels)
        uint256 totalLiquidity;    // Combined liquidity
        uint256 priceImpact;       // Estimated price impact for 1% trade
    }
    
    /**
     * @dev Get current price for an asset from the best available source
     * @param assetIndex The index/identifier of the asset
     * @return price Current price in USDC (scaled by 1e18)
     */
    function getPrice(uint32 assetIndex) external view returns (uint256 price);
    
    /**
     * @dev Get detailed price information including source and confidence
     * @param assetIndex The index/identifier of the asset
     * @return priceData Detailed price information
     */
    function getPriceData(uint32 assetIndex) external view returns (PriceData memory priceData);
    
    /**
     * @dev Get price from specific source
     * @param assetIndex The index/identifier of the asset
     * @param source The specific price source to query
     * @return price Price from the specified source
     * @return isAvailable Whether the source has valid data
     */
    function getPriceFromSource(uint32 assetIndex, PriceSource source) 
        external view returns (uint256 price, bool isAvailable);
    
    /**
     * @dev Get aggregated price from multiple sources with weights
     * @param assetIndex The index/identifier of the asset
     * @return price Weighted average price
     * @return weights Array of weights used for each source
     */
    function getAggregatedPrice(uint32 assetIndex) 
        external view returns (uint256 price, uint256[] memory weights);
    
    /**
     * @dev Get multiple asset prices in a single call (gas optimization)
     * @param assetIndices Array of asset indices
     * @return prices Array of current prices
     */
    function getMultiplePrices(uint32[] memory assetIndices) 
        external view returns (uint256[] memory prices);
    
    /**
     * @dev Get liquidity information for an asset
     * @param assetIndex The index/identifier of the asset
     * @return liquidityInfo Available liquidity across all sources
     */
    function getLiquidityInfo(uint32 assetIndex) 
        external view returns (LiquidityInfo memory liquidityInfo);
    
    /**
     * @dev Calculate price impact for a specific trade size
     * @param assetIndex The index/identifier of the asset
     * @param tradeAmount Amount to trade (in asset units)
     * @param isBuy True for buy orders, false for sell orders
     * @return priceImpact Estimated price impact (basis points)
     * @return executionPrice Estimated execution price
     */
    function calculatePriceImpact(uint32 assetIndex, uint256 tradeAmount, bool isBuy) 
        external view returns (uint256 priceImpact, uint256 executionPrice);
    
    /**
     * @dev Check if asset is supported and has valid price data
     * @param assetIndex The index/identifier of the asset
     * @return isSupported Whether the asset is supported
     * @return hasValidPrice Whether valid price data is available
     */
    function isAssetSupported(uint32 assetIndex) 
        external view returns (bool isSupported, bool hasValidPrice);
    
    /**
     * @dev Get optimal execution route for a trade
     * @param assetIndex The index/identifier of the asset
     * @param tradeAmount Amount to trade
     * @param maxPriceImpact Maximum acceptable price impact (basis points)
     * @return sources Recommended sources in execution order
     * @return amounts Amounts to execute on each source
     * @return totalPrice Total execution price
     */
    function getOptimalRoute(uint32 assetIndex, uint256 tradeAmount, uint256 maxPriceImpact)
        external view returns (
            PriceSource[] memory sources,
            uint256[] memory amounts, 
            uint256 totalPrice
        );
    
    // Events
    event PriceUpdated(
        uint32 indexed assetIndex, 
        uint256 newPrice, 
        PriceSource source,
        uint256 timestamp
    );
    
    event SourceAdded(uint32 indexed assetIndex, PriceSource source);
    event SourceRemoved(uint32 indexed assetIndex, PriceSource source);
    event PriceSourceWeightUpdated(PriceSource source, uint256 newWeight);
    
    // Admin events
    event StaleThresholdUpdated(uint256 newThreshold);
    event ConfidenceThresholdUpdated(uint256 newThreshold);
}