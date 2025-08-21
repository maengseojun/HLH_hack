// lib/utils/trading-errors.ts
/**
 * 🚨 Standardized Error Handling for Trading System
 */

export enum TradingErrorCode {
  // Order errors
  INVALID_ORDER_AMOUNT = 'INVALID_ORDER_AMOUNT',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  
  // Market errors
  PAIR_NOT_SUPPORTED = 'PAIR_NOT_SUPPORTED',
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  PRICE_IMPACT_TOO_HIGH = 'PRICE_IMPACT_TOO_HIGH',
  
  // System errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  REDIS_CONNECTION_FAILED = 'REDIS_CONNECTION_FAILED',
  ORACLE_UNAVAILABLE = 'ORACLE_UNAVAILABLE',
  
  // Settlement errors
  SETTLEMENT_FAILED = 'SETTLEMENT_FAILED',
  INSUFFICIENT_ALLOWANCE = 'INSUFFICIENT_ALLOWANCE',
  TRANSACTION_REVERTED = 'TRANSACTION_REVERTED'
}

export class TradingError extends Error {
  constructor(
    public readonly code: TradingErrorCode,
    message: string,
    public readonly context?: any,
    public readonly isRetryable: boolean = false
  ) {
    super(`[${code}] ${message}`);
    this.name = 'TradingError';
  }

  static invalidAmount(amount: string): TradingError {
    return new TradingError(
      TradingErrorCode.INVALID_ORDER_AMOUNT,
      `Invalid order amount: ${amount}`,
      { amount },
      false
    );
  }

  static insufficientLiquidity(pair: string, amount: string): TradingError {
    return new TradingError(
      TradingErrorCode.INSUFFICIENT_LIQUIDITY,
      `Insufficient liquidity in ${pair} for amount ${amount}`,
      { pair, amount },
      false
    );
  }

  static databaseError(operation: string, originalError: any): TradingError {
    return new TradingError(
      TradingErrorCode.DATABASE_ERROR,
      `Database operation failed: ${operation}`,
      { operation, originalError },
      true // Database errors might be retryable
    );
  }
}

/**
 * 🔄 Retry mechanism for recoverable errors
 */
export class RetryableOperation {
  constructor(
    private maxRetries: number = 3,
    private baseDelayMs: number = 1000
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    isRetryable: (error: any) => boolean = (e) => e instanceof TradingError && e.isRetryable
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (_error) {
        lastError = error;
        
        if (!isRetryable(error) || attempt === this.maxRetries) {
          throw _error;
        }
        
        const delay = this.baseDelayMs * Math.pow(2, attempt);
        console.warn(`Operation failed, retrying in ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
}

/**
 * 🚨 Circuit breaker for external services
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new TradingError(
          TradingErrorCode.DATABASE_ERROR,
          'Circuit breaker is OPEN - service temporarily unavailable',
          { state: this.state, failures: this.failures },
          false
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (_error) {
      this.onFailure();
      throw _error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getStatus() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailTime: this.lastFailTime
    };
  }
}