// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IPriceFeed.sol";

/**
 * @title MockPriceFeed
 * @dev Mock price feed for testing oracle functionality, compliant with IPriceFeed
 */
abstract contract MockPriceFeed is IPriceFeed {
    mapping(uint32 => uint256) private prices;
    mapping(uint32 => uint256) private updateTimes;
    bool public shouldRevert = false;
    
    event PriceSet(uint32 indexed assetIndex, uint256 price);
    
    function setPrice(uint32 assetIndex, uint256 price) external {
        prices[assetIndex] = price;
        updateTimes[assetIndex] = block.timestamp;
        emit PriceSet(assetIndex, price);
    }
    
    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }
    
    function getPrice(uint32 assetIndex) external view override returns (uint256) {
        require(!shouldRevert, "MockPriceFeed: Simulated failure");
        return prices[assetIndex];
    }
    
    function getLastUpdate(uint32 assetIndex) external view returns (uint256) {
        return updateTimes[assetIndex];
    }
    
    function isStale(uint32 assetIndex, uint256 maxAge) external view returns (bool) {
        return block.timestamp > updateTimes[assetIndex] + maxAge;
    }
}