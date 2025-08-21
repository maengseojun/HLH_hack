// lib/config/trading-constants.ts
/**
 * 🔧 Trading System Configuration Constants
 * Centralized configuration to replace magic numbers
 */

export const TRADING_CONFIG = {
  // Order Processing
  MAX_ROUTING_ITERATIONS: 100,
  MAX_ORDER_SIZE_USD: 1000000, // $1M max order
  MIN_ORDER_SIZE_USD: 1, // $1 min order
  
  // AMM Configuration
  MAX_AMM_CHUNK_SIZE_TOKENS: 1000,
  DEFAULT_SLIPPAGE_BASIS_POINTS: 300, // 3%
  MAX_SLIPPAGE_BASIS_POINTS: 1000, // 10%
  PRICE_IMPACT_WARNING_THRESHOLD: 100, // 1%
  PRICE_IMPACT_REJECTION_THRESHOLD: 500, // 5%
  
  // Orderbook Configuration
  MAX_ORDERBOOK_DEPTH: 100,
  ORDER_EXPIRY_SECONDS: 86400, // 24 hours
  PARTIAL_FILL_THRESHOLD: 0.01, // 1% minimum fill
  
  // Oracle Configuration
  ORACLE_STALENESS_SECONDS: 3600, // 1 hour
  ORACLE_DEVIATION_THRESHOLD: 500, // 5%
  
  // Performance Limits
  MAX_ORDERS_PER_SECOND: 1000,
  MAX_TRADES_PER_BATCH: 100,
  REDIS_OPERATION_TIMEOUT_MS: 5000,
  DATABASE_QUERY_TIMEOUT_MS: 10000,
  
  // Circuit Breaker
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: 5,
  CIRCUIT_BREAKER_TIMEOUT_MS: 60000, // 1 minute
  
  // Retry Configuration
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_BASE_DELAY_MS: 1000,
  
  // Settlement
  SETTLEMENT_BATCH_SIZE: 10,
  SETTLEMENT_TIMEOUT_SECONDS: 300, // 5 minutes
  MAX_SETTLEMENT_GAS_PRICE: '50000000000', // 50 Gwei
  
  // Precision
  PRICE_DECIMALS: 8,
  AMOUNT_DECIMALS: 18,
  USD_DECIMALS: 6,
  
  // Fee Configuration
  DEFAULT_TRADING_FEE_BASIS_POINTS: 30, // 0.3%
  MAKER_FEE_BASIS_POINTS: 20, // 0.2%
  TAKER_FEE_BASIS_POINTS: 30, // 0.3%
  
  // Risk Management
  MAX_POSITION_SIZE_USD: 10000000, // $10M
  MAX_DAILY_VOLUME_USD: 100000000, // $100M
  SUSPEND_TRADING_ON_HIGH_VOLATILITY: true,
  VOLATILITY_THRESHOLD: 1000, // 10%
  
} as const;

export const REDIS_CONFIG = {
  KEYS: {
    ORDER: (orderId: string) => `order:${orderId}`,
    ORDERBOOK: (pair: string) => `orderbook:${pair}`,
    TRADES: (pair: string) => `trades:${pair}`,
    USER_ORDERS: (userId: string) => `user:${userId}:orders`,
    PRICE_FEED: (pair: string) => `price:${pair}`,
    METRICS: 'trading:metrics',
  },
  
  EXPIRY: {
    ORDER_SECONDS: 86400, // 24 hours
    TRADE_SECONDS: 3600, // 1 hour
    PRICE_SECONDS: 60, // 1 minute
  },
  
  BATCH_SIZES: {
    ORDER_PROCESSING: 50,
    TRADE_RECORDING: 100,
    METRICS_UPDATE: 20,
  },
} as const;

export const BLOCKCHAIN_CONFIG = {
  NETWORKS: {
    HYPERVM_TESTNET: {
      CHAIN_ID: 998,
      RPC_URL: 'https://rpc.hyperliquid-testnet.xyz/evm',
      EXPLORER_URL: 'https://explorer.hyperliquid-testnet.xyz',
      NATIVE_TOKEN: 'HYPE',
    },
    HYPERVM_MAINNET: {
      CHAIN_ID: 999,
      RPC_URL: 'https://rpc.hyperliquid.xyz/evm',
      EXPLORER_URL: 'https://explorer.hyperliquid.xyz',
      NATIVE_TOKEN: 'HYPE',
    },
  },
  
  GAS_LIMITS: {
    SIMPLE_TRANSFER: 21000,
    TOKEN_TRANSFER: 65000,
    SWAP_TRANSACTION: 200000,
    ADD_LIQUIDITY: 300000,
    SETTLEMENT: 150000,
  },
  
  CONFIRMATION_BLOCKS: {
    FAST: 1,
    STANDARD: 3,
    SAFE: 6,
  },
} as const;

export const API_CONFIG = {
  RATE_LIMITS: {
    ORDERS_PER_MINUTE: 60,
    QUERIES_PER_MINUTE: 300,
    HEAVY_OPERATIONS_PER_MINUTE: 10,
  },
  
  TIMEOUTS: {
    REQUEST_TIMEOUT_MS: 30000,
    DATABASE_TIMEOUT_MS: 10000,
    BLOCKCHAIN_TIMEOUT_MS: 60000,
  },
  
  VALIDATION: {
    MAX_AMOUNT_LENGTH: 20,
    MAX_PRICE_LENGTH: 20,
    SUPPORTED_PAIRS: ['HYPERINDEX-USDC'] as const,
    SUPPORTED_ORDER_TYPES: ['market', 'limit'] as const,
    SUPPORTED_SIDES: ['buy', 'sell'] as const,
  },
} as const;

// Type helpers for better type safety
export type SupportedPair = typeof API_CONFIG.VALIDATION.SUPPORTED_PAIRS[number];
export type OrderType = typeof API_CONFIG.VALIDATION.SUPPORTED_ORDER_TYPES[number];
export type OrderSide = typeof API_CONFIG.VALIDATION.SUPPORTED_SIDES[number];

// Validation functions
export const isValidPair = (pair: string): pair is SupportedPair => {
  return API_CONFIG.VALIDATION.SUPPORTED_PAIRS.includes(pair as SupportedPair);
};

export const isValidOrderType = (type: string): type is OrderType => {
  return API_CONFIG.VALIDATION.SUPPORTED_ORDER_TYPES.includes(type as OrderType);
};

export const isValidOrderSide = (side: string): side is OrderSide => {
  return API_CONFIG.VALIDATION.SUPPORTED_SIDES.includes(side as OrderSide);
};