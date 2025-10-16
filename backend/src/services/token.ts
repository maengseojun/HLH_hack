// Token Service - Native token management

import { AppError } from '../utils/httpError.js';
import type {
  TokenHolder,
  TokenTransaction,
  TokenMetrics,
  NATIVE_TOKEN,
} from '../types/token.js';

// Mock database (in production, use Supabase)
const tokenHolders = new Map<string, TokenHolder>();
const tokenTransactions: TokenTransaction[] = [];

let totalSupply = 1_000_000_000; // 1 billion HI
let burnedAmount = 0;
let circulatingSupply = 0;

/**
 * Get or create token holder
 */
export function getTokenHolder(userId: string): TokenHolder {
  let holder = tokenHolders.get(userId);
  
  if (!holder) {
    holder = {
      userId,
      balance: 0,
      locked: 0,
      staked: 0,
      rewards: 0,
      investments: [],
    };
    tokenHolders.set(userId, holder);
  }
  
  return holder;
}

/**
 * Get token balance
 */
export function getBalance(userId: string): {
  available: number;
  locked: number;
  staked: number;
  rewards: number;
  total: number;
} {
  const holder = getTokenHolder(userId);
  
  return {
    available: holder.balance,
    locked: holder.locked,
    staked: holder.staked,
    rewards: holder.rewards,
    total: holder.balance + holder.locked + holder.staked,
  };
}

/**
 * Mint tokens (admin only)
 */
export function mintTokens(
  userId: string,
  amount: number,
  reason: string
): TokenTransaction {
  if (amount <= 0) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'Amount must be greater than 0'
    });
  }
  
  const holder = getTokenHolder(userId);
  holder.balance += amount;
  circulatingSupply += amount;
  
  const tx: TokenTransaction = {
    id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    type: 'mint',
    amount,
    to: userId,
    reason,
    timestamp: Date.now(),
  };
  
  tokenTransactions.push(tx);
  
  return tx;
}

/**
 * Burn tokens
 */
export function burnTokens(
  userId: string,
  amount: number,
  reason: string
): TokenTransaction {
  if (amount <= 0) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'Amount must be greater than 0'
    });
  }
  
  const holder = getTokenHolder(userId);
  
  if (holder.balance < amount) {
    throw new AppError(400, {
      code: 'INSUFFICIENT_FUNDS',
      message: `Insufficient balance. Have: ${holder.balance}, Need: ${amount}`
    });
  }
  
  holder.balance -= amount;
  burnedAmount += amount;
  circulatingSupply -= amount;
  
  const tx: TokenTransaction = {
    id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    type: 'burn',
    amount,
    from: userId,
    reason,
    timestamp: Date.now(),
  };
  
  tokenTransactions.push(tx);
  
  return tx;
}

/**
 * Transfer tokens
 */
export function transferTokens(
  fromUserId: string,
  toUserId: string,
  amount: number,
  reason: string = 'Transfer'
): TokenTransaction {
  if (amount <= 0) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'Amount must be greater than 0'
    });
  }
  
  const fromHolder = getTokenHolder(fromUserId);
  
  if (fromHolder.balance < amount) {
    throw new AppError(400, {
      code: 'INSUFFICIENT_FUNDS',
      message: `Insufficient balance. Have: ${fromHolder.balance}, Need: ${amount}`
    });
  }
  
  const toHolder = getTokenHolder(toUserId);
  
  fromHolder.balance -= amount;
  toHolder.balance += amount;
  
  const tx: TokenTransaction = {
    id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId: fromUserId,
    type: 'transfer',
    amount,
    from: fromUserId,
    to: toUserId,
    reason,
    timestamp: Date.now(),
  };
  
  tokenTransactions.push(tx);
  
  return tx;
}

/**
 * Lock tokens (for vesting)
 */
export function lockTokens(userId: string, amount: number): void {
  const holder = getTokenHolder(userId);
  
  if (holder.balance < amount) {
    throw new AppError(400, {
      code: 'INSUFFICIENT_FUNDS',
      message: 'Insufficient available balance to lock'
    });
  }
  
  holder.balance -= amount;
  holder.locked += amount;
}

/**
 * Unlock tokens (from vesting)
 */
export function unlockTokens(userId: string, amount: number): void {
  const holder = getTokenHolder(userId);
  
  if (holder.locked < amount) {
    throw new AppError(400, {
      code: 'INSUFFICIENT_FUNDS',
      message: 'Insufficient locked balance to unlock'
    });
  }
  
  holder.locked -= amount;
  holder.balance += amount;
}

/**
 * Claim tokens (from vesting schedule)
 */
export function claimTokens(
  userId: string,
  amount: number,
  source: string
): TokenTransaction {
  unlockTokens(userId, amount);
  
  const tx: TokenTransaction = {
    id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    type: 'claim',
    amount,
    to: userId,
    reason: `Claimed from ${source}`,
    timestamp: Date.now(),
  };
  
  tokenTransactions.push(tx);
  
  return tx;
}

/**
 * Get token metrics
 */
export function getTokenMetrics(): TokenMetrics {
  const stakedAmount = Array.from(tokenHolders.values()).reduce(
    (sum, holder) => sum + holder.staked,
    0
  );
  
  // Mock price - in production, get from oracle
  const priceUsd = 0.05;
  
  return {
    totalSupply,
    circulatingSupply,
    burnedAmount,
    stakedAmount,
    treasuryBalance: getBalance('treasury').total,
    priceUsd,
    marketCap: circulatingSupply * priceUsd,
    holders: tokenHolders.size,
  };
}

/**
 * Get transaction history
 */
export function getTransactionHistory(
  userId?: string,
  limit: number = 50
): TokenTransaction[] {
  let txs = tokenTransactions;
  
  if (userId) {
    txs = txs.filter(
      tx => tx.userId === userId || tx.from === userId || tx.to === userId
    );
  }
  
  return txs
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

/**
 * Get all token holders (for analytics)
 */
export function getAllHolders(): TokenHolder[] {
  return Array.from(tokenHolders.values());
}

/**
 * Initialize treasury
 */
export function initializeTreasury(amount: number): void {
  const treasury = getTokenHolder('treasury');
  
  if (treasury.balance === 0) {
    treasury.balance = amount;
    circulatingSupply += amount;
    
    console.log(`💰 Treasury initialized with ${amount.toLocaleString()} HI tokens`);
  }
}

/**
 * Get treasury balance
 */
export function getTreasuryBalance(): number {
  return getBalance('treasury').available;
}
