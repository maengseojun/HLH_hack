import { z } from 'zod';

// Test the Zod schemas used in meta.ts
const UniverseItem = z.object({
  name: z.string().optional(),
  coin: z.string().optional(),
  ticker: z.string().optional(),
  szDecimals: z.number().int().nonnegative().optional(),
  sizeDecimals: z.number().int().nonnegative().optional(),
  priceDecimals: z.number().int().nonnegative().optional(),
  maxLeverage: z.number().positive().optional(),
  assetId: z.number().int().nonnegative().optional(),
});

const AssetCtxItem = z.object({
  markPx: z.union([z.string(), z.number()]).optional(),
  prevDayPx: z.union([z.string(), z.number()]).optional(),
  funding: z.union([z.string(), z.number()]).optional(),
  openInterest: z.union([z.string(), z.number()]).optional(),
  dayNtlVlm: z.union([z.string(), z.number()]).optional(),
  premium: z.union([z.string(), z.number()]).optional(),
});

const MetaAndCtxsResp = z.object({
  universe: z.array(UniverseItem),
  assetCtxs: z.array(AssetCtxItem),
});

describe('Meta Service Zod Validation', () => {
  describe('UniverseItem validation', () => {
    it('should accept valid universe item with all fields', () => {
      const validItem = {
        name: 'Bitcoin',
        coin: 'BTC',
        ticker: 'BTC',
        szDecimals: 3,
        sizeDecimals: 3,
        priceDecimals: 2,
        maxLeverage: 50,
        assetId: 0,
      };

      const result = UniverseItem.safeParse(validItem);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Bitcoin');
        expect(result.data.szDecimals).toBe(3);
      }
    });

    it('should accept minimal valid universe item', () => {
      const minimalItem = {
        name: 'ETH',
      };

      const result = UniverseItem.safeParse(minimalItem);
      expect(result.success).toBe(true);
    });

    it('should reject invalid szDecimals (negative)', () => {
      const invalidItem = {
        name: 'BTC',
        szDecimals: -1,
      };

      const result = UniverseItem.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });

    it('should reject invalid priceDecimals (non-integer)', () => {
      const invalidItem = {
        name: 'BTC',
        priceDecimals: 2.5,
      };

      const result = UniverseItem.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });

    it('should reject invalid maxLeverage (zero)', () => {
      const invalidItem = {
        name: 'BTC',
        maxLeverage: 0,
      };

      const result = UniverseItem.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });
  });

  describe('AssetCtxItem validation', () => {
    it('should accept string price values', () => {
      const item = {
        markPx: '62843.12',
        prevDayPx: '61500.05',
        funding: '0.0123',
      };

      const result = AssetCtxItem.safeParse(item);
      expect(result.success).toBe(true);
    });

    it('should accept numeric price values', () => {
      const item = {
        markPx: 62843.12,
        prevDayPx: 61500.05,
        funding: 0.0123,
      };

      const result = AssetCtxItem.safeParse(item);
      expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
      const result = AssetCtxItem.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid value types', () => {
      const invalidItem = {
        markPx: null,
        prevDayPx: [],
        funding: {},
      };

      const result = AssetCtxItem.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });
  });

  describe('MetaAndCtxsResp validation', () => {
    it('should accept valid response with matching arrays', () => {
      const validResp = {
        universe: [
          { name: 'BTC', szDecimals: 3, priceDecimals: 2 },
          { name: 'ETH', szDecimals: 4, priceDecimals: 3 },
        ],
        assetCtxs: [
          { markPx: '62843.12', prevDayPx: '61500.05' },
          { markPx: '3245.67', prevDayPx: '3100.12' },
        ],
      };

      const result = MetaAndCtxsResp.safeParse(validResp);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.universe).toHaveLength(2);
        expect(result.data.assetCtxs).toHaveLength(2);
      }
    });

    it('should reject missing universe field', () => {
      const invalidResp = {
        assetCtxs: [{ markPx: '62843.12' }],
      };

      const result = MetaAndCtxsResp.safeParse(invalidResp);
      expect(result.success).toBe(false);
    });

    it('should reject missing assetCtxs field', () => {
      const invalidResp = {
        universe: [{ name: 'BTC' }],
      };

      const result = MetaAndCtxsResp.safeParse(invalidResp);
      expect(result.success).toBe(false);
    });

    it('should reject non-array universe', () => {
      const invalidResp = {
        universe: { name: 'BTC' },
        assetCtxs: [],
      };

      const result = MetaAndCtxsResp.safeParse(invalidResp);
      expect(result.success).toBe(false);
    });
  });
});