// Token Service - Supabase version
// Native token (HI) management with PostgreSQL

import { supabase } from '../lib/supabase.js';

// System account IDs (fixed UUIDs)
export const SYSTEM_ACCOUNTS = {
  TREASURY: '00000000-0000-0000-0000-000000000001',
  BUYBACK_POOL: '00000000-0000-0000-0000-000000000002',
  STAKING_REWARDS: '00000000-0000-0000-0000-000000000003',
} as const;
import { AppError } from '../utils/httpError.js';
import type {
  TokenHolder,
  TokenTransaction,
  TokenMetrics,
} from '../types/token.js';

/**
 * Get or create token holder
 */
export async function getTokenHolder(userId: string): Promise<TokenHolder> {
  // Try to get existing holder
  const { data: holder, error } = await supabase
    .from('token_holders')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to fetch token holder: ${error.message}`
    });
  }
  
  // If not found, create new holder
  if (!holder) {
    // First ensure user exists
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (!user) {
      // Create a placeholder user for system accounts (treasury, etc.)
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: userId,
          privy_user_id: `system-${userId}`,
          wallet_address: `system-${userId}`,
        });
      
      if (userError && userError.code !== '23505') { // Ignore duplicate
        throw new AppError(500, {
          code: 'DB_ERROR',
          message: `Failed to create system user: ${userError.message}`
        });
      }
    }
    
    // Create token holder
    const { data: newHolder, error: createError } = await supabase
      .from('token_holders')
      .insert({
        user_id: userId,
        balance: 0,
        locked: 0,
        staked: 0,
        rewards: 0,
      })
      .select()
      .single();
    
    if (createError) {
      throw new AppError(500, {
        code: 'DB_ERROR',
        message: `Failed to create token holder: ${createError.message}`
      });
    }
    
    return {
      userId: newHolder.user_id,
      balance: parseFloat(newHolder.balance),
      locked: parseFloat(newHolder.locked),
      staked: parseFloat(newHolder.staked),
      rewards: parseFloat(newHolder.rewards),
      investments: [],
    };
  }
  
  // Return existing holder
  return {
    userId: holder.user_id,
    balance: parseFloat(holder.balance),
    locked: parseFloat(holder.locked),
    staked: parseFloat(holder.staked),
    rewards: parseFloat(holder.rewards),
    investments: [],
  };
}

/**
 * Get token balance
 */
export async function getBalance(userId: string): Promise<{
  available: number;
  locked: number;
  staked: number;
  rewards: number;
  total: number;
}> {
  const holder = await getTokenHolder(userId);
  
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
export async function mintTokens(
  userId: string,
  amount: number,
  reason: string
): Promise<TokenTransaction> {
  if (amount <= 0) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'Amount must be greater than 0'
    });
  }
  
  // Get or create holder
  const holder = await getTokenHolder(userId);
  
  // Update balance (read-modify-write)
  const newBalance = holder.balance + amount;
  
  const { error: updateError } = await supabase
    .from('token_holders')
    .update({
      balance: newBalance
    })
    .eq('user_id', userId);
  
  if (updateError) {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to mint tokens: ${updateError.message}`
    });
  }
  
  // Record transaction
  const { data: tx, error: txError } = await supabase
    .from('token_transactions')
    .insert({
      user_id: userId,
      type: 'mint',
      amount: amount,
      to_user: userId,
      reason: reason,
    })
    .select()
    .single();
  
  if (txError) {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to record transaction: ${txError.message}`
    });
  }
  
  return {
    id: tx.id,
    userId: tx.user_id,
    type: 'mint',
    amount: parseFloat(tx.amount),
    to: tx.to_user,
    reason: tx.reason,
    timestamp: new Date(tx.created_at).getTime(),
  };
}

/**
 * Burn tokens
 */
export async function burnTokens(
  userId: string,
  amount: number,
  reason: string
): Promise<TokenTransaction> {
  if (amount <= 0) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'Amount must be greater than 0'
    });
  }
  
  const holder = await getTokenHolder(userId);
  
  if (holder.balance < amount) {
    throw new AppError(400, {
      code: 'INSUFFICIENT_FUNDS',
      message: `Insufficient balance. Have: ${holder.balance}, Need: ${amount}`
    });
  }
  
  // Update balance (subtract)
  const { data, error: updateError } = await supabase
    .from('token_holders')
    .update({
      balance: holder.balance - amount
    })
    .eq('user_id', userId)
    .select();
  
  if (updateError) {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to burn tokens: ${updateError.message}`
    });
  }
  
  // Record transaction
  const { data: tx, error: txError } = await supabase
    .from('token_transactions')
    .insert({
      user_id: userId,
      type: 'burn',
      amount: amount,
      from_user: userId,
      reason: reason,
    })
    .select()
    .single();
  
  if (txError) {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to record transaction: ${txError.message}`
    });
  }
  
  return {
    id: tx.id,
    userId: tx.user_id,
    type: 'burn',
    amount: parseFloat(tx.amount),
    from: tx.from_user,
    reason: tx.reason,
    timestamp: new Date(tx.created_at).getTime(),
  };
}

/**
 * Transfer tokens
 */
export async function transferTokens(
  fromUserId: string,
  toUserId: string,
  amount: number,
  reason: string = 'Transfer'
): Promise<TokenTransaction> {
  if (amount <= 0) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'Amount must be greater than 0'
    });
  }
  
  const fromHolder = await getTokenHolder(fromUserId);
  
  if (fromHolder.balance < amount) {
    throw new AppError(400, {
      code: 'INSUFFICIENT_FUNDS',
      message: `Insufficient balance. Have: ${fromHolder.balance}, Need: ${amount}`
    });
  }
  
  // Ensure recipient exists
  const toHolder = await getTokenHolder(toUserId);
  
  // Subtract from sender
  const { error: fromError } = await supabase
    .from('token_holders')
    .update({
      balance: fromHolder.balance - amount
    })
    .eq('user_id', fromUserId);
  
  if (fromError) {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to deduct tokens: ${fromError.message}`
    });
  }
  
  // Add to recipient
  const { error: toError } = await supabase
    .from('token_holders')
    .update({
      balance: toHolder.balance + amount
    })
    .eq('user_id', toUserId);
  
  if (toError) {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to add tokens: ${toError.message}`
    });
  }
  
  // Record transaction
  const { data: tx, error: txError } = await supabase
    .from('token_transactions')
    .insert({
      user_id: fromUserId,
      type: 'transfer',
      amount: amount,
      from_user: fromUserId,
      to_user: toUserId,
      reason: reason,
    })
    .select()
    .single();
  
  if (txError) {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to record transaction: ${txError.message}`
    });
  }
  
  return {
    id: tx.id,
    userId: tx.user_id,
    type: 'transfer',
    amount: parseFloat(tx.amount),
    from: tx.from_user,
    to: tx.to_user,
    reason: tx.reason,
    timestamp: new Date(tx.created_at).getTime(),
  };
}

