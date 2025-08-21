// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
// SafeMath not needed in Solidity 0.8+
import "../IndexTokenFactory.sol";
import "../interfaces/IIndexTokenFactory.sol";
import "../libraries/PrecisionMath.sol";

/**
 * @title PrecisionCalculator
 * @dev Handles precise calculations for token redemption with evmExtraWeiDecimals consideration
 */
contract PrecisionCalculator is AccessControl {
    // SafeMath usage removed (Solidity 0.8+ has built-in overflow checks)
    using PrecisionMath for uint256;
    
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CALCULATOR_ROLE = keccak256("CALCULATOR_ROLE");
    
    // Core contracts
    IndexTokenFactory public immutable factory;
    
    // Configuration
    mapping(address => uint8) public evmExtraWeiDecimals;
    uint256 public dustThreshold = 1e12; // Minimum dust value
    uint256 public gasEstimatePerAsset = 21000; // Gas estimate per asset transfer
    
    // Events
    event PrecisionCalculationCompleted(
        bytes32 indexed fundId,
        uint256 tokenAmount,
        uint256 totalAssetValue,
        uint256 totalDustValue
    );
    
    /**
     * @dev Constructor
     */
    constructor(address _factory) {
        require(_factory != address(0), "Factory cannot be zero address");
        
        factory = IndexTokenFactory(_factory);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(CALCULATOR_ROLE, msg.sender);
    }
    
    /**
     * @dev Calculate precise redemption amounts with dust handling
     */
    function calculatePreciseRedemption(
        bytes32 fundId,
        uint256 tokenAmount
    ) external view returns (
        address[] memory assetTokens,
        uint256[] memory preciseAmounts,
        uint256 totalDustValue
    ) {
        // Get fund information
        (, , , , uint256 totalSupply, , , bool isIssued) = factory.getFundInfo(fundId);
        require(isIssued, "Fund not issued");
        require(totalSupply > 0, "No tokens in circulation");
        require(tokenAmount <= totalSupply, "Amount exceeds total supply");
        
        // Get fund components
        IIndexTokenFactory.ComponentToken[] memory components = factory.getFundComponents(fundId);
        require(components.length > 0, "No components in fund");
        
        // Initialize return arrays
        assetTokens = new address[](components.length);
        preciseAmounts = new uint256[](components.length);
        totalDustValue = 0;
        
        // Calculate redemption ratio
        uint256 redemptionRatio = tokenAmount.mul(1e18).div(totalSupply);
        
        // Calculate precise amounts for each component
        for (uint256 i = 0; i < components.length; i++) {
            assetTokens[i] = components[i].tokenAddress;
            
            // Calculate raw redemption amount
            uint256 rawAmount = components[i].depositedAmount.mul(redemptionRatio).div(1e18);
            
            // Apply precision adjustment
            (uint256 adjustedAmount, uint256 dustAmount) = _calculatePrecisionAdjustment(
                components[i].tokenAddress,
                rawAmount
            );
            
            preciseAmounts[i] = adjustedAmount;
            totalDustValue = totalDustValue.add(dustAmount);
        }
        
        return (assetTokens, preciseAmounts, totalDustValue);
    }
    
    /**
     * @dev Calculate precision adjustment for a specific token
     */
    function _calculatePrecisionAdjustment(
        address token,
        uint256 rawAmount
    ) internal view returns (uint256 adjustedAmount, uint256 dustAmount) {
        uint8 extraDecimals = evmExtraWeiDecimals[token];
        
        if (extraDecimals > 0) {
            uint256 divisor = 10 ** extraDecimals;
            adjustedAmount = rawAmount.div(divisor).mul(divisor);
            dustAmount = rawAmount.sub(adjustedAmount);
        } else {
            adjustedAmount = rawAmount;
            dustAmount = 0;
        }
        
        return (adjustedAmount, dustAmount);
    }
    
    /**
     * @dev Calculate total value of assets to be redeemed
     */
    function calculateRedemptionValue(
        bytes32 fundId,
        uint256 tokenAmount
    ) external view returns (uint256 totalValue) {
        (, , uint256 nav, , , , , bool isIssued) = factory.getFundInfo(fundId);
        require(isIssued, "Fund not issued");
        
        // Calculate total value based on NAV
        totalValue = tokenAmount.mul(nav).div(1e18);
        
        return totalValue;
    }
    
    /**
     * @dev Calculate gas savings from batch operations
     */
    function calculateGasSavings(uint256 assetCount) external view returns (uint256 gasSaved) {
        // Estimate gas savings from batch operations vs individual transfers
        uint256 individualGasCost = assetCount.mul(gasEstimatePerAsset);
        uint256 batchGasCost = gasEstimatePerAsset.add(assetCount.mul(5000)); // Overhead + per-asset cost
        
        gasSaved = individualGasCost > batchGasCost ? individualGasCost.sub(batchGasCost) : 0;
        
        return gasSaved;
    }
    
    /**
     * @dev Simulate redemption to preview results
     */
    function simulateRedemption(
        bytes32 fundId,
        uint256 tokenAmount
    ) external view returns (
        address[] memory assetTokens,
        uint256[] memory preciseAmounts,
        uint256[] memory dustAmounts,
        uint256 totalValue,
        uint256 totalDust,
        uint256 estimatedGas
    ) {
        // Get precise calculation results
        (assetTokens, preciseAmounts, totalDust) = this.calculatePreciseRedemption(fundId, tokenAmount);
        
        // Calculate individual dust amounts
        dustAmounts = new uint256[](assetTokens.length);
        IIndexTokenFactory.ComponentToken[] memory components = factory.getFundComponents(fundId);
        (, , , , uint256 totalSupply, , , ) = factory.getFundInfo(fundId);
        uint256 redemptionRatio = tokenAmount.mul(1e18).div(totalSupply);
        
        for (uint256 i = 0; i < components.length; i++) {
            uint256 rawAmount = components[i].depositedAmount.mul(redemptionRatio).div(1e18);
            (, dustAmounts[i]) = _calculatePrecisionAdjustment(assetTokens[i], rawAmount);
        }
        
        // Calculate total value
        totalValue = calculateRedemptionValue(fundId, tokenAmount);
        
        // Estimate gas cost
        estimatedGas = calculateGasSavings(assetTokens.length);
        
        return (assetTokens, preciseAmounts, dustAmounts, totalValue, totalDust, estimatedGas);
    }
    
    /**
     * @dev Check if redemption amount creates significant dust
     */
    function isDustSignificant(
        bytes32 fundId,
        uint256 tokenAmount
    ) external view returns (bool significant, uint256 dustPercentage) {
        (, , uint256 totalDustValue) = this.calculatePreciseRedemption(fundId, tokenAmount);
        uint256 totalValue = calculateRedemptionValue(fundId, tokenAmount);
        
        if (totalValue > 0) {
            dustPercentage = totalDustValue.mul(10000).div(totalValue); // Basis points
            significant = dustPercentage > 100; // More than 1%
        }
        
        return (significant, dustPercentage);
    }
    
    /**
     * @dev Get optimal redemption amount to minimize dust
     */
    function getOptimalRedemptionAmount(
        bytes32 fundId,
        uint256 targetAmount
    ) external view returns (uint256 optimalAmount, uint256 dustReduction) {
        // This is a simplified implementation
        // In practice, you might want to iterate to find the amount that minimizes dust
        
        IIndexTokenFactory.ComponentToken[] memory components = factory.getFundComponents(fundId);
        (, , , , uint256 totalSupply, , , ) = factory.getFundInfo(fundId);
        
        uint256 minReductionFactor = type(uint256).max;
        
        // Find the component that requires the most adjustment
        for (uint256 i = 0; i < components.length; i++) {
            uint8 extraDecimals = evmExtraWeiDecimals[components[i].tokenAddress];
            if (extraDecimals > 0) {
                uint256 divisor = 10 ** extraDecimals;
                uint256 componentRatio = components[i].depositedAmount.mul(1e18).div(totalSupply);
                uint256 adjustmentFactor = divisor.mul(1e18).div(componentRatio);
                
                if (adjustmentFactor < minReductionFactor) {
                    minReductionFactor = adjustmentFactor;
                }
            }
        }
        
        if (minReductionFactor != type(uint256).max) {
            optimalAmount = targetAmount.div(minReductionFactor).mul(minReductionFactor);
            dustReduction = targetAmount.sub(optimalAmount);
        } else {
            optimalAmount = targetAmount;
            dustReduction = 0;
        }
        
        return (optimalAmount, dustReduction);
    }
    
    // Admin functions
    
    /**
     * @dev Set evmExtraWeiDecimals for a token
     */
    function setEVMExtraWeiDecimals(
        address token,
        uint8 decimals
    ) external onlyRole(ADMIN_ROLE) {
        require(token != address(0), "Invalid token address");
        require(decimals <= 18, "Decimals too high");
        
        evmExtraWeiDecimals[token] = decimals;
    }
    
    /**
     * @dev Set dust threshold
     */
    function setDustThreshold(uint256 _threshold) external onlyRole(ADMIN_ROLE) {
        dustThreshold = _threshold;
    }
    
    /**
     * @dev Set gas estimate per asset
     */
    function setGasEstimatePerAsset(uint256 _gasEstimate) external onlyRole(ADMIN_ROLE) {
        gasEstimatePerAsset = _gasEstimate;
    }
    
    // View functions
    
    /**
     * @dev Get precision settings for a token
     */
    function getPrecisionSettings(address token) external view returns (
        uint8 extraDecimals,
        uint256 divisor,
        bool needsAdjustment
    ) {
        extraDecimals = evmExtraWeiDecimals[token];
        divisor = extraDecimals > 0 ? 10 ** extraDecimals : 1;
        needsAdjustment = extraDecimals > 0;
        
        return (extraDecimals, divisor, needsAdjustment);
    }
    
    /**
     * @dev Preview precision adjustment for an amount
     */
    function previewPrecisionAdjustment(
        address token,
        uint256 amount
    ) external view returns (uint256 adjustedAmount, uint256 dustAmount) {
        return _calculatePrecisionAdjustment(token, amount);
    }
}