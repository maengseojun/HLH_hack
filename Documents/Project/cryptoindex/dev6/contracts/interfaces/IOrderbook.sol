// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IOrderbook
 * @dev Interface for Offchain Orderbook integration
 * @notice Manages orderbook operations, order execution, and market data
 */
interface IOrderbook {
    
    // Order Types
    enum OrderType {
        MARKET,      // Market order (immediate execution)
        LIMIT,       // Limit order (specific price)
        STOP,        // Stop order (trigger price)
        STOP_LIMIT   // Stop-limit order (trigger + limit price)
    }
    
    // Order Side
    enum OrderSide {
        BUY,         // Buy order
        SELL         // Sell order
    }
    
    // Order Status
    enum OrderStatus {
        PENDING,     // Order submitted, not yet processed
        PARTIAL,     // Partially filled
        FILLED,      // Completely filled
        CANCELLED,   // Cancelled by user
        REJECTED,    // Rejected by system
        EXPIRED      // Expired (time-based)
    }
    
    // Order Structure
    struct Order {
        bytes32 orderId;          // Unique order identifier
        address trader;           // Order creator
        address baseAsset;        // Base asset address
        address quoteAsset;       // Quote asset address
        OrderType orderType;      // Type of order
        OrderSide side;           // Buy or sell
        uint256 amount;           // Order amount (base asset)
        uint256 price;            // Order price (0 for market orders)
        uint256 stopPrice;        // Stop trigger price (for stop orders)
        uint256 filledAmount;     // Amount already filled
        uint256 remainingAmount;  // Amount remaining to fill
        uint256 avgFillPrice;     // Average fill price
        OrderStatus status;       // Current order status
        uint256 createdAt;        // Order creation timestamp
        uint256 expiresAt;        // Order expiration timestamp
        uint256 fee;              // Trading fee paid
        bytes32 parentOrderId;    // Parent order (for stop orders)
    }
    
    // Market Data Structure
    struct MarketData {
        address baseAsset;        // Base asset address
        address quoteAsset;       // Quote asset address
        uint256 lastPrice;        // Last trade price
        uint256 bestBid;          // Best bid price
        uint256 bestAsk;          // Best ask price
        uint256 bidSize;          // Best bid size
        uint256 askSize;          // Best ask size
        uint256 volume24h;        // 24h trading volume
        uint256 priceChange24h;   // 24h price change
        uint256 highPrice24h;     // 24h high price
        uint256 lowPrice24h;      // 24h low price
        uint256 timestamp;        // Last update timestamp
    }
    
    // Order Book Depth
    struct OrderBookLevel {
        uint256 price;            // Price level
        uint256 amount;           // Total amount at this level
        uint256 orderCount;       // Number of orders at this level
    }
    
    struct OrderBookDepth {
        OrderBookLevel[] bids;    // Bid levels (highest to lowest)
        OrderBookLevel[] asks;    // Ask levels (lowest to highest)
        uint256 timestamp;        // Snapshot timestamp
    }
    
    /**
     * @dev Submit a new order to the orderbook
     * @param baseAsset Base asset address
     * @param quoteAsset Quote asset address
     * @param orderType Type of order
     * @param side Buy or sell
     * @param amount Order amount in base asset
     * @param price Order price (0 for market orders)
     * @param stopPrice Stop price for stop orders
     * @param expirationTime Order expiration (0 for GTC)
     * @return orderId Unique order identifier
     */
    function submitOrder(
        address baseAsset,
        address quoteAsset,
        OrderType orderType,
        OrderSide side,
        uint256 amount,
        uint256 price,
        uint256 stopPrice,
        uint256 expirationTime
    ) external returns (bytes32 orderId);
    
    /**
     * @dev Cancel an existing order
     * @param orderId Order identifier to cancel
     * @return success Whether cancellation was successful
     */
    function cancelOrder(bytes32 orderId) external returns (bool success);
    
    /**
     * @dev Cancel multiple orders in batch
     * @param orderIds Array of order identifiers to cancel
     * @return results Array of cancellation results
     */
    function cancelOrders(bytes32[] memory orderIds) 
        external returns (bool[] memory results);
    
