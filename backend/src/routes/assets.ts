import { Router } from 'express';
import { z } from 'zod';
import { listAssets, getAsset } from '../services/assets.js';
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
