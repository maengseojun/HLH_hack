// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IPriceFeed.sol";

/**
 * @title MockPriceFeed
 * @dev Complete implementation of IPriceFeed for testing
 */
contract MockPriceFeed is IPriceFeed {
    
    mapping(uint32 => uint256) private prices;
    mapping(uint32 => PriceData) private priceDataMapping;
    mapping(uint32 => bool) private supportedAssets;
    mapping(uint32 => LiquidityInfo) private liquidityInfo;
    
    constructor() {
        // Initialize with common test assets
        _initializeTestAssets();
    }
    
    function _initializeTestAssets() private {
        // Asset 0: USDC
        setSupportedAsset(0, true);
        setPrice(0, 1e18); // $1
        
        // Asset 1: WETH
        setSupportedAsset(1, true);
        setPrice(1, 2000e18); // $2000
        
        // Asset 2: WBTC
        setSupportedAsset(2, true);
        setPrice(2, 35000e18); // $35000
        
        // Asset 3: SOL (mock)
        setSupportedAsset(3, true);
        setPrice(3, 100e18); // $100
    }
    
    /**
     * @dev Get current price for an asset
     */
    function getPrice(uint32 assetIndex) external view override returns (uint256 price) {
        require(supportedAssets[assetIndex], "Asset not supported");
        return prices[assetIndex];
    }
    
    /**
     * @dev Get detailed price information
     */
    function getPriceData(uint32 assetIndex) external view override returns (PriceData memory priceData) {
        require(supportedAssets[assetIndex], "Asset not supported");
        return priceDataMapping[assetIndex];
    }
    
    /**
     * @dev Get price from specific source
     */
    function getPriceFromSource(uint32 assetIndex, PriceSource source) 
        external view override returns (uint256 price, bool isAvailable) {
        if (!supportedAssets[assetIndex]) {
            return (0, false);
        }
        
        // For mock, all sources return same price
        return (prices[assetIndex], true);
    }
    
    /**
     * @dev Get aggregated price from multiple sources
     */
    function getAggregatedPrice(uint32 assetIndex) 
        external view override returns (uint256 price, uint256[] memory weights) {
        require(supportedAssets[assetIndex], "Asset not supported");
        
        // Mock weights: AMM 40%, ORDERBOOK 40%, ORACLE 20%
        weights = new uint256[](3);
        weights[0] = 4000; // 40%
        weights[1] = 4000; // 40%
        weights[2] = 2000; // 20%
        
        return (prices[assetIndex], weights);
    }
    
    /**
     * @dev Get multiple asset prices
     */
    function getMultiplePrices(uint32[] memory assetIndices) 
        external view override returns (uint256[] memory pricesArray) {
        pricesArray = new uint256[](assetIndices.length);
        for (uint i = 0; i < assetIndices.length; i++) {
            if (supportedAssets[assetIndices[i]]) {
                pricesArray[i] = prices[assetIndices[i]];
            } else {
                pricesArray[i] = 0;
            }
        }
        return pricesArray;
    }
    
    /**
     * @dev Get liquidity information
     */
    function getLiquidityInfo(uint32 assetIndex) 
        external view override returns (LiquidityInfo memory liquidityInfoData) {
        require(supportedAssets[assetIndex], "Asset not supported");
        return liquidityInfo[assetIndex];
    }
    
    /**
     * @dev Calculate price impact for trade
     */
    function calculatePriceImpact(uint32 assetIndex, uint256 tradeAmount, bool isBuy) 
        external view override returns (uint256 priceImpact, uint256 executionPrice) {
        require(supportedAssets[assetIndex], "Asset not supported");
        
        uint256 basePrice = prices[assetIndex];
        
        // Simple price impact calculation: 0.01% per 10K units
        priceImpact = (tradeAmount * 100) / 1000000; // basis points
        
        // Adjust execution price based on buy/sell and impact
        if (isBuy) {
            executionPrice = basePrice + (basePrice * priceImpact / 10000);
        } else {
            executionPrice = basePrice - (basePrice * priceImpact / 10000);
        }
        
        return (priceImpact, executionPrice);
    }
    
    /**
     * @dev Check if asset is supported
     */
    function isAssetSupported(uint32 assetIndex) 
        external view override returns (bool isSupported, bool hasValidPrice) {
        isSupported = supportedAssets[assetIndex];
        hasValidPrice = isSupported && prices[assetIndex] > 0;
        return (isSupported, hasValidPrice);
    }
    
    /**
     * @dev Get optimal execution route
     */
    function getOptimalRoute(uint32 assetIndex, uint256 tradeAmount, uint256 maxPriceImpact)
        external view override returns (
            PriceSource[] memory sources,
            uint256[] memory amounts, 
            uint256 totalPrice
        ) {
        require(supportedAssets[assetIndex], "Asset not supported");
        
        // For mock, always use single source (AMM)
        sources = new PriceSource[](1);
        amounts = new uint256[](1);
        
        sources[0] = PriceSource.AMM;
        amounts[0] = tradeAmount;
        totalPrice = prices[assetIndex];
        
        return (sources, amounts, totalPrice);
    }
    
    // === Admin/Test Functions ===
    
    /**
     * @dev Set price for an asset (test function)
     */
    function setPrice(uint32 assetIndex, uint256 price) public {
        prices[assetIndex] = price;
        
        // Update price data
        priceDataMapping[assetIndex] = PriceData({
            price: price,
            timestamp: block.timestamp,
            confidence: 10000, // 100% confidence for mock
            source: PriceSource.ORACLE,
            isStale: false
        });
        
        // Set default liquidity info
        liquidityInfo[assetIndex] = LiquidityInfo({
            ammLiquidity: 1000000e18,     // 1M units
            orderbookDepth: 500000e18,    // 500K units
            totalLiquidity: 1500000e18,   // 1.5M units
            priceImpact: 50               // 0.5% for 1% trade
        });
    }
    
    /**
     * @dev Set asset support status (test function)
     */
    function setSupportedAsset(uint32 assetIndex, bool supported) public {
        supportedAssets[assetIndex] = supported;
    }
}