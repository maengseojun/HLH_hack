import { z } from './common.js';

export const CandleTupleSchema = z.tuple([
  z.union([z.string(), z.number()]),
  z.union([z.string(), z.number()]),
  z.union([z.string(), z.number()]),
  z.union([z.string(), z.number()]),
  z.union([z.string(), z.number()]),
  z.union([z.string(), z.number()]),
]);

export const CandleSnapshotSchema = z
  .object({
    candles: z.array(CandleTupleSchema).optional(),
  })
  .passthrough();

export type CandleSnapshot = z.infer<typeof CandleSnapshotSchema>;

export const FundingTupleSchema = z.tuple([
  z.union([z.string(), z.number()]),
  z.union([z.string(), z.number()]),
]);

export const FundingHistorySchema = z
  .object({
    funding: z.array(FundingTupleSchema).optional(),
  })
  .passthrough();

export type FundingHistory = z.infer<typeof FundingHistorySchema>;

