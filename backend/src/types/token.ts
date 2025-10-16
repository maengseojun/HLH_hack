// Native Token Types and Economics

/**
 * Native token symbol and decimals
 */
export const NATIVE_TOKEN = {
  symbol: 'HI',
  name: 'HyperIndex Token',
  decimals: 18,
  totalSupply: 1_000_000_000, // 1 billion tokens
};

/**
 * Token allocation breakdown
 */
export interface TokenAllocation {
  category: 'team' | 'investors' | 'community' | 'foundation' | 'treasury';
  percentage: number;
  amount: number;
  vestingMonths: number;
  cliffMonths: number;
}

/**
 * Default token allocation (based on industry standards)
 */
export const DEFAULT_TOKEN_ALLOCATION: TokenAllocation[] = [
  {
    category: 'team',
    percentage: 20,
    amount: 200_000_000,
    vestingMonths: 36,
    cliffMonths: 12,
  },
  {
    category: 'investors',
    percentage: 20,
    amount: 200_000_000,
    vestingMonths: 24,
    cliffMonths: 6,
  },
  {
    category: 'community',
    percentage: 35,
    amount: 350_000_000,
    vestingMonths: 48,
    cliffMonths: 0, // Immediate distribution starts
  },
  {
    category: 'foundation',
    percentage: 15,
    amount: 150_000_000,
    vestingMonths: 48,
    cliffMonths: 0,
  },
  {
    category: 'treasury',
    percentage: 10,
    amount: 100_000_000,
    vestingMonths: 0,
    cliffMonths: 0, // Liquid for operations
  },
];

/**
 * Funding round details
 */
export interface FundingRound {
  id: string;
  name: 'seed' | 'strategic' | 'public';
  pricePerToken: number;
  discountPercent: number;
  minInvestment: number;
  maxInvestment: number;
  targetRaise: number;
  currentRaise: number;
  startTime: number;
  endTime: number;
  vestingMonths: number;
  cliffMonths: number;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
}

/**
 * Default funding rounds (MVP)
 */
export const DEFAULT_FUNDING_ROUNDS: Omit<FundingRound, 'id' | 'currentRaise' | 'status'>[] = [
  {
    name: 'seed',
    pricePerToken: 0.01,      // $0.01 per token
    discountPercent: 70,       // 70% discount from public price
    minInvestment: 1_000,      // $1k minimum
    maxInvestment: 50_000,     // $50k maximum
    targetRaise: 500_000,      // $500k target
    startTime: Date.now(),
    endTime: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    vestingMonths: 12,
    cliffMonths: 3,
  },
  {
    name: 'strategic',
    pricePerToken: 0.02,       // $0.02 per token
    discountPercent: 40,       // 40% discount
    minInvestment: 10_000,     // $10k minimum
    maxInvestment: 500_000,    // $500k maximum
    targetRaise: 2_000_000,    // $2M target
    startTime: Date.now() + 30 * 24 * 60 * 60 * 1000,
    endTime: Date.now() + 60 * 24 * 60 * 60 * 1000, // 60 days
    vestingMonths: 18,
    cliffMonths: 6,
  },
  {
    name: 'public',
    pricePerToken: 0.05,       // $0.05 per token (base price)
    discountPercent: 0,        // No discount
    minInvestment: 100,        // $100 minimum
    maxInvestment: 100_000,    // $100k maximum
    targetRaise: 5_000_000,    // $5M target
    startTime: Date.now() + 60 * 24 * 60 * 60 * 1000,
    endTime: Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days
    vestingMonths: 6,
    cliffMonths: 0, // Immediate TGE
  },
];

/**
 * Investor participation in funding round
 */
export interface Investment {
  id: string;
  userId: string;
  roundId: string;
  roundName: 'seed' | 'strategic' | 'public';
  investmentAmount: number; // USD
  tokenAmount: number; // HI tokens
  pricePerToken: number;
  timestamp: number;
  
