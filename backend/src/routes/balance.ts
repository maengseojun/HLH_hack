// Balance routes
import { Router } from 'express';
import {
  getUserBalances,
  getTokenBalance,
  getPortfolioValue
} from '../services/balance.js';
import { AppError } from '../utils/httpError.js';

export const balanceRouter = Router();

/**
 * GET /v1/balance
 * Get user's all token balances
 */
balanceRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const balances = await getUserBalances(userId);

    res.json({
      success: true,
      data: balances
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/balance/:tokenAddress
 * Get balance for a specific token
 */
balanceRouter.get('/:tokenAddress', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const { tokenAddress } = req.params;

    const balance = await getTokenBalance(userId, tokenAddress);

    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/balance/portfolio/value
 * Get total portfolio value in USD
 */
balanceRouter.get('/portfolio/value', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const value = await getPortfolioValue(userId);

    res.json({
      success: true,
      data: {
        totalValueUsd: value
      }
    });
  } catch (error) {
    next(error);
  }
});
