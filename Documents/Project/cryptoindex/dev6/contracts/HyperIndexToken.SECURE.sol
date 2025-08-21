// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * @title HyperIndexToken (PRODUCTION SECURE VERSION)
 * @dev 보안 강화된 프로덕션용 HyperIndex 토큰
 * 
 * 🔒 Security Improvements:
 * - Real Chainlink oracle validation
 * - Reentrancy protection  
 * - Emergency pause functionality
 * - Comprehensive input validation
 * - Stale price protection
 */
contract HyperIndexToken is ERC20, Ownable, ReentrancyGuard, Pausable {
    
    // Component structure for index composition
    struct Component {
        AggregatorV3Interface priceFeed;
        uint256 weight; // Weight in basis points (10000 = 100%)
        bool isActive;
        uint256 lastUpdateTime;
    }
    
    // State variables
    mapping(string => Component) public components;
    string[] public componentSymbols;
    uint256 public totalWeight;
    
    // Security constants
    uint256 public constant MAX_STALENESS = 3600; // 1 hour
    uint256 public constant MIN_WEIGHT = 100; // 1%
    uint256 public constant MAX_WEIGHT = 5000; // 50%
    uint256 public constant MAX_COMPONENTS = 10;
    uint256 public constant PRICE_DECIMALS = 8;
    
    // Events
    event ComponentAdded(string indexed symbol, address indexed priceFeed, uint256 weight);
    event ComponentRemoved(string indexed symbol);
    event ComponentUpdated(string indexed symbol, uint256 newWeight);
    event IndexPriceUpdated(uint256 newPrice, uint256 timestamp);
    event EmergencyPause(address indexed pauser, uint256 timestamp);
    
    // Custom errors for gas efficiency
    error InvalidOracleAddress();
    error OracleNotFunctional();
    error StalePriceData();
    error InvalidWeight();
    error ComponentAlreadyExists();
    error ComponentNotFound();
    error TooManyComponents();
    error ZeroWeightSum();
    error InvalidSymbol();
    
    constructor() ERC20("HyperIndex Token", "HYPERINDEX") Ownable(msg.sender) {
        // Mint initial supply to deployer (100M tokens)
        _mint(msg.sender, 100_000_000 * 10**decimals());
    }
    
    /**
     * @dev Oracle validation modifier
     */
    modifier validOracle(address oracle) {
        if (oracle == address(0)) revert InvalidOracleAddress();
        if (oracle.code.length == 0) revert InvalidOracleAddress();
        
        // Test oracle functionality
        try AggregatorV3Interface(oracle).latestRoundData() returns (
            uint80 roundId,
            int256 price,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            if (price <= 0) revert OracleNotFunctional();
            if (updatedAt == 0) revert OracleNotFunctional();
            if (block.timestamp - updatedAt > MAX_STALENESS) revert StalePriceData();
            if (roundId == 0 || answeredInRound == 0) revert OracleNotFunctional();
        } catch {
            revert OracleNotFunctional();
        }
        _;
    }
    
    /**
     * @dev Add a new component to the index (SECURE VERSION)
     * @param symbol Token symbol (e.g., "DOGE")
     * @param priceFeed Chainlink price feed address
     * @param weight Weight in basis points (100-5000)
     */
    function addComponent(
        string calldata symbol,
        address priceFeed,
        uint256 weight
    ) external onlyOwner validOracle(priceFeed) whenNotPaused {
        // Input validation
        if (bytes(symbol).length == 0 || bytes(symbol).length > 10) revert InvalidSymbol();
        if (weight < MIN_WEIGHT || weight > MAX_WEIGHT) revert InvalidWeight();
        if (components[symbol].isActive) revert ComponentAlreadyExists();
        if (componentSymbols.length >= MAX_COMPONENTS) revert TooManyComponents();
        
        // Add component
        components[symbol] = Component({
            priceFeed: AggregatorV3Interface(priceFeed),
            weight: weight,
            isActive: true,
            lastUpdateTime: block.timestamp
        });
        
        componentSymbols.push(symbol);
        totalWeight += weight;
        
        emit ComponentAdded(symbol, priceFeed, weight);
    }
    
    /**
     * @dev Remove a component from the index
     */
    function removeComponent(string calldata symbol) external onlyOwner {
        if (!components[symbol].isActive) revert ComponentNotFound();
        
        // Remove from array
        for (uint256 i = 0; i < componentSymbols.length; i++) {
            if (keccak256(bytes(componentSymbols[i])) == keccak256(bytes(symbol))) {
                componentSymbols[i] = componentSymbols[componentSymbols.length - 1];
                componentSymbols.pop();
                break;
            }
        }
        
        totalWeight -= components[symbol].weight;
        delete components[symbol];
        
        emit ComponentRemoved(symbol);
    }
    
    /**
     * @dev Update component weight
     */
    function updateComponentWeight(
        string calldata symbol,
        uint256 newWeight
    ) external onlyOwner {
        if (!components[symbol].isActive) revert ComponentNotFound();
        if (newWeight < MIN_WEIGHT || newWeight > MAX_WEIGHT) revert InvalidWeight();
        
        totalWeight = totalWeight - components[symbol].weight + newWeight;
        components[symbol].weight = newWeight;
        components[symbol].lastUpdateTime = block.timestamp;
        
        emit ComponentUpdated(symbol, newWeight);
    }
    
    /**
     * @dev Get current index price (weighted average of all components)
     * @return price Index price in USD (8 decimals)
     */
    function getCurrentPrice() external view returns (uint256 price) {
        if (totalWeight == 0) revert ZeroWeightSum();
        
        uint256 weightedSum = 0;
        uint256 activeWeight = 0;
        
        for (uint256 i = 0; i < componentSymbols.length; i++) {
            Component storage component = components[componentSymbols[i]];
            if (!component.isActive) continue;
            
            try component.priceFeed.latestRoundData() returns (
                uint80,
                int256 componentPrice,
                uint256,
                uint256 updatedAt,
                uint80
            ) {
                // Skip stale prices but don't revert (graceful degradation)
                if (block.timestamp - updatedAt <= MAX_STALENESS && componentPrice > 0) {
                    weightedSum += uint256(componentPrice) * component.weight;
                    activeWeight += component.weight;
                }
            } catch {
                // Skip failed oracle calls
                continue;
            }
        }
        
        if (activeWeight == 0) return 0; // No active components
        return weightedSum / activeWeight;
    }
    
    /**
     * @dev Get component count
     */
    function getComponentCount() external view returns (uint256) {
        return componentSymbols.length;
    }
    
    /**
     * @dev Get all component symbols
     */
    function getComponentSymbols() external view returns (string[] memory) {
        return componentSymbols;
    }
    
    /**
     * @dev Check if oracle data is fresh
     */
    function isOracleDataFresh(string calldata symbol) external view returns (bool) {
        if (!components[symbol].isActive) return false;
        
        try components[symbol].priceFeed.latestRoundData() returns (
            uint80, int256, uint256, uint256 updatedAt, uint80
        ) {
            return block.timestamp - updatedAt <= MAX_STALENESS;
        } catch {
            return false;
        }
    }
    
    /**
     * @dev Emergency functions
     */
    function pause() external onlyOwner {
        _pause();
        emit EmergencyPause(msg.sender, block.timestamp);
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Override transfer functions to respect pause
     */
    function transfer(address to, uint256 amount) public override whenNotPaused returns (bool) {
        return super.transfer(to, amount);
    }
    
    function transferFrom(address from, address to, uint256 amount) public override whenNotPaused returns (bool) {
        return super.transferFrom(from, to, amount);
    }
    
    /**
     * @dev Batch oracle health check (for monitoring)
     */
    function batchOracleHealthCheck() external view returns (
        string[] memory symbols,
        bool[] memory isHealthy,
        uint256[] memory lastUpdated
    ) {
        symbols = new string[](componentSymbols.length);
        isHealthy = new bool[](componentSymbols.length);
        lastUpdated = new uint256[](componentSymbols.length);
        
        for (uint256 i = 0; i < componentSymbols.length; i++) {
            symbols[i] = componentSymbols[i];
            Component storage component = components[componentSymbols[i]];
            
            try component.priceFeed.latestRoundData() returns (
                uint80, int256 price, uint256, uint256 updatedAt, uint80
            ) {
                isHealthy[i] = (price > 0) && (block.timestamp - updatedAt <= MAX_STALENESS);
                lastUpdated[i] = updatedAt;
            } catch {
                isHealthy[i] = false;
                lastUpdated[i] = 0;
            }
        }
    }
}

// 실제 배포시 사용할 Oracle 주소들 (환경 변수로 관리)
/*
PRODUCTION ORACLE ADDRESSES (TO BE UPDATED):

HyperEVM Mainnet Chainlink Feeds:
- DOGE/USD: 0x... (실제 주소로 교체)
- PEPE/USD: 0x... (실제 주소로 교체)  
- SHIB/USD: 0x... (실제 주소로 교체)
- WIF/USD: 0x...  (실제 주소로 교체)
- BONK/USD: 0x... (실제 주소로 교체)

확인 방법:
1. https://docs.chain.link/data-feeds/price-feeds/addresses
2. HyperEVM 네트워크 선택
3. 각 token pair의 USD feed 주소 복사
4. 배포 스크립트에서 addComponent 호출시 사용
*/