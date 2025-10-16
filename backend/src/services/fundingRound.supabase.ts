// Funding Round Service - Supabase Implementation
// Investment management with proper transaction handling

import { supabase } from '../config/supabase.js';
import { AppError } from '../utils/httpError.js';
import type {
  FundingRound,
  Investment,
  VestingSchedule,
} from '../types/token.js';
import { getTokenHolder, lockTokens, mintTokens } from './token.supabase.js';

// ============================================================================
// Helper Functions: Type Transformations
// ============================================================================

/**
 * Transform database row to FundingRound type
 */
function transformFundingRound(row: any): FundingRound {
  return {
    id: row.id,
    name: row.name,
    pricePerToken: parseFloat(row.price_per_token),
    discountPercent: parseFloat(row.discount_percent),
    minInvestment: parseFloat(row.min_investment),
    maxInvestment: parseFloat(row.max_investment),
    targetRaise: parseFloat(row.target_raise),
    currentRaise: parseFloat(row.current_raise),
    startTime: new Date(row.start_time).getTime(),
    endTime: new Date(row.end_time).getTime(),
    vestingMonths: row.vesting_months,
    cliffMonths: row.cliff_months,
    status: row.status,
  };
}

/**
 * Transform database row to Investment type
 */
function transformInvestment(row: any): Investment {
  return {
    id: row.id,
    userId: row.user_id,
    roundId: row.round_id,
    roundName: row.round_name,
    investmentAmount: parseFloat(row.investment_amount),
    tokenAmount: parseFloat(row.token_amount),
    pricePerToken: parseFloat(row.price_per_token),
    timestamp: new Date(row.created_at).getTime(),
    vestingSchedule: {
      totalAmount: parseFloat(row.vesting_total),
      startTime: new Date(row.vesting_start_time).getTime(),
      cliffEndTime: new Date(row.vesting_cliff_end_time).getTime(),
      endTime: new Date(row.vesting_end_time).getTime(),
      claimedAmount: parseFloat(row.claimed_amount),
    },
    claimedAmount: parseFloat(row.claimed_amount),
    remainingAmount: parseFloat(row.remaining_amount),
  };
}

/**
 * Calculate round status dynamically (Application Layer)
 * This ensures status is always accurate without DB updates
 */
function calculateRoundStatus(round: any): FundingRound['status'] {
  const now = Date.now();
  const startTime = new Date(round.start_time).getTime();
  const endTime = new Date(round.end_time).getTime();
  const currentRaise = parseFloat(round.current_raise);
  const targetRaise = parseFloat(round.target_raise);
  
  // Check if manually cancelled
  if (round.status === 'cancelled') {
    return 'cancelled';
  }
  
  // Check if target reached
  if (currentRaise >= targetRaise) {
    return 'completed';
  }
  
  // Check time-based status
  if (now < startTime) {
    return 'upcoming';
  }
  
  if (now > endTime) {
    return 'completed';
  }
  
  return 'active';
}

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Get all funding rounds
 */
export async function getAllFundingRounds(): Promise<FundingRound[]> {
  const { data, error } = await supabase
    .from('funding_rounds')
    .select('*')
    .order('created_at', { ascending: true });
  
  if (error) {
    throw new AppError(500, {
      code: 'DATABASE_ERROR',
      message: 'Failed to fetch funding rounds',
      details: error.message,
    });
  }
  
  // Apply dynamic status calculation
  return data.map(row => {
    const round = transformFundingRound(row);
    round.status = calculateRoundStatus(row);
    return round;
  });
}

/**
 * Get active funding rounds (with dynamic status calculation)
 */
export async function getActiveFundingRounds(): Promise<FundingRound[]> {
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('funding_rounds')
    .select('*')
    .lte('start_time', now)
    .gte('end_time', now)
    .neq('status', 'cancelled');
  
  if (error) {
    throw new AppError(500, {
      code: 'DATABASE_ERROR',
      message: 'Failed to fetch active funding rounds',
      details: error.message,
    });
  }
  
  // Filter by actual active status (dynamic calculation)
  return data
    .map(row => {
      const round = transformFundingRound(row);
      round.status = calculateRoundStatus(row);
      return round;
    })
    .filter(round => round.status === 'active');
}

/**
 * Get funding round by ID
 */
export async function getFundingRound(roundId: string): Promise<FundingRound> {
  const { data, error } = await supabase
    .from('funding_rounds')
    .select('*')
    .eq('id', roundId)
    .single();
  
  // Supabase returns PGRST116 when no rows found
  if (error || !data) {
    // Check if it's a "not found" error vs other errors
    const isNotFound = error?.code === 'PGRST116' || !data;
    
    throw new AppError(isNotFound ? 404 : 500, {
      code: isNotFound ? 'NOT_FOUND' : 'DATABASE_ERROR',
      message: isNotFound 
        ? `Funding round ${roundId} not found`
        : 'Failed to fetch funding round',
      details: error?.message,
    });
  }
  
  const round = transformFundingRound(data);
  round.status = calculateRoundStatus(data);
  return round;
}

