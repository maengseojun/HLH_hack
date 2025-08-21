// lib/validation/trading-validation.ts
/**
 * 🛡️ Comprehensive Input Validation for Trading System
 */

import { z } from 'zod';
import { TradingError, TradingErrorCode } from '@/lib/utils/trading-errors';
import { 
  TRADING_CONFIG, 
  API_CONFIG,
  isValidPair,
  isValidOrderType,
  isValidOrderSide,
  type SupportedPair,
  type OrderType,
  type OrderSide
} from '@/lib/config/trading-constants';

// Zod schemas for robust validation
export const OrderSchema = z.object({
  pair: z.string()
    .min(1, 'Pair is required')
    .refine(isValidPair, 'Unsupported trading pair'),
    
  type: z.string()
    .refine(isValidOrderType, 'Invalid order type'),
    
  side: z.string()
    .refine(isValidOrderSide, 'Invalid order side'),
    
  amount: z.string()
    .regex(/^\d+\.?\d*$/, 'Amount must be a valid number')
    .refine(
      (val) => {
        const num = parseFloat(val);
        return num >= TRADING_CONFIG.MIN_ORDER_SIZE_USD && 
               num <= TRADING_CONFIG.MAX_ORDER_SIZE_USD;
      },
      `Amount must be between $${TRADING_CONFIG.MIN_ORDER_SIZE_USD} and $${TRADING_CONFIG.MAX_ORDER_SIZE_USD}`
    ),
    
  price: z.string()
    .regex(/^\d+\.?\d*$/, 'Price must be a valid number')
    .optional(),
    
  slippageTolerance: z.number()
    .min(1, 'Minimum slippage is 0.01%')
    .max(TRADING_CONFIG.MAX_SLIPPAGE_BASIS_POINTS, `Maximum slippage is ${TRADING_CONFIG.MAX_SLIPPAGE_BASIS_POINTS / 100}%`)
    .optional(),
}).refine(
  (data) => {
    // Limit orders must have price
    if (data.type === 'limit' && !data.price) {
      return false;
    }
    return true;
  },
  {
    message: 'Limit orders must specify a price',
    path: ['price']
  }
);

export const SettlementParamsSchema = z.object({
  tradeId: z.string().min(1, 'Trade ID is required'),
  buyer: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid buyer address'),
  seller: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid seller address'),
  tokenBuy: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid buy token address'),
  tokenSell: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid sell token address'),
  amountBuy: z.string().regex(/^\d+$/, 'Buy amount must be a positive integer'),
  amountSell: z.string().regex(/^\d+$/, 'Sell amount must be a positive integer'),
});

export interface ValidatedOrder {
  pair: SupportedPair;
  type: OrderType;
  side: OrderSide;
  amount: string;
  price?: string;
  slippageTolerance?: number;
}

/**
 * 🔍 Order Validation Service
 */
export class OrderValidator {
  /**
   * Validate order data with comprehensive checks
   */
  static validateOrder(data: unknown): ValidatedOrder {
    try {
      const result = OrderSchema.parse(data);
      
      // Additional business logic validation
      this.validateOrderSizeConstraints(result);
      this.validatePriceConstraints(result);
      
      return result as ValidatedOrder;
    } catch (_error) {
      if (error instanceof z.ZodError) {
        const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new TradingError(
          TradingErrorCode.INVALID_ORDER_AMOUNT,
          `Order validation failed: ${message}`,
          { errors: error.errors },
          false
        );
      }
      throw _error;
    }
  }

  /**
   * Validate order size constraints based on current market conditions
   */
  private static validateOrderSizeConstraints(order: ValidatedOrder): void {
    const amount = parseFloat(order.amount);
    
    // Check against maximum position size
    if (amount > TRADING_CONFIG.MAX_POSITION_SIZE_USD) {
      throw TradingError.invalidAmount(
        `Order size ${amount} exceeds maximum position size ${TRADING_CONFIG.MAX_POSITION_SIZE_USD}`
      );
    }

    // Additional checks for market orders
    if (order.type === 'market') {
      // Market orders should not be too large to prevent market manipulation
      const maxMarketOrderSize = TRADING_CONFIG.MAX_POSITION_SIZE_USD * 0.1; // 10% of max position
      if (amount > maxMarketOrderSize) {
        throw new TradingError(
          TradingErrorCode.PRICE_IMPACT_TOO_HIGH,
          `Market order size ${amount} too large, maximum ${maxMarketOrderSize}`,
          { amount, maxMarketOrderSize },
          false
        );
      }
    }
  }

