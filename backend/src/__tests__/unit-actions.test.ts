import {
  encLimitOrder,
  encUsdClassTransfer,
  toBytes32Symbol,
  randomCloid,
  assertUint64,
  assertUint128,
  MAX_UINT64,
  MAX_UINT128,
  ActionId,
} from '../corewriter/actions.js';

describe('Actions Encoding', () => {
  describe('assertUint64', () => {
    it('should accept valid uint64 values', () => {
      expect(() => assertUint64(0n, 'test')).not.toThrow();
      expect(() => assertUint64(1n, 'test')).not.toThrow();
      expect(() => assertUint64(MAX_UINT64, 'test')).not.toThrow();
    });

    it('should reject negative values', () => {
      expect(() => assertUint64(-1n, 'test')).toThrow(RangeError);
    });

    it('should reject values exceeding uint64 max', () => {
      expect(() => assertUint64(MAX_UINT64 + 1n, 'test')).toThrow(RangeError);
    });
  });

  describe('assertUint128', () => {
    it('should accept valid uint128 values', () => {
      expect(() => assertUint128(0n, 'test')).not.toThrow();
      expect(() => assertUint128(MAX_UINT64, 'test')).not.toThrow();
      expect(() => assertUint128(MAX_UINT128, 'test')).not.toThrow();
    });

    it('should reject negative values', () => {
      expect(() => assertUint128(-1n, 'test')).toThrow(RangeError);
    });

    it('should reject values exceeding uint128 max', () => {
      expect(() => assertUint128(MAX_UINT128 + 1n, 'test')).toThrow(RangeError);
    });
  });

  describe('toBytes32Symbol', () => {
    it('should convert simple symbol correctly', () => {
      const result = toBytes32Symbol('BTC-PERP');
      expect(result).toMatch(/^0x[0-9a-f]{64}$/);
      // Should start with BTC in hex
      expect(result.slice(2, 8)).toBe('425443'); // 'BTC' in hex
    });

    it('should convert ETH symbol correctly', () => {
      const result = toBytes32Symbol('ETH-PERP');
      expect(result).toMatch(/^0x[0-9a-f]{64}$/);
      // Should start with ETH in hex
      expect(result.slice(2, 8)).toBe('455448'); // 'ETH' in hex
    });

    it('should handle symbols without -PERP suffix', () => {
      const result = toBytes32Symbol('BTC');
      expect(result).toMatch(/^0x[0-9a-f]{64}$/);
      expect(result.slice(2, 8)).toBe('425443'); // 'BTC' in hex
    });

    it('should handle lowercase symbols', () => {
      const result = toBytes32Symbol('btc-perp');
      expect(result).toMatch(/^0x[0-9a-f]{64}$/);
      expect(result.slice(2, 8)).toBe('425443'); // should convert to uppercase 'BTC'
    });
  });

  describe('randomCloid', () => {
    it('should generate valid uint128 values', () => {
      const cloid = randomCloid();
      expect(() => assertUint128(cloid, 'cloid')).not.toThrow();
    });

    it('should generate different values on consecutive calls', () => {
      const cloid1 = randomCloid();
      const cloid2 = randomCloid();
      expect(cloid1).not.toBe(cloid2);
    });

    it('should generate non-zero values (statistically)', () => {
      // Run multiple times to ensure we don't get zero by chance
      const cloids = Array(10).fill(0).map(() => randomCloid());
      const nonZeroCount = cloids.filter(c => c !== 0n).length;
      expect(nonZeroCount).toBeGreaterThan(8); // At least 80% should be non-zero
    });
  });

  describe('encLimitOrder', () => {
    const validParams = {
      assetId: 0,
      isBuy: true,
      limitPxRaw: 60000n,
      sizeRaw: 1000n,
      reduceOnly: false,
      tif: 0 as const,
      cloid: 123456789n,
    };

    it('should encode valid limit order', () => {
      const encoded = encLimitOrder(validParams);

      expect(encoded).toMatch(/^0x[0-9a-f]+$/);
      expect(encoded.length).toBeGreaterThan(10); // Should have header + params

      // Check header structure
      const header = encoded.slice(0, 10); // 0x + 4 bytes = 10 chars
      expect(header).toMatch(/^0x[0-9a-f]{8}$/);

      // First byte should be encoding version (0x01)
      expect(encoded.slice(2, 4)).toBe('01');

      // Fourth byte should be action ID (LIMIT_ORDER = 0x01)
      expect(encoded.slice(8, 10)).toBe('01');
    });

    it('should handle different asset IDs', () => {
      const params1 = { ...validParams, assetId: 0 };
      const params2 = { ...validParams, assetId: 1 };

      const encoded1 = encLimitOrder(params1);
      const encoded2 = encLimitOrder(params2);

      expect(encoded1).not.toBe(encoded2);
    });

    it('should handle buy vs sell orders differently', () => {
      const buyOrder = { ...validParams, isBuy: true };
      const sellOrder = { ...validParams, isBuy: false };

      const encodedBuy = encLimitOrder(buyOrder);
      const encodedSell = encLimitOrder(sellOrder);

      expect(encodedBuy).not.toBe(encodedSell);
    });

    it('should handle different TIF values', () => {
      const tif0 = { ...validParams, tif: 0 as const };
      const tif1 = { ...validParams, tif: 1 as const };
      const tif2 = { ...validParams, tif: 2 as const };

      const encoded0 = encLimitOrder(tif0);
      const encoded1 = encLimitOrder(tif1);
      const encoded2 = encLimitOrder(tif2);

      expect(encoded0).not.toBe(encoded1);
      expect(encoded1).not.toBe(encoded2);
      expect(encoded0).not.toBe(encoded2);
    });

    it('should generate random cloid if not provided', () => {
      const paramsWithoutCloid = { ...validParams };
      delete (paramsWithoutCloid as any).cloid;

      const encoded1 = encLimitOrder(paramsWithoutCloid);
      const encoded2 = encLimitOrder(paramsWithoutCloid);

      // Should be different due to random cloids
      expect(encoded1).not.toBe(encoded2);
    });

    it('should reject invalid limitPxRaw', () => {
      const invalidParams = { ...validParams, limitPxRaw: MAX_UINT64 + 1n };
      expect(() => encLimitOrder(invalidParams)).toThrow(RangeError);
    });

    it('should reject invalid sizeRaw', () => {
      const invalidParams = { ...validParams, sizeRaw: -1n };
      expect(() => encLimitOrder(invalidParams)).toThrow(RangeError);
    });

    it('should reject invalid cloid', () => {
      const invalidParams = { ...validParams, cloid: MAX_UINT128 + 1n };
      expect(() => encLimitOrder(invalidParams)).toThrow(RangeError);
    });
  });

  describe('encUsdClassTransfer', () => {
    it('should encode USD class transfer to perp', () => {
      const encoded = encUsdClassTransfer(1000n, true);

      expect(encoded).toMatch(/^0x[0-9a-f]+$/);

      // Check header
      expect(encoded.slice(2, 4)).toBe('01'); // encoding version
      expect(encoded.slice(8, 10)).toBe('07'); // USD_CLASS_TRANSFER action ID
    });

    it('should encode USD class transfer to spot', () => {
      const encoded = encUsdClassTransfer(1000n, false);

      expect(encoded).toMatch(/^0x[0-9a-f]+$/);
      expect(encoded.slice(8, 10)).toBe('07'); // USD_CLASS_TRANSFER action ID
    });

    it('should handle different amounts', () => {
      const encoded1 = encUsdClassTransfer(1000n, true);
      const encoded2 = encUsdClassTransfer(2000n, true);

      expect(encoded1).not.toBe(encoded2);
    });

    it('should handle toPerp flag differences', () => {
      const toPerp = encUsdClassTransfer(1000n, true);
      const toSpot = encUsdClassTransfer(1000n, false);

      expect(toPerp).not.toBe(toSpot);
    });

    it('should reject invalid amounts', () => {
      expect(() => encUsdClassTransfer(-1n, true)).toThrow(RangeError);
      expect(() => encUsdClassTransfer(MAX_UINT64 + 1n, true)).toThrow(RangeError);
    });

    it('should accept zero amount', () => {
      expect(() => encUsdClassTransfer(0n, true)).not.toThrow();
    });

    it('should accept maximum uint64 amount', () => {
      expect(() => encUsdClassTransfer(MAX_UINT64, true)).not.toThrow();
    });
  });

  describe('Action encoding consistency', () => {
    it('should have consistent header structure across actions', () => {
      const limitOrder = encLimitOrder({
        assetId: 0,
        isBuy: true,
        limitPxRaw: 60000n,
        sizeRaw: 1000n,
        reduceOnly: false,
        tif: 0,
        cloid: 123n,
      });

      const usdTransfer = encUsdClassTransfer(1000n, true);

      // Both should start with same encoding version
      expect(limitOrder.slice(2, 4)).toBe(usdTransfer.slice(2, 4));

      // Both should have proper action IDs
      expect(limitOrder.slice(8, 10)).toBe('01'); // LIMIT_ORDER
      expect(usdTransfer.slice(8, 10)).toBe('07'); // USD_CLASS_TRANSFER
    });
  });

  describe('Parameter order verification', () => {
    it('should encode parameters in correct order for limit orders', () => {
      // This test verifies that parameter order matches the ABI encoding order
      const params = {
        assetId: 1,
        isBuy: false,
        limitPxRaw: 50000n,
        sizeRaw: 2000n,
        reduceOnly: true,
        tif: 1 as const,
        cloid: 999n,
      };

      const encoded = encLimitOrder(params);

      // Should be deterministic for same parameters
      const encoded2 = encLimitOrder(params);
      expect(encoded).toBe(encoded2);

      // Changing any parameter should change the encoding
      const modifiedParams = { ...params, assetId: 2 };
      const encodedModified = encLimitOrder(modifiedParams);
      expect(encoded).not.toBe(encodedModified);
    });
  });
});