/**
 * Lock tokens (for vesting)
 */
export async function lockTokens(userId: string, amount: number): Promise<void> {
  const holder = await getTokenHolder(userId);
  
  if (holder.balance < amount) {
    throw new AppError(400, {
      code: 'INSUFFICIENT_FUNDS',
      message: 'Insufficient available balance to lock'
    });
  }
  
  const { error } = await supabase
    .from('token_holders')
    .update({
      balance: holder.balance - amount,
      locked: holder.locked + amount,
    })
    .eq('user_id', userId);
  
  if (error) {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to lock tokens: ${error.message}`
    });
  }
}

/**
 * Unlock tokens (from vesting)
 */
export async function unlockTokens(userId: string, amount: number): Promise<void> {
  const holder = await getTokenHolder(userId);
  
  if (holder.locked < amount) {
    throw new AppError(400, {
      code: 'INSUFFICIENT_FUNDS',
      message: 'Insufficient locked balance to unlock'
    });
  }
  
  const { error } = await supabase
    .from('token_holders')
    .update({
      locked: holder.locked - amount,
      balance: holder.balance + amount,
    })
    .eq('user_id', userId);
  
  if (error) {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to unlock tokens: ${error.message}`
    });
  }
}

/**
 * Claim tokens (from vesting schedule)
 */
