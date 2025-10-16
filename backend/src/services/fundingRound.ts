// Funding Round Service - Investment management

import { AppError } from '../utils/httpError.js';
import type {
  FundingRound,
  Investment,
  VestingSchedule,
  DEFAULT_FUNDING_ROUNDS,
} from '../types/token.ts';
import { getTokenHolder, lockTokens, mintTokens } from './token.supabase.js';

// Mock database
const fundingRounds = new Map<string, FundingRound>();
const investments = new Map<string, Investment>();

/**
 * Initialize default funding rounds
 */
export function initializeFundingRounds(): void {
  if (fundingRounds.size > 0) return;
  
  const rounds: Omit<FundingRound, 'id' | 'currentRaise' | 'status'>[] = [
    {
      name: 'seed',
      pricePerToken: 0.01,
      discountPercent: 70,
      minInvestment: 1_000,
      maxInvestment: 50_000,
      targetRaise: 500_000,
      startTime: Date.now(),
      endTime: Date.now() + 30 * 24 * 60 * 60 * 1000,
      vestingMonths: 12,
      cliffMonths: 3,
    },
    {
      name: 'strategic',
      pricePerToken: 0.02,
      discountPercent: 40,
      minInvestment: 10_000,
      maxInvestment: 500_000,
      targetRaise: 2_000_000,
      startTime: Date.now() + 30 * 24 * 60 * 60 * 1000,
      endTime: Date.now() + 60 * 24 * 60 * 60 * 1000,
      vestingMonths: 18,
      cliffMonths: 6,
    },
    {
      name: 'public',
      pricePerToken: 0.05,
      discountPercent: 0,
      minInvestment: 100,
      maxInvestment: 100_000,
      targetRaise: 5_000_000,
      startTime: Date.now() + 60 * 24 * 60 * 60 * 1000,
      endTime: Date.now() + 90 * 24 * 60 * 60 * 1000,
      vestingMonths: 6,
      cliffMonths: 0,
    },
  ];
  
  rounds.forEach((round, index) => {
    const id = `round-${round.name}-${index}`;
    const now = Date.now();
    
    let status: FundingRound['status'];
    if (now < round.startTime) {
      status = 'upcoming';
    } else if (now >= round.startTime && now <= round.endTime) {
      status = 'active';
    } else {
      status = 'completed';
    }
    
    fundingRounds.set(id, {
      id,
      ...round,
      currentRaise: 0,
      status,
    });
  });
  
  console.log(`💎 Initialized ${rounds.length} funding rounds`);
}

/**
 * Get all funding rounds
 */
export function getAllFundingRounds(): FundingRound[] {
  return Array.from(fundingRounds.values());
}

/**
 * Get active funding rounds
 */
export function getActiveFundingRounds(): FundingRound[] {
  const now = Date.now();
  
  return Array.from(fundingRounds.values())
    .filter(round => round.status === 'active' && now >= round.startTime && now <= round.endTime);
}

/**
 * Get funding round by ID
 */
export function getFundingRound(roundId: string): FundingRound {
  const round = fundingRounds.get(roundId);
  
  if (!round) {
    throw new AppError(404, {
      code: 'BAD_REQUEST',
      message: `Funding round ${roundId} not found`
    });
  }
  
  return round;
}

/**
 * Participate in funding round
 */
export async function participateInRound(
  userId: string,
  roundId: string,
  investmentAmount: number
): Investment {
  const round = getFundingRound(roundId);
  const now = Date.now();
  
  // Check if round is active
  if (round.status !== 'active') {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: `Funding round ${round.name} is not active`
    });
  }
  
  if (now < round.startTime || now > round.endTime) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'Funding round is not currently accepting investments'
    });
  }
  
  // Check investment limits
  if (investmentAmount < round.minInvestment) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: `Minimum investment is $${round.minInvestment.toLocaleString()}`
    });
  }
  
  if (investmentAmount > round.maxInvestment) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: `Maximum investment is $${round.maxInvestment.toLocaleString()}`
    });
  }
  
  // Check if target reached
  if (round.currentRaise + investmentAmount > round.targetRaise) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'Funding round target would be exceeded'
    });
  }
  
  // Calculate token amount
  const tokenAmount = investmentAmount / round.pricePerToken;
  
  // Create vesting schedule
  const vestingSchedule: VestingSchedule = {
    totalAmount: tokenAmount,
    startTime: now,
    cliffEndTime: now + round.cliffMonths * 30 * 24 * 60 * 60 * 1000,
    endTime: now + round.vestingMonths * 30 * 24 * 60 * 60 * 1000,
    claimedAmount: 0,
  };
  
  // Create investment record
  const investment: Investment = {
    id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    roundId: round.id,
    roundName: round.name,
    investmentAmount,
    tokenAmount,
    pricePerToken: round.pricePerToken,
    timestamp: now,
    vestingSchedule,
    claimedAmount: 0,
    remainingAmount: tokenAmount,
  };
  
  // Update round
  round.currentRaise += investmentAmount;
  
  if (round.currentRaise >= round.targetRaise) {
    round.status = 'completed';
  }
  
  // Store investment
  investments.set(investment.id, investment);
  
  // Add to user's investments
  const holder = await getTokenHolder(userId);
  holder.investments.push(investment);
  
  // Mint and lock tokens
  await mintTokens(userId, tokenAmount, `Investment in ${round.name} round`);
  await lockTokens(userId, tokenAmount);
  
  return investment;
}

/**
 * Get user's investments
 */
export function getUserInvestments(userId: string): Investment[] {
  return Array.from(investments.values()).filter(inv => inv.userId === userId);
}

/**
 * Get investment by ID
 */
export function getInvestment(investmentId: string): Investment {
  const investment = investments.get(investmentId);
  
  if (!investment) {
    throw new AppError(404, {
      code: 'BAD_REQUEST',
      message: `Investment ${investmentId} not found`
    });
  }
  
  return investment;
}

/**
 * Calculate claimable amount from vesting
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

/**
 * Get all claimable amounts for user
 */
export function getUserClaimableTokens(userId: string): {
  total: number;
  byInvestment: Array<{
    investmentId: string;
    roundName: string;
    claimable: number;
    totalVested: number;
    totalAmount: number;
  }>;
} {
  const userInvestments = getUserInvestments(userId);
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
export function getFundingRoundStats() {
  const rounds = getAllFundingRounds();
  
  const totalRaised = rounds.reduce((sum, r) => sum + r.currentRaise, 0);
  const totalTarget = rounds.reduce((sum, r) => sum + r.targetRaise, 0);
  
  return {
    totalRounds: rounds.length,
    activeRounds: rounds.filter(r => r.status === 'active').length,
    completedRounds: rounds.filter(r => r.status === 'completed').length,
    totalRaised,
    totalTarget,
    progress: (totalRaised / totalTarget) * 100,
    rounds: rounds.map(r => ({
      name: r.name,
      status: r.status,
      raised: r.currentRaise,
      target: r.targetRaise,
      progress: (r.currentRaise / r.targetRaise) * 100,
    })),
  };
}
