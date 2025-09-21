HyperIndex API v1 Migration Guide
================================

This note keeps the frontend and documentation aligned with the backend revamp that introduced the `/v1` routes, shared error schema, and candle request safeguards.

What changed
------------

- **New base paths**: all public endpoints now live under `/v1`, e.g. `/v1/assets`, `/v1/assets/:symbol/candles`, `/v1/baskets/calculate`.
- **Uniform errors**: every error response is shaped like
  ```json
  {
    "error": {
      "code": "WEIGHT_SUM_INVALID",
      "message": "Sum of weights must equal 1.0 (±1e-6)",
      "details": { "sum": 0.92 },
      "retryAfterSec": 30
    }
  }
  ```
  The `retryAfterSec` field is included when a retry makes sense (upstream throttling, temporary failure).
- **Hyperliquid symbol normalisation**: backend converts `XYZ-PERP` → `XYZ`. Downstream consumers should treat `symbol` as “what the client sent” and use `meta.coinNormalization` for any messaging.
- **Candle fetch hardening**: duplicate-timestamp filtering, axios retries, and in-flight deduplication prevent hammering the upstream API under bursty usage.

Frontend updates
----------------

1. **Route prefixes**: update every call site to use `/v1/...` instead of the legacy `/assets` and `/baskets` roots.
2. **Error handling**: expect `error.code` rather than free-form strings. Implement a small mapping (code → user-facing copy) and read `retryAfterSec` when deciding whether to surface “try again” CTAs.
3. **Candles metadata**: responses now include a meta block such as
   ```json
   {
     "meta": {
       "coinNormalization": "SYMBOL-PERP->SYMBOL",
       "source": "hyperliquid.info.candleSnapshot"
     }
   }
   ```
   Bubble this information into devtools or debugging overlays so symbol mismatches are easy to spot.
4. **Basket payload validation**: enforce `sum(weights) = 1` client-side before posting to `/v1/baskets/calculate` to avoid unnecessary round trips.
5. **Asset detail expansions**: opt into extras with `?include=fundingHistory,change7d`. Missing data should be treated as optional so the UI can hide that section.
6. **Official info API only**: `candleSnapshot`/`fundingHistory` calls must target the Hyperliquid public info endpoint. 커스텀 노드에서는 503이 발생할 수 있으며, 각 시장은 최신 5,000개 캔들만 제공합니다.

Documentation checklist
-----------------------

- Update API reference tables to point to `/v1/assets`, `/v1/assets/:symbol`, `/v1/assets/:symbol/candles`, `/v1/baskets/calculate`.
- Document the new payment endpoints (`/v1/payments/precheck`, `/v1/payments/intents`, `/v1/payments/{intentId}/confirm`) including signature requirements and error codes (`INSUFFICIENT_FUNDS`, `ONCHAIN_REVERT`).
- Document the common error envelope (code/message/details/retryAfterSec) and list the expected codes (`BAD_REQUEST`, `INVALID_RANGE`, `LOOKBACK_EXCEEDED`, `UNSUPPORTED_PRESET`, `UNSUPPORTED_SYMBOL`, `WEIGHT_SUM_INVALID`, `EMPTY_CANDLES`, `UPSTREAM_UNAVAILABLE`).
- Note the default lookback windows per interval (`1h` → 24 h, `1d` → 30 d, `7d` → 7 d) and the hard limit of 365 d.

Verification scripts
--------------------

Run the backend locally (`npm run dev` from `backend/`) and exercise the endpoints:

```bash
# Health check
curl http://localhost:3000/health

# All assets
curl http://localhost:3000/v1/assets

# Asset detail with on-chain enrichment
curl http://localhost:3000/v1/assets/BTC

# Candle snapshot (1d lookback)
curl "http://localhost:3000/v1/assets/BTC-PERP/candles?interval=1d"

# Basket calculation (weights sum to 1)
curl -X POST http://localhost:3000/v1/baskets/calculate \
  -H 'Content-Type: application/json' \
  -d '{
        "interval": "7d",
        "assets": [
          { "symbol": "BTC-PERP", "weight": 0.6, "position": "long" },
          { "symbol": "ETH-PERP", "weight": 0.4, "position": "short", "leverage": 2 }
        ]
      }'
```

To confirm in-flight deduplication, fire several identical candle requests in parallel (for example via `autocannon` or `hey`) and watch the logs—only one upstream call should appear per cache key.

Environment reminders
---------------------

- Ensure `.env` carries the correct testnet values (`HYPERLIQUID_API_URL`, `HYPERCORE_RPC_URL`, `HYPERCORE_WALLET_KEY`).
- `config.ts` already reads the above; no further code changes are required if the variables are present.

Keep this guide close to the frontend ticket so everyone migrates in lockstep.
