// Bonding Curve routes - L3 index trading

import { Router } from 'express';
import {
  calculateBuyPrice,
  calculateSellPrice,
  getPriceAtSupply,
  simulatePriceTrajectory,
  getDefaultHybridParams,
} from '../services/bondingCurve.js';
import {
  checkGraduationEligibility,
  getGraduationProgress,
  graduateIndex,
  estimateGraduationTime,
} from '../services/graduation.js';
import { getIndexById } from '../services/index.supabase.js';
import { AppError } from '../utils/httpError.js';
import type { L3Index } from '../types/index.js';

export const bondingCurveRouter = Router();

/**
 * GET /v1/bonding-curve/:indexId/price
 * Get current price for an L3 index
 */
bondingCurveRouter.get('/:indexId/price', async (req, res, next) => {
  try {
    const { indexId } = req.params;
    
    const index = await getIndexById(indexId);
    
    if (index.layer !== 'L3') {
      throw new AppError(400, {
        code: 'BAD_REQUEST',
        message: 'Bonding curve pricing only available for L3 indices'
      });
    }
    
    const l3Index = index as L3Index;
    const supply = l3Index.bondingCurve?.totalRaised || 0;
    
    res.json({
      success: true,
      data: {
        indexId,
        currentPrice: l3Index.bondingCurve?.currentPrice || 0,
        currentSupply: supply,
        marketCap: l3Index.bondingCurve?.currentMarketCap || 0,
        progress: l3Index.bondingCurve?.progress || 0,
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/bonding-curve/:indexId/quote/buy
 * Get buy quote (price estimation)
 */
bondingCurveRouter.post('/:indexId/quote/buy', async (req, res, next) => {
  try {
    const { indexId } = req.params;
    const { amount } = req.body;
    
    if (!amount || parseFloat(amount) <= 0) {
      throw new AppError(400, {
        code: 'BAD_REQUEST',
        message: 'Amount must be greater than 0'
      });
    }
    
    const index = await getIndexById(indexId);
    
    if (index.layer !== 'L3') {
      throw new AppError(400, {
        code: 'BAD_REQUEST',
        message: 'Bonding curve trading only available for L3 indices'
      });
    }
    
    const l3Index = index as L3Index;
    const supply = l3Index.bondingCurve?.totalRaised || 0;
    const params = l3Index.bondingCurve?.params || getDefaultHybridParams(1000000);
    
    const quote = calculateBuyPrice(supply, parseFloat(amount), params);
    
    res.json({
      success: true,
      data: {
        amount,
        pricePerToken: quote.pricePerToken.toFixed(6),
        averagePrice: quote.averagePrice.toFixed(6),
        totalCost: quote.totalCost.toFixed(2),
        newSupply: quote.newSupply,
        slippage: (((quote.pricePerToken - quote.averagePrice) / quote.averagePrice) * 100).toFixed(2) + '%',
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/bonding-curve/:indexId/quote/sell
 * Get sell quote (price estimation)
 */
bondingCurveRouter.post('/:indexId/quote/sell', async (req, res, next) => {
  try {
    const { indexId } = req.params;
    const { amount } = req.body;
    
    if (!amount || parseFloat(amount) <= 0) {
      throw new AppError(400, {
        code: 'BAD_REQUEST',
        message: 'Amount must be greater than 0'
      });
    }
    
    const index = await getIndexById(indexId);
    
    if (index.layer !== 'L3') {
      throw new AppError(400, {
        code: 'BAD_REQUEST',
        message: 'Bonding curve trading only available for L3 indices'
      });
    }
    
    const l3Index = index as L3Index;
    const supply = l3Index.bondingCurve?.totalRaised || 0;
    const params = l3Index.bondingCurve?.params || getDefaultHybridParams(1000000);
    
    const quote = calculateSellPrice(supply, parseFloat(amount), params);
    
    res.json({
      success: true,
      data: {
        amount,
        pricePerToken: quote.pricePerToken.toFixed(6),
        averagePrice: quote.averagePrice.toFixed(6),
        totalReturn: quote.totalReturn.toFixed(2),
        newSupply: quote.newSupply,
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/bonding-curve/:indexId/trajectory
 * Get price trajectory simulation
 */
bondingCurveRouter.get('/:indexId/trajectory', async (req, res, next) => {
  try {
    const { indexId } = req.params;
    const steps = parseInt(req.query.steps as string) || 100;
    
    const index = await getIndexById(indexId);
    
    if (index.layer !== 'L3') {
      throw new AppError(400, {
        code: 'BAD_REQUEST',
        message: 'Trajectory only available for L3 indices'
      });
    }
    
    const l3Index = index as L3Index;
    const params = l3Index.bondingCurve?.params || getDefaultHybridParams(1000000);
    const maxSupply = params.targetMarketCap / params.basePrice; // Estimate
    
    const trajectory = simulatePriceTrajectory(params, maxSupply, steps);
    
    res.json({
      success: true,
      data: {
        trajectory,
        params: {
          curveType: params.curveType,
          basePrice: params.basePrice,
          targetMarketCap: params.targetMarketCap,
        },
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/bonding-curve/:indexId/graduation
 * Check graduation eligibility and progress
 */
bondingCurveRouter.get('/:indexId/graduation', async (req, res, next) => {
  try {
    const { indexId } = req.params;
    
    const [progress, timeEstimate] = await Promise.all([
      getGraduationProgress(indexId),
      estimateGraduationTime(indexId),
    ]);
    
    res.json({
      success: true,
      data: {
        ...progress,
        estimatedDaysToGraduation: timeEstimate,
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/bonding-curve/:indexId/graduate
 * Graduate L3 index to L2 (requires auth)
 */
bondingCurveRouter.post('/:indexId/graduate', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { indexId } = req.params;
    
    if (!userId) {
      throw new AppError(401, {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    const l2Index = await graduateIndex(indexId, userId);
    
    req.log?.info({ indexId, l2IndexId: l2Index.id }, 'Index graduated successfully');
    
    res.json({
      success: true,
      data: {
        oldL3IndexId: indexId,
        newL2Index: l2Index,
        message: 'Congratulations! Your index has graduated to Layer 2',
      }
    });
  } catch (error) {
    next(error);
  }
});
