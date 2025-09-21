import type { RequestHandler, Response } from 'express';
import { z } from './common.js';
import { zBps, zHash, zodIssues } from './common.js';
import { InstrumentRowSchema } from './meta.js';

export const PositionSideSchema = z.enum(['LONG', 'SHORT']);

export const OpenPositionRequestSchema = z.object({
  symbol: z.string().min(3),
  side: PositionSideSchema,
  leverage: z.number().int().positive(),
  notionalUsd: z.number().positive(),
  slippageBps: zBps,
});
export type OpenPositionRequest = z.infer<typeof OpenPositionRequestSchema>;

export const PrecheckOpenResponseSchema = z.object({
  ok: z.literal(true),
  markPx: z.number(),
  qtyHuman: z.number(),
  instrument: InstrumentRowSchema,
  indexId: z.string(),
});

export const OpenPositionResponseSchema = z.object({
  status: z.enum(['SUBMITTED', 'FILLED', 'REJECTED']).default('SUBMITTED'),
  txHash: zHash,
  orderId: z.string().optional(),
  requested: z.object({
    symbol: z.string(),
    side: PositionSideSchema,
    leverage: z.number(),
    qty: z.number().optional(),
    limit: z.number().optional(),
  }).optional(),
});

export const ClosePositionRequestSchema = z.object({
  symbol: z.string().min(3),
  closePercent: z.number().min(0).max(100).optional(),
  slippageBps: zBps,
});
export type ClosePositionRequest = z.infer<typeof ClosePositionRequestSchema>;

export const ClosePositionResponseSchema = z.object({
  status: z.enum(['SUBMITTED', 'FILLED', 'REJECTED']).default('SUBMITTED'),
  txHash: zHash,
  requested: z.object({
    symbol: z.string(),
    closeQty: z.number().optional(),
    limit: z.number().optional(),
  }).optional(),
});

export const BasketAssetSchema = z.object({
  symbol: z.string().min(1),
  weight: z.number().min(0),
  position: z.enum(['long', 'short']),
  leverage: z.number().min(1).optional(),
});

export const BasketCalculateRequestSchema = z.object({
  assets: z.array(BasketAssetSchema).min(1),
  interval: z.enum(['1h', '1d', '7d']).default('7d'),
  from: z.number().optional(),
  to: z.number().optional(),
});
export type BasketCalculateRequest = z.infer<typeof BasketCalculateRequestSchema>;

export const BasketCalculateResponseSchema = z.object({
  meta: z.object({
    interval: z.enum(['1h', '1d', '7d']),
    request: z.object({ from: z.number().optional(), to: z.number().optional() }),
    coinNormalization: z.string(),
    leverageApplied: z.boolean(),
    source: z.string(),
    rangeMs: z.number(),
    presetDurationMs: z.number().optional(),
    staleWhileRevalidate: z.boolean().optional(),
  }),
  basketPriceHistory: z.array(z.object({
    timestamp: z.number(),
    price: z.number(),
  })),
  performance: z.object({
    returnPct: z.number(),
    maxDrawdown: z.number(),
  }),
  assets: z.array(z.object({
    symbol: z.string(),
    weight: z.number(),
    position: z.enum(['long', 'short']),
    leverage: z.number(),
    individualReturnPct: z.number(),
  })),
});

const SHOULD_VALIDATE_RESPONSE = process.env.NODE_ENV !== 'production';

declare global {
  namespace Express {
    interface Request {
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

export const validateBody = <Schema extends z.ZodTypeAny>(schema: Schema): RequestHandler =>
  (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        issues: zodIssues(parsed.error),
      });
    }
    req.validated = { ...(req.validated ?? {}), body: parsed.data };
    return next();
  };

export function sendValidated<T>(res: Response, schema: z.ZodSchema<T>, payload: unknown, status = 200) {
  if (!SHOULD_VALIDATE_RESPONSE) {
    return res.status(status).json(payload);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return res.status(500).json({
      code: 'RESPONSE_SCHEMA_ERROR',
      issues: zodIssues(parsed.error),
    });
  }

  return res.status(status).json(parsed.data);
}

export {};

