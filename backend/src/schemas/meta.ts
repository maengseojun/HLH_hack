import { z } from './common.js';

export const InstrumentSchema = z.object({
  assetId: z.number().int().nonnegative(),
  base: z.string(),
  symbol: z.string(),
  szDecimals: z.number().int().min(0),
  priceDecimals: z.number().int().min(0),
  maxLeverage: z.number().positive().nullable(),
});

export const AssetCtxSchema = z.object({
  markPx: z.number().nullable(),
  prevDayPx: z.number().nullable(),
  funding: z.number().nullable(),
  openInterest: z.number().nullable(),
  dayNtlVlm: z.number().nullable(),
  premium: z.number().nullable(),
});

export const InstrumentRowSchema = InstrumentSchema.extend({
  ctx: AssetCtxSchema,
});

export type InstrumentRow = z.infer<typeof InstrumentRowSchema>;

