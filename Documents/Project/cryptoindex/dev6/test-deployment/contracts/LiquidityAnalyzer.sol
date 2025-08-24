// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IPriceFeed.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LiquidityAnalyzer
 * @dev Market liquidity analysis for dynamic minimum calculation
 * Based on: Aave V3 Liquidity Analysis + Compound V3 Market Conditions
 */
contract LiquidityAnalyzer is Ownable {
    IPriceFeed public immutable priceFeed;
    
    struct MarketCondition {
        uint256 totalLiquidity;      // Total market liquidity
        uint256 volatilityIndex;     // Market volatility (0-10000 basis points)
        uint256 demandPressure;      // User demand pressure
        uint256 lastUpdate;          // Last update timestamp
        bool isStable;               // Market stability flag
    }
    
    struct LiquidityTier {
        uint256 threshold;           // Liquidity threshold
        uint256 minimumRequired;     // Required minimum for this tier
        string tierName;             // Tier identification
    }
    
    MarketCondition public currentMarket;
    LiquidityTier[] public liquidityTiers;
    
    // Events
    event MarketConditionUpdated(uint256 liquidity, uint256 volatility, bool stable);
    event MinimumCalculated(uint256 baseLiquidity, uint256 calculatedMinimum, string tier);
    event LiquidityTierAdded(uint256 threshold, uint256 minimum, string tierName);
    
    constructor(address _priceFeed) {
        priceFeed = IPriceFeed(_priceFeed);
        
        // Initialize liquidity tiers (Aave V3 inspired)
        _addLiquidityTier(100000000e6, 50e6, "Ultra High");    // >100M: $50 min
        _addLiquidityTier(50000000e6, 100e6, "Very High");     // >50M: $100 min
        _addLiquidityTier(10000000e6, 200e6, "High");          // >10M: $200 min
        _addLiquidityTier(1000000e6, 500e6, "Medium");         // >1M: $500 min
        _addLiquidityTier(0, 1000e6, "Low");                   // <1M: $1000 min
        
        // Initialize market condition
        currentMarket = MarketCondition({
            totalLiquidity: 50000000e6, // Start with 50M assumption
            volatilityIndex: 1000,       // 10% volatility
            demandPressure: 5000,        // 50% demand pressure
            lastUpdate: block.timestamp,
            isStable: true
        });
    }
    
    /**
     * @dev Calculate dynamic minimum based on current market conditions
     * @return minimum The calculated minimum required amount
     * @return tierName The liquidity tier name
     */
    function calculateDynamicMinimum() external view returns (uint256 minimum, string memory tierName) {
        uint256 baseLiquidity = getCurrentMarketLiquidity();
        
        // Find appropriate tier
        for (uint256 i = 0; i < liquidityTiers.length; i++) {
            if (baseLiquidity >= liquidityTiers[i].threshold) {
                uint256 baseMinimum = liquidityTiers[i].minimumRequired;
                
                // Apply volatility adjustment (Compound V3 style)
                uint256 volatilityAdjustment = _calculateVolatilityAdjustment(baseMinimum);
                
                // Apply demand pressure adjustment  
                uint256 demandAdjustment = _calculateDemandAdjustment(baseMinimum);
                
                // Final calculation
                minimum = baseMinimum + volatilityAdjustment + demandAdjustment;
                
                // Safety bounds (never below $25, never above $2000)
                if (minimum < 25e6) minimum = 25e6;
                if (minimum > 2000e6) minimum = 2000e6;
                
                return (minimum, liquidityTiers[i].tierName);
            }
        }
        
        // Fallback to highest minimum
        return (liquidityTiers[liquidityTiers.length - 1].minimumRequired, "Fallback");
    }
    
    /**
     * @dev Get current market liquidity (mock implementation)
     */
    function getCurrentMarketLiquidity() public view returns (uint256) {
        // In production, this would aggregate from multiple DEXes
        // For now, return stored value with time-based simulation
        uint256 timeElapsed = block.timestamp - currentMarket.lastUpdate;
        uint256 liquidityVariation = (timeElapsed * currentMarket.demandPressure) / 10000;
        
        return currentMarket.totalLiquidity + liquidityVariation;
    }
    
    /**
     * @dev Update market conditions (would be called by oracle)
     */
    function updateMarketConditions(
        uint256 _liquidity,
        uint256 _volatility,
        uint256 _demandPressure
    ) external onlyOwner {
        currentMarket.totalLiquidity = _liquidity;
        currentMarket.volatilityIndex = _volatility;
        currentMarket.demandPressure = _demandPressure;
        currentMarket.lastUpdate = block.timestamp;
        currentMarket.isStable = _volatility < 2000; // <20% volatility = stable
        
        emit MarketConditionUpdated(_liquidity, _volatility, currentMarket.isStable);
    }
    
    // Internal calculation functions
    function _calculateVolatilityAdjustment(uint256 baseMinimum) internal view returns (uint256) {
        // Higher volatility = higher minimum (max 50% increase)
        return (baseMinimum * currentMarket.volatilityIndex) / 20000; // Divide by 20000 for max 50%
    }
    
    function _calculateDemandAdjustment(uint256 baseMinimum) internal view returns (uint256) {
        // Higher demand = lower minimum to attract users (max 25% decrease)
        uint256 demandReduction = (baseMinimum * currentMarket.demandPressure) / 40000; // Max 25% reduction
        return demandReduction > baseMinimum ? 0 : demandReduction;
    }
    
    function _addLiquidityTier(uint256 threshold, uint256 minimum, string memory tierName) internal {
        liquidityTiers.push(LiquidityTier({
            threshold: threshold,
            minimumRequired: minimum,
            tierName: tierName
        }));
        
        emit LiquidityTierAdded(threshold, minimum, tierName);
    }
    
    // Getters
    function getLiquidityTiers() external view returns (LiquidityTier[] memory) {
        return liquidityTiers;
    }
    
    function getMarketCondition() external view returns (MarketCondition memory) {
        return currentMarket;
    }
}