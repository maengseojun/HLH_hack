// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title HyperIndexToken
 * @notice Meme coin index token tracking external assets (DOGE, PEPE, SHIB, etc.)
 * @dev ERC-20 token with Chainlink price feeds for NAV calculation
 */
contract HyperIndexToken is ERC20, Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // Index components configuration
    struct Component {
        AggregatorV3Interface priceFeed;  // Chainlink price feed
        uint256 weight;                   // Weight in basis points (10000 = 100%)
        bool isActive;                    // Component active status
        uint256 lastPrice;                // Cache for gas optimization
        uint256 lastUpdate;               // Last price update timestamp
    }

    // State variables
    mapping(string => Component) public components;
    string[] public componentSymbols;
    
    uint256 public constant TOTAL_WEIGHT = 10000; // 100% in basis points
    uint256 public constant PRICE_STALENESS_THRESHOLD = 3600; // 1 hour
    uint256 public constant REBALANCE_COOLDOWN = 86400; // 24 hours
    
    uint256 public lastRebalance;
    uint256 public managementFee; // Annual management fee in basis points
    address public feeCollector;
    
    // Events
    event ComponentAdded(string symbol, address priceFeed, uint256 weight);
    event ComponentUpdated(string symbol, uint256 newWeight);
    event ComponentRemoved(string symbol);
    event Rebalanced(uint256 timestamp, uint256 newNAV);
    event ManagementFeeUpdated(uint256 newFee);
    event FeeCollectorUpdated(address newCollector);

    constructor(
        string memory _name,
        string memory _symbol,
        address _owner
    ) ERC20(_name, _symbol) {
        _transferOwnership(_owner);
        managementFee = 200; // 2% annual management fee
        feeCollector = _owner;
        lastRebalance = block.timestamp;
        
        // Initialize with default meme coin components
        _initializeComponents();
    }

    /**
     * @notice Initialize default meme coin components
     * @dev Sets up DOGE, PEPE, SHIB with equal weights
     */
    function _initializeComponents() private {
        // Note: These are placeholder addresses - replace with actual Chainlink feeds on HyperEVM
        componentSymbols.push("DOGE");
        components["DOGE"] = Component({
            priceFeed: AggregatorV3Interface(0x0000000000000000000000000000000000000001),
            weight: 3000, // 30%
            isActive: true,
            lastPrice: 0,
            lastUpdate: block.timestamp
        });

        componentSymbols.push("PEPE");
        components["PEPE"] = Component({
            priceFeed: AggregatorV3Interface(0x0000000000000000000000000000000000000002),
            weight: 2500, // 25%
            isActive: true,
            lastPrice: 0,
            lastUpdate: block.timestamp
        });

        componentSymbols.push("SHIB");
        components["SHIB"] = Component({
            priceFeed: AggregatorV3Interface(0x0000000000000000000000000000000000000003),
            weight: 2000, // 20%
            isActive: true,
            lastPrice: 0,
            lastUpdate: block.timestamp
        });

        componentSymbols.push("JINDOGE");
        components["JINDOGE"] = Component({
            priceFeed: AggregatorV3Interface(0x0000000000000000000000000000000000000004),
            weight: 2500, // 25%
            isActive: true,
            lastPrice: 0,
            lastUpdate: block.timestamp
        });

        emit ComponentAdded("DOGE", address(components["DOGE"].priceFeed), 3000);
        emit ComponentAdded("PEPE", address(components["PEPE"].priceFeed), 2500);
        emit ComponentAdded("SHIB", address(components["SHIB"].priceFeed), 2000);
        emit ComponentAdded("JINDOGE", address(components["JINDOGE"].priceFeed), 2500);
    }

    /**
     * @notice Calculate Net Asset Value (NAV) of the index
     * @return nav Current NAV in USD (scaled by 1e8)
     */
    function calculateNAV() public view returns (uint256 nav) {
        uint256 totalValue = 0;
        
        for (uint256 i = 0; i < componentSymbols.length; i++) {
            string memory symbol = componentSymbols[i];
            Component memory component = components[symbol];
            
            if (!component.isActive) continue;
            
            uint256 price = _getLatestPrice(component.priceFeed);
            uint256 weightedValue = price.mul(component.weight);
            totalValue = totalValue.add(weightedValue);
        }
        
        return totalValue.div(TOTAL_WEIGHT);
    }

    /**
     * @notice Get current price from Chainlink oracle
     * @param priceFeed Chainlink price feed address
     * @return price Latest price (scaled by 1e8)
     */
    function _getLatestPrice(AggregatorV3Interface priceFeed) 
        private 
        view 
        returns (uint256 price) 
    {
        try priceFeed.latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            require(answer > 0, "HyperIndex: INVALID_PRICE");
            require(
                block.timestamp - updatedAt <= PRICE_STALENESS_THRESHOLD,
                "HyperIndex: STALE_PRICE"
            );
            return uint256(answer);
        } catch {
            revert("HyperIndex: ORACLE_ERROR");
        }
    }

    /**
     * @notice Mint index tokens based on current NAV
     * @param to Address to mint tokens to
     * @param usdAmount USD amount to invest (scaled by 1e8)
     */
    function mint(address to, uint256 usdAmount) 
        external 
        nonReentrant 
        returns (uint256 tokens) 
    {
        require(usdAmount > 0, "HyperIndex: ZERO_AMOUNT");
        
        uint256 nav = calculateNAV();
        require(nav > 0, "HyperIndex: ZERO_NAV");
        
        // Calculate tokens to mint: tokens = usdAmount / nav
        tokens = usdAmount.mul(1e18).div(nav);
        
        // Deduct management fee if applicable
        if (_shouldCollectFee()) {
            tokens = _deductManagementFee(tokens);
        }
        
        _mint(to, tokens);
        
        return tokens;
    }

    /**
     * @notice Burn index tokens and return USD value
     * @param from Address to burn tokens from
     * @param tokens Amount of tokens to burn
     * @return usdAmount USD value returned (scaled by 1e8)
     */
    function burn(address from, uint256 tokens) 
        external 
        nonReentrant 
        returns (uint256 usdAmount) 
    {
        require(tokens > 0, "HyperIndex: ZERO_AMOUNT");
        require(balanceOf(from) >= tokens, "HyperIndex: INSUFFICIENT_BALANCE");
        
        uint256 nav = calculateNAV();
        require(nav > 0, "HyperIndex: ZERO_NAV");
        
        // Calculate USD amount: usdAmount = tokens * nav
        usdAmount = tokens.mul(nav).div(1e18);
        
        _burn(from, tokens);
        
        return usdAmount;
    }

    /**
     * @notice Add new component to the index
     * @param symbol Component symbol (e.g., "DOGE")
     * @param priceFeed Chainlink price feed address
     * @param weight Component weight in basis points
     */
    function addComponent(
        string calldata symbol,
        address priceFeed,
        uint256 weight
    ) external onlyOwner {
        require(bytes(symbol).length > 0, "HyperIndex: EMPTY_SYMBOL");
        require(priceFeed != address(0), "HyperIndex: ZERO_ADDRESS");
        require(weight > 0, "HyperIndex: ZERO_WEIGHT");
        require(!components[symbol].isActive, "HyperIndex: COMPONENT_EXISTS");
        
        // Validate total weight doesn't exceed 100%
        uint256 currentTotalWeight = _getCurrentTotalWeight();
        require(
            currentTotalWeight.add(weight) <= TOTAL_WEIGHT,
            "HyperIndex: WEIGHT_OVERFLOW"
        );
        
        componentSymbols.push(symbol);
        components[symbol] = Component({
            priceFeed: AggregatorV3Interface(priceFeed),
            weight: weight,
            isActive: true,
            lastPrice: 0,
            lastUpdate: block.timestamp
        });
        
        emit ComponentAdded(symbol, priceFeed, weight);
    }

    /**
     * @notice Update component weight
     * @param symbol Component symbol
     * @param newWeight New weight in basis points
     */
    function updateComponentWeight(string calldata symbol, uint256 newWeight) 
        external 
        onlyOwner 
    {
        require(components[symbol].isActive, "HyperIndex: COMPONENT_NOT_FOUND");
        require(newWeight > 0, "HyperIndex: ZERO_WEIGHT");
        
        uint256 oldWeight = components[symbol].weight;
        components[symbol].weight = newWeight;
        
        // Validate total weight doesn't exceed 100%
        uint256 currentTotalWeight = _getCurrentTotalWeight();
        require(currentTotalWeight <= TOTAL_WEIGHT, "HyperIndex: WEIGHT_OVERFLOW");
        
        emit ComponentUpdated(symbol, newWeight);
    }

    /**
     * @notice Remove component from index
     * @param symbol Component symbol to remove
     */
    function removeComponent(string calldata symbol) external onlyOwner {
        require(components[symbol].isActive, "HyperIndex: COMPONENT_NOT_FOUND");
        
        components[symbol].isActive = false;
        components[symbol].weight = 0;
        
        // Remove from componentSymbols array
        for (uint256 i = 0; i < componentSymbols.length; i++) {
            if (keccak256(bytes(componentSymbols[i])) == keccak256(bytes(symbol))) {
                componentSymbols[i] = componentSymbols[componentSymbols.length - 1];
                componentSymbols.pop();
                break;
            }
        }
        
        emit ComponentRemoved(symbol);
    }

    /**
     * @notice Rebalance the index (for record-keeping and events)
     * @dev This is mainly for tracking purposes as no actual tokens are held
     */
    function rebalance() external {
        require(
            block.timestamp >= lastRebalance.add(REBALANCE_COOLDOWN),
            "HyperIndex: REBALANCE_COOLDOWN"
        );
        
        uint256 nav = calculateNAV();
        lastRebalance = block.timestamp;
        
        emit Rebalanced(block.timestamp, nav);
    }

    /**
     * @notice Update management fee
     * @param newFee New annual management fee in basis points
     */
    function setManagementFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "HyperIndex: FEE_TOO_HIGH"); // Max 10%
        managementFee = newFee;
        emit ManagementFeeUpdated(newFee);
    }

    /**
     * @notice Update fee collector address
     * @param newCollector New fee collector address
     */
    function setFeeCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "HyperIndex: ZERO_ADDRESS");
        feeCollector = newCollector;
        emit FeeCollectorUpdated(newCollector);
    }

    // View functions
    function getComponentCount() external view returns (uint256) {
        return componentSymbols.length;
    }

    function getComponent(string calldata symbol) 
        external 
        view 
        returns (
            address priceFeed,
            uint256 weight,
            bool isActive,
            uint256 lastPrice,
            uint256 lastUpdate
        ) 
    {
        Component memory component = components[symbol];
        return (
            address(component.priceFeed),
            component.weight,
            component.isActive,
            component.lastPrice,
            component.lastUpdate
        );
    }

    // Private functions
    function _getCurrentTotalWeight() private view returns (uint256 totalWeight) {
        for (uint256 i = 0; i < componentSymbols.length; i++) {
            if (components[componentSymbols[i]].isActive) {
                totalWeight = totalWeight.add(components[componentSymbols[i]].weight);
            }
        }
    }

    function _shouldCollectFee() private view returns (bool) {
        return managementFee > 0 && totalSupply() > 0;
    }

    function _deductManagementFee(uint256 tokens) private returns (uint256) {
        if (!_shouldCollectFee()) return tokens;
        
        uint256 feeAmount = tokens.mul(managementFee).div(TOTAL_WEIGHT);
        if (feeAmount > 0) {
            _mint(feeCollector, feeAmount);
        }
        
        return tokens.sub(feeAmount);
    }
}

// SafeMath library for safe arithmetic operations
library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");
        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "SafeMath: subtraction overflow");
        return a - b;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) return 0;
        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");
        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "SafeMath: division by zero");
        return a / b;
    }
}