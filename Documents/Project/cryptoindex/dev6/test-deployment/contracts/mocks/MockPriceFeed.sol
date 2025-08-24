// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IPriceFeed.sol";

/**
 * @title MockPriceFeed
 * @dev Enhanced mock price feed with update functionality
 * Based on: Chainlink Oracle + Compound V3 Price Feeds
 */
contract MockPriceFeed is IPriceFeed {
    struct PriceData {
        uint256 price;
        uint256 timestamp;
        uint256 confidence;
        bool isStale;
    }
    
    mapping(uint32 => PriceData) private priceData;
    mapping(uint32 => bool) public supportedAssets;
    
    uint256 public constant STALENESS_THRESHOLD = 3600; // 1 hour
    address public owner;
    
    event PriceUpdated(
        uint32 indexed assetIndex,
        uint256 oldPrice,
        uint256 newPrice,
        uint256 timestamp
    );
    
    event AssetAdded(uint32 indexed assetIndex, string symbol);
    event AssetRemoved(uint32 indexed assetIndex);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        
        // Initialize with mock prices
        _updatePrice(0, 1000000, 95); // USDC: $1.00
        _updatePrice(1, 2026280000, 98); // ETH: $2026.28  
        _updatePrice(2, 67420000000, 97); // BTC: $67420
        
        supportedAssets[0] = true;
        supportedAssets[1] = true; 
        supportedAssets[2] = true;
    }
    
    // ✅ FIX: Missing updatePrice function
    function updatePrice(
        uint32 assetIndex,
        uint256 newPrice
    ) external onlyOwner {
        require(supportedAssets[assetIndex], "Asset not supported");
        require(newPrice > 0, "Invalid price");
        
        uint256 oldPrice = priceData[assetIndex].price;
        _updatePrice(assetIndex, newPrice, 100); // 100% confidence for manual updates
        
        emit PriceUpdated(assetIndex, oldPrice, newPrice, block.timestamp);
    }
    
    // ✅ FIX: Batch price update
    function updatePrices(
        uint32[] memory assetIndexes,
        uint256[] memory prices
    ) external onlyOwner {
        require(assetIndexes.length == prices.length, "Array length mismatch");
        
        for (uint256 i = 0; i < assetIndexes.length; i++) {
            if (supportedAssets[assetIndexes[i]] && prices[i] > 0) {
                uint256 oldPrice = priceData[assetIndexes[i]].price;
                _updatePrice(assetIndexes[i], prices[i], 100);
                
                emit PriceUpdated(assetIndexes[i], oldPrice, prices[i], block.timestamp);
            }
        }
    }
    
    // IPriceFeed implementation
    function getPrice(uint32 assetIndex) external view override returns (uint256 price) {
        require(supportedAssets[assetIndex], "Asset not supported");
        
        PriceData memory data = priceData[assetIndex];
        require(data.price > 0, "Price not available");
        require(!data.isStale, "Price is stale");
        
        return data.price;
    }
    
    function getLatestPrice(uint32 assetIndex) external view override returns (uint256 price, uint256 timestamp) {
        require(supportedAssets[assetIndex], "Asset not supported");
        
        PriceData memory data = priceData[assetIndex];
        return (data.price, data.timestamp);
    }
    
    function isPriceStale(uint32 assetIndex) external view override returns (bool) {
        if (!supportedAssets[assetIndex]) return true;
        
        PriceData memory data = priceData[assetIndex];
        return block.timestamp > data.timestamp + STALENESS_THRESHOLD;
    }
    
    function getPriceWithConfidence(uint32 assetIndex) external view override returns (
        uint256 price,
        uint256 confidence,
        uint256 timestamp
    ) {
        require(supportedAssets[assetIndex], "Asset not supported");
        
        PriceData memory data = priceData[assetIndex];
        return (data.price, data.confidence, data.timestamp);
    }
    
    function getSupportedAssets() external view override returns (uint32[] memory) {
        uint32[] memory assets = new uint32[](10); // Max 10 assets
        uint256 count = 0;
        
        for (uint32 i = 0; i < 10; i++) {
            if (supportedAssets[i]) {
                assets[count] = i;
                count++;
            }
        }
        
        // Resize array to actual count
        uint32[] memory result = new uint32[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = assets[i];
        }
        
        return result;
    }
    
    function getMultiplePrices(uint32[] memory assetIndexes) external view override returns (
        uint256[] memory prices,
        uint256[] memory timestamps
    ) {
        prices = new uint256[](assetIndexes.length);
        timestamps = new uint256[](assetIndexes.length);
        
        for (uint256 i = 0; i < assetIndexes.length; i++) {
            if (supportedAssets[assetIndexes[i]]) {
                PriceData memory data = priceData[assetIndexes[i]];
                prices[i] = data.price;
                timestamps[i] = data.timestamp;
            }
        }
    }
    
    function validatePriceAge(uint32 assetIndex, uint256 maxAge) external view override returns (bool) {
        if (!supportedAssets[assetIndex]) return false;
        
        PriceData memory data = priceData[assetIndex];
        return block.timestamp <= data.timestamp + maxAge;
    }
    
    function getAssetCount() external view override returns (uint256) {
        uint256 count = 0;
        for (uint32 i = 0; i < 100; i++) {
            if (supportedAssets[i]) count++;
        }
        return count;
    }
    
    function hasValidPrice(uint32 assetIndex) external view override returns (bool) {
        if (!supportedAssets[assetIndex]) return false;
        
        PriceData memory data = priceData[assetIndex];
        return data.price > 0 && !data.isStale;
    }
    
    // ✅ FIX: Asset management
    function addAsset(uint32 assetIndex, string memory symbol) external onlyOwner {
        supportedAssets[assetIndex] = true;
        _updatePrice(assetIndex, 1000000, 90); // Default $1 with 90% confidence
        
        emit AssetAdded(assetIndex, symbol);
    }
    
    function removeAsset(uint32 assetIndex) external onlyOwner {
        supportedAssets[assetIndex] = false;
        delete priceData[assetIndex];
        
        emit AssetRemoved(assetIndex);
    }
    
    // Internal function
    function _updatePrice(uint32 assetIndex, uint256 price, uint256 confidence) internal {
        priceData[assetIndex] = PriceData({
            price: price,
            timestamp: block.timestamp,
            confidence: confidence,
            isStale: false
        });
    }
    
    // ✅ FIX: Utility functions
    function markAssetStale(uint32 assetIndex) external onlyOwner {
        if (supportedAssets[assetIndex]) {
            priceData[assetIndex].isStale = true;
        }
    }
    
    function refreshAsset(uint32 assetIndex) external onlyOwner {
        if (supportedAssets[assetIndex]) {
            priceData[assetIndex].isStale = false;
            priceData[assetIndex].timestamp = block.timestamp;
        }
    }
}