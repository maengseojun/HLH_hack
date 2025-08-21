// lib/trading/mock-amm.ts
/**
 * Mock AMM for testing hybrid trading system
 * Simulates Uniswap V2 style constant product AMM
 */

export interface AMMPool {
  tokenA: string;
  tokenB: string;
  reserveA: number;
  reserveB: number;
  fee: number; // 0.003 = 0.3%
}

export class MockAMM {
  private pools: Map<string, AMMPool> = new Map();
  private priceImpactHistory: Array<{
    timestamp: number;
    pair: string;
    oldPrice: number;
    newPrice: number;
    volume: number;
  }> = [];

  constructor() {
    // Initialize default pools
    this.initializeDefaultPools();
  }

  private initializeDefaultPools() {
    // HYPERINDEX-USDC pool
    this.pools.set('HYPERINDEX-USDC', {
      tokenA: 'HYPERINDEX',
      tokenB: 'USDC',
      reserveA: 1000000, // 1M HYPERINDEX
      reserveB: 1000000, // 1M USDC (initial price = 1.0)
      fee: 0.003
    });

    // Add more pools as needed
    this.pools.set('MEMEINDEX-USDC', {
      tokenA: 'MEMEINDEX',
      tokenB: 'USDC',
      reserveA: 500000,
      reserveB: 250000, // Initial price = 0.5
      fee: 0.003
    });
  }

  /**
   * Get current spot price for a pair
   */
  getSpotPrice(pair: string): number {
    const pool = this.pools.get(pair);
    if (!pool) {
      throw new Error(`Pool ${pair} not found`);
    }

    // Price of tokenA in terms of tokenB
    return pool.reserveB / pool.reserveA;
  }

  /**
   * Get price after a hypothetical swap (without executing)
   */
  getPriceAfterSwap(pair: string, side: 'buy' | 'sell', amount: number): number {
    const pool = this.pools.get(pair);
    if (!pool) {
      throw new Error(`Pool ${pair} not found`);
    }

    const amountWithFee = amount * (1 - pool.fee);

    if (side === 'buy') {
      // Buying tokenA with tokenB
      const newReserveB = pool.reserveB + amountWithFee;
      const newReserveA = (pool.reserveA * pool.reserveB) / newReserveB;
      return newReserveB / newReserveA;
    } else {
      // Selling tokenA for tokenB
      const newReserveA = pool.reserveA + amountWithFee;
      const newReserveB = (pool.reserveA * pool.reserveB) / newReserveA;
      return newReserveB / newReserveA;
    }
  }

  /**
   * Calculate output amount for a swap
   */
  calculateSwapOutput(
    pair: string,
    side: 'buy' | 'sell',
    inputAmount: number
  ): { outputAmount: number; priceImpact: number; effectivePrice: number } {
    const pool = this.pools.get(pair);
    if (!pool) {
      throw new Error(`Pool ${pair} not found`);
    }

    const inputWithFee = inputAmount * (1 - pool.fee);
    const currentPrice = this.getSpotPrice(pair);
    let outputAmount: number;
    let newPrice: number;

    if (side === 'buy') {
      // Buying tokenA with tokenB (input is USDC)
      outputAmount = (pool.reserveA * inputWithFee) / (pool.reserveB + inputWithFee);
      newPrice = (pool.reserveB + inputWithFee) / (pool.reserveA - outputAmount);
    } else {
      // Selling tokenA for tokenB (input is tokenA)
      outputAmount = (pool.reserveB * inputWithFee) / (pool.reserveA + inputWithFee);
      newPrice = (pool.reserveB - outputAmount) / (pool.reserveA + inputWithFee);
    }

    const priceImpact = Math.abs((newPrice - currentPrice) / currentPrice);
    
    // 올바른 effectivePrice 계산 - 수수료 고려한 실제 비율
    let effectivePrice: number;
    if (side === 'buy') {
      // Buy: inputAmount USDC로 outputAmount HYPERINDEX 구매
      effectivePrice = inputAmount / outputAmount; // USDC per HYPERINDEX
    } else {
      // Sell: inputWithFee HYPERINDEX로 outputAmount USDC 획득  
      effectivePrice = outputAmount / inputWithFee; // USDC per HYPERINDEX (수수료 제외된 실제 거래량 기준)
    }

    return { outputAmount, priceImpact, effectivePrice };
  }

