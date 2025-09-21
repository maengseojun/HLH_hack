import {
  humanPxToRaw,
  rawPxToHuman,
  humanSzToRaw,
  rawSzToHuman,
  roundQtyToStep,
} from '../corewriter/scales.js';

describe('Scales Utility Functions', () => {
  describe('humanPxToRaw', () => {
    const testCases = [
      // [humanPx, priceDecimals, expectedRaw]
      [100.0, 0, 100n],
      [100.5, 0, 101n], // rounds
      [100.25, 2, 10025n],
      [62843.12, 2, 6284312n],
      [0.000001, 6, 1n],
      [1.123456789, 8, 112345679n], // rounds to 8 decimals
      [1000000.0, 18, 1000000000000000000000000n],
    ];

    test.each(testCases)('humanPxToRaw(%f, %d) = %s', (...args: any[]) => {
      const [humanPx, priceDecimals, expected] = args;
      const result = humanPxToRaw(humanPx, priceDecimals);
      expect(result).toBe(expected);
    });

    it('should handle edge case: zero price', () => {
      expect(humanPxToRaw(0, 2)).toBe(0n);
      expect(humanPxToRaw(0, 18)).toBe(0n);
    });

    it('should handle very small prices', () => {
      expect(humanPxToRaw(0.000000000000000001, 18)).toBe(1n);
      expect(humanPxToRaw(0.0000000000000000005, 18)).toBe(1n); // rounds up
    });
  });

  describe('rawPxToHuman', () => {
    const testCases = [
      // [rawPx, priceDecimals, expectedHuman]
      [100n, 0, 100.0],
      [10025n, 2, 100.25],
      [6284312n, 2, 62843.12],
      [1n, 6, 0.000001],
      [112345679n, 8, 1.12345679],
      [1000000000000000000000000n, 18, 1000000.0],
    ];

    test.each(testCases)('rawPxToHuman(%s, %d) = %f', (...args: any[]) => {
      const [rawPx, priceDecimals, expected] = args;
      const result = rawPxToHuman(rawPx, priceDecimals);
      expect(result).toBeCloseTo(expected, 10);
    });

    it('should handle zero raw price', () => {
      expect(rawPxToHuman(0n, 2)).toBe(0);
      expect(rawPxToHuman(0n, 18)).toBe(0);
    });
  });

  describe('humanSzToRaw', () => {
    const testCases = [
      // [humanSz, szDecimals, expectedRaw]
      [1.0, 0, 1n],
      [1.5, 0, 2n], // rounds
      [1.234, 3, 1234n],
      [0.001, 3, 1n],
      [10.123456, 6, 10123456n],
      [0.000000000000000001, 18, 1n],
    ];

    test.each(testCases)('humanSzToRaw(%f, %d) = %s', (...args: any[]) => {
      const [humanSz, szDecimals, expected] = args;
      const result = humanSzToRaw(humanSz, szDecimals);
      expect(result).toBe(expected);
    });

    it('should handle zero size', () => {
      expect(humanSzToRaw(0, 3)).toBe(0n);
      expect(humanSzToRaw(0, 18)).toBe(0n);
    });
  });

  describe('rawSzToHuman', () => {
    const testCases = [
      // [rawSz, szDecimals, expectedHuman]
      [1n, 0, 1.0],
      [1234n, 3, 1.234],
      [1n, 3, 0.001],
      [10123456n, 6, 10.123456],
      [1n, 18, 0.000000000000000001],
    ];

    test.each(testCases)('rawSzToHuman(%s, %d) = %f', (...args: any[]) => {
      const [rawSz, szDecimals, expected] = args;
      const result = rawSzToHuman(rawSz, szDecimals);
      expect(result).toBeCloseTo(expected, 18);
    });

    it('should handle zero raw size', () => {
      expect(rawSzToHuman(0n, 3)).toBe(0);
      expect(rawSzToHuman(0n, 18)).toBe(0);
    });
  });

  describe('roundQtyToStep', () => {
    const testCases = [
      // [qtyHuman, szDecimals, expected]
      [1.5, 0, 1], // floors to integer
      [1.999, 0, 1],
      [1.234567, 3, 1.234], // rounds to 3 decimal places
      [1.999999, 3, 1.999],
      [10.123456789, 6, 10.123456],
      [0.000000123456789, 8, 0.00000012],
    ];

    test.each(testCases)('roundQtyToStep(%f, %d) = %f', (...args: any[]) => {
      const [qtyHuman, szDecimals, expected] = args;
      const result = roundQtyToStep(qtyHuman, szDecimals);
      expect(result).toBeCloseTo(expected, 10);
    });

    it('should handle zero decimals', () => {
      expect(roundQtyToStep(5.999, 0)).toBe(5);
      expect(roundQtyToStep(0.1, 0)).toBe(0);
    });

    it('should handle negative decimals (edge case)', () => {
      expect(roundQtyToStep(123.456, -1)).toBe(123);
      expect(roundQtyToStep(123.456, -2)).toBe(123);
    });

    it('should handle high precision', () => {
      const result = roundQtyToStep(1.123456789012345, 12);
      expect(result).toBeCloseTo(1.123456789012, 12);
    });
  });

  describe('Round-trip conversion accuracy', () => {
    const testDecimals = [0, 2, 6, 8, 12, 18];
    const testValues = [0, 0.1, 1, 10.5, 100.25, 1000.123456789];

    testDecimals.forEach(decimals => {
      testValues.forEach(value => {
        it(`should maintain accuracy for price ${value} with ${decimals} decimals`, () => {
          const raw = humanPxToRaw(value, decimals);
          const recovered = rawPxToHuman(raw, decimals);

          // Allow for small rounding differences due to precision limits
          const tolerance = decimals === 0 ? 1 : Math.pow(10, -(decimals - 1));
          expect(Math.abs(recovered - value)).toBeLessThanOrEqual(tolerance);
        });

        it(`should maintain accuracy for size ${value} with ${decimals} decimals`, () => {
          const raw = humanSzToRaw(value, decimals);
          const recovered = rawSzToHuman(raw, decimals);

          // Allow for small rounding differences due to precision limits
          const tolerance = decimals === 0 ? 1 : Math.pow(10, -(decimals - 1));
          expect(Math.abs(recovered - value)).toBeLessThanOrEqual(tolerance);
        });
      });
    });
  });

  describe('Boundary value testing', () => {
    it('should handle maximum safe integer values', () => {
      const maxSafeRaw = BigInt(Number.MAX_SAFE_INTEGER);

      // Should not throw for large values
      expect(() => rawPxToHuman(maxSafeRaw, 0)).not.toThrow();
      expect(() => rawSzToHuman(maxSafeRaw, 0)).not.toThrow();
    });

    it('should handle very large decimal precision', () => {
      // Should handle up to 18 decimals (typical for blockchain)
      expect(() => humanPxToRaw(1, 18)).not.toThrow();
      expect(() => humanSzToRaw(1, 18)).not.toThrow();
      expect(() => roundQtyToStep(1, 18)).not.toThrow();
    });
  });
});