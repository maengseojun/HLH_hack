// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPriceFeed
 * @notice Interface for unified price feed system
 * @dev Provides real-time price data from various sources
 */
interface IPriceFeed {
    /**
     * @notice Price source enumeration
     */
    enum PriceSource {
        HYPERLIQUID_L1,     // HyperLiquid L1 oracle
        AMM,                // Internal AMM prices
        EXTERNAL_ORACLE,    // External oracle (e.g., Chainlink)
        TWAP,               // Time-weighted average price
        HYBRID              // Combined sources
    }
    
    /**
     * @notice Liquidity information for an asset
     */
    struct LiquidityInfo {
        uint256 totalLiquidity;      // Total available liquidity
        uint256 availableLiquidity;  // Currently available
        uint256 utilizationRate;     // Percentage used (in basis points)
        uint256 lastUpdated;         // Timestamp of last update
    }
    
    /**
     * @notice Price information with metadata
     */
    struct PriceInfo {
        uint256 price;               // Price in USDC (18 decimals)
        uint256 timestamp;           // When price was recorded
        PriceSource source;          // Where price came from
        uint256 confidence;          // Confidence level (0-10000)
    }
    
    /**
     * @notice Emitted when a price is updated
     */
    event PriceUpdated(
        uint32 indexed assetIndex,
        uint256 price,
        PriceSource source,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when price source is changed
     */
    event PriceSourceUpdated(
        uint32 indexed assetIndex,
        PriceSource oldSource,
        PriceSource newSource
    );
    
    /**
     * @notice Get current price for an asset
     * @param assetIndex HyperLiquid asset index
     * @return price Price in USDC (scaled by 1e18)
     */
    function getPrice(uint32 assetIndex) external view returns (uint256 price);
    
    /**
     * @notice Get detailed price information
     * @param assetIndex HyperLiquid asset index
     * @return priceInfo Detailed price information
     */
    function getPriceInfo(uint32 assetIndex) external view returns (PriceInfo memory priceInfo);
    
    /**
     * @notice Get prices for multiple assets
     * @param assetIndexes Array of asset indexes
     * @return prices Array of prices
     */
    function getPrices(uint32[] calldata assetIndexes) 
        external 
        view 
        returns (uint256[] memory prices);
    
    /**
     * @notice Get liquidity information for an asset
     * @param assetIndex HyperLiquid asset index
     * @return liquidityInfo Liquidity details
     */
    function getLiquidityInfo(uint32 assetIndex) 
        external 
        view 
        returns (LiquidityInfo memory liquidityInfo);
    
    /**
     * @notice Check if asset is supported and has valid price
     * @param assetIndex HyperLiquid asset index
     * @return isSupported True if asset is supported
     * @return hasValidPrice True if price is valid and recent
     */
    function isAssetSupported(uint32 assetIndex) 
        external 
        view 
        returns (bool isSupported, bool hasValidPrice);
    
    /**
     * @notice Get the price source for an asset
     * @param assetIndex HyperLiquid asset index
     * @return source Current price source
     */
    function getPriceSource(uint32 assetIndex) external view returns (PriceSource source);
    
    /**
     * @notice Set price source for an asset (admin only)
     * @param assetIndex HyperLiquid asset index
     * @param source New price source
     */
    function setPriceSource(uint32 assetIndex, PriceSource source) external;
    
    /**
     * @notice Update price manually (oracle role only)
     * @param assetIndex HyperLiquid asset index
     * @param price New price
     */
    function updatePrice(uint32 assetIndex, uint256 price) external;
    
    /**
     * @notice Get maximum allowed price staleness
     * @return maxStaleness Maximum seconds before price is considered stale
     */
    function getMaxPriceStaleness() external view returns (uint256 maxStaleness);
}
