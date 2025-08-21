// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IHyperliquidDEX
 * @dev Interface for Hyperliquid native DEX integration
 * @notice Hyperliquid-specific trading and liquidity functions
 */
interface IHyperliquidDEX {
    
    // Hyperliquid Order Types
    enum OrderType {
        MARKET,
        LIMIT,
        STOP_MARKET,
        STOP_LIMIT,
        TAKE_PROFIT
    }
    
    // Order Side
    enum Side {
        BUY,
        SELL
    }
    
    // Order Status
    enum OrderStatus {
        PENDING,
        FILLED,
        PARTIALLY_FILLED,
        CANCELLED,
        EXPIRED
    }
    
    // Hyperliquid Order Structure
    struct Order {
        address trader;
        address token;
        uint256 amount;
        uint256 price;
        OrderType orderType;
        Side side;
        uint256 leverage;
        uint256 timestamp;
        OrderStatus status;
        bytes32 orderId;
    }
    
    // Liquidity Position
    struct LiquidityPosition {
        address provider;
        address tokenA;
        address tokenB;
        uint256 amountA;
        uint256 amountB;
        uint256 liquidity;
        uint256 fee;
        uint256 timestamp;
    }
    
    // Trading Functions
    function placeOrder(Order calldata order) external returns (bytes32 orderId);
    function cancelOrder(bytes32 orderId) external returns (bool);
    function modifyOrder(bytes32 orderId, uint256 newPrice, uint256 newAmount) external returns (bool);
    function getOrder(bytes32 orderId) external view returns (Order memory);
    
    // Market Functions
    function getSpotPrice(address token) external view returns (uint256);
    function get24hVolume(address token) external view returns (uint256);
    function getOrderBook(address token, uint256 depth) external view returns (
        uint256[] memory bidPrices,
        uint256[] memory bidAmounts,
        uint256[] memory askPrices,
        uint256[] memory askAmounts
    );
    
    // Liquidity Functions
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 minLiquidity
    ) external returns (uint256 liquidity);
    
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 minAmountA,
        uint256 minAmountB
    ) external returns (uint256 amountA, uint256 amountB);
    
    // Hyperliquid Specific Features
    function flashLoan(
        address token,
        uint256 amount,
        bytes calldata data
    ) external;
    
    function getMaxLeverage(address token) external view returns (uint256);
    function getLiquidationPrice(address trader, address token) external view returns (uint256);
    function getAccountHealth(address trader) external view returns (uint256);
    
    // Events
    event OrderPlaced(bytes32 indexed orderId, address indexed trader, Order order);
    event OrderCancelled(bytes32 indexed orderId, address indexed trader);
    event OrderFilled(bytes32 indexed orderId, address indexed trader, uint256 filledAmount, uint256 filledPrice);
    event LiquidityAdded(address indexed provider, address tokenA, address tokenB, uint256 liquidity);
    event LiquidityRemoved(address indexed provider, address tokenA, address tokenB, uint256 liquidity);
    event FlashLoan(address indexed borrower, address indexed token, uint256 amount, uint256 fee);
}

/**
 * @title IHyperliquidOracle
 * @dev Interface for Hyperliquid native oracle
 */
interface IHyperliquidOracle {
    
    struct PriceData {
        uint256 price;
        uint256 timestamp;
        uint256 confidence;
        uint256 volume24h;
        int256 priceChange24h;
    }
    
    function getPrice(address token) external view returns (uint256);
    function getPriceData(address token) external view returns (PriceData memory);
    function getTWAP(address token, uint256 period) external view returns (uint256);
    function getVolatility(address token, uint256 period) external view returns (uint256);
    function updatePrice(address token, uint256 price) external;
    
    event PriceUpdated(address indexed token, uint256 price, uint256 timestamp);
}

/**
 * @title IHyperliquidVault
 * @dev Interface for Hyperliquid native vault features
 */
interface IHyperliquidVault {
    
    struct VaultStrategy {
        string name;
        address strategist;
        uint256 allocation; // Percentage in basis points
        uint256 performanceFee;
        uint256 lastRebalance;
        bool isActive;
    }
    
    function executeStrategy(uint256 strategyId) external;
    function rebalance() external;
    function harvest() external returns (uint256 profit);
    function compound() external;
    
    // Hyperliquid specific yield strategies
    function stakeLiquidity(uint256 amount) external;
    function unstakeLiquidity(uint256 amount) external;
    function claimRewards() external returns (uint256);
    
    event StrategyExecuted(uint256 indexed strategyId, string name, uint256 timestamp);
    event Rebalanced(uint256 timestamp, uint256 gasUsed);
    event RewardsClaimed(address indexed user, uint256 amount);
}
