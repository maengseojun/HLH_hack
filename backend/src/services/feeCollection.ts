// Fee Collection and Buyback Service

import { AppError } from '../utils/httpError.js';
import type {
  FeeCollectionConfig,
  BuybackConfig,
  DEFAULT_FEE_CONFIG,
  DEFAULT_BUYBACK_CONFIG,
} from '../types/token.ts';
import {
  getTokenHolder,
  transferTokens,
  burnTokens,
  getTreasuryBalance,
  SYSTEM_ACCOUNTS,
} from './token.supabase.js';

// Configuration (in production, store in database)
let feeConfig: FeeCollectionConfig = {
  swapFeePercent: 0.003,
  rebalancingFeePercent: 0.005,
  l1ManagementFee: 0.007,
  l2ManagementFee: 0.01,
  l3ManagementFee: 0.02,
  l3PerformanceFee: 0.2,
  treasuryShare: 0.4,
  buybackShare: 0.3,
  stakingRewardShare: 0.3,
};

let buybackConfig: BuybackConfig = {
  enabled: true,
  minTreasuryBalance: 10_000,
  buybackPercentPerWeek: 0.1,
  priceThreshold: 0.04,
  burnPercentage: 0.5,
};

// Fee collection stats
interface FeeStats {
  totalCollected: number;
  toTreasury: number;
  toBuyback: number;
  toStaking: number;
  lastCollection: number;
}

const feeStats: FeeStats = {
  totalCollected: 0,
  toTreasury: 0,
  toBuyback: 0,
  toStaking: 0,
  lastCollection: Date.now(),
};

// Buyback stats
interface BuybackStats {
  totalBuyback: number;
  totalBurned: number;
  totalLP: number;
  lastBuyback: number;
  buybackCount: number;
}

const buybackStats: BuybackStats = {
  totalBuyback: 0,
  totalBurned: 0,
  totalLP: 0,
  lastBuyback: Date.now(),
  buybackCount: 0,
};

/**
 * Collect fee in native token
 */
export async function collectFee(
  fromUserId: string,
  feeAmount: number,
  reason: string
): Promise<void> {
  if (feeAmount <= 0) return;
  
  // Transfer fee from user to treasury
  await transferTokens(fromUserId, SYSTEM_ACCOUNTS.TREASURY, feeAmount, reason);
  
  // Distribute fee
  const toTreasury = feeAmount * feeConfig.treasuryShare;
  const toBuyback = feeAmount * feeConfig.buybackShare;
  const toStaking = feeAmount * feeConfig.stakingRewardShare;
  
  // Move buyback portion to buyback pool
  if (toBuyback > 0) {
    await transferTokens(SYSTEM_ACCOUNTS.TREASURY, SYSTEM_ACCOUNTS.BUYBACK_POOL, toBuyback, 'Fee allocation for buyback');
  }
  
  // Move staking portion to staking rewards pool
  if (toStaking > 0) {
    await transferTokens(SYSTEM_ACCOUNTS.TREASURY, SYSTEM_ACCOUNTS.STAKING_REWARDS, toStaking, 'Fee allocation for staking rewards');
  }
  
  // Update stats
  feeStats.totalCollected += feeAmount;
  feeStats.toTreasury += toTreasury;
  feeStats.toBuyback += toBuyback;
  feeStats.toStaking += toStaking;
  feeStats.lastCollection = Date.now();
}

/**
 * Calculate swap fee in native token
 */
export function calculateSwapFee(swapValueUsd: number): number {
  // Fee is calculated in native token
  // Mock: 1 HI = $0.05
  const tokenPrice = 0.05;
  const feeUsd = swapValueUsd * feeConfig.swapFeePercent;
  return feeUsd / tokenPrice;
}

/**
 * Calculate rebalancing fee
 */
export function calculateRebalancingFee(rebalanceValueUsd: number): number {
  const tokenPrice = 0.05;
  const feeUsd = rebalanceValueUsd * feeConfig.rebalancingFeePercent;
  return feeUsd / tokenPrice;
}

/**
 * Calculate annual management fee
 */
export function calculateManagementFee(
  indexLayer: 'L1' | 'L2' | 'L3',
  indexTvlUsd: number,
  durationDays: number
): number {
  let annualFeeRate: number;
  
  switch (indexLayer) {
    case 'L1':
      annualFeeRate = feeConfig.l1ManagementFee;
      break;
    case 'L2':
      annualFeeRate = feeConfig.l2ManagementFee;
      break;
    case 'L3':
      annualFeeRate = feeConfig.l3ManagementFee;
      break;
  }
  
  const tokenPrice = 0.05;
  const dailyFeeRate = annualFeeRate / 365;
  const feeUsd = indexTvlUsd * dailyFeeRate * durationDays;
  
  return feeUsd / tokenPrice;
}

/**
 * Calculate performance fee (L3 only)
 */
