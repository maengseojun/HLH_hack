// Graduation Service - L3 to L2 migration logic

import { AppError } from '../utils/httpError.js';
import type { Index, L3Index, GraduationCriteria } from '../types/index.js';
import { getIndexById } from './index.supabase.js';

/**
 * Default graduation criteria (MVP - scaled down from production)
 * Production values: $100M market cap, 25,000 holders, $5M volume, $50M TVL
 * MVP values: $1M market cap, 100 holders, $50k volume, $100k TVL
 */
export const DEFAULT_GRADUATION_CRITERIA: GraduationCriteria = {
  minMarketCap: 1_000_000,      // $1M market cap
  minHolders: 100,              // 100 unique holders
  minVolume24h: 50_000,         // $50k daily volume
  minAge: 30 * 24 * 60 * 60,    // 30 days in seconds
};

/**
 * Check if an L3 index meets graduation criteria
 */
export async function checkGraduationEligibility(
  indexId: string
): Promise<{
  eligible: boolean;
  criteria: GraduationCriteria;
  current: {
    marketCap: number;
    holders: number;
    volume24h: number;
    age: number;
  };
  missing: string[];
}> {
  const index = await getIndexById(indexId);
  
  if (index.layer !== 'L3') {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'Only L3 indices can graduate to L2'
    });
  }
  
  const l3Index = index as L3Index;
  
  // Get current metrics
  const current = {
    marketCap: l3Index.bondingCurve?.currentMarketCap || 0,
    holders: index.holders || 0,
    volume24h: parseFloat(index.volume24h || '0'),
    age: Date.now() - index.createdAt,
  };
  
  // Check each criterion
  const missing: string[] = [];
  
  if (current.marketCap < DEFAULT_GRADUATION_CRITERIA.minMarketCap) {
    missing.push(
      `Market cap: $${current.marketCap.toLocaleString()} / $${DEFAULT_GRADUATION_CRITERIA.minMarketCap.toLocaleString()}`
    );
  }
  
  if (current.holders < DEFAULT_GRADUATION_CRITERIA.minHolders) {
    missing.push(
      `Holders: ${current.holders} / ${DEFAULT_GRADUATION_CRITERIA.minHolders}`
    );
  }
  
  if (current.volume24h < DEFAULT_GRADUATION_CRITERIA.minVolume24h) {
    missing.push(
      `24h Volume: $${current.volume24h.toLocaleString()} / $${DEFAULT_GRADUATION_CRITERIA.minVolume24h.toLocaleString()}`
    );
  }
  
  if (current.age < DEFAULT_GRADUATION_CRITERIA.minAge) {
    const daysOld = Math.floor(current.age / (24 * 60 * 60 * 1000));
    const daysRequired = Math.floor(DEFAULT_GRADUATION_CRITERIA.minAge / (24 * 60 * 60 * 1000));
    missing.push(`Age: ${daysOld} days / ${daysRequired} days`);
  }
  
  return {
    eligible: missing.length === 0,
    criteria: DEFAULT_GRADUATION_CRITERIA,
    current,
    missing,
  };
}

/**
 * Graduate an L3 index to L2
 */
export async function graduateIndex(
  indexId: string,
  approvedBy?: string
): Promise<Index> {
  // Check eligibility
  const eligibility = await checkGraduationEligibility(indexId);
  
  if (!eligibility.eligible) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'Index does not meet graduation criteria',
      details: {
        missing: eligibility.missing,
      },
    });
  }
  
  const l3Index = await getIndexById(indexId) as L3Index;
  
  // Create new L2 index
  const l2Index: Index = {
    id: `l2-graduated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    layer: 'L2',
    symbol: l3Index.symbol,
    name: l3Index.name,
    description: `${l3Index.description} (Graduated from L3)`,
    components: l3Index.components,
    managementFee: 0.01, // L2 fee: 1%
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: approvedBy || l3Index.createdBy,
    totalValueLocked: l3Index.totalValueLocked,
    holders: l3Index.holders,
    volume24h: l3Index.volume24h,
  };
  
  // Mark L3 index as graduated
  l3Index.status = 'graduated';
  l3Index.updatedAt = Date.now();
  
  // TODO: In production:
  // 1. Deploy new L2 smart contract
  // 2. Migrate liquidity from bonding curve to AMM
  // 3. Convert L3 tokens to L2 tokens for all holders
  // 4. Update database
  // 5. Notify token holders
  
  return l2Index;
}

/**
 * Get graduation progress for an L3 index
 */
export async function getGraduationProgress(indexId: string) {
  const eligibility = await checkGraduationEligibility(indexId);
  
  // Calculate progress for each criterion (0-100%)
  const progress = {
    marketCap: Math.min(
      (eligibility.current.marketCap / eligibility.criteria.minMarketCap) * 100,
      100
    ),
    holders: Math.min(
      (eligibility.current.holders / eligibility.criteria.minHolders) * 100,
      100
    ),
    volume: Math.min(
      (eligibility.current.volume24h / eligibility.criteria.minVolume24h) * 100,
      100
    ),
    age: Math.min(
      (eligibility.current.age / eligibility.criteria.minAge) * 100,
      100
    ),
  };
  
  // Overall progress (average of all criteria)
  const overall =
    (progress.marketCap + progress.holders + progress.volume + progress.age) / 4;
  
  return {
    eligible: eligibility.eligible,
    overall: Math.round(overall),
    breakdown: {
      marketCap: {
        progress: Math.round(progress.marketCap),
        current: eligibility.current.marketCap,
        required: eligibility.criteria.minMarketCap,
      },
      holders: {
        progress: Math.round(progress.holders),
        current: eligibility.current.holders,
        required: eligibility.criteria.minHolders,
      },
      volume: {
        progress: Math.round(progress.volume),
        current: eligibility.current.volume24h,
        required: eligibility.criteria.minVolume24h,
      },
      age: {
        progress: Math.round(progress.age),
        current: Math.floor(eligibility.current.age / (24 * 60 * 60 * 1000)),
        required: Math.floor(eligibility.criteria.minAge / (24 * 60 * 60 * 1000)),
      },
    },
    missing: eligibility.missing,
  };
}

/**
 * Estimate time to graduation
 */
export async function estimateGraduationTime(indexId: string): Promise<number> {
  const progress = await getGraduationProgress(indexId);
  
  if (progress.eligible) {
    return 0; // Already eligible
  }
  
  // Simple estimation based on current growth rate
  // In production, use historical data for better predictions
  const index = await getIndexById(indexId) as L3Index;
  const ageInDays = (Date.now() - index.createdAt) / (24 * 60 * 60 * 1000);
  
  if (ageInDays < 1) {
    return 30; // Default to 30 days if too young
  }
  
  // Estimate based on slowest criterion
  const slowestProgress = Math.min(
    progress.breakdown.marketCap.progress,
    progress.breakdown.holders.progress,
    progress.breakdown.volume.progress
  );
  
  if (slowestProgress < 10) {
    return 90; // 3 months if very slow
  } else if (slowestProgress < 50) {
    return 60; // 2 months if moderate
  } else {
    return 30; // 1 month if close
  }
}
