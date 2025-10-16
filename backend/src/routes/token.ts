// Token routes - Native token API
// ✅ MIGRATED TO SUPABASE

import { Router } from 'express';
import {
  getBalance,
  getTokenMetrics,
  getTransactionHistory,
  claimTokens,
  initializeTreasury,
} from '../services/token.supabase.js'; // ← Supabase version!
import {
  initializeFundingRounds,
  getAllFundingRounds,
  getActiveFundingRounds,
  getFundingRound,
  participateInRound,
  getUserInvestments,
  getUserClaimableTokens,
  getFundingRoundStats,
  calculateClaimableAmount,
  getInvestment,
} from '../services/fundingRound.js';
import {
  getFeeStats,
  getBuybackStats,
  getFeeConfig,
  getBuybackConfig,
  executeBuyback,
  simulateBuybackSchedule,
} from '../services/feeCollection.js';
import { AppError } from '../utils/httpError.js';

export const tokenRouter = Router();

// Initialize on first load (async)
(async () => {
  await initializeTreasury(100_000_000); // 100M tokens
  initializeFundingRounds();
})();

/**
 * GET /v1/token/balance
 * Get user's token balance
 * ✅ Using Supabase
 */
tokenRouter.get('/balance', async (req, res, next) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      throw new AppError(401, {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    const balance = await getBalance(userId);
    
    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/token/metrics
 * Get token metrics
 * ✅ Using Supabase
 */
tokenRouter.get('/metrics', async (req, res, next) => {
  try {
    const metrics = await getTokenMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/token/transactions
 * Get transaction history
 * ✅ Using Supabase
 */
tokenRouter.get('/transactions', async (req, res, next) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const transactions = await getTransactionHistory(userId, limit);
    
    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/token/funding-rounds
 * Get all funding rounds
 */
tokenRouter.get('/funding-rounds', async (req, res, next) => {
  try {
    const activeOnly = req.query.active === 'true';
    
    const rounds = activeOnly ? getActiveFundingRounds() : getAllFundingRounds();
    
    res.json({
      success: true,
      data: rounds
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/token/funding-rounds/stats
 * Get funding round statistics
 */
tokenRouter.get('/funding-rounds/stats', async (req, res, next) => {
  try {
    const stats = getFundingRoundStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/token/funding-rounds/:roundId
 * Get specific funding round
 */
tokenRouter.get('/funding-rounds/:roundId', async (req, res, next) => {
  try {
    const { roundId } = req.params;
    
    const round = getFundingRound(roundId);
    
    res.json({
      success: true,
      data: round
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/token/funding-rounds/:roundId/participate
 * Participate in funding round
 */
tokenRouter.post('/funding-rounds/:roundId/participate', async (req, res, next) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      throw new AppError(401, {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    const { roundId } = req.params;
    const { amount } = req.body;
    
    if (!amount || parseFloat(amount) <= 0) {
      throw new AppError(400, {
        code: 'BAD_REQUEST',
        message: 'Investment amount must be greater than 0'
      });
    }
    
    const investment = await participateInRound(userId, roundId, parseFloat(amount));
    
    req.log?.info({
      userId,
      roundId,
      amount,
      tokenAmount: investment.tokenAmount,
    }, 'User participated in funding round');
    
    res.json({
      success: true,
      data: investment,
      message: 'Successfully invested in funding round'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/token/investments
 * Get user's investments
 */
tokenRouter.get('/investments', async (req, res, next) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      throw new AppError(401, {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    const investments = getUserInvestments(userId);
    
    res.json({
      success: true,
      data: investments
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/token/claimable
 * Get claimable tokens from vesting
 */
tokenRouter.get('/claimable', async (req, res, next) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      throw new AppError(401, {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    const claimable = getUserClaimableTokens(userId);
    
    res.json({
      success: true,
      data: claimable
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/token/claim/:investmentId
 * Claim vested tokens
 * ✅ Using Supabase
 */
tokenRouter.post('/claim/:investmentId', async (req, res, next) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      throw new AppError(401, {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    const { investmentId } = req.params;
    
    const investment = getInvestment(investmentId);
    
    if (investment.userId !== userId) {
      throw new AppError(403, {
        code: 'UNAUTHORIZED',
        message: 'Not authorized to claim this investment'
      });
    }
    
    const claimableAmount = calculateClaimableAmount(investment);
    
    if (claimableAmount <= 0) {
      throw new AppError(400, {
        code: 'BAD_REQUEST',
        message: 'No tokens available to claim yet'
      });
    }
    
    const tx = await claimTokens(userId, claimableAmount, `${investment.roundName} vesting`);
    
    // Update investment
    investment.claimedAmount += claimableAmount;
    investment.remainingAmount -= claimableAmount;
    investment.vestingSchedule.claimedAmount += claimableAmount;
    
    req.log?.info({
      userId,
      investmentId,
      amount: claimableAmount,
    }, 'User claimed vested tokens');
    
    res.json({
      success: true,
      data: {
        transaction: tx,
        claimedAmount: claimableAmount,
        remainingAmount: investment.remainingAmount,
      },
      message: `Successfully claimed ${claimableAmount.toFixed(2)} HI tokens`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/token/fees/stats
 * Get fee collection statistics
 */
tokenRouter.get('/fees/stats', async (req, res, next) => {
  try {
    const feeStats = getFeeStats();
    const feeConfig = getFeeConfig();
    
    res.json({
      success: true,
      data: {
        stats: feeStats,
        config: feeConfig,
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/token/buyback/stats
 * Get buyback statistics
 */
tokenRouter.get('/buyback/stats', async (req, res, next) => {
  try {
    const buybackStats = getBuybackStats();
    const buybackConfig = getBuybackConfig();
    
    res.json({
      success: true,
      data: {
        stats: buybackStats,
        config: buybackConfig,
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/token/buyback/execute
 * Execute buyback (admin only)
 */
tokenRouter.post('/buyback/execute', async (req, res, next) => {
  try {
    const userId = req.userId;
    
    // TODO: Add admin check
    if (!userId) {
      throw new AppError(401, {
        code: 'UNAUTHORIZED',
        message: 'Admin authentication required'
      });
    }
    
    const result = await executeBuyback();
    
    if (result.success) {
      req.log?.info({
        amountBuyback: result.amountBuyback,
        amountBurned: result.amountBurned,
        amountLP: result.amountLP,
      }, 'Buyback executed successfully');
    }
    
    res.json({
      success: result.success,
      data: result,
      message: result.success ? 'Buyback executed successfully' : result.reason
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/token/buyback/schedule
 * Get simulated buyback schedule
 */
tokenRouter.get('/buyback/schedule', async (req, res, next) => {
  try {
    const weeks = parseInt(req.query.weeks as string) || 12;
    
    const schedule = await simulateBuybackSchedule(weeks);
    
    res.json({
      success: true,
      data: schedule
    });
  } catch (error) {
    next(error);
  }
});
