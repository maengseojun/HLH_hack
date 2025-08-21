// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title PrecisionMath
 * @dev Library for high-precision mathematical operations
 * Handles calculations with extra decimal places for Hyperliquid compatibility
 */
library PrecisionMath {
    
    uint256 private constant PRECISION_BASE = 1e18;
    uint256 private constant MAX_DECIMALS = 18;
    
    /**
     * @dev Multiply two numbers with precision handling
     */
    function precisionMul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0 || b == 0) return 0;
        
        uint256 result = a * b;
        require(result / a == b, "PrecisionMath: multiplication overflow");
        
        return result / PRECISION_BASE;
    }
    
    /**
     * @dev Divide two numbers with precision handling
     */
    function precisionDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "PrecisionMath: division by zero");
        
        uint256 result = (a * PRECISION_BASE) / b;
        return result;
    }
    
    /**
     * @dev Calculate percentage with basis points precision
     */
    function percentage(uint256 amount, uint256 basisPoints) internal pure returns (uint256) {
        require(basisPoints <= 10000, "PrecisionMath: basis points too high");
        
        return (amount * basisPoints) / 10000;
    }
    
    /**
     * @dev Adjust amount based on extra decimal places
     */
    function adjustForExtraDecimals(
        uint256 amount,
        uint8 extraDecimals
    ) internal pure returns (uint256 adjustedAmount, uint256 dust) {
        require(extraDecimals <= MAX_DECIMALS, "PrecisionMath: too many extra decimals");
        
        if (extraDecimals == 0) {
            return (amount, 0);
        }
        
        uint256 divisor = 10 ** extraDecimals;
        adjustedAmount = (amount / divisor) * divisor;
        dust = amount - adjustedAmount;
        
        return (adjustedAmount, dust);
    }
    
    /**
     * @dev Calculate ratio between two amounts with high precision
     */
    function calculateRatio(uint256 numerator, uint256 denominator) internal pure returns (uint256) {
        require(denominator > 0, "PrecisionMath: division by zero");
        
        return (numerator * PRECISION_BASE) / denominator;
    }
    
    /**
     * @dev Apply ratio to an amount
     */
    function applyRatio(uint256 amount, uint256 ratio) internal pure returns (uint256) {
        return (amount * ratio) / PRECISION_BASE;
    }
    
    /**
     * @dev Calculate compound interest
     */
    function compound(
        uint256 principal,
        uint256 rate,
        uint256 periods
    ) internal pure returns (uint256) {
        if (periods == 0) return principal;
        
        uint256 result = principal;
        uint256 ratePerPeriod = rate + PRECISION_BASE;
        
        for (uint256 i = 0; i < periods; i++) {
            result = precisionMul(result, ratePerPeriod);
        }
        
        return result;
    }
    
    /**
     * @dev Calculate square root using Babylonian method
     */
    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        
        return y;
    }
    
    /**
     * @dev Calculate weighted average
     */
    function weightedAverage(
        uint256[] memory values,
        uint256[] memory weights
    ) internal pure returns (uint256) {
        require(values.length == weights.length, "PrecisionMath: array length mismatch");
        require(values.length > 0, "PrecisionMath: empty arrays");
        
        uint256 weightedSum = 0;
        uint256 totalWeight = 0;
        
        for (uint256 i = 0; i < values.length; i++) {
            weightedSum += values[i] * weights[i];
            totalWeight += weights[i];
        }
        
        require(totalWeight > 0, "PrecisionMath: zero total weight");
        
        return weightedSum / totalWeight;
    }
    
    /**
     * @dev Calculate moving average
     */
    function movingAverage(
        uint256[] memory values,
        uint256 windowSize
    ) internal pure returns (uint256[] memory) {
        require(values.length >= windowSize, "PrecisionMath: insufficient data");
        require(windowSize > 0, "PrecisionMath: invalid window size");
        
        uint256[] memory averages = new uint256[](values.length - windowSize + 1);
        
        for (uint256 i = 0; i <= values.length - windowSize; i++) {
            uint256 sum = 0;
            for (uint256 j = i; j < i + windowSize; j++) {
                sum += values[j];
            }
            averages[i] = sum / windowSize;
        }
        
        return averages;
    }
    
    /**
     * @dev Check if two values are approximately equal within tolerance
     */
    function isApproximatelyEqual(
        uint256 a,
        uint256 b,
        uint256 tolerance
    ) internal pure returns (bool) {
        if (a == b) return true;
        
        uint256 diff = a > b ? a - b : b - a;
        uint256 larger = a > b ? a : b;
        
        if (larger == 0) return diff <= tolerance;
        
        return (diff * PRECISION_BASE) / larger <= tolerance;
    }
    
    /**
     * @dev Calculate minimum value from array
     */
    function min(uint256[] memory values) internal pure returns (uint256) {
        require(values.length > 0, "PrecisionMath: empty array");
        
        uint256 minimum = values[0];
        for (uint256 i = 1; i < values.length; i++) {
            if (values[i] < minimum) {
                minimum = values[i];
            }
        }
        
        return minimum;
    }
    
    /**
     * @dev Calculate maximum value from array
     */
    function max(uint256[] memory values) internal pure returns (uint256) {
        require(values.length > 0, "PrecisionMath: empty array");
        
        uint256 maximum = values[0];
        for (uint256 i = 1; i < values.length; i++) {
            if (values[i] > maximum) {
                maximum = values[i];
            }
        }
        
        return maximum;
    }
    
    /**
     * @dev Calculate standard deviation
     */
    function standardDeviation(uint256[] memory values) internal pure returns (uint256) {
        require(values.length > 1, "PrecisionMath: insufficient data for std dev");
        
        // Calculate mean
        uint256 sum = 0;
        for (uint256 i = 0; i < values.length; i++) {
            sum += values[i];
        }
        uint256 mean = sum / values.length;
        
        // Calculate variance
        uint256 varianceSum = 0;
        for (uint256 i = 0; i < values.length; i++) {
            uint256 diff = values[i] > mean ? values[i] - mean : mean - values[i];
            varianceSum += diff * diff;
        }
        uint256 variance = varianceSum / (values.length - 1);
        
        return sqrt(variance);
    }
}