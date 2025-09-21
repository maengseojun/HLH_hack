import { z } from './common.js';
import { zAddress, zUIntStr } from './common.js';

export const BasketPositionSchema = z.object({
  symbol: z.string(),
  sizeRaw: zUIntStr,
});

export const BasketStateSchema = z.object({
  owner: zAddress,
  assetId: z.string(),
  positions: z.array(BasketPositionSchema),
  updatedAt: z.number().int(),
});

export type BasketState = z.infer<typeof BasketStateSchema>;

