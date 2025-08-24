// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/IPriceFeed.sol";

/**
 * @title EnhancedOracleManager
 * @dev Advanced oracle management with TWAP, deviation detection, and multi-source aggregation
 * @notice Addresses critical oracle manipulation resistance identified in 2nd verification
 */
contract EnhancedOracleManager is AccessControl, ReentrancyGuard {
    using Math for uint256;
    
    // Roles
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");
    bytes32 public constant PRICE_UPDATER_ROLE = keccak256("PRICE_UPDATER_ROLE");
    
    // Constants
    uint256 public constant MAX_PRICE_DEVIATION = 1000; // 10%
    uint256 public constant MIN_UPDATE_INTERVAL = 60;   // 1 minute
    uint256 public constant MAX_UPDATE_INTERVAL = 3600; // 1 hour
    uint256 public constant TWAP_WINDOW = 1800;         // 30 minutes
    uint256 public constant MIN_ORACLE_SOURCES = 2;
    uint256 public constant MAX_ORACLE_SOURCES = 5;
    
    // Structs
    struct OracleSource {
        IPriceFeed oracle;
        uint256 weight;          // Weight in aggregation (basis points)
        uint256 lastUpdate;
        uint256 failureCount;
        uint256 maxFailures;
        bool isActive;
        string name;
    }
    
    struct PricePoint {
        uint256 price;
        uint256 timestamp;
        uint256 blockNumber;
        bool isValid;
    }
    
    struct TWAPData {
        uint256 cumulativePrice;
        uint256 startTime;
        uint256 updateCount;
        uint256 lastPrice;
        bool isInitialized;
    }
    
    struct AggregatedPrice {
        uint256 price;
        uint256 confidence;      // 0-10000 (basis points)
        uint256 timestamp;
        uint256 sourceCount;
        bool isValid;
    }
    
    // State variables
    mapping(address => OracleSource[]) public oracleSources;
    mapping(address => PricePoint[]) public priceHistory;
    mapping(address => TWAPData) public twapData;
    mapping(address => AggregatedPrice) public latestPrices;
    mapping(address => bool) public isAssetSupported;

    // Asset Registry
    mapping(address => uint32) public assetToIndex;
    mapping(uint32 => address) public indexToAsset;
    uint32 public nextAssetIndex = 1; // Start from 1, 0 is reserved for invalid

    // Configuration
    mapping(address => uint256) public maxPriceAge;
    mapping(address => uint256) public minConfidenceLevel;
    mapping(address => uint256) public priceDeviationThreshold;
    
    // Circuit breaker
    mapping(address => uint256) public lastManipulationDetection;
    mapping(address => uint256) public manipulationCount;
    uint256 public manipulationCooldown = 300; // 5 minutes
    
    // Statistics
    uint256 public totalPriceUpdates;
    uint256 public totalManipulationAttempts;
    uint256 public totalOracleFailures;
    
    // Events
    event AssetRegistered(address indexed asset, uint32 indexed assetIndex);
    event OracleSourceAdded(address indexed asset, address indexed oracle, string name, uint256 weight);
    event OracleSourceRemoved(address indexed asset, address indexed oracle);
    event PriceUpdated(address indexed asset, uint256 price, uint256 confidence, uint256 sourceCount);
    event PriceManipulationDetected(address indexed asset, uint256 expectedPrice, uint256 reportedPrice);
    event TWAPUpdated(address indexed asset, uint256 twapPrice, uint256 spotPrice);
    event OracleFailure(address indexed asset, address indexed oracle, string reason);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ADMIN_ROLE, msg.sender);
        _grantRole(PRICE_UPDATER_ROLE, msg.sender);
    }
    
    /**
     * @dev Add oracle source for an asset
     * @param asset The asset address
     * @param oracle The oracle contract address
     * @param weight Weight in aggregation (basis points, sum should be 10000)
     * @param maxFailures Maximum failures before deactivation
     * @param name Human readable name
     */
    function addOracleSource(
        address asset,
        IPriceFeed oracle,
        uint256 weight,
        uint256 maxFailures,
        string calldata name
    ) 
        external 
        onlyRole(ORACLE_ADMIN_ROLE) 
    {
        require(address(oracle) != address(0), "Invalid oracle address");
        require(weight > 0 && weight <= 10000, "Invalid weight");
        require(oracleSources[asset].length < MAX_ORACLE_SOURCES, "Too many oracle sources");
        
        if (assetToIndex[asset] == 0) {
            require(nextAssetIndex < 2**32, "Max assets reached");
            uint32 newIndex = nextAssetIndex;
            assetToIndex[asset] = newIndex;
            indexToAsset[newIndex] = asset;
            nextAssetIndex++;
            emit AssetRegistered(asset, newIndex);
        }

        for (uint i = 0; i < oracleSources[asset].length; i++) {
            require(
                address(oracleSources[asset][i].oracle) != address(oracle),
                "Oracle already exists"
            );
        }
        
        oracleSources[asset].push(OracleSource({
            oracle: oracle,
            weight: weight,
            lastUpdate: block.timestamp,
            failureCount: 0,
            maxFailures: maxFailures,
            isActive: true,
            name: name
        }));
        
        if (!isAssetSupported[asset]) {
            isAssetSupported[asset] = true;
            maxPriceAge[asset] = MAX_UPDATE_INTERVAL;
            minConfidenceLevel[asset] = 7000; // 70%
            priceDeviationThreshold[asset] = MAX_PRICE_DEVIATION;
        }
        
        emit OracleSourceAdded(asset, address(oracle), name, weight);
    }
    
    /**
     * @dev Remove oracle source
     * @param asset The asset address
     * @param oracleIndex Index of oracle to remove
     */
    function removeOracleSource(address asset, uint256 oracleIndex) 
        external 
        onlyRole(ORACLE_ADMIN_ROLE) 
    {
        require(oracleIndex < oracleSources[asset].length, "Invalid oracle index");
        require(oracleSources[asset].length > MIN_ORACLE_SOURCES, "Cannot remove, minimum oracles required");
        
        address oracleAddr = address(oracleSources[asset][oracleIndex].oracle);
        
        oracleSources[asset][oracleIndex] = oracleSources[asset][oracleSources[asset].length - 1];
        oracleSources[asset].pop();
        
        emit OracleSourceRemoved(asset, oracleAddr);
    }
    
    /**
     * @dev Update price from all oracle sources
     * @param asset The asset to update price for
     */
    function updatePrice(address asset) 
        external 
        nonReentrant 
        onlyRole(PRICE_UPDATER_ROLE) 
    {
        require(isAssetSupported[asset], "Asset not supported");
        require(oracleSources[asset].length >= MIN_ORACLE_SOURCES, "Insufficient oracle sources");
        
        uint32 assetIndex = assetToIndex[asset];
        require(assetIndex != 0, "Asset not registered in oracle");

        uint256 totalWeight = 0;
        uint256 weightedPriceSum = 0;
        uint256 validSources = 0;
        uint256[] memory prices = new uint256[](oracleSources[asset].length);
        bool[] memory sourceValid = new bool[](oracleSources[asset].length);
        
        for (uint i = 0; i < oracleSources[asset].length; i++) {
            OracleSource storage source = oracleSources[asset][i];
            
            if (!source.isActive) continue;
            
            try source.oracle.getPrice(assetIndex) returns (uint256 price) {
                if (price > 0 && _validatePrice(asset, price)) {
                    prices[i] = price;
                    sourceValid[i] = true;
                    validSources++;
                    source.lastUpdate = block.timestamp;
                    
                    if (source.failureCount > 0) {
                        source.failureCount = 0;
                    }
                } else {
                    _handleOracleFailure(asset, i, "Invalid price returned");
                }
            } catch Error(string memory reason) {
                _handleOracleFailure(asset, i, reason);
            } catch {
                _handleOracleFailure(asset, i, "Unknown error");
            }
        }
        
        require(validSources >= MIN_ORACLE_SOURCES, "Insufficient valid oracle sources");
        
        if (_detectPriceManipulation(asset, prices, sourceValid)) {
            return; 
        }
        
        for (uint i = 0; i < oracleSources[asset].length; i++) {
            if (sourceValid[i]) {
                weightedPriceSum += prices[i] * oracleSources[asset][i].weight;
                totalWeight += oracleSources[asset][i].weight;
            }
        }
        
        require(totalWeight > 0, "No valid weighted sources");
        
        uint256 aggregatedPrice = weightedPriceSum / totalWeight;
        uint256 confidence = _calculateConfidence(validSources, oracleSources[asset].length);
        
        _updateTWAP(asset, aggregatedPrice);
        
        latestPrices[asset] = AggregatedPrice({
            price: aggregatedPrice,
            confidence: confidence,
            timestamp: block.timestamp,
            sourceCount: validSources,
            isValid: true
        });
        
        _addPriceToHistory(asset, aggregatedPrice);
        
        totalPriceUpdates++;
        
        emit PriceUpdated(asset, aggregatedPrice, confidence, validSources);
    }
    
    /**
     * @dev Get latest price with confidence level
     * @param asset The asset to get price for
     * @return price The aggregated price
     * @return confidence Confidence level (basis points)
     * @return timestamp Last update timestamp
     */
    function getPrice(address asset) 
        external 
        view 
        returns (uint256 price, uint256 confidence, uint256 timestamp) 
    {
        require(isAssetSupported[asset], "Asset not supported");
        
        AggregatedPrice memory priceData = latestPrices[asset];
        require(priceData.isValid, "No valid price available");
        require(
            block.timestamp <= priceData.timestamp + maxPriceAge[asset],
            "Price too stale"
        );
        require(
            priceData.confidence >= minConfidenceLevel[asset],
            "Price confidence too low"
        );
        
        return (priceData.price, priceData.confidence, priceData.timestamp);
    }
    
    /**
     * @dev Get TWAP price
     * @param asset The asset to get TWAP for
     * @return twapPrice The TWAP price
     * @return isValid Whether TWAP is valid
     */
    function getTWAP(address asset) 
        external 
        view 
        returns (uint256 twapPrice, bool isValid) 
    {
        TWAPData memory twap = twapData[asset];
        
        if (!twap.isInitialized || twap.updateCount == 0) {
            return (0, false);
        }
        
        uint256 timeElapsed = block.timestamp - twap.startTime;
        if (timeElapsed < TWAP_WINDOW / 2) {
            return (0, false); // Not enough data
        }
        
        twapPrice = twap.cumulativePrice / twap.updateCount;
        return (twapPrice, true);
    }
    
    /**
     * @dev Check if price manipulation is detected
     * @param asset The asset to check
     * @return isManipulated Whether manipulation was detected recently
     */
    function isManipulationDetected(address asset) 
        external 
        view 
        returns (bool isManipulated) 
    {
        return block.timestamp < lastManipulationDetection[asset] + manipulationCooldown;
    }
    
    // Internal functions
    
    function _validatePrice(address asset, uint256 price) 
        internal 
        view 
        returns (bool) 
    {
        if (price == 0) return false;
        
        AggregatedPrice memory lastPrice = latestPrices[asset];
        if (lastPrice.isValid && lastPrice.timestamp > 0) {
            uint256 deviation = _calculateDeviation(lastPrice.price, price);
            if (deviation > priceDeviationThreshold[asset]) {
                return false;
            }
        }
        
        return true;
    }
    
    function _detectPriceManipulation(
        address asset,
        uint256[] memory prices,
        bool[] memory sourceValid
    ) 
        internal 
        returns (bool manipulationDetected) 
    {
        if (prices.length < 3) return false;
        
        uint256 validCount = 0;
        uint256 priceSum = 0;
        
        for (uint i = 0; i < prices.length; i++) {
            if (sourceValid[i]) {
                validCount++;
                priceSum += prices[i];
            }
        }
        
        if (validCount < 3) return false;
        
        uint256 averagePrice = priceSum / validCount;
        uint256 outlierCount = 0;
        
        for (uint i = 0; i < prices.length; i++) {
            if (sourceValid[i]) {
                uint256 deviation = _calculateDeviation(averagePrice, prices[i]);
                if (deviation > MAX_PRICE_DEVIATION * 2) { 
                    outlierCount++;
                }
            }
        }
        
        if (outlierCount * 100 / validCount > 30) {
            lastManipulationDetection[asset] = block.timestamp;
            manipulationCount[asset]++;
            totalManipulationAttempts++;
            
            emit PriceManipulationDetected(asset, averagePrice, 0);
            return true;
        }
        
        return false;
    }
    
    function _handleOracleFailure(address asset, uint256 oracleIndex, string memory reason) 
        internal 
    {
        OracleSource storage source = oracleSources[asset][oracleIndex];
        source.failureCount++;
        totalOracleFailures++;
        
        if (source.failureCount >= source.maxFailures) {
            source.isActive = false;
        }
        
        emit OracleFailure(asset, address(source.oracle), reason);
    }
    
    function _updateTWAP(address asset, uint256 price) internal {
        TWAPData storage twap = twapData[asset];
        
        if (!twap.isInitialized) {
            twap.cumulativePrice = price;
            twap.startTime = block.timestamp;
            twap.updateCount = 1;
            twap.lastPrice = price;
            twap.isInitialized = true;
        } else {
            if (block.timestamp > twap.startTime + TWAP_WINDOW) {
                twap.cumulativePrice = price;
                twap.startTime = block.timestamp;
                twap.updateCount = 1;
            } else {
                twap.cumulativePrice += price;
                twap.updateCount++;
            }
            twap.lastPrice = price;
        }
        
        emit TWAPUpdated(asset, twap.cumulativePrice / twap.updateCount, price);
    }
    
    function _addPriceToHistory(address asset, uint256 price) internal {
        priceHistory[asset].push(PricePoint({
            price: price,
            timestamp: block.timestamp,
            blockNumber: block.number,
            isValid: true
        }));
        
        if (priceHistory[asset].length > 100) {
            for (uint i = 0; i < 99; i++) {
                priceHistory[asset][i] = priceHistory[asset][i + 1];
            }
            priceHistory[asset].pop();
        }
    }
    
    function _calculateDeviation(uint256 price1, uint256 price2) 
        internal 
        pure 
        returns (uint256) 
    {
        uint256 diff = price1 > price2 ? price1 - price2 : price2 - price1;
        return (diff * 10000) / price1;
    }
    
    function _calculateConfidence(uint256 validSources, uint256 totalSources) 
        internal 
        pure 
        returns (uint256) 
    {
        return (validSources * 10000) / totalSources;
    }
    
    // Admin functions
    
    function setAssetConfig(
        address asset,
        uint256 _maxPriceAge,
        uint256 _minConfidenceLevel,
        uint256 _priceDeviationThreshold
    ) 
        external 
        onlyRole(ORACLE_ADMIN_ROLE) 
    {
        require(_maxPriceAge >= MIN_UPDATE_INTERVAL, "Price age too low");
        require(_maxPriceAge <= MAX_UPDATE_INTERVAL, "Price age too high");
        require(_minConfidenceLevel <= 10000, "Invalid confidence level");
        require(_priceDeviationThreshold <= 5000, "Deviation threshold too high");
        
        maxPriceAge[asset] = _maxPriceAge;
        minConfidenceLevel[asset] = _minConfidenceLevel;
        priceDeviationThreshold[asset] = _priceDeviationThreshold;
    }
    
    function setManipulationCooldown(uint256 _cooldown) 
        external 
        onlyRole(ORACLE_ADMIN_ROLE) 
    {
        require(_cooldown >= 60 && _cooldown <= 3600, "Invalid cooldown period");
        manipulationCooldown = _cooldown;
    }
    
    function activateOracleSource(address asset, uint256 oracleIndex) 
        external 
        onlyRole(ORACLE_ADMIN_ROLE) 
    {
        require(oracleIndex < oracleSources[asset].length, "Invalid oracle index");
        oracleSources[asset][oracleIndex].isActive = true;
        oracleSources[asset][oracleIndex].failureCount = 0;
    }
    
    function deactivateOracleSource(address asset, uint256 oracleIndex) 
        external 
        onlyRole(ORACLE_ADMIN_ROLE) 
    {
        require(oracleIndex < oracleSources[asset].length, "Invalid oracle index");
        require(oracleSources[asset].length > MIN_ORACLE_SOURCES, "Cannot deactivate, minimum required");
        oracleSources[asset][oracleIndex].isActive = false;
    }
    
    // View functions
    
    function getOracleSourceCount(address asset) external view returns (uint256) {
        return oracleSources[asset].length;
    }
    
    function getActiveOracleCount(address asset) external view returns (uint256 count) {
        for (uint i = 0; i < oracleSources[asset].length; i++) {
            if (oracleSources[asset][i].isActive) {
                count++;
            }
        }
    }
    
    function getPriceHistoryLength(address asset) external view returns (uint256) {
        return priceHistory[asset].length;
    }
    
    function getManipulationStats(address asset) 
        external 
        view 
        returns (uint256 count, uint256 lastDetection) 
    {
        return (manipulationCount[asset], lastManipulationDetection[asset]);
    }
}