export function calculatePerformanceFee(profitUsd: number): number {
  if (profitUsd <= 0) return 0;
  
  const tokenPrice = 0.05;
  const feeUsd = profitUsd * feeConfig.l3PerformanceFee;
  
  return feeUsd / tokenPrice;
}

/**
 * Execute buyback (called periodically)
 */
export async function executeBuyback(): Promise<{
  success: boolean;
  amountBuyback: number;
  amountBurned: number;
  amountLP: number;
  reason?: string;
}> {
  if (!buybackConfig.enabled) {
    return {
      success: false,
      amountBuyback: 0,
      amountBurned: 0,
      amountLP: 0,
      reason: 'Buyback is disabled',
    };
  }
  
  const buybackPool = await getTokenHolder(SYSTEM_ACCOUNTS.BUYBACK_POOL);
  const buybackBalance = buybackPool.balance;
  
  // Check minimum balance
  if (buybackBalance < buybackConfig.minTreasuryBalance) {
    return {
      success: false,
      amountBuyback: 0,
      amountBurned: 0,
      amountLP: 0,
      reason: `Buyback pool balance (${buybackBalance}) below minimum (${buybackConfig.minTreasuryBalance})`,
    };
  }
  
  // Check price threshold (mock)
  const currentPrice = 0.05; // Mock price
  if (currentPrice >= buybackConfig.priceThreshold) {
    return {
      success: false,
      amountBuyback: 0,
      amountBurned: 0,
      amountLP: 0,
      reason: `Current price ($${currentPrice}) above threshold ($${buybackConfig.priceThreshold})`,
    };
  }
  
  // Calculate buyback amount
  const buybackAmount = buybackBalance * buybackConfig.buybackPercentPerWeek;
  
  // Calculate burn vs LP allocation
  const burnAmount = buybackAmount * buybackConfig.burnPercentage;
  const lpAmount = buybackAmount - burnAmount;
  
  // Execute burn
  if (burnAmount > 0) {
    await burnTokens(SYSTEM_ACCOUNTS.BUYBACK_POOL, burnAmount, 'Buyback burn');
  }
  
  // Add to LP (mock - in production, add to liquidity pool)
  if (lpAmount > 0) {
    // TODO: liquidity-pool needs a UUID too
    // transferTokens(SYSTEM_ACCOUNTS.BUYBACK_POOL, 'liquidity-pool', lpAmount, 'Buyback LP provision');
  }
  
  // Update stats
  buybackStats.totalBuyback += buybackAmount;
  buybackStats.totalBurned += burnAmount;
  buybackStats.totalLP += lpAmount;
  buybackStats.lastBuyback = Date.now();
  buybackStats.buybackCount += 1;
  
  return {
    success: true,
    amountBuyback: buybackAmount,
    amountBurned: burnAmount,
    amountLP: lpAmount,
  };
}

/**
 * Get fee collection stats
 */
export function getFeeStats(): FeeStats {
  return { ...feeStats };
}

/**
 * Get buyback stats
 */
export function getBuybackStats(): BuybackStats {
  return { ...buybackStats };
}

/**
 * Get fee configuration
 */
export function getFeeConfig(): FeeCollectionConfig {
  return { ...feeConfig };
}

/**
 * Update fee configuration (admin only)
 */
export function updateFeeConfig(newConfig: Partial<FeeCollectionConfig>): void {
  feeConfig = { ...feeConfig, ...newConfig };
}

/**
 * Get buyback configuration
 */
export function getBuybackConfig(): BuybackConfig {
  return { ...buybackConfig };
}

/**
 * Update buyback configuration (admin only)
 */
export function updateBuybackConfig(newConfig: Partial<BuybackConfig>): void {
  buybackConfig = { ...buybackConfig, ...newConfig };
}

/**
 * Simulate buyback schedule
 */
export async function simulateBuybackSchedule(weeks: number = 12): Promise<Array<{
  week: number;
  buybackAmount: number;
  burnAmount: number;
  lpAmount: number;
  poolBalance: number;
}>> {
  const schedule: Array<{
    week: number;
    buybackAmount: number;
    burnAmount: number;
    lpAmount: number;
    poolBalance: number;
  }> = [];
  
  let poolBalance = (await getTokenHolder(SYSTEM_ACCOUNTS.BUYBACK_POOL)).balance;
  
  for (let week = 1; week <= weeks; week++) {
    if (poolBalance < buybackConfig.minTreasuryBalance) break;
    
    const buybackAmount = poolBalance * buybackConfig.buybackPercentPerWeek;
    const burnAmount = buybackAmount * buybackConfig.burnPercentage;
    const lpAmount = buybackAmount - burnAmount;
    
    poolBalance -= buybackAmount;
    
    schedule.push({
      week,
      buybackAmount,
      burnAmount,
      lpAmount,
      poolBalance,
    });
  }
  
  return schedule;
}
