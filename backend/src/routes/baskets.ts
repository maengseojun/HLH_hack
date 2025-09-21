import { Router } from 'express';
import { getCandles } from '../services/hypercore.js';
import { calcBasketFromCandles } from '../services/basket.js';
import { resolvePresetRange } from '../utils/candlePresets.js';
import type { Position } from '../types/domain.js';
import { AppError } from '../utils/httpError.js';
import {
  BasketCalculateRequestSchema,
  BasketCalculateResponseSchema,
  validateBody,
  sendValidated,
} from '../schemas/http.js';
import type { BasketCalculateRequest } from '../schemas/http.js';

const basketsRouter = Router();

basketsRouter.post('/calculate', validateBody(BasketCalculateRequestSchema), async (req, res, next) => {
  try {
    const { assets, interval, from, to } = (req.validated?.body ?? {}) as BasketCalculateRequest;
    const weightSum = assets.reduce((acc, asset) => acc + asset.weight, 0);
    if (Math.abs(weightSum - 1) > 1e-6) {
      throw new AppError(400, {
        code: 'WEIGHT_SUM_INVALID',
        message: 'Sum of weights must equal 1.0 (±1e-6)',
        details: { sum: weightSum },
      });
    }

    const range = resolvePresetRange({ interval, from, to });

    const inputs = await Promise.all(
      assets.map(async (asset) => ({
        symbol: asset.symbol,
        weight: asset.weight,
        position: asset.position as Position,
        leverage: asset.leverage,
        candles: await getCandles(asset.symbol, interval, range.from, range.to),
      })),
    );

    const result = calcBasketFromCandles(inputs);

    return sendValidated(res, BasketCalculateResponseSchema, {
      meta: {
        interval,
        request: { from: range.from, to: range.to },
        coinNormalization: 'SYMBOL-PERP->SYMBOL',
        leverageApplied: true,
        source: 'hyperliquid.info.candleSnapshot',
        rangeMs: range.durationMs,
        presetDurationMs: range.presetDurationMs,
        staleWhileRevalidate: true,
      },
      basketPriceHistory: result.basketPriceHistory,
      performance: {
        returnPct: result.basketReturnPct,
        maxDrawdown: result.maxDrawdown,
      },
      assets: result.assets,
    });
  } catch (error) {
    return next(error);
  }
});

export { basketsRouter };
