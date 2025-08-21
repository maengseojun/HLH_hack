// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IPriceFeed.sol";

/**
 * @title MockPriceFeed
 * @dev Mock price feed for testing oracle functionality
 */
contract MockPriceFeed is IPriceFeed {
    mapping(address => uint256) private prices;
    mapping(address => uint256) private updateTimes;
    bool public shouldRevert = false;
    
    event PriceSet(address indexed asset, uint256 price);
    
    function setPrice(address asset, uint256 price) external {
        prices[asset] = price;
        updateTimes[asset] = block.timestamp;
        emit PriceSet(asset, price);
    }
    
    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }
    
    function getPrice(address asset) external view override returns (uint256) {
        require(!shouldRevert, "MockPriceFeed: Simulated failure");
        return prices[asset];
    }
    
    function getLastUpdate(address asset) external view returns (uint256) {
        return updateTimes[asset];
    }
    
    function isStale(address asset, uint256 maxAge) external view returns (bool) {
        return block.timestamp > updateTimes[asset] + maxAge;
    }
}