  /**
   * Execute a swap and update reserves
   */
  executeSwap(
    pair: string,
    side: 'buy' | 'sell',
    inputAmount: number
  ): {
    outputAmount: number;
    effectivePrice: number;
    priceImpact: number;
    newSpotPrice: number;
  } {
    const pool = this.pools.get(pair);
    if (!pool) {
      throw new Error(`Pool ${pair} not found`);
    }

    const oldPrice = this.getSpotPrice(pair);
    const swapResult = this.calculateSwapOutput(pair, side, inputAmount);

    // Update reserves
    if (side === 'buy') {
      pool.reserveB += inputAmount;
      pool.reserveA -= swapResult.outputAmount;
    } else {
      pool.reserveA += inputAmount;
      pool.reserveB -= swapResult.outputAmount;
    }

    const newSpotPrice = this.getSpotPrice(pair);

    // Record price impact
    this.priceImpactHistory.push({
      timestamp: Date.now(),
      pair,
      oldPrice,
      newPrice: newSpotPrice,
      volume: inputAmount
    });

    return {
      outputAmount: swapResult.outputAmount,
      effectivePrice: swapResult.effectivePrice,
      priceImpact: swapResult.priceImpact,
      newSpotPrice,
      reservesBefore: { reserveA: pool.reserveA + (side === 'sell' ? -inputAmount : swapResult.outputAmount), reserveB: pool.reserveB + (side === 'buy' ? -inputAmount : swapResult.outputAmount) },
      reservesAfter: { reserveA: pool.reserveA, reserveB: pool.reserveB }
    };
  }

  /**
   * 🔥 CRITICAL: 가격 제한이 있는 스왑 (하이브리드 라우팅용)
   * 특정 가격에 도달하면 멈추는 스왑 - 오더북과의 조화를 위함
   */
  executeSwapUntilPrice(
    pair: string,
    side: 'buy' | 'sell',
    maxInputAmount: number,
    limitPrice: number
  ): {
    actualInputAmount: number;
    outputAmount: number;
    effectivePrice: number;
    priceImpact: number;
    newSpotPrice: number;
    hitPriceLimit: boolean;
    reservesBefore: any;
    reservesAfter: any;
  } {
    const pool = this.pools.get(pair);
    if (!pool) {
      throw new Error(`Pool ${pair} not found`);
    }

    const oldPrice = this.getSpotPrice(pair);
    const reservesBefore = { reserveA: pool.reserveA, reserveB: pool.reserveB };
    
    // 목표 가격에 도달하는데 필요한 실제 수량 계산
    const amountToReachPrice = this.getAmountToReachPrice(pair, limitPrice, side);
    
    // 실제 실행할 수량 결정 (최대 수량과 목표 도달 수량 중 작은 것)
    const actualInputAmount = Math.min(maxInputAmount, Math.max(0, amountToReachPrice));
    const hitPriceLimit = actualInputAmount < maxInputAmount;
    
    if (actualInputAmount <= 0) {
      // 이미 목표 가격에 도달했거나 넘어섬
      return {
        actualInputAmount: 0,
        outputAmount: 0,
        effectivePrice: oldPrice,
        priceImpact: 0,
        newSpotPrice: oldPrice,
        hitPriceLimit: true,
        reservesBefore,
        reservesAfter: reservesBefore
      };
    }

    // 스왑 실행
    const swapResult = this.calculateSwapOutput(pair, side, actualInputAmount);

    // 리저브 업데이트
    if (side === 'buy') {
      pool.reserveB += actualInputAmount;
      pool.reserveA -= swapResult.outputAmount;
    } else {
      pool.reserveA += actualInputAmount;
      pool.reserveB -= swapResult.outputAmount;
    }

    const newSpotPrice = this.getSpotPrice(pair);
    const reservesAfter = { reserveA: pool.reserveA, reserveB: pool.reserveB };

    // 가격 영향 기록
    this.priceImpactHistory.push({
      timestamp: Date.now(),
      pair,
      oldPrice,
      newPrice: newSpotPrice,
      volume: actualInputAmount
    });

    console.log(`🎯 AMM price-limited swap:`, {
      pair,
      side,
      maxInputAmount,
      actualInputAmount,
      limitPrice,
      oldPrice,
      newSpotPrice,
      hitPriceLimit
    });

    return {
      actualInputAmount,
      outputAmount: swapResult.outputAmount,
      effectivePrice: swapResult.effectivePrice,
      priceImpact: swapResult.priceImpact,
      newSpotPrice,
      hitPriceLimit,
      reservesBefore,
      reservesAfter
    };
  }

