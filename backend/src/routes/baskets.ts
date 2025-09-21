import { Router } from 'express';
import { z } from 'zod';
import { getCandles } from '../services/hypercore.js';
import { calcBasketFromCandles } from '../services/basket.js';
import { AppError } from '../utils/httpError.js';
import { resolvePresetRange } from '../utils/candlePresets.js';
import type { Position } from '../types/domain.js';

const assetSchema = z.object({
  symbol: z.string().min(1),
  weight: z.number().min(0),
  position: z.enum(['long', 'short']),
  leverage: z.number().min(1).optional(),
});

const bodySchema = z.object({
  assets: z.array(assetSchema).min(1),
  interval: z.enum(['1h', '1d', '7d']).default('7d'),
  from: z.number().optional(),
  to: z.number().optional(),
});

const basketsRouter = Router();

basketsRouter.post('/calculate', async (req, res, next) => {
  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, {
        code: 'BAD_REQUEST',
        message: 'Request body validation failed',
        details: parsed.error.flatten(),
      });
    }

    const { assets, interval, from, to } = parsed.data;
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

    return res.json({
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
