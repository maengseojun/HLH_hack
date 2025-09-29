# API Integration Guide (Local + Deploy)

## Overview
- Frontend: Next.js 15 (React 19)
- Backend: Express (HyperIndex v1 API)
- Preferred pattern: Single-domain proxy (Next rewrites -> backend). Alternative: Split-domain + CORS.

## Local Development (Single-domain Proxy)
1) Frontend `.env.local` (project root)
```
NEXT_PUBLIC_API_BASE=http://localhost:3000/v1
NEXT_PUBLIC_API_PROXY_TARGET=http://localhost:3001
NEXT_PUBLIC_DEMO_BEARER_TOKEN=hyperindex-demo-token-2024
```

2) Backend `backend/.env` (testnet example)
```
NODE_ENV=testnet
PORT=3001

# Hyperliquid info/testnet
HYPERLIQUID_API_URL=https://api.testnet.hyperliquid.xyz
INFO_API_URL=https://api.testnet.hyperliquid.xyz/info

# HyperCore/chain
HYPERCORE_RPC_URL=https://testnet.hypercore.hyperliquid.xyz
CORE_WRITER_ADDRESS=0x3333333333333333333333333333333333333333
CHAIN_RPC_URL=https://rpc.hyperliquid-testnet.xyz/evm
CHAIN_ID=998

# Demo bearer token (for protected endpoints like baskets/calculate)
DEMO_BEARER_TOKEN=hyperindex-demo-token-2024

# Rate limit / cache / timeout (optional)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=200
CACHE_TTL_SECONDS=30
CACHE_STALE_TTL=90
REQUEST_TIMEOUT_MS=30000
HYPERCORE_TIMEOUT=30000
```

3) Start both (one terminal)
```
pnpm run dev:all
```
- What it does: starts backend on 3001, waits until it’s ready, then starts Next dev on 3000 (webpack mode to avoid dev manifest issues).

4) Sanity checks (browser)
```
http://localhost:3000/health        # proxied -> 3001/health (200)
http://localhost:3000/v1/assets     # proxied -> 3001/v1/assets (JSON array)
```
- Launch page search uses `GET /v1/assets`. If this fails, no suggestions appear.

## Endpoints (v1)
- `GET /v1/assets`                → asset list (public)
- `GET /v1/assets/:symbol`        → asset detail (public)
- `GET /v1/assets/:symbol/candles?interval=1h|1d|7d` → candles (public; upstream-limited)
- `POST /v1/baskets/calculate`    → basket calc (protected: Bearer token)

Auth (demo)
```
Authorization: Bearer hyperindex-demo-token-2024
```

Error envelope
```
{
  "error": {
    "code": "UPSTREAM_UNAVAILABLE",
    "message": "...",
    "details": { "status": 503 },
    "retryAfterSec": 30
  }
}
```

## Deploy Patterns
- Single-domain proxy (recommended)
  - Example: `app.example.com` serves Next. Rewrites: `/v1/*` -> `https://api.example.com/v1/*` (or same host, path-based).
  - Frontend env: `NEXT_PUBLIC_API_BASE=https://app.example.com/v1`
  - Ensure proxy forwards `Authorization`, `Idempotency-Key`, and respects timeouts.

- Split-domain + CORS
  - Frontend: `app.example.com`, Backend: `api.example.com`
  - Backend enables CORS for `Origin: https://app.example.com`
  - Frontend env: `NEXT_PUBLIC_API_BASE=https://api.example.com/v1`

## Common Issues & Fixes
- Launch search shows nothing
  - Check `http://localhost:3000/v1/assets` → should return JSON array.
  - Ensure backend 3001 is up; frontend env uses proxy base (3000/v1), not 3001.

- 401 on `POST /v1/baskets/calculate`
  - Missing `Authorization` header. Use demo token or real auth.

- ECONNREFUSED during proxy
  - Backend not running or wrong `NEXT_PUBLIC_API_PROXY_TARGET` port.

- Next dev manifest/ChunkLoadError (dev-only)
  - Clear cache: `rm -rf .next`
  - Use webpack dev: `pnpm run dev:webpack`
  - Keep only one Next config (mjs), remove npm lockfile (use pnpm only).

## Quick Commands
Reinstall and run (clean)
```
rm -rf .next node_modules
pnpm i
pnpm run dev:all
```

Backend only
```
pnpm -C backend dev
```

Frontend only (webpack dev)
```
pnpm run dev:webpack
```

Prod test
```
pnpm run build:all
pnpm run start:all
```

## Handover Notes
- Frontend reads `NEXT_PUBLIC_API_BASE` and assumes it includes `/v1`.
- Proxy rewrites are set in `next.config.mjs` for `/v1/*` and `/health`.
- `/v1/assets` is the source of truth for search; make sure backend upstream URLs are correct.
- Protected routes require Bearer token; demo token is configurable from env.

