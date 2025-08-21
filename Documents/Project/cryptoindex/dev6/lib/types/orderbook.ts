// 오더북 관련 타입 정의

export interface Order {
  id: string;
  userId: string;
  pair: string; // e.g., "HYPERINDEX-USDC"
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  price: string; // Decimal string for precision
  amount: string; // Decimal string for precision
  filled: string; // Amount filled
  remaining: string; // Amount remaining
  status: 'pending' | 'active' | 'filled' | 'cancelled' | 'expired';
  timestamp: number;
  expiresAt?: number; // Optional expiration timestamp
}

export interface OrderbookLevel {
  price: string;
  amount: string;
  orders: number; // Number of orders at this level
}

export interface OrderbookSnapshot {
  pair: string;
  bids: OrderbookLevel[]; // Buy orders, highest price first
  asks: OrderbookLevel[]; // Sell orders, lowest price first
  lastUpdate: number;
}

export interface Trade {
  id: string;
  pair: string;
  price: string;
  amount: string;
  side: 'buy' | 'sell'; // Taker side
  buyOrderId: string;
  sellOrderId: string;
  timestamp: number;
}

export interface PriceLevel {
  price: string;
  totalAmount: string;
  orderIds: string[];
}

// Redis key patterns
export const REDIS_KEYS = {
  // Orderbook data
  BIDS: (pair: string) => `orderbook:${pair}:bids`,
  ASKS: (pair: string) => `orderbook:${pair}:asks`,
  
  // Order details
  ORDER: (orderId: string) => `order:${orderId}`,
  USER_ORDERS: (userId: string) => `user:${userId}:orders`,
  
  // Price levels
  PRICE_LEVEL: (pair: string, side: string, price: string) => 
    `price:${pair}:${side}:${price}`,
  
  // Recent trades
  TRADES: (pair: string) => `trades:${pair}`,
  
  // Market data
  TICKER: (pair: string) => `ticker:${pair}`,
  
  // Real-time channels
  CHANNELS: {
    ORDERBOOK: (pair: string) => `orderbook:${pair}`,
    TRADES: (pair: string) => `trades:${pair}`,
    ORDERS: (userId: string) => `orders:${userId}`,
  }
} as const;

// Matching engine events
export interface MatchResult {
  trades: Trade[];
  updatedOrders: Order[];
  cancelledOrders: string[];
}

export interface OrderbookUpdate {
  type: 'order_added' | 'order_cancelled' | 'order_filled' | 'trade_executed';
  pair: string;
  data: any;
  timestamp: number;
}