import { Router } from 'express';
import { closePosition, openPosition, precheckOpen } from '../services/position.js';
import {
  OpenPositionRequestSchema,
  OpenPositionResponseSchema,
  PrecheckOpenResponseSchema,
  ClosePositionRequestSchema,
  ClosePositionResponseSchema,
  validateBody,
  sendValidated,
} from '../schemas/http.js';
import type { OpenPositionRequest, ClosePositionRequest } from '../schemas/http.js';

export const positionsRouter = Router();

positionsRouter.post(
  '/:indexId/positions/precheck',
  validateBody(OpenPositionRequestSchema),
  async (req, res, next) => {
  try {
    const body = (req.validated?.body ?? {}) as OpenPositionRequest;
    const result = await precheckOpen(req.params.indexId, body);
    return sendValidated(res, PrecheckOpenResponseSchema, result);
  } catch (error) {
    return next(error);
  }
  },
);

positionsRouter.post(
  '/:indexId/positions/open',
  validateBody(OpenPositionRequestSchema),
  async (req, res, next) => {
  try {
    const body = (req.validated?.body ?? {}) as OpenPositionRequest;
    const result = await openPosition(req.params.indexId, body);
    return sendValidated(res, OpenPositionResponseSchema, result);
  } catch (error) {
    return next(error);
  }
  },
);

positionsRouter.post(
  '/:indexId/positions/close',
  validateBody(ClosePositionRequestSchema),
  async (req, res, next) => {
  try {
    const body = (req.validated?.body ?? {}) as ClosePositionRequest;
    const result = await closePosition(req.params.indexId, body);
    return sendValidated(res, ClosePositionResponseSchema, result);
  } catch (error) {
    return next(error);
  }
  },
);
