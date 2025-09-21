import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/httpError.js';
import { closePosition, openPosition, precheckOpen } from '../services/position.js';

export const positionsRouter = Router();

const openSchema = z.object({
  symbol: z.string().min(3),
  side: z.enum(['LONG', 'SHORT']),
  leverage: z.number().int().positive(),
  notionalUsd: z.number().positive(),
  slippageBps: z.number().int().min(0).max(500),
});

positionsRouter.post('/:indexId/positions/precheck', async (req, res, next) => {
  try {
    const parsed = openSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, { code: 'BAD_REQUEST', message: 'Invalid body', details: parsed.error.flatten() });
    }
    const result = await precheckOpen(req.params.indexId, parsed.data);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

positionsRouter.post('/:indexId/positions/open', async (req, res, next) => {
  try {
    const parsed = openSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, { code: 'BAD_REQUEST', message: 'Invalid body', details: parsed.error.flatten() });
    }
    const result = await openPosition(req.params.indexId, parsed.data);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

const closeSchema = z.object({
  symbol: z.string().min(3),
  closePercent: z.number().min(0).max(100).optional(),
  slippageBps: z.number().int().min(0).max(500),
});

positionsRouter.post('/:indexId/positions/close', async (req, res, next) => {
  try {
    const parsed = closeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, { code: 'BAD_REQUEST', message: 'Invalid body', details: parsed.error.flatten() });
    }
    const result = await closePosition(req.params.indexId, parsed.data);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