  // Vesting details
  vestingSchedule: VestingSchedule;
  claimedAmount: number;
  remainingAmount: number;
}

/**
 * Vesting schedule
 */
export interface VestingSchedule {
  totalAmount: number;
  startTime: number;
  cliffEndTime: number;
  endTime: number;
  claimedAmount: number;
}

/**
 * Fee structure in native token
 */
export interface FeeCollectionConfig {
  // Trading fees (collected in native token)
  swapFeePercent: number;          // e.g., 0.3% of swap value
  rebalancingFeePercent: number;   // e.g., 0.5% of rebalancing
  
  // Index management fees (annual, in native token)
  l1ManagementFee: number;         // 0.7% annually
  l2ManagementFee: number;         // 1% annually
  l3ManagementFee: number;         // 2% annually
  l3PerformanceFee: number;        // 20% of profits
  
  // Distribution
  treasuryShare: number;           // % to treasury
  buybackShare: number;            // % for buyback
  stakingRewardShare: number;      // % for stakers
}

export const DEFAULT_FEE_CONFIG: FeeCollectionConfig = {
  swapFeePercent: 0.003,           // 0.3%
  rebalancingFeePercent: 0.005,    // 0.5%
  l1ManagementFee: 0.007,          // 0.7%
  l2ManagementFee: 0.01,           // 1%
  l3ManagementFee: 0.02,           // 2%
  l3PerformanceFee: 0.2,           // 20%
  treasuryShare: 0.4,              // 40% to treasury
  buybackShare: 0.3,               // 30% for buyback
  stakingRewardShare: 0.3,         // 30% for staking rewards
};

/**
 * Buy-back configuration
 */
export interface BuybackConfig {
  enabled: boolean;
  minTreasuryBalance: number;      // Min balance before buyback
  buybackPercentPerWeek: number;   // % of treasury to use weekly
  priceThreshold: number;          // Only buyback below this price
  burnPercentage: number;          // % to burn vs LP
}

export const DEFAULT_BUYBACK_CONFIG: BuybackConfig = {
  enabled: true,
  minTreasuryBalance: 10_000,      // $10k minimum
  buybackPercentPerWeek: 0.1,      // 10% per week
  priceThreshold: 0.04,            // Buyback if < $0.04
  burnPercentage: 0.5,             // 50% burn, 50% LP
};

/**
 * Token holder information
 */
export interface TokenHolder {
  userId: string;
  balance: number;                 // Available balance
  locked: number;                  // Vesting/locked balance
  staked: number;                  // Staked balance
  rewards: number;                 // Unclaimed rewards
  investments: Investment[];       // Funding round investments
}

/**
 * Token transaction
 */
export interface TokenTransaction {
  id: string;
  userId: string;
  type: 'mint' | 'burn' | 'transfer' | 'claim' | 'stake' | 'unstake' | 'reward';
  amount: number;
  from?: string;
  to?: string;
  reason: string;
  timestamp: number;
  txHash?: string;
}

/**
 * Staking configuration
 */
export interface StakingConfig {
  enabled: boolean;
  minStakeAmount: number;
  lockPeriodDays: number;
  aprPercent: number;              // Annual percentage rate
  earlyUnstakePenalty: number;     // % penalty for early unstake
}

export const DEFAULT_STAKING_CONFIG: StakingConfig = {
  enabled: true,
  minStakeAmount: 100,             // 100 HI minimum
  lockPeriodDays: 30,              // 30 days lock
  aprPercent: 15,                  // 15% APR
  earlyUnstakePenalty: 0.1,        // 10% penalty
};

/**
 * Token metrics
 */
export interface TokenMetrics {
  totalSupply: number;
  circulatingSupply: number;
  burnedAmount: number;
  stakedAmount: number;
  treasuryBalance: number;
  priceUsd: number;
  marketCap: number;
  holders: number;
}
