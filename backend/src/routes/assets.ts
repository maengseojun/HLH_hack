import { Router } from 'express';
import { z } from 'zod';
import { listAssets, getAsset } from '../services/assets.js';
import { getCandles } from '../services/hypercore.js';
import { resolvePresetRange } from '../utils/candlePresets.js';
import { AppError } from '../utils/httpError.js';

export const assetsRouter = Router();

assetsRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await listAssets();
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

assetsRouter.get('/:symbol', async (req, res, next) => {
  try {
    const parsed = z.object({ symbol: z.string().min(2) }).safeParse(req.params);
    if (!parsed.success) {
      throw new AppError(400, { code: 'BAD_REQUEST', message: 'symbol is required', details: parsed.error.flatten() });
    }
    const asset = await getAsset(parsed.data.symbol);
    res.json(asset);
  } catch (error) {
    next(error);
  }
});

assetsRouter.get('/:symbol/candles', async (req, res, next) => {
  try {
    const paramsSchema = z.object({ symbol: z.string().min(2) });
    const querySchema = z.object({ 
      interval: z.enum(['5m', '1h', '1d', '7d']).default('1d'),
      from: z.string().optional(),
      to: z.string().optional()
    });
    
    const paramsResult = paramsSchema.safeParse(req.params);
    const queryResult = querySchema.safeParse(req.query);
    
    if (!paramsResult.success) {
      throw new AppError(400, { code: 'BAD_REQUEST', message: 'symbol is required', details: paramsResult.error.flatten() });
    }
    if (!queryResult.success) {
      throw new AppError(400, { code: 'BAD_REQUEST', message: 'invalid query parameters', details: queryResult.error.flatten() });
    }
    
    const { symbol } = paramsResult.data;
    const { interval, from, to } = queryResult.data;
    
    const range = resolvePresetRange({ 
      interval, 
      from: from ? parseInt(from) : undefined, 
      to: to ? parseInt(to) : undefined 
    });
    
    // 자산 정보를 먼저 조회해서 marketType 확인
    const asset = await getAsset(symbol);
    const candles = await getCandles(symbol, interval, range.from, range.to, asset.marketType, asset.spotIndex);
    
    res.json({
      candles,
      meta: {
        symbol,
        interval,
        from: range.from,
        to: range.to,
        count: candles.length
      }
    });
  } catch (error) {
    next(error);
  }
});
