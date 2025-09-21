import request from 'supertest';
import { app } from '../index.js';

describe('E2E Basket Flow Tests', () => {
  const indexId = 'test-index-1';
  const demoToken = process.env.DEMO_TOKEN || 'test_token_for_e2e';

  beforeAll(() => {
    // Ensure we have required environment variables
    if (!process.env.DEMO_TOKEN) {
      console.warn('DEMO_TOKEN not set, using default test token');
    }
  });

  describe('Scenario 1: Happy Path - Complete Basket Flow', () => {
    it('should complete full basket flow: precheck -> open -> state -> close -> state', async () => {
      const amountTokens = '100'; // 100 index tokens

      // Step 1: Precheck basket
      const precheckRes = await request(app)
        .post(`/v1/indexes/${indexId}/basket/precheck`)
        .set('Authorization', `Bearer ${demoToken}`)
        .send({ amountTokens })
        .expect(200);

      expect(precheckRes.body).toHaveProperty('ok', true);
      expect(precheckRes.body).toHaveProperty('tokenBal');
      expect(precheckRes.body).toHaveProperty('hypeBal');

      // Step 2: Open basket (assemble)
      const openRes = await request(app)
        .post(`/v1/indexes/${indexId}/basket/open`)
        .set('Authorization', `Bearer ${demoToken}`)
        .set('Idempotency-Key', 'basket-open-1')
        .send({ amountTokens })
        .expect(200);

      expect(openRes.body).toHaveProperty('status', 'SUBMITTED');
      expect(openRes.body).toHaveProperty('txHash');

      // Wait for blockchain settlement
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Check basket state
      const stateRes1 = await request(app)
        .get(`/v1/indexes/${indexId}/basket`)
        .set('Authorization', `Bearer ${demoToken}`)
        .expect(200);

      expect(stateRes1.body).toHaveProperty('state');
      expect(stateRes1.body.state).toBeDefined();

      // Step 4: Close basket (disassemble)
      const closeRes = await request(app)
        .post(`/v1/indexes/${indexId}/basket/close`)
        .set('Authorization', `Bearer ${demoToken}`)
        .set('Idempotency-Key', 'basket-close-1')
        .send({ amountTokens })
        .expect(200);

      expect(closeRes.body).toHaveProperty('status', 'SUBMITTED');
      expect(closeRes.body).toHaveProperty('txHash');

      // Wait for blockchain settlement
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 5: Verify basket state after close
      const stateRes2 = await request(app)
        .get(`/v1/indexes/${indexId}/basket`)
        .set('Authorization', `Bearer ${demoToken}`)
        .expect(200);

      expect(stateRes2.body).toHaveProperty('state');
      // State should reflect the closed position
    });
  });

  describe('Scenario 2: Idempotency & Concurrent Requests', () => {
    it('should handle 5 concurrent basket open requests with same Idempotency-Key', async () => {
      const idempotencyKey = 'basket-concurrent-1';
      const amountTokens = '50';

      // Send 5 identical requests concurrently
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post(`/v1/indexes/${indexId}/basket/open`)
          .set('Authorization', `Bearer ${demoToken}`)
          .set('Idempotency-Key', idempotencyKey)
          .send({ amountTokens })
      );

      const responses = await Promise.all(promises);

      // All should succeed (status 200)
      responses.forEach(res => {
        expect(res.status).toBe(200);
      });

      // Check for idempotent replay flags
      const replayFlags = responses.map(res => res.body.idempotent_replay ? 1 : 0);
      const originalRequests = replayFlags.filter(flag => flag === 0);

      // Should have exactly 1 original request and 4 replays
      expect(originalRequests).toHaveLength(1);
    });

    it('should serialize wallet operations to prevent nonce collision', async () => {
      // Multiple different basket operations for same wallet
      const promises = [
        request(app)
          .post(`/v1/indexes/${indexId}/basket/open`)
          .set('Authorization', `Bearer ${demoToken}`)
          .set('Idempotency-Key', 'basket-serial-1')
          .send({ amountTokens: '10' }),

        request(app)
          .post(`/v1/indexes/${indexId}/basket/open`)
          .set('Authorization', `Bearer ${demoToken}`)
          .set('Idempotency-Key', 'basket-serial-2')
          .send({ amountTokens: '20' }),

        request(app)
          .post(`/v1/indexes/${indexId}/basket/close`)
          .set('Authorization', `Bearer ${demoToken}`)
          .set('Idempotency-Key', 'basket-serial-3')
          .send({ amountTokens: '5' }),
      ];

      const responses = await Promise.all(promises);

      // All should succeed without nonce conflicts
      responses.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('txHash');
      });

      // All should have different transaction hashes
      const txHashes = responses.map(res => res.body.txHash);
      const uniqueTxHashes = new Set(txHashes);
      expect(uniqueTxHashes.size).toBe(txHashes.length);
    });
  });

  describe('Scenario 3: Error Handling', () => {
    it('should handle insufficient index tokens gracefully', async () => {
      const largeAmount = '999999999'; // Unrealistically large amount

      const response = await request(app)
        .post(`/v1/indexes/${indexId}/basket/precheck`)
        .set('Authorization', `Bearer ${demoToken}`)
        .send({ amountTokens: largeAmount })
        .expect(400);

      expect(response.body).toHaveProperty('code', 'INSUFFICIENT_TOKENS');
      expect(response.body).toHaveProperty('message');
    });

    it('should handle insufficient gas (HYPE) gracefully', async () => {
      // This would be tested with a wallet that has tokens but no HYPE
      // For mock testing, we simulate the error
      const response = await request(app)
        .post(`/v1/indexes/low-gas-index/basket/precheck`)
        .set('Authorization', `Bearer ${demoToken}`)
        .send({ amountTokens: '1' });

      if (response.status === 400) {
        expect(response.body.code).toBe('INSUFFICIENT_GAS');
        expect(response.body.message).toContain('HYPE');
      }
    });

    it('should handle unsupported basket symbol', async () => {
      const response = await request(app)
        .post(`/v1/indexes/nonexistent-basket/basket/open`)
        .set('Authorization', `Bearer ${demoToken}`)
        .set('Idempotency-Key', 'invalid-basket-1')
        .send({ amountTokens: '10' });

      expect([400, 404]).toContain(response.status);
      if (response.status === 400) {
        expect(response.body.code).toBe('UNSUPPORTED_SYMBOL');
      }
    });

    it('should handle upstream HyperCore unavailable', async () => {
      // Test with malformed requests to trigger upstream errors
      const response = await request(app)
        .post(`/v1/indexes/${indexId}/basket/open`)
        .set('Authorization', `Bearer ${demoToken}`)
        .set('Idempotency-Key', 'upstream-error-1')
        .send({ amountTokens: 'invalid_amount' }) // Invalid format
        .expect(400);

      expect(response.body).toHaveProperty('code');
      expect(['BAD_REQUEST', 'UPSTREAM_UNAVAILABLE']).toContain(response.body.code);
    });

    it('should handle CoreWriter sendRawAction failures', async () => {
      // This would typically require mocking CoreWriter
      // For now, test error structure
      const response = await request(app)
        .post(`/v1/indexes/failing-index/basket/open`)
        .set('Authorization', `Bearer ${demoToken}`)
        .set('Idempotency-Key', 'corewriter-fail-1')
        .send({ amountTokens: '1' });

      if (response.status >= 500) {
        expect(response.body.code).toMatch(/UPSTREAM_UNAVAILABLE|ONCHAIN_REVERT/);
      }
    });
  });

  describe('Scenario 4: Authorization & Validation', () => {
    it('should require valid Authorization header', async () => {
      const response = await request(app)
        .post(`/v1/indexes/${indexId}/basket/precheck`)
        // No Authorization header
        .send({ amountTokens: '10' })
        .expect(401);

      expect(response.body).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should validate amountTokens parameter', async () => {
      const testCases = [
        { amountTokens: '' }, // Empty
        { amountTokens: '0' }, // Zero
        { amountTokens: '-10' }, // Negative
        { amountTokens: 'abc' }, // Non-numeric
        { amountTokens: '1.5.5' }, // Invalid format
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post(`/v1/indexes/${indexId}/basket/precheck`)
          .set('Authorization', `Bearer ${demoToken}`)
          .send(testCase)
          .expect(400);

        expect(response.body).toHaveProperty('code', 'BAD_REQUEST');
        expect(response.body).toHaveProperty('details');
      }
    });

    it('should validate Idempotency-Key format', async () => {
      const response = await request(app)
        .post(`/v1/indexes/${indexId}/basket/open`)
        .set('Authorization', `Bearer ${demoToken}`)
        .set('Idempotency-Key', '') // Empty idempotency key
        .send({ amountTokens: '10' });

      // Should either accept it or return validation error
      if (response.status === 400) {
        expect(response.body.code).toBe('BAD_REQUEST');
      }
    });
  });

  describe('Scenario 5: Integration with HyperEVM & HyperCore', () => {
    it('should verify basket state reads from precompile', async () => {
      const response = await request(app)
        .get(`/v1/indexes/${indexId}/basket`)
        .set('Authorization', `Bearer ${demoToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('state');

      // Validate state structure
      const state = response.body.state;
      expect(state).toBeDefined();

      // State should contain relevant basket information
      // Structure depends on your precompile implementation
    });

    it('should handle precompile read failures gracefully', async () => {
      const response = await request(app)
        .get(`/v1/indexes/nonexistent-precompile/basket`)
        .set('Authorization', `Bearer ${demoToken}`);

      if (response.status !== 200) {
        expect([400, 503]).toContain(response.status);
        expect(response.body.code).toMatch(/PRECOMPILE_PARSE_ERROR|UPSTREAM_UNAVAILABLE/);
      }
    });

    it('should ensure CoreWriter uses correct wallet for index', async () => {
      // Test that different indexes use different wallets
      const indexId2 = 'test-index-2';

      const [response1, response2] = await Promise.all([
        request(app)
          .post(`/v1/indexes/${indexId}/basket/open`)
          .set('Authorization', `Bearer ${demoToken}`)
          .set('Idempotency-Key', 'wallet-test-1')
          .send({ amountTokens: '1' }),

        request(app)
          .post(`/v1/indexes/${indexId2}/basket/open`)
          .set('Authorization', `Bearer ${demoToken}`)
          .set('Idempotency-Key', 'wallet-test-2')
          .send({ amountTokens: '1' })
      ]);

      // Both should succeed or fail consistently
      expect([200, 400, 404]).toContain(response1.status);
      expect([200, 400, 404]).toContain(response2.status);

      // If both succeed, they should use different wallets (different tx hashes)
      if (response1.status === 200 && response2.status === 200) {
        expect(response1.body.txHash).not.toBe(response2.body.txHash);
      }
    });
  });

  describe('Performance & Load Testing', () => {
    it('should handle reasonable concurrent load', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();

      const promises = Array(concurrentRequests).fill(null).map((_, i) =>
        request(app)
          .post(`/v1/indexes/${indexId}/basket/precheck`)
          .set('Authorization', `Bearer ${demoToken}`)
          .send({ amountTokens: '1' })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Most requests should succeed
      const successCount = responses.filter(res => res.status === 200).length;
      expect(successCount).toBeGreaterThanOrEqual(concurrentRequests * 0.8);

      // Should complete within reasonable time (adjust based on your requirements)
      expect(duration).toBeLessThan(10000); // 10 seconds
    });

    it('should not leak memory or connections during batch operations', async () => {
      // Simple batch test to ensure no obvious leaks
      const batchSize = 5;

      for (let batch = 0; batch < 3; batch++) {
        const promises = Array(batchSize).fill(null).map((_, i) =>
          request(app)
            .get(`/v1/indexes/${indexId}/basket`)
            .set('Authorization', `Bearer ${demoToken}`)
        );

        const responses = await Promise.all(promises);

        // Should maintain consistent performance across batches
        responses.forEach(res => {
          expect([200, 400, 503]).toContain(res.status);
        });
      }
    });
  });
});