  /**
   * Get amount needed to move price to a specific level
   */
  getAmountToReachPrice(
    pair: string,
    targetPrice: number,
    side: 'buy' | 'sell'
  ): number {
    const pool = this.pools.get(pair);
    if (!pool) {
      throw new Error(`Pool ${pair} not found`);
    }

    const currentPrice = this.getSpotPrice(pair);
    
    if (side === 'buy' && targetPrice <= currentPrice) {
      return 0; // Price is already at or above target
    }
    if (side === 'sell' && targetPrice >= currentPrice) {
      return 0; // Price is already at or above target (sell은 가격이 내려가야 하는데 이미 목표보다 낮음)
    }

    // Calculate amount needed using constant product formula
    if (side === 'buy') {
      // Need to increase price by buying
      const newReserveA = pool.reserveB / targetPrice;
      const deltaA = pool.reserveA - newReserveA;
      const deltaB = (pool.reserveA * pool.reserveB) / newReserveA - pool.reserveB;
      return deltaB / (1 - pool.fee);
    } else {
      // Need to decrease price by selling
      const newReserveA = pool.reserveB / targetPrice;
      const deltaA = newReserveA - pool.reserveA;
      return deltaA / (1 - pool.fee);
    }
  }

  /**
   * Add liquidity to pool
   */
  addLiquidity(pair: string, amountA: number, amountB: number): void {
    const pool = this.pools.get(pair);
    if (!pool) {
      throw new Error(`Pool ${pair} not found`);
    }

    // Check if ratio matches current pool ratio
    const currentRatio = pool.reserveA / pool.reserveB;
    const providedRatio = amountA / amountB;
    
    if (Math.abs(currentRatio - providedRatio) > 0.001) {
      throw new Error('Liquidity must be added in current pool ratio');
    }

    pool.reserveA += amountA;
    pool.reserveB += amountB;
  }

  /**
   * Get pool information
   */
  getPoolInfo(pair: string): AMMPool & { 
    spotPrice: number; 
    tvl: number; 
    volume24h: number;
  } {
    const pool = this.pools.get(pair);
    if (!pool) {
      throw new Error(`Pool ${pair} not found`);
    }

    const spotPrice = this.getSpotPrice(pair);
    const tvl = pool.reserveA * spotPrice + pool.reserveB;
    
    // Calculate 24h volume from history
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const volume24h = this.priceImpactHistory
      .filter(h => h.pair === pair && h.timestamp > oneDayAgo)
      .reduce((sum, h) => sum + h.volume, 0);

    return {
      ...pool,
      spotPrice,
      tvl,
      volume24h
    };
  }

  /**
   * Reset pool to initial state (for testing)
   */
  resetPool(pair: string): void {
    this.initializeDefaultPools();
    this.priceImpactHistory = this.priceImpactHistory.filter(h => h.pair !== pair);
  }

  /**
   * Get all available pairs
   */
  getAvailablePairs(): string[] {
    return Array.from(this.pools.keys());
  }
}

// Singleton instance
let mockAMMInstance: MockAMM | null = null;

export function getMockAMM(): MockAMM {
  if (!mockAMMInstance) {
    mockAMMInstance = new MockAMM();
  }
  return mockAMMInstance;
}

// Export types for use in other modules
export interface AMMQuote {
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  effectivePrice: number;
  spotPriceBefore: number;
  spotPriceAfter: number;
}

export interface AMMPriceCheck {
  spotPrice: number;
  buyPriceFor: (amount: number) => number;
  sellPriceFor: (amount: number) => number;
}