/**
 * Get user's investments
 */
export async function getUserInvestments(userId: string): Promise<Investment[]> {
  const { data, error } = await supabase
    .from('investments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new AppError(500, {
      code: 'DATABASE_ERROR',
      message: 'Failed to fetch user investments',
      details: error.message,
    });
  }
  
  return data.map(transformInvestment);
}

/**
 * Get investment by ID
 */
export async function getInvestment(investmentId: string): Promise<Investment> {
  const { data, error } = await supabase
    .from('investments')
    .select('*')
    .eq('id', investmentId)
    .single();
  
  // Supabase returns PGRST116 when no rows found
  if (error || !data) {
    const isNotFound = error?.code === 'PGRST116' || !data;
    
    throw new AppError(isNotFound ? 404 : 500, {
      code: isNotFound ? 'NOT_FOUND' : 'DATABASE_ERROR',
      message: isNotFound
        ? `Investment ${investmentId} not found`
        : 'Failed to fetch investment',
      details: error?.message,
    });
  }
  
  return transformInvestment(data);
}

// ============================================================================
// Pure Functions (No DB, No Changes)
// ============================================================================

/**
 * Calculate claimable amount from vesting (Pure Function)
 * This function has NO side effects and can be tested independently
 */
export function calculateClaimableAmount(investment: Investment): number {
  const now = Date.now();
  const schedule = investment.vestingSchedule;
  
  // Before cliff, nothing is claimable
  if (now < schedule.cliffEndTime) {
    return 0;
  }
  
  // After vesting end, everything is claimable
  if (now >= schedule.endTime) {
    return investment.remainingAmount;
  }
  
  // During vesting, calculate linear unlock
  const vestingDuration = schedule.endTime - schedule.cliffEndTime;
  const elapsedTime = now - schedule.cliffEndTime;
  const vestedPercent = elapsedTime / vestingDuration;
  
  const totalVested = schedule.totalAmount * vestedPercent;
  const claimable = totalVested - schedule.claimedAmount;
  
  return Math.max(0, Math.min(claimable, investment.remainingAmount));
}

// ============================================================================
// Statistics & Calculations
// ============================================================================

/**
 * Get all claimable amounts for user
 */
export async function getUserClaimableTokens(userId: string): Promise<{
  total: number;
  byInvestment: Array<{
    investmentId: string;
    roundName: string;
    claimable: number;
    totalVested: number;
    totalAmount: number;
  }>;
}> {
  const userInvestments = await getUserInvestments(userId);
  const now = Date.now();
  
  let total = 0;
  
  const byInvestment = userInvestments.map(inv => {
    const claimable = calculateClaimableAmount(inv);
    total += claimable;
    
    const schedule = inv.vestingSchedule;
    const vestingProgress = now < schedule.cliffEndTime
      ? 0
      : Math.min((now - schedule.cliffEndTime) / (schedule.endTime - schedule.cliffEndTime), 1);
    
    return {
      investmentId: inv.id,
      roundName: inv.roundName,
      claimable,
      totalVested: schedule.totalAmount * vestingProgress,
      totalAmount: schedule.totalAmount,
    };
  });
  
  return { total, byInvestment };
}

/**
 * Get funding round statistics
 */
export async function getFundingRoundStats() {
  const rounds = await getAllFundingRounds();
  
  const totalRaised = rounds.reduce((sum, r) => sum + r.currentRaise, 0);
  const totalTarget = rounds.reduce((sum, r) => sum + r.targetRaise, 0);
  
  return {
    totalRounds: rounds.length,
    activeRounds: rounds.filter(r => r.status === 'active').length,
    completedRounds: rounds.filter(r => r.status === 'completed').length,
    totalRaised,
    totalTarget,
    progress: totalTarget > 0 ? (totalRaised / totalTarget) * 100 : 0,
    rounds: rounds.map(r => ({
      name: r.name,
      status: r.status,
      raised: r.currentRaise,
      target: r.targetRaise,
      progress: r.targetRaise > 0 ? (r.currentRaise / r.targetRaise) * 100 : 0,
    })),
  };
}

// ============================================================================
// TODO: Write Operations (Phase 3)
// ============================================================================

/**
 * Initialize funding rounds (DEPRECATED - Use Migration SQL instead)
 * This function is kept for backward compatibility only
 */
export async function initializeFundingRounds(): Promise<void> {
  console.warn('⚠️  initializeFundingRounds() is deprecated. Use Migration SQL instead.');
  console.log('💎 Funding rounds should be initialized via Migration 20250120000004_seed_funding_rounds.sql');
}

/**
 * Participate in funding round (TODO: Implement in Phase 3)
 */
export async function participateInRound(
  userId: string,
  roundId: string,
  investmentAmount: number
): Promise<Investment> {
  throw new AppError(501, {
    code: 'NOT_IMPLEMENTED',
    message: 'participateInRound() will be implemented in Phase 3',
  });
}
