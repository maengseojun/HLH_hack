// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IL1Read
 * @dev Interface for Hyperliquid L1 Precompile contract
 * @notice This interface allows HyperEVM contracts to read real-time price data from HyperCore
 */
interface IL1Read {
    /**
     * @dev Get the current spot price of an asset in USDC
     * @param assetIndex The index of the asset on Hyperliquid
     * @return The current price in USDC (scaled by 1e18)
     */
    function getSpotPrice(uint32 assetIndex) external view returns (uint256);
    
    /**
     * @dev Get all spot prices at once
     * @return Array of prices in USDC (scaled by 1e18)
     */
    function getAllSpotPrices() external view returns (uint256[] memory);
    
    /**
     * @dev Get oracle price with timestamp
     * @param assetIndex The index of the asset on Hyperliquid
     * @return price The current price in USDC
     * @return timestamp The timestamp of the price update
     */
    function getSpotPriceWithTimestamp(uint32 assetIndex) external view returns (uint256 price, uint256 timestamp);
}
