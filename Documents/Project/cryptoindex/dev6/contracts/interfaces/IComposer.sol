// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IComposer
 * @dev Interface for Hyperliquid's Composer functionality for dust handling and complex operations
 */
interface IComposer {
    
    /**
     * @dev Handle dust amounts from precision calculations
     */
    function handleDust(
        address token,
        uint256 dustAmount,
        address recipient
    ) external returns (uint256 processedAmount);
    
    /**
     * @dev Convert dust value to HYPE token
     */
    function convertToHYPE(
        uint256 dustValue,
        address recipient
    ) external returns (uint256 hypeAmount);
    
    /**
     * @dev Accumulate dust for a specific fund
     */
    function accumulateDustForFund(
        bytes32 fundId,
        uint256 dustValue
    ) external;
    
    /**
     * @dev Distribute accumulated dust to fund participants
     */
    function distributeFundDust(
        bytes32 fundId,
        address[] memory participants,
        uint256[] memory shares
    ) external returns (uint256 totalDistributed);
    
    /**
     * @dev Convert dust to platform fee
     */
    function convertDustToPlatformFee(
        uint256 dustValue
    ) external returns (uint256 feeAmount);
    
    /**
     * @dev Batch process multiple dust operations
     */
    function batchProcessDust(
        address[] memory tokens,
        uint256[] memory dustAmounts,
        address[] memory recipients,
        uint8[] memory strategies  // 0: HYPE, 1: Accumulate, 2: Platform Fee
    ) external returns (uint256[] memory processedAmounts);
    
    /**
     * @dev Get accumulated dust for a fund
     */
    function getFundDustBalance(bytes32 fundId) external view returns (uint256 balance);
    
    /**
     * @dev Get current HYPE conversion rate
     */
    function getHYPEConversionRate() external view returns (uint256 rate);
    
    /**
     * @dev Check if dust amount is worth processing
     */
    function isDustProcessingWorthwhile(
        uint256 dustValue
    ) external view returns (bool worthwhile);
    
    /**
     * @dev Calculate gas cost for dust processing
     */
    function calculateDustProcessingCost(
        uint256 dustValue,
        uint8 strategy
    ) external view returns (uint256 gasCost);
    
    /**
     * @dev Emergency function to withdraw accumulated dust
     */
    function emergencyWithdrawDust(
        bytes32 fundId,
        address recipient
    ) external returns (uint256 withdrawnAmount);
}