  /**
   * Validate price constraints for limit orders
   */
  private static validatePriceConstraints(order: ValidatedOrder): void {
    if (order.type === 'limit' && order.price) {
      const price = parseFloat(order.price);
      
      // Basic sanity checks
      if (price <= 0) {
        throw TradingError.invalidAmount('Price must be positive');
      }
      
      // Check for reasonable price ranges (prevent obvious errors)
      if (price > 1000000) { // $1M per token seems unreasonable
        throw new TradingError(
          TradingErrorCode.INVALID_ORDER_AMOUNT,
          `Price ${price} seems unreasonably high`,
          { price },
          false
        );
      }
      
      if (price < 0.000001) { // Very low prices might be errors
        throw new TradingError(
          TradingErrorCode.INVALID_ORDER_AMOUNT,
          `Price ${price} seems unreasonably low`,
          { price },
          false
        );
      }
    }
  }

  /**
   * Validate address format (checksummed or not)
   */
  static validateAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Validate amount string format and precision
   */
  static validateAmountString(amount: string, maxDecimals: number = 18): boolean {
    if (!/^\d+\.?\d*$/.test(amount)) {
      return false;
    }
    
    const parts = amount.split('.');
    if (parts[1] && parts[1].length > maxDecimals) {
      return false; // Too many decimal places
    }
    
    return true;
  }

  /**
   * Sanitize user input to prevent injection attacks
   */
  static sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/['";]/g, '') // Remove SQL injection chars
      .trim()
      .slice(0, 100); // Limit length
  }

  /**
   * Validate trading pair exists and is supported
   */
  static validateTradingPair(pair: string): SupportedPair {
    if (!isValidPair(pair)) {
      throw new TradingError(
        TradingErrorCode.PAIR_NOT_SUPPORTED,
        `Trading pair ${pair} is not supported`,
        { pair, supportedPairs: API_CONFIG.VALIDATION.SUPPORTED_PAIRS },
        false
      );
    }
    return pair;
  }
}

/**
 * 🛡️ Rate Limiting Validation
 */
export class RateLimitValidator {
  private static userRequestCounts = new Map<string, { count: number; resetTime: number }>();

  static checkRateLimit(userId: string, endpoint: string): void {
    const now = Date.now();
    const minute = 60 * 1000;
    const key = `${userId}:${endpoint}`;
    
    let userLimit;
    switch (endpoint) {
      case 'orders':
        userLimit = API_CONFIG.RATE_LIMITS.ORDERS_PER_MINUTE;
        break;
      case 'queries':
        userLimit = API_CONFIG.RATE_LIMITS.QUERIES_PER_MINUTE;
        break;
      case 'heavy':
        userLimit = API_CONFIG.RATE_LIMITS.HEAVY_OPERATIONS_PER_MINUTE;
        break;
      default:
        userLimit = API_CONFIG.RATE_LIMITS.QUERIES_PER_MINUTE;
    }

    const current = this.userRequestCounts.get(key);
    
    if (!current || now > current.resetTime) {
      // Reset counter
      this.userRequestCounts.set(key, { count: 1, resetTime: now + minute });
      return;
    }

    if (current.count >= userLimit) {
      throw new TradingError(
        TradingErrorCode.DATABASE_ERROR, // Reusing for rate limiting
        `Rate limit exceeded: ${userLimit} requests per minute for ${endpoint}`,
        { userId, endpoint, limit: userLimit },
        true // Retryable after time passes
      );
    }

    current.count++;
  }

  static getUserRequestCount(userId: string, endpoint: string): number {
    const key = `${userId}:${endpoint}`;
    const current = this.userRequestCounts.get(key);
    return current?.count || 0;
  }
}