export async function claimTokens(
  userId: string,
  amount: number,
  source: string
): Promise<TokenTransaction> {
  await unlockTokens(userId, amount);
  
  const { data: tx, error: txError } = await supabase
    .from('token_transactions')
    .insert({
      user_id: userId,
      type: 'claim',
      amount: amount,
      to_user: userId,
      reason: `Claimed from ${source}`,
    })
    .select()
    .single();
  
  if (txError) {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to record claim: ${txError.message}`
    });
  }
  
  return {
    id: tx.id,
    userId: tx.user_id,
    type: 'claim',
    amount: parseFloat(tx.amount),
    to: tx.to_user,
    reason: tx.reason,
    timestamp: new Date(tx.created_at).getTime(),
  };
}

/**
 * Get token metrics
 */
export async function getTokenMetrics(): Promise<TokenMetrics> {
  // Calculate totals from all holders
  const { data: holders, error } = await supabase
    .from('token_holders')
    .select('balance, locked, staked');
  
  if (error) {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to fetch metrics: ${error.message}`
    });
  }
  
  let circulatingSupply = 0;
  let stakedAmount = 0;
  
  holders?.forEach(holder => {
    circulatingSupply += parseFloat(holder.balance) + parseFloat(holder.locked);
    stakedAmount += parseFloat(holder.staked);
  });
  
  // Get burned amount from burn transactions
  const { data: burnTxs } = await supabase
    .from('token_transactions')
    .select('amount')
    .eq('type', 'burn');
  
  const burnedAmount = burnTxs?.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) || 0;
  
  // Constants
  const totalSupply = 1_000_000_000; // 1 billion HI
  const priceUsd = 0.05; // Mock price
  
  // Get treasury balance
  const treasuryBalance = await getBalance(SYSTEM_ACCOUNTS.TREASURY);
  
  // Count unique holders
  const { count } = await supabase
    .from('token_holders')
    .select('user_id', { count: 'exact', head: true })
    .gt('balance', 0);
  
  return {
    totalSupply,
    circulatingSupply,
    burnedAmount,
    stakedAmount,
    treasuryBalance: treasuryBalance.total,
    priceUsd,
    marketCap: circulatingSupply * priceUsd,
    holders: count || 0,
  };
}

/**
 * Get transaction history
 */
export async function getTransactionHistory(
  userId?: string,
  limit: number = 50
): Promise<TokenTransaction[]> {
  let query = supabase
    .from('token_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (userId) {
    query = query.or(`user_id.eq.${userId},from_user.eq.${userId},to_user.eq.${userId}`);
  }
  
  const { data: txs, error } = await query;
  
  if (error) {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to fetch transactions: ${error.message}`
    });
  }
  
  return txs.map(tx => ({
    id: tx.id,
    userId: tx.user_id,
    type: tx.type as any,
    amount: parseFloat(tx.amount),
    from: tx.from_user || undefined,
    to: tx.to_user || undefined,
    reason: tx.reason,
    timestamp: new Date(tx.created_at).getTime(),
  }));
}

/**
 * Get all token holders (for analytics)
 */
export async function getAllHolders(): Promise<TokenHolder[]> {
  const { data: holders, error } = await supabase
    .from('token_holders')
    .select('*')
    .gt('balance', 0);
  
  if (error) {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to fetch holders: ${error.message}`
    });
  }
  
  return holders.map(h => ({
    userId: h.user_id,
    balance: parseFloat(h.balance),
    locked: parseFloat(h.locked),
    staked: parseFloat(h.staked),
    rewards: parseFloat(h.rewards),
    investments: [],
  }));
}

/**
 * Initialize treasury
 */
export async function initializeTreasury(amount: number): Promise<void> {
  const treasuryBalance = await getBalance(SYSTEM_ACCOUNTS.TREASURY);
  
  if (treasuryBalance.available === 0) {
    await mintTokens(SYSTEM_ACCOUNTS.TREASURY, amount, 'Treasury initialization');
    console.log(`💰 Treasury initialized with ${amount.toLocaleString()} HI tokens`);
  }
}

/**
 * Get treasury balance
 */
export async function getTreasuryBalance(): Promise<number> {
  const balance = await getBalance(SYSTEM_ACCOUNTS.TREASURY);
  return balance.available;
}
