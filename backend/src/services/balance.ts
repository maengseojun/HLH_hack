// Balance service for HyperCore tokens
import { AppError } from '../utils/httpError.js';

// Mock balance data for MVP
// In production, this will query HyperCore RPC
interface TokenBalance {
  token: string;
  symbol: string;
  balance: string;
  balanceUsd: string;
}

/**
 * Get user's token balances
 * @param userId User ID
 * @returns List of token balances
 */
export async function getUserBalances(userId: string): Promise<TokenBalance[]> {
  // TODO: Implement actual HyperCore RPC call
  // For now, return mock data
  
  if (!userId) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'User ID is required'
    });
  }

  // Mock balances
  return [
    {
      token: '0x1111111111111111111111111111111111111111',
      symbol: 'USDC',
      balance: '1000.00',
      balanceUsd: '1000.00'
    },
    {
      token: '0x2222222222222222222222222222222222222222',
      symbol: 'HYPE',
      balance: '500.00',
      balanceUsd: '750.00'
    }
  ];
}

/**
 * Get balance for a specific token
 * @param userId User ID
 * @param tokenAddress Token contract address
 * @returns Token balance
 */
export async function getTokenBalance(
  userId: string,
  tokenAddress: string
): Promise<TokenBalance> {
  if (!userId || !tokenAddress) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'User ID and token address are required'
    });
  }

  // TODO: Implement actual HyperCore RPC call
  
  // Mock balance
  return {
    token: tokenAddress,
    symbol: 'USDC',
    balance: '1000.00',
    balanceUsd: '1000.00'
  };
}

/**
 * Get total portfolio value in USD
 * @param userId User ID
 * @returns Total value in USD
 */
export async function getPortfolioValue(userId: string): Promise<string> {
  const balances = await getUserBalances(userId);
  const total = balances.reduce((sum, b) => sum + parseFloat(b.balanceUsd), 0);
  return total.toFixed(2);
}
