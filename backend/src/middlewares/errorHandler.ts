import { NextFunction, Request, Response } from 'express';
import { AppError, errorBody } from '../utils/httpError.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json(errorBody(err.payload));
  }

  const status = (err as any)?.response?.status;
  const data = (err as any)?.response?.data;
  const message = typeof data === 'string' ? data : (err as any)?.message ?? 'Upstream service unavailable';

  return res.status(503).json(
    errorBody({
      code: 'UPSTREAM_UNAVAILABLE',
      message: `${message}. Note: Hyperliquid's candleSnapshot and fundingHistory endpoints are only available via the official public API and expose the most recent 5000 candles`,
      retryAfterSec: 30,
      details: status ? { status } : undefined,
    }),
  );
}
