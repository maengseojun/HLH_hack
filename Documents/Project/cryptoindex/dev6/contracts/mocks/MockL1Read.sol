// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IL1Read.sol";

/**
 * @title MockL1Read
 * @dev Mock implementation of Hyperliquid L1Read for testing
 */
contract MockL1Read is IL1Read {
    
    // Mock price data for testing
    mapping(uint32 => uint256) private mockPrices;
    
    constructor() {
        // Set some default mock prices (scaled by 1e18)
        mockPrices[1] = 45000e18; // BTC: $45,000
        mockPrices[2] = 2500e18;  // ETH: $2,500
        mockPrices[3] = 1e18;     // USDC: $1
        mockPrices[4] = 100e18;   // SOL: $100
    }
    
    /**
     * @dev Get mock spot price for testing
     */
    function getSpotPrice(uint32 assetIndex) external view override returns (uint256) {
        uint256 price = mockPrices[assetIndex];
        require(price > 0, "MockL1Read: Price not set for asset");
        return price;
    }
    
    /**
     * @dev Set mock price for testing
     */
    function setMockPrice(uint32 assetIndex, uint256 price) external {
        mockPrices[assetIndex] = price;
    }
    
    /**
     * @dev Get all spot prices at once
     */
    function getAllSpotPrices() external view override returns (uint256[] memory) {
        uint256[] memory prices = new uint256[](5);
        prices[0] = 0; // Index 0 not used
        prices[1] = mockPrices[1]; // BTC
        prices[2] = mockPrices[2]; // ETH
        prices[3] = mockPrices[3]; // USDC
        prices[4] = mockPrices[4]; // SOL
        return prices;
    }
    
    /**
     * @dev Get price with timestamp (mock)
     */
    function getSpotPriceWithTimestamp(uint32 assetIndex) 
        external 
        view 
        override 
        returns (uint256 price, uint256 timestamp) 
    {
        price = mockPrices[assetIndex];
        require(price > 0, "MockL1Read: Price not set for asset");
        timestamp = block.timestamp;
        return (price, timestamp);
    }
}