    /**
     * @dev Get order information
     * @param orderId Order identifier
     * @return order Order details
     */
    function getOrder(bytes32 orderId) external view returns (Order memory order);
    
    /**
     * @dev Get orders for a specific trader
     * @param trader Trader address
     * @param status Filter by order status (optional)
     * @param limit Maximum number of orders to return
     * @param offset Pagination offset
     * @return orders Array of orders
     */
    function getOrdersForTrader(
        address trader,
        OrderStatus status,
        uint256 limit,
        uint256 offset
    ) external view returns (Order[] memory orders);
    
    /**
     * @dev Get market data for a trading pair
     * @param baseAsset Base asset address
     * @param quoteAsset Quote asset address
     * @return marketData Current market data
     */
    function getMarketData(address baseAsset, address quoteAsset) 
        external view returns (MarketData memory marketData);
    
    /**
     * @dev Get orderbook depth for a trading pair
     * @param baseAsset Base asset address
     * @param quoteAsset Quote asset address
     * @param depth Number of levels to return per side
     * @return orderBook Order book depth data
     */
    function getOrderBookDepth(
        address baseAsset,
        address quoteAsset,
        uint256 depth
    ) external view returns (OrderBookDepth memory orderBook);
    
    /**
     * @dev Get estimated execution price for a market order
     * @param baseAsset Base asset address
     * @param quoteAsset Quote asset address
     * @param side Order side (buy/sell)
     * @param amount Order amount
     * @return executionPrice Estimated average execution price
     * @return priceImpact Estimated price impact (basis points)
     */
    function getExecutionEstimate(
        address baseAsset,
        address quoteAsset,
        OrderSide side,
        uint256 amount
    ) external view returns (uint256 executionPrice, uint256 priceImpact);
    
    /**
     * @dev Check if trading pair is supported
     * @param baseAsset Base asset address
     * @param quoteAsset Quote asset address
     * @return isSupported Whether pair is supported
     * @return isActive Whether trading is active
     */
    function isTradingPairSupported(address baseAsset, address quoteAsset) 
        external view returns (bool isSupported, bool isActive);
    
    /**
     * @dev Get available liquidity for a trading pair
     * @param baseAsset Base asset address
     * @param quoteAsset Quote asset address
     * @param side Order side
     * @param priceRange Price range for liquidity calculation (basis points)
     * @return liquidity Available liquidity within price range
     */
    function getAvailableLiquidity(
        address baseAsset,
        address quoteAsset,
        OrderSide side,
        uint256 priceRange
    ) external view returns (uint256 liquidity);
    
    /**
     * @dev Execute immediate settlement of a trade (for index fund operations)
     * @param baseAsset Base asset address
     * @param quoteAsset Quote asset address
     * @param side Order side
     * @param amount Amount to trade
     * @param maxSlippage Maximum acceptable slippage (basis points)
     * @param recipient Address to receive proceeds
     * @return executedAmount Amount actually executed
     * @return averagePrice Average execution price
     * @return totalFee Total fees paid
     */
    function executeImmediateSettlement(
        address baseAsset,
        address quoteAsset,
        OrderSide side,
        uint256 amount,
        uint256 maxSlippage,
        address recipient
    ) external returns (
        uint256 executedAmount,
        uint256 averagePrice,
        uint256 totalFee
    );
    
    // Events
    event OrderSubmitted(
        bytes32 indexed orderId,
        address indexed trader,
        address indexed baseAsset,
        address quoteAsset,
        OrderType orderType,
        OrderSide side,
        uint256 amount,
        uint256 price
    );
    
    event OrderCancelled(
        bytes32 indexed orderId,
        address indexed trader,
        uint256 remainingAmount
    );
    
    event OrderFilled(
        bytes32 indexed orderId,
        address indexed trader,
        uint256 filledAmount,
        uint256 fillPrice,
        uint256 fee
    );
    
    event Trade(
        bytes32 indexed buyOrderId,
        bytes32 indexed sellOrderId,
        address indexed baseAsset,
        address quoteAsset,
        uint256 amount,
        uint256 price,
        uint256 timestamp
    );
    
    event MarketDataUpdated(
        address indexed baseAsset,
        address indexed quoteAsset,
        uint256 price,
        uint256 volume,
        uint256 timestamp
    );
}