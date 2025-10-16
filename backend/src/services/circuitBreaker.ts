// Circuit Breaker Service - Emergency Safety Mechanism

import { AppError } from '../utils/httpError.js';
import { logger } from '../infra/logger.js';

interface CircuitBreakerState {
  isActive: boolean;
  triggeredAt: number | null;
  reason: string | null;
  cooldownEndsAt: number | null;
  lastTVL: number;
  tvlHistory: { timestamp: number; tvl: number }[];
}

interface CircuitBreakerConfig {
  tvlThresholdPercent: number; // 25 = 25% decline
  timeWindowMs: number; // 24 hours in ms
  cooldownMs: number; // 48 hours in ms
  enabled: boolean;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  tvlThresholdPercent: 25,
  timeWindowMs: 24 * 60 * 60 * 1000, // 24 hours
  cooldownMs: 48 * 60 * 60 * 1000, // 48 hours
  enabled: true,
};

// In-memory circuit breaker states by index ID
const circuitBreakers = new Map<string, CircuitBreakerState>();

/**
 * Initialize circuit breaker for an index
 */
export function initCircuitBreaker(
  indexId: string,
  initialTVL: number
): void {
  circuitBreakers.set(indexId, {
    isActive: false,
    triggeredAt: null,
    reason: null,
    cooldownEndsAt: null,
    lastTVL: initialTVL,
    tvlHistory: [{
      timestamp: Date.now(),
      tvl: initialTVL
    }],
  });
  
  logger.info({ indexId, initialTVL }, 'Circuit breaker initialized');
}

/**
 * Check and update TVL - triggers circuit breaker if needed
 */
export function checkTVL(
  indexId: string,
  currentTVL: number,
  config: CircuitBreakerConfig = DEFAULT_CONFIG
): { triggered: boolean; reason?: string } {
  if (!config.enabled) {
    return { triggered: false };
  }
  
  const state = circuitBreakers.get(indexId);
  if (!state) {
    initCircuitBreaker(indexId, currentTVL);
    return { triggered: false };
  }
  
  // Check if already in cooldown
  if (state.isActive && state.cooldownEndsAt) {
    if (Date.now() < state.cooldownEndsAt) {
      return {
        triggered: true,
        reason: `Circuit breaker active until ${new Date(state.cooldownEndsAt).toISOString()}`
      };
    } else {
      // Cooldown expired, reset
      deactivateCircuitBreaker(indexId);
    }
  }
  
  // Update TVL history
  const now = Date.now();
  state.tvlHistory.push({ timestamp: now, tvl: currentTVL });
  
  // Remove old entries outside time window
  state.tvlHistory = state.tvlHistory.filter(
    entry => now - entry.timestamp < config.timeWindowMs
  );
  
  // Check for significant TVL decline
  if (state.tvlHistory.length < 2) {
    state.lastTVL = currentTVL;
    return { triggered: false };
  }
  
  // Find maximum TVL in the time window
  const maxTVL = Math.max(...state.tvlHistory.map(e => e.tvl));
  
  // Calculate decline percentage
  const decline = ((maxTVL - currentTVL) / maxTVL) * 100;
  
  if (decline >= config.tvlThresholdPercent) {
    // Trigger circuit breaker
    const reason = `TVL declined ${decline.toFixed(2)}% from $${maxTVL.toFixed(0)} to $${currentTVL.toFixed(0)} within ${config.timeWindowMs / 1000 / 60 / 60} hours`;
    
    activateCircuitBreaker(indexId, reason, config.cooldownMs);
    
    logger.warn({
      indexId,
      decline,
      maxTVL,
      currentTVL,
      timeWindow: config.timeWindowMs / 1000 / 60 / 60
    }, 'Circuit breaker triggered');
    
    return { triggered: true, reason };
  }
  
  state.lastTVL = currentTVL;
  return { triggered: false };
}

/**
 * Activate circuit breaker
 */
export function activateCircuitBreaker(
  indexId: string,
  reason: string,
  cooldownMs: number
): void {
  const state = circuitBreakers.get(indexId);
  if (!state) return;
  
  const now = Date.now();
  
  state.isActive = true;
  state.triggeredAt = now;
  state.reason = reason;
  state.cooldownEndsAt = now + cooldownMs;
  
  logger.error({
    indexId,
    reason,
    cooldownHours: cooldownMs / 1000 / 60 / 60
  }, 'Circuit breaker ACTIVATED');
}

/**
 * Manually deactivate circuit breaker (admin only)
 */
export function deactivateCircuitBreaker(indexId: string): void {
  const state = circuitBreakers.get(indexId);
  if (!state) return;
  
  state.isActive = false;
  state.triggeredAt = null;
  state.reason = null;
  state.cooldownEndsAt = null;
  
  logger.info({ indexId }, 'Circuit breaker DEACTIVATED');
}

/**
 * Check if circuit breaker is active
 */
export function isCircuitBreakerActive(indexId: string): boolean {
  const state = circuitBreakers.get(indexId);
  if (!state) return false;
  
  // Check if cooldown expired
  if (state.isActive && state.cooldownEndsAt) {
    if (Date.now() >= state.cooldownEndsAt) {
      deactivateCircuitBreaker(indexId);
      return false;
    }
  }
  
  return state.isActive;
}

/**
 * Get circuit breaker status
 */
export function getCircuitBreakerStatus(indexId: string) {
  const state = circuitBreakers.get(indexId);
  
  if (!state) {
    return {
      exists: false,
      isActive: false
    };
  }
  
  return {
    exists: true,
    isActive: state.isActive,
    triggeredAt: state.triggeredAt,
    reason: state.reason,
    cooldownEndsAt: state.cooldownEndsAt,
    lastTVL: state.lastTVL,
    tvlHistory: state.tvlHistory
  };
}

/**
 * Middleware: Check circuit breaker before trading
 */
export function checkCircuitBreakerMiddleware(indexId: string): void {
  if (isCircuitBreakerActive(indexId)) {
    const status = getCircuitBreakerStatus(indexId);
    
    throw new AppError(503, {
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'Trading is temporarily paused due to circuit breaker',
      details: {
        reason: status.reason,
        cooldownEndsAt: status.cooldownEndsAt
      }
    });
  }
}

/**
 * Get all active circuit breakers (admin monitoring)
 */
export function getActiveCircuitBreakers() {
  const active: Array<{ indexId: string; status: any }> = [];
  
  for (const [indexId, state] of circuitBreakers.entries()) {
    if (state.isActive) {
      active.push({
        indexId,
        status: getCircuitBreakerStatus(indexId)
      });
    }
  }
  
  return active;
}
