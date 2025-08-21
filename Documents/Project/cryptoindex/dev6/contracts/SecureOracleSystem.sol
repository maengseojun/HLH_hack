// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IPriceFeed.sol";

/**
 * @title SecureOracleSystem
 * @dev Multi-oracle validation with TWAP and manipulation resistance
 * @notice Prevents oracle manipulation attacks through multiple validation layers
 */
contract SecureOracleSystem is AccessControl, ReentrancyGuard {
    
    // Roles
    bytes32 public constant ORACLE_UPDATER_ROLE = keccak256("ORACLE_UPDATER_ROLE");
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");
    
    // Oracle source types
    enum OracleSource {
        HYPERLIQUID_NATIVE,
        CHAINLINK,
        BAND_PROTOCOL,
        UNISWAP_V3_TWAP,
        PYTH_NETWORK
    }
    
    // Price data structure
    struct PriceData {
        uint256 price;
        uint256 timestamp;
        uint256 confidence;
        OracleSource source;
        bool isValid;
    }
    
    // TWAP configuration
    struct TWAPConfig {
        uint256 windowSize;      // Number of data points
        uint256 updateInterval;  // Seconds between updates
        uint256 maxAge;         // Maximum age for valid data
        uint256 minSources;     // Minimum oracle sources required
    }
    
    // Oracle configuration
    struct OracleConfig {
        address oracleAddress;
        OracleSource sourceType;
        uint256 weight;         // Weight in aggregation (basis points)
        bool isActive;
        uint256 maxDeviation;   // Max deviation from median (basis points)
    }
    
    // State variables
    mapping(address => mapping(OracleSource => PriceData)) public priceData;
    mapping(address => PriceData[]) public priceHistory;
    mapping(OracleSource => OracleConfig) public oracleConfigs;
    mapping(address => uint256) public lastUpdateTime;
    
    TWAPConfig public twapConfig;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MAX_PRICE_AGE = 3600; // 1 hour
    uint256 public constant MIN_ORACLE_SOURCES = 3;
    uint256 public constant MAX_DEVIATION = 500; // 5%
    
    // Circuit breaker
    bool public emergencyMode = false;
    uint256 public lastEmergencyTime;
    
    // Events
    event PriceUpdated(address indexed token, uint256 price, OracleSource source);
    event OracleConfigured(OracleSource source, address oracle, uint256 weight);
    event ManipulationDetected(address token, uint256 suspiciousPrice, OracleSource source);
    event EmergencyModeActivated(string reason);
    event TWAPCalculated(address token, uint256 twapPrice, uint256 dataPoints);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_UPDATER_ROLE, msg.sender);
        
        // Initialize TWAP config
        twapConfig = TWAPConfig({
            windowSize: 24,          // 24 data points
            updateInterval: 3600,     // 1 hour
            maxAge: 86400,           // 24 hours
            minSources: 3
        });
    }
    
    /**
     * @dev Configure an oracle source
     */
    function configureOracle(
        OracleSource source,
        address oracleAddress,
        uint256 weight,
        uint256 maxDeviation
    ) external onlyRole(ORACLE_ADMIN_ROLE) {
        require(oracleAddress != address(0), "Invalid oracle");
        require(weight > 0 && weight <= BASIS_POINTS, "Invalid weight");
        require(maxDeviation <= 1000, "Deviation too high"); // Max 10%
        
        oracleConfigs[source] = OracleConfig({
            oracleAddress: oracleAddress,
            sourceType: source,
            weight: weight,
            isActive: true,
            maxDeviation: maxDeviation
        });
        
        emit OracleConfigured(source, oracleAddress, weight);
    }
    
    /**
     * @dev Get secure price with multi-oracle validation
     */
    function getSecurePrice(address token) external view returns (uint256) {
        require(!emergencyMode, "Emergency mode active");
        
        // Collect prices from all active oracles
        uint256[] memory prices = new uint256[](5);
        uint256[] memory weights = new uint256[](5);
        uint256 validSources = 0;
        
        for (uint256 i = 0; i < 5; i++) {
            OracleSource source = OracleSource(i);
            OracleConfig memory config = oracleConfigs[source];
            
            if (config.isActive) {
                PriceData memory data = priceData[token][source];
                
                // Check if price is fresh
                if (data.isValid && block.timestamp - data.timestamp <= MAX_PRICE_AGE) {
                    prices[validSources] = data.price;
                    weights[validSources] = config.weight;
                    validSources++;
                }
            }
        }
        
        require(validSources >= MIN_ORACLE_SOURCES, "Insufficient oracle sources");
        
        // Calculate weighted median price
        uint256 medianPrice = calculateWeightedMedian(prices, weights, validSources);
        
        // Validate against manipulation
        validatePriceIntegrity(token, medianPrice, prices, validSources);
        
        return medianPrice;
    }
    
    /**
     * @dev Calculate TWAP (Time-Weighted Average Price)
     */
    function getTWAP(address token, uint256 period) external view returns (uint256) {
        require(period > 0 && period <= twapConfig.maxAge, "Invalid period");
        
        PriceData[] memory history = priceHistory[token];
        require(history.length > 0, "No price history");
        
        uint256 weightedSum = 0;
        uint256 totalWeight = 0;
        uint256 currentTime = block.timestamp;
        uint256 dataPoints = 0;
        
        // Calculate time-weighted average
        for (uint256 i = history.length; i > 0; i--) {
            PriceData memory data = history[i - 1];
            
            if (currentTime - data.timestamp > period) {
                break;
            }
            
            uint256 timeWeight = period - (currentTime - data.timestamp);
            weightedSum += data.price * timeWeight;
            totalWeight += timeWeight;
            dataPoints++;
        }
        
        require(totalWeight > 0, "No valid data in period");
        uint256 twapPrice = weightedSum / totalWeight;
        
        return twapPrice;
    }
    
    /**
     * @dev Update price from oracle source
     */
    function updatePrice(
        address token,
        uint256 price,
        OracleSource source
    ) external onlyRole(ORACLE_UPDATER_ROLE) {
        require(price > 0, "Invalid price");
        require(oracleConfigs[source].isActive, "Oracle not active");
        
        // Check for manipulation
        if (isManipulationDetected(token, price, source)) {
            emit ManipulationDetected(token, price, source);
            // Don't update price if manipulation detected
            return;
        }
        
        // Update price data
        PriceData memory newData = PriceData({
            price: price,
            timestamp: block.timestamp,
            confidence: calculateConfidence(token, price),
            source: source,
            isValid: true
        });
        
        priceData[token][source] = newData;
        priceHistory[token].push(newData);
        lastUpdateTime[token] = block.timestamp;
        
        // Trim history if too long
        if (priceHistory[token].length > twapConfig.windowSize * 5) {
            // Keep only recent history
            trimPriceHistory(token);
        }
        
        emit PriceUpdated(token, price, source);
    }
    
    /**
     * @dev Check for price manipulation
     */
    function isManipulationDetected(
        address token,
        uint256 newPrice,
        OracleSource source
    ) private view returns (bool) {
        // Get current average price
        uint256 currentAvg = getCurrentAveragePrice(token);
        if (currentAvg == 0) return false; // No baseline to compare
        
        // Calculate deviation
        uint256 deviation;
        if (newPrice > currentAvg) {
            deviation = ((newPrice - currentAvg) * BASIS_POINTS) / currentAvg;
        } else {
            deviation = ((currentAvg - newPrice) * BASIS_POINTS) / currentAvg;
        }
        
        // Check against max deviation for this oracle
        uint256 maxDev = oracleConfigs[source].maxDeviation;
        if (maxDev == 0) maxDev = MAX_DEVIATION;
        
        return deviation > maxDev;
    }
    
    /**
     * @dev Calculate weighted median price
     */
    function calculateWeightedMedian(
        uint256[] memory prices,
        uint256[] memory weights,
        uint256 count
    ) private pure returns (uint256) {
        // Sort prices while maintaining weight association
        for (uint256 i = 0; i < count - 1; i++) {
            for (uint256 j = 0; j < count - i - 1; j++) {
                if (prices[j] > prices[j + 1]) {
                    // Swap prices
                    uint256 tempPrice = prices[j];
                    prices[j] = prices[j + 1];
                    prices[j + 1] = tempPrice;
                    
                    // Swap weights
                    uint256 tempWeight = weights[j];
                    weights[j] = weights[j + 1];
                    weights[j + 1] = tempWeight;
                }
            }
        }
        
        // Calculate weighted median
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < count; i++) {
            totalWeight += weights[i];
        }
        
        uint256 medianWeight = totalWeight / 2;
        uint256 cumulativeWeight = 0;
        
        for (uint256 i = 0; i < count; i++) {
            cumulativeWeight += weights[i];
            if (cumulativeWeight >= medianWeight) {
                return prices[i];
            }
        }
        
        return prices[count - 1];
    }
    
    /**
     * @dev Validate price integrity
     */
    function validatePriceIntegrity(
        address token,
        uint256 medianPrice,
        uint256[] memory prices,
        uint256 count
    ) private view {
        // Check for outliers
        for (uint256 i = 0; i < count; i++) {
            uint256 deviation;
            if (prices[i] > medianPrice) {
                deviation = ((prices[i] - medianPrice) * BASIS_POINTS) / medianPrice;
            } else {
                deviation = ((medianPrice - prices[i]) * BASIS_POINTS) / medianPrice;
            }
            
            require(deviation <= MAX_DEVIATION * 2, "Price outlier detected");
        }
    }
    
    /**
     * @dev Calculate confidence score for price
     */
    function calculateConfidence(address token, uint256 price) private view returns (uint256) {
        uint256 sources = 0;
        uint256 totalDeviation = 0;
        
        for (uint256 i = 0; i < 5; i++) {
            OracleSource source = OracleSource(i);
            if (oracleConfigs[source].isActive) {
                PriceData memory data = priceData[token][source];
                if (data.isValid && block.timestamp - data.timestamp <= MAX_PRICE_AGE) {
                    sources++;
                    
                    // Calculate deviation from this price
                    if (price > data.price) {
                        totalDeviation += ((price - data.price) * BASIS_POINTS) / price;
                    } else {
                        totalDeviation += ((data.price - price) * BASIS_POINTS) / price;
                    }
                }
            }
        }
        
        if (sources == 0) return 0;
        
        // Higher confidence with more sources and lower deviation
        uint256 avgDeviation = totalDeviation / sources;
        uint256 confidence = BASIS_POINTS - avgDeviation;
        
        // Boost confidence based on number of sources
        confidence = (confidence * sources) / MIN_ORACLE_SOURCES;
        
        return confidence > BASIS_POINTS ? BASIS_POINTS : confidence;
    }
    
    /**
     * @dev Get current average price from all sources
     */
    function getCurrentAveragePrice(address token) private view returns (uint256) {
        uint256 sum = 0;
        uint256 count = 0;
        
        for (uint256 i = 0; i < 5; i++) {
            OracleSource source = OracleSource(i);
            if (oracleConfigs[source].isActive) {
                PriceData memory data = priceData[token][source];
                if (data.isValid && block.timestamp - data.timestamp <= MAX_PRICE_AGE) {
                    sum += data.price;
                    count++;
                }
            }
        }
        
        return count > 0 ? sum / count : 0;
    }
    
    /**
     * @dev Trim old price history
     */
    function trimPriceHistory(address token) private {
        PriceData[] storage history = priceHistory[token];
        uint256 currentTime = block.timestamp;
        uint256 cutoffTime = currentTime - twapConfig.maxAge;
        
        // Find index where to start keeping data
        uint256 keepIndex = 0;
        for (uint256 i = 0; i < history.length; i++) {
            if (history[i].timestamp >= cutoffTime) {
                keepIndex = i;
                break;
            }
        }
        
        // Remove old data
        if (keepIndex > 0) {
            for (uint256 i = 0; i < history.length - keepIndex; i++) {
                history[i] = history[i + keepIndex];
            }
            
            // Reduce array size
            for (uint256 i = 0; i < keepIndex; i++) {
                history.pop();
            }
        }
    }
    
    /**
     * @dev Emergency mode activation
     */
    function activateEmergencyMode(string memory reason) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emergencyMode = true;
        lastEmergencyTime = block.timestamp;
        emit EmergencyModeActivated(reason);
    }
    
    /**
     * @dev Deactivate emergency mode
     */
    function deactivateEmergencyMode() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(block.timestamp >= lastEmergencyTime + 3600, "Too soon"); // 1 hour cooldown
        emergencyMode = false;
    }
}
