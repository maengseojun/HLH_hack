// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IHyperCore
 * @dev Interface for Hyperliquid's core native functionality
 */
interface IHyperCore {
    
    /**
     * @dev Get native asset information
     */
    function getAssetInfo(uint32 assetIndex) external view returns (
        string memory name,
        string memory symbol,
        uint8 decimals,
        bool isActive
    );
    
    /**
     * @dev Get current spot price for an asset
     */
    function getSpotPrice(uint32 assetIndex) external view returns (uint256 price);
    
    /**
     * @dev Transfer native assets with precision handling
     */
    function transferNativeAsset(
        uint32 assetIndex,
        address to,
        uint256 amount
    ) external returns (bool success);
    
    /**
     * @dev Batch transfer multiple native assets
     */
    function batchTransferNativeAssets(
        uint32[] memory assetIndices,
        address[] memory recipients,
        uint256[] memory amounts
    ) external returns (bool success);
    
    /**
     * @dev Convert between native asset and ERC20 representation
     */
    function convertToERC20(
        uint32 assetIndex,
        uint256 nativeAmount
    ) external view returns (uint256 erc20Amount);
    
    /**
     * @dev Convert from ERC20 to native asset representation
     */
    function convertToNative(
        uint32 assetIndex,
        uint256 erc20Amount
    ) external view returns (uint256 nativeAmount);
    
    /**
     * @dev Check if asset transfer is allowed
     */
    function isTransferAllowed(
        uint32 assetIndex,
        address from,
        address to,
        uint256 amount
    ) external view returns (bool allowed);
    
    /**
     * @dev Get asset index by ERC20 token address
     */
    function getAssetIndexByToken(address tokenAddress) external view returns (uint32 assetIndex);
    
    /**
     * @dev Get ERC20 token address by asset index
     */
    function getTokenByAssetIndex(uint32 assetIndex) external view returns (address tokenAddress);
}