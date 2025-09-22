# Local Integration & Test Checklist

This playbook walks through configuring environment variables, running the backend and frontend together, and validating the full flow with Cypress.

## 1. Environment Files

1. Copy the provided templates:
   - `cp .env.example .env.local`
   - `cp backend/.env.example backend/.env`
   - (Optional workspace split) `cp frontend/.env.example frontend/.env.local`
2. Fill in real secrets only on your machine:
   - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - Privy: `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`
   - Hyperliquid/Hypercore keys for the backend (`HYPERCORE_WALLET_KEY`, token/router addresses, etc.)
3. Optional but recommended:
   - Set `DEMO_BEARER_TOKEN` to a unique value and reuse it across backend tests/E2E specs
   - Add `LOG_LEVEL=debug` temporarily when debugging backend behaviour

> Keep all `.env*` files out of version control; they are already ignored by `.gitignore`.

## 2. Backend (Express API @ :3001)

```bash
cd backend
npm install
npm run build     # optional for type safety; skip when iterating quickly
npm run dev       # listens on http://localhost:3001 by default
```

Health checks once it boots:

```bash
curl http://localhost:3001/health
curl -H "Authorization: Bearer $DEMO_BEARER_TOKEN" http://localhost:3001/v1/assets
```

Troubleshooting:
- `ENV_INVALID` errors originate from `backend/src/schemas/env.ts`; double-check the `.env` values and types.
- The mocked bearer token defaults to `hyperindex-demo-token-2024`; override via `DEMO_BEARER_TOKEN` to align with Cypress.

## 3. Frontend (Next.js @ :3000)

In a new terminal:

```bash
npm install
npm run dev:local
```

Key points:
- `NEXT_PUBLIC_API_URL` should resolve to the backend’s `/v1` prefix (`http://localhost:3001/v1`).
- `NEXT_PUBLIC_PRIVY_APP_ID` must match the Privy dashboard configuration, otherwise login modals stay in a loading state.
- When using Supabase locally, ensure Row Level Security policies allow the signed-in Privy user to read/write.

Quick smoke tests:
- Visit `http://localhost:3000` and confirm the dashboard loads.
- Open DevTools' Network tab and verify `/v1/assets` requests return `200`.

## 4. Cypress E2E Regression

```bash
npm run dev:local   # ensure frontend keeps running (port 3000)
cd cypress
npm install        # first run only, if you use a separate node_modules
cd ..
npx cypress run    # headless
# or
npx cypress open   # interactive mode
```

Tips:
- The config in `cypress.config.ts` points to `http://localhost:3000` for UI calls and `http://localhost:3001` for API calls via `env.apiBaseUrl`.
- Seed demo data or mock responses before the run if real Hyperliquid access is unreliable.
- Videos/screenshots are disabled by default; toggle `video`/`screenshot` flags if you need artifacts for CI.

## 5. Ready-for-Commit Checklist

- [ ] `.env.local` and `backend/.env` populated with non-production secrets only
- [ ] `npm run dev:local` (frontend) and `npm run dev` (backend) both stable for 5+ minutes
- [ ] Cypress `npx cypress run` passes locally
- [ ] `pnpm run validate:env` reports “Environment templates match backend schema”
- [ ] Any new API fields mirrored between backend types and frontend clients (`backend/src/types` ↔ `lib/api.ts`)
- [ ] (Optional) `npm run test:backend` for Jest coverage on backend utilities

Document any deviations from this checklist inside your PR description to keep reviewers aligned.
