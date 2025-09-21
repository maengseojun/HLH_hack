import {
  readPerpPosition,
  readSpotBalance,
  readOraclePx,
  readSpotPx,
} from '../precompile/readers.js';
import { jest } from '@jest/globals';

// Mock the provider
const mockProvider = {
  call: jest.fn() as jest.MockedFunction<any>,
};

jest.mock('../services/onchain.js', () => ({
  provider: mockProvider,
}));

describe('Precompile Readers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('readPerpPosition', () => {
    it('should decode valid position data correctly', async () => {
      // Mock successful response
      // Raw response represents [szi: int64, leverage: uint32, entryNtl: uint64]
      // Example: szi=1000 (signed), leverage=5, entryNtl=50000
      const mockRawResponse = '0x00000000000003e80000000500000000000c3500'; // simplified mock

      mockProvider.call.mockResolvedValueOnce(mockRawResponse);

      const result = await readPerpPosition('0x1234567890123456789012345678901234567890', 0);

      expect(mockProvider.call).toHaveBeenCalledWith({
        to: expect.any(String), // PRECOMPILE.POSITIONS address
        data: expect.any(String), // encoded call data
      });

      expect(result).toHaveProperty('szi');
      expect(result).toHaveProperty('leverage');
      expect(result).toHaveProperty('entryNtl');
      expect(typeof result.leverage).toBe('number');
    });

    it('should handle negative position size (short)', async () => {
      // Mock response with negative szi (short position)
      const mockRawResponse = '0xfffffffffffffc180000000500000000000c3500'; // szi=-1000

      mockProvider.call.mockResolvedValueOnce(mockRawResponse);

      const result = await readPerpPosition('0x1234567890123456789012345678901234567890', 0);

      expect(result.szi).toBeLessThan(0n);
      expect(result.leverage).toBeGreaterThan(0);
      expect(result.entryNtl).toBeGreaterThanOrEqual(0n);
    });

    it('should throw PRECOMPILE_PARSE_ERROR on provider failure', async () => {
      mockProvider.call.mockRejectedValueOnce(new Error('RPC call failed'));

      await expect(
        readPerpPosition('0x1234567890123456789012345678901234567890', 0)
      ).rejects.toThrow();

      // Should throw AppError with PRECOMPILE_PARSE_ERROR code
      try {
        await readPerpPosition('0x1234567890123456789012345678901234567890', 0);
      } catch (error: any) {
        expect(error.body?.code).toBe('PRECOMPILE_PARSE_ERROR');
        expect(error.body?.message).toContain('Failed to read perp position');
      }
    });

    it('should throw PRECOMPILE_PARSE_ERROR on invalid response data', async () => {
      // Mock response with invalid/truncated data
      mockProvider.call.mockResolvedValueOnce('0x123'); // too short

      await expect(
        readPerpPosition('0x1234567890123456789012345678901234567890', 0)
      ).rejects.toThrow();

      try {
        await readPerpPosition('0x1234567890123456789012345678901234567890', 0);
      } catch (error: any) {
        expect(error.body?.code).toBe('PRECOMPILE_PARSE_ERROR');
      }
    });
  });

  describe('readSpotBalance', () => {
    it('should decode valid balance data correctly', async () => {
      // Mock response: [total: uint64, hold: uint64, entryNtl: uint64]
      const mockRawResponse = '0x00000000000186a000000000000007d000000000000c3500';

      mockProvider.call.mockResolvedValueOnce(mockRawResponse);

      const result = await readSpotBalance('0x1234567890123456789012345678901234567890', 1n);

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('hold');
      expect(result).toHaveProperty('entryNtl');
      expect(typeof result.total).toBe('bigint');
      expect(typeof result.hold).toBe('bigint');
      expect(typeof result.entryNtl).toBe('bigint');
    });

    it('should handle zero balances', async () => {
      const mockRawResponse = '0x000000000000000000000000000000000000000000000000';

      mockProvider.call.mockResolvedValueOnce(mockRawResponse);

      const result = await readSpotBalance('0x1234567890123456789012345678901234567890', 1n);

      expect(result.total).toBe(0n);
      expect(result.hold).toBe(0n);
      expect(result.entryNtl).toBe(0n);
    });

    it('should throw PRECOMPILE_PARSE_ERROR on provider failure', async () => {
      mockProvider.call.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(
        readSpotBalance('0x1234567890123456789012345678901234567890', 1n)
      ).rejects.toThrow();

      try {
        await readSpotBalance('0x1234567890123456789012345678901234567890', 1n);
      } catch (error: any) {
        expect(error.body?.code).toBe('PRECOMPILE_PARSE_ERROR');
        expect(error.body?.message).toContain('Failed to read spot balance');
      }
    });
  });

  describe('readOraclePx', () => {
    it('should decode oracle price correctly', async () => {
      // Mock response: uint64 price
      const mockRawResponse = '0x000000000000ea60'; // 60000 in hex

      mockProvider.call.mockResolvedValueOnce(mockRawResponse);

      const result = await readOraclePx(0);

      expect(typeof result).toBe('bigint');
      expect(result).toBeGreaterThan(0n);
    });

    it('should handle zero price (edge case)', async () => {
      const mockRawResponse = '0x0000000000000000';

      mockProvider.call.mockResolvedValueOnce(mockRawResponse);

      const result = await readOraclePx(0);

      expect(result).toBe(0n);
    });

    it('should throw PRECOMPILE_PARSE_ERROR on invalid response', async () => {
      mockProvider.call.mockRejectedValueOnce(new Error('Invalid asset ID'));

      await expect(readOraclePx(999)).rejects.toThrow();

      try {
        await readOraclePx(999);
      } catch (error: any) {
        expect(error.body?.code).toBe('PRECOMPILE_PARSE_ERROR');
        expect(error.body?.message).toContain('Failed to read oracle price');
      }
    });

    it('should handle malformed response data', async () => {
      mockProvider.call.mockResolvedValueOnce('0xinvalidhex');

      await expect(readOraclePx(0)).rejects.toThrow();
    });
  });

  describe('readSpotPx', () => {
    it('should decode spot price correctly', async () => {
      const mockRawResponse = '0x000000000000ea60';

      mockProvider.call.mockResolvedValueOnce(mockRawResponse);

      const result = await readSpotPx(1);

      expect(typeof result).toBe('bigint');
      expect(result).toBeGreaterThanOrEqual(0n);
    });

    it('should throw PRECOMPILE_PARSE_ERROR on provider failure', async () => {
      mockProvider.call.mockRejectedValueOnce(new Error('Token not found'));

      await expect(readSpotPx(999)).rejects.toThrow();

      try {
        await readSpotPx(999);
      } catch (error: any) {
        expect(error.body?.code).toBe('PRECOMPILE_PARSE_ERROR');
        expect(error.body?.message).toContain('Failed to read spot price');
      }
    });
  });

  describe('Error handling consistency', () => {
    const errorTestCases = [
      { fn: () => readPerpPosition('0x123', 0), name: 'readPerpPosition' },
      { fn: () => readSpotBalance('0x123', 1n), name: 'readSpotBalance' },
      { fn: () => readOraclePx(0), name: 'readOraclePx' },
      { fn: () => readSpotPx(1), name: 'readSpotPx' },
    ];

    errorTestCases.forEach(({ fn, name }) => {
      it(`${name} should throw consistent error structure`, async () => {
        mockProvider.call.mockRejectedValueOnce(new Error('Test error'));

        try {
          await fn();
          fail('Should have thrown an error');
        } catch (error: any) {
          expect(error.body).toBeDefined();
          expect(error.body.code).toBe('PRECOMPILE_PARSE_ERROR');
          expect(error.body.message).toContain('Failed to read');
          expect(error.body.details).toBeDefined();
          expect(error.status).toBe(503);
        }
      });
    });

    it('should include original error details in thrown error', async () => {
      const originalError = new Error('Specific RPC failure');
      mockProvider.call.mockRejectedValueOnce(originalError);

      try {
        await readOraclePx(0);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.body.details.error).toContain('Specific RPC failure');
      }
    });
  });

  describe('Input validation', () => {
    it('should handle different address formats', async () => {
      const mockRawResponse = '0x00000000000003e80000000500000000000c3500';
      mockProvider.call.mockResolvedValue(mockRawResponse);

      // Should work with different address cases
      await expect(
        readPerpPosition('0x1234567890123456789012345678901234567890', 0)
      ).resolves.toBeDefined();

      await expect(
        readPerpPosition('0X1234567890123456789012345678901234567890', 0)
      ).resolves.toBeDefined();
    });

    it('should handle large token IDs', async () => {
      const mockRawResponse = '0x00000000000186a000000000000007d000000000000c3500';
      mockProvider.call.mockResolvedValue(mockRawResponse);

      const largeTokenId = BigInt(Number.MAX_SAFE_INTEGER);
      await expect(
        readSpotBalance('0x1234567890123456789012345678901234567890', largeTokenId)
      ).resolves.toBeDefined();
    });

    it('should handle edge case asset IDs', async () => {
      const mockRawResponse = '0x000000000000ea60';
      mockProvider.call.mockResolvedValue(mockRawResponse);

      // Should handle 0 and large asset IDs
      await expect(readOraclePx(0)).resolves.toBeDefined();
      await expect(readOraclePx(999999)).resolves.toBeDefined();
    });
  });
});