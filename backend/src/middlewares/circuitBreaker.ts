// Circuit Breaker Middleware - Emergency stop mechanism

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/httpError.js';

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  isActive: boolean;
  triggeredAt?: number;
  reason?: string;
  cooldownEndsAt?: number;
  lastTVL?: number;
  tvlHistory: Array<{ timestamp: number; tvl: number }>;
}

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  tvlThreshold: number;        // % decline threshold (e.g., 25 = 25%)
  timeWindow: number;          // Time window in ms (e.g., 24 hours)
  cooldownPeriod: number;      // Cooldown in ms (e.g., 48 hours)
  enabled: boolean;
}

// Global state (in production, use Redis or database)
const circuitBreakerState: CircuitBreakerState = {
  isActive: false,
  tvlHistory: [],
};

// Default configuration based on industry standards
const defaultConfig: CircuitBreakerConfig = {
  tvlThreshold: 25,                    // 25% TVL decline
  timeWindow: 24 * 60 * 60 * 1000,    // 24 hours
  cooldownPeriod: 48 * 60 * 60 * 1000, // 48 hours
  enabled: true,
};

/**
 * Update TVL and check circuit breaker conditions
 */
export function updateTVL(currentTVL: number): void {
  const now = Date.now();
  
  // Add to history
  circuitBreakerState.tvlHistory.push({
    timestamp: now,
    tvl: currentTVL,
  });
  
  // Keep only data within time window
  const cutoff = now - defaultConfig.timeWindow;
  circuitBreakerState.tvlHistory = circuitBreakerState.tvlHistory.filter(
    entry => entry.timestamp > cutoff
  );
  
  // Check if circuit breaker should trigger
  if (circuitBreakerState.tvlHistory.length > 0) {
    const oldestTVL = circuitBreakerState.tvlHistory[0].tvl;
    const decline = ((oldestTVL - currentTVL) / oldestTVL) * 100;
    
    if (decline >= defaultConfig.tvlThreshold && defaultConfig.enabled) {
      triggerCircuitBreaker(
        `TVL declined by ${decline.toFixed(2)}% in ${defaultConfig.timeWindow / (60 * 60 * 1000)} hours`
      );
    }
  }
  
  circuitBreakerState.lastTVL = currentTVL;
}

/**
 * Manually trigger circuit breaker
 */
export function triggerCircuitBreaker(reason: string): void {
  if (circuitBreakerState.isActive) {
    return; // Already active
  }
  
  const now = Date.now();
  
  circuitBreakerState.isActive = true;
  circuitBreakerState.triggeredAt = now;
  circuitBreakerState.reason = reason;
  circuitBreakerState.cooldownEndsAt = now + defaultConfig.cooldownPeriod;
  
  console.error('🚨 CIRCUIT BREAKER ACTIVATED:', {
    reason,
    triggeredAt: new Date(now).toISOString(),
    cooldownEndsAt: new Date(circuitBreakerState.cooldownEndsAt).toISOString(),
  });
  
  // TODO: Send alerts to admin (email, Slack, etc.)
}

/**
 * Manually deactivate circuit breaker (admin only)
 */
export function deactivateCircuitBreaker(): void {
  circuitBreakerState.isActive = false;
  circuitBreakerState.triggeredAt = undefined;
  circuitBreakerState.reason = undefined;
  circuitBreakerState.cooldownEndsAt = undefined;
  
  console.log('✅ Circuit breaker deactivated');
}

/**
 * Check if circuit breaker is active
 */
export function isCircuitBreakerActive(): boolean {
  // Auto-deactivate if cooldown period has passed
  if (
    circuitBreakerState.isActive &&
    circuitBreakerState.cooldownEndsAt &&
    Date.now() > circuitBreakerState.cooldownEndsAt
  ) {
    deactivateCircuitBreaker();
  }
  
  return circuitBreakerState.isActive;
}

/**
 * Get circuit breaker status
 */
export function getCircuitBreakerStatus() {
  return {
    isActive: circuitBreakerState.isActive,
    triggeredAt: circuitBreakerState.triggeredAt,
    reason: circuitBreakerState.reason,
    cooldownEndsAt: circuitBreakerState.cooldownEndsAt,
    currentTVL: circuitBreakerState.lastTVL,
    config: defaultConfig,
  };
}

/**
 * Circuit breaker middleware - blocks trading when active
 */
export function circuitBreakerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!defaultConfig.enabled) {
    return next();
  }
  
  if (isCircuitBreakerActive()) {
    const status = getCircuitBreakerStatus();
    
    req.log?.warn({
      path: req.path,
      method: req.method,
      reason: status.reason,
    }, 'Request blocked by circuit breaker');
    
    const error = new AppError(503, {
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'Trading is temporarily halted due to unusual activity',
      details: {
        reason: status.reason,
        triggeredAt: status.triggeredAt,
        cooldownEndsAt: status.cooldownEndsAt,
      },
      retryAfterSec: status.cooldownEndsAt
        ? Math.ceil((status.cooldownEndsAt - Date.now()) / 1000)
        : 3600,
    });
    
    return next(error);
  }
  
  next();
}

/**
 * Apply circuit breaker only to specific routes
 */
export function protectTradingRoutes(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only protect trading-related operations
  const tradingPaths = [
    '/v1/trading/swap',
    '/v1/trading/orders',
    '/v1/indexes',
  ];
  
  const shouldProtect = tradingPaths.some(path => req.path.startsWith(path));
  
  if (shouldProtect && req.method !== 'GET') {
    return circuitBreakerMiddleware(req, res, next);
  }
  
  next();
}
