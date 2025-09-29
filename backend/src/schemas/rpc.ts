import { z } from './common.js';

// The schema is an object, not a tuple
export const CandleObjectSchema = z.object({
  t: z.number(),
  o: z.union([z.string(), z.number()]),
  h: z.union([z.string(), z.number()]),
  l: z.union([z.string(), z.number()]),
  c: z.union([z.string(), z.number()]),
  v: z.union([z.string(), z.number()]),
}).passthrough(); // Allow other fields like T, s, i, n

// The API returns an array of these objects
export const CandleSnapshotSchema = z.array(CandleObjectSchema);

export type CandleSnapshot = z.infer<typeof CandleSnapshotSchema>;

// --- Funding History (for reference, unchanged) ---
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