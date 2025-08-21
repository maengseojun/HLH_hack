// lib/types/trading.ts
export interface TradingOrder {
  id: string;
  userId: string;
  tokenAddress: string;
  symbol: string;
  tokenName: string;
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: string;
  price?: string;
  status: 'pending' | 'filled' | 'cancelled' | 'partial';
  filledAmount: string;
  remainingAmount: string;
  averageFillPrice?: string;
  hypercoreOrderId?: string;
  transactionHash?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  filledAt?: string;
  cancelledAt?: string;
}

export interface TradingPosition {
  tokenAddress: string;
  symbol: string;
  name: string;
  amount: string;
  averagePrice: string;
  currentPrice: string;
  totalCost: string;
  marketValue: string;
  unrealizedPnL: string;
  realizedPnL?: string;
  pnLPercentage: string;
  allocation: string;
}

export interface TokenBalance {
  tokenAddress: string;
  symbol?: string;
  available: string;
  locked: string;
  total: string;
}

export interface MarketInfo {
  tokenAddress: string;
  symbol: string;
  name: string;
  description?: string;
  price: string;
  change24h: string;
  volume24h: string;
  high24h: string;
  low24h: string;
  navPerToken: string;
  totalSupply: string;
  components?: any;
  isTradeable: boolean;
  lastUpdated: number;
  orderBook?: {
    bids: Array<{ price: string; amount: string }>;
    asks: Array<{ price: string; amount: string }>;
    timestamp: number;
  };
  priceHistory?: Array<{ price: string; timestamp: number }>;
  recentTrades?: Array<{
    side: 'buy' | 'sell';
    amount: string;
    price: string;
    timestamp: number;
  }>;
}

export interface PortfolioSummary {
  totalValue: string;
  totalPnL: string;
  pnL24h: string;
  positionCount: number;
}

export interface Portfolio {
  summary: PortfolioSummary;
  positions: TradingPosition[];
  balances?: TokenBalance[];
}

export interface TradeHistoryItem {
  id: string;
  orderId: string;
  tokenAddress: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: string;
  price: string;
  totalValue: string;
  feeAmount: string;
  transactionHash?: string;
  createdAt: string;
}

export interface CreateOrderRequest {
  tokenAddress: string;
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: string;
  price?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}

export interface PaginationParams {
  limit: number;
  offset: number;
  total?: number;
}

// Market data types
export interface OrderBookEntry {
  price: string;
  amount: string;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: number;
}

export interface PriceUpdate {
  symbol: string;
  price: string;
  volume: string;
  timestamp: number;
  change24h: string;
}

export interface OrderUpdate {
  orderId: string;
  status: 'pending' | 'filled' | 'cancelled' | 'partial';
  filledAmount: string;
  remainingAmount: string;
  averageFillPrice?: string;
}

// Risk management types
export interface RiskMetrics {
  totalExposure: string;
  availableMargin: string;
  marginRatio: string;
  liquidationPrice?: string;
  unrealizedPnL: string;
}

export interface TradingLimits {
  maxOrderSize: string;
  maxDailyVolume: string;
  maxPositionSize: string;
  minOrderSize: string;
}

// WebSocket message types
export interface WSMessage {
  type: 'price_update' | 'order_update' | 'trade_update' | 'balance_update';
  data: any;
  timestamp: number;
}

export interface WSPriceUpdate extends WSMessage {
  type: 'price_update';
  data: PriceUpdate;
}

export interface WSOrderUpdate extends WSMessage {
  type: 'order_update';
  data: OrderUpdate;
}

// Database types
export interface TradingOrderDB {
  id: string;
  user_id: string;
  token_address: string;
  order_type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: string;
  price?: string;
  status: 'pending' | 'filled' | 'cancelled' | 'partial';
  hypercore_order_id?: string;
  filled_amount: string;
  remaining_amount: string;
  average_fill_price?: string;
  transaction_hash?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  filled_at?: string;
  cancelled_at?: string;
}

export interface TradingPositionDB {
  id: string;
  user_id: string;
  token_address: string;
  symbol?: string;
  amount: string;
  average_price: string;
  total_cost: string;
  unrealized_pnl: string;
  realized_pnl: string;
  last_updated: string;
  created_at: string;
}

export interface UserBalanceDB {
  id: string;
  user_id: string;
  token_address: string;
  symbol?: string;
  available_balance: string;
  locked_balance: string;
  total_balance: string;
  last_updated: string;
}

export interface IndexTokenDB {
  id: string;
  token_address: string;
  symbol: string;
  name: string;
  description?: string;
  components?: any;
  total_supply: string;
  nav_per_token: string;
  is_active: boolean;
  is_tradeable: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Error types
export enum TradingErrorCode {
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INVALID_ORDER_SIZE = 'INVALID_ORDER_SIZE',
  TOKEN_NOT_FOUND = 'TOKEN_NOT_FOUND',
  TOKEN_NOT_TRADEABLE = 'TOKEN_NOT_TRADEABLE',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  CANNOT_CANCEL_ORDER = 'CANNOT_CANCEL_ORDER',
  HYPERCORE_ERROR = 'HYPERCORE_ERROR',
  INVALID_PRICE = 'INVALID_PRICE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED'
}

export interface TradingError {
  code: TradingErrorCode;
  message: string;
  details?: any;
}

// Constants
export const TRADING_CONSTANTS = {
  MIN_ORDER_SIZE: '0.000001',
  MAX_ORDER_SIZE: '1000000',
  MAX_PRICE_DEVIATION: 0.1, // 10%
  ORDER_TIMEOUT_MS: 300000, // 5 minutes
  PRICE_UPDATE_INTERVAL_MS: 5000, // 5 seconds
  BALANCE_SYNC_INTERVAL_MS: 30000, // 30 seconds
} as const;

export const SUPPORTED_NETWORKS = {
  HYPERLIQUID: {
    chainId: 999,
    name: 'Hyperliquid',
    rpcUrl: 'https://api.hyperliquid-testnet.xyz/evm',
    nativeCurrency: 'USDC',
    precompileAddress: '0x0000000000000000000000000000000000000808'
  }
} as const;