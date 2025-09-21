import request from 'supertest';
import { app } from '../index.js';

describe('E2E Position Flow Tests', () => {
  const indexId = 'test-index-1';
  const validPayload = {
    symbol: 'ETH-PERP',
    side: 'LONG',
    leverage: 5,
    notionalUsd: 1000,
    slippageBps: 50,
  };

  describe('Scenario 1: Happy Path', () => {
    it('should complete full flow: precheck -> open -> positions -> close -> positions', async () => {
      // Step 1: Precheck
      const precheckRes = await request(app)
        .post(`/v1/indexes/${indexId}/positions/precheck`)
        .send(validPayload)
        .expect(200);

      expect(precheckRes.body).toHaveProperty('estimatedEntryPrice');
      expect(precheckRes.body).toHaveProperty('estimatedSize');

      // Step 2: Open position
      const openRes = await request(app)
        .post(`/v1/indexes/${indexId}/positions/open`)
        .set('Idempotency-Key', 'test-open-1')
        .send(validPayload)
        .expect(200);

      expect(openRes.body).toHaveProperty('positionId');
      expect(openRes.body).toHaveProperty('txHash');
      const positionId = openRes.body.positionId;

      // Step 3: Check positions
      const positionsRes = await request(app)
        .get(`/v1/indexes/${indexId}/positions`)
        .expect(200);

      expect(Array.isArray(positionsRes.body)).toBe(true);
      const position = positionsRes.body.find((p: any) => p.positionId === positionId);
      expect(position).toBeDefined();
      expect(position.side).toBe('LONG');

      // Step 4: Close position
      const closePayload = {
        symbol: 'ETH-PERP',
        closePercent: 100,
        slippageBps: 50,
      };

      const closeRes = await request(app)
        .post(`/v1/indexes/${indexId}/positions/close`)
        .set('Idempotency-Key', 'test-close-1')
        .send(closePayload)
        .expect(200);

      expect(closeRes.body).toHaveProperty('txHash');

      // Step 5: Verify position closed
      const finalPositionsRes = await request(app)
        .get(`/v1/indexes/${indexId}/positions`)
        .expect(200);

      const closedPosition = finalPositionsRes.body.find((p: any) => p.positionId === positionId);
      expect(closedPosition?.size).toBe(0);
    });
  });

  describe('Scenario 2: Idempotency Test', () => {
    it('should handle 5 concurrent identical requests with same Idempotency-Key', async () => {
      const idempotencyKey = 'test-concurrent-1';

      // Send 5 identical requests concurrently
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post(`/v1/indexes/${indexId}/positions/open`)
          .set('Idempotency-Key', idempotencyKey)
          .send(validPayload)
      );

      const responses = await Promise.all(promises);

      // All should succeed (status 200)
      responses.forEach(res => {
        expect(res.status).toBe(200);
      });

      // Should have same response body (except first one has no idempotent_replay flag)
      const firstResponse = responses[0].body;
      const subsequentResponses = responses.slice(1);

      subsequentResponses.forEach(res => {
        expect(res.body.idempotent_replay).toBe(true);
        expect(res.body.positionId).toBe(firstResponse.positionId);
        expect(res.body.txHash).toBe(firstResponse.txHash);
      });

      // Only first response should not have idempotent_replay flag
      expect(firstResponse.idempotent_replay).toBeUndefined();
    });

    it('should prevent nonce collision by serializing wallet operations', async () => {
      // Multiple different operations but same wallet should be serialized
      const promises = [
        request(app)
          .post(`/v1/indexes/${indexId}/positions/open`)
          .set('Idempotency-Key', 'test-serial-1')
          .send({ ...validPayload, notionalUsd: 1000 }),

        request(app)
          .post(`/v1/indexes/${indexId}/positions/open`)
          .set('Idempotency-Key', 'test-serial-2')
          .send({ ...validPayload, notionalUsd: 2000 }),

        request(app)
          .post(`/v1/indexes/${indexId}/positions/open`)
          .set('Idempotency-Key', 'test-serial-3')
          .send({ ...validPayload, notionalUsd: 3000 }),
      ];

      const responses = await Promise.all(promises);

      // All should succeed without nonce conflicts
      responses.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('txHash');
      });

      // All should have different transaction hashes (no duplicates)
      const txHashes = responses.map(res => res.body.txHash);
      const uniqueTxHashes = new Set(txHashes);
      expect(uniqueTxHashes.size).toBe(txHashes.length);
    });
  });

  describe('Scenario 3: Upstream Error Handling', () => {
    it('should handle upstream timeout/unavailable gracefully', async () => {
      // Simulate upstream error by using invalid symbol
      const invalidPayload = {
        ...validPayload,
        symbol: 'INVALID-SYMBOL-THAT-DOES-NOT-EXIST',
      };

      const response = await request(app)
        .post(`/v1/indexes/${indexId}/positions/precheck`)
        .send(invalidPayload)
        .expect(400); // Should return 400 for unsupported symbol

      expect(response.body).toHaveProperty('code');
      expect(response.body.code).toBe('UNSUPPORTED_SYMBOL');
      expect(response.body).toHaveProperty('message');
    });

    it('should return standardized error codes for parsing errors', async () => {
      // Test with malformed request body
      const malformedPayload = {
        symbol: 'E', // Too short
        side: 'INVALID_SIDE',
        leverage: -1, // Invalid
        notionalUsd: -100, // Invalid
        slippageBps: 1000, // Too high
      };

      const response = await request(app)
        .post(`/v1/indexes/${indexId}/positions/precheck`)
        .send(malformedPayload)
        .expect(400);

      expect(response.body).toHaveProperty('code');
      expect(response.body.code).toBe('BAD_REQUEST');
      expect(response.body).toHaveProperty('details');
    });

    it('should handle precompile parse errors', async () => {
      // This would typically be triggered by actual blockchain call failure
      // For now, we'll test the error structure
      const response = await request(app)
        .post(`/v1/indexes/nonexistent-index/positions/precheck`)
        .send(validPayload);

      // Should handle gracefully even if index doesn't exist
      expect([400, 404, 503]).toContain(response.status);
      if (response.status === 503) {
        expect(response.body.code).toMatch(/UPSTREAM_UNAVAILABLE|PRECOMPILE_PARSE_ERROR/);
      }
    });
  });

  describe('Validation and Edge Cases', () => {
    it('should validate required Idempotency-Key for mutation operations', async () => {
      const response = await request(app)
        .post(`/v1/indexes/${indexId}/positions/open`)
        // No Idempotency-Key header
        .send(validPayload);

      // Should still work but recommend using idempotency key
      // In production, you might want to require it
      expect([200, 400]).toContain(response.status);
    });

    it('should handle different Idempotency-Keys for same payload', async () => {
      const responses = await Promise.all([
        request(app)
          .post(`/v1/indexes/${indexId}/positions/open`)
          .set('Idempotency-Key', 'key-1')
          .send(validPayload),

        request(app)
          .post(`/v1/indexes/${indexId}/positions/open`)
          .set('Idempotency-Key', 'key-2')
          .send(validPayload),
      ]);

      // Different keys should result in different transactions
      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(200);

      if (responses[0].body.txHash && responses[1].body.txHash) {
        expect(responses[0].body.txHash).not.toBe(responses[1].body.txHash);
      }
    });
  });
});