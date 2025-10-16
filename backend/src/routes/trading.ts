// Trading routes
import { Router } from 'express';
import {
  executeSwap,
  createOrder,
  getUserOrders,
  cancelOrder,
  getPoolInfo,
  type SwapParams,
  type OrderParams
} from '../services/trading.js';
import { AppError } from '../utils/httpError.js';

export const tradingRouter = Router();

/**
 * POST /v1/trading/swap
 * Execute an AMM swap
 */
tradingRouter.post('/swap', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const { fromToken, toToken, amount, slippage } = req.body;

    const params: SwapParams = {
      userId,
      fromToken,
      toToken,
      amount,
      slippage
    };

    const result = await executeSwap(params);

    req.log?.info({ orderId: result.orderId }, 'Swap executed successfully');

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/trading/orders
 * Create a new order
 */
tradingRouter.post('/orders', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const { pair, side, type, amount, price } = req.body;

    const params: OrderParams = {
      userId,
      pair,
      side,
      type,
      amount,
      price
    };

    const order = await createOrder(params);

    req.log?.info({ orderId: order.id }, 'Order created successfully');

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/trading/orders
 * Get user's orders
 */
tradingRouter.get('/orders', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const status = req.query.status as any;

    const orders = await getUserOrders(userId, status);

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /v1/trading/orders/:orderId
 * Cancel an order
 */
tradingRouter.delete('/orders/:orderId', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const { orderId } = req.params;

    const order = await cancelOrder(userId, orderId);

    req.log?.info({ orderId }, 'Order cancelled successfully');

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/trading/pools/:pair
 * Get AMM pool information
 */
tradingRouter.get('/pools/:pair', async (req, res, next) => {
  try {
    const { pair } = req.params;

    const poolInfo = await getPoolInfo(pair);

    res.json({
      success: true,
      data: poolInfo
    });
  } catch (error) {
    next(error);
  }
});
