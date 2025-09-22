# Operator Checklist (Manual Steps)

Use this as a companion to the automated assets in the repository.

## Local Readiness

- [ ] Duplicate `.env.example` → `.env.local` and inject real Supabase + Privy keys
- [ ] Duplicate `backend/.env.example` → `backend/.env` with Hypercore credentials and demo tokens
- [ ] Start backend: `npm run dev` inside `backend/` (expect health check OK on :3001)
- [ ] Start frontend: `npm run dev:local` at repo root (UI reachable on :3000)
- [ ] Run Cypress (`npx cypress run`) and resolve any failing specs before progressing

## Vercel Deployment

- [ ] Decide on hosting approach: API routes inside Next.js or external backend URL
- [ ] Push latest code to the Git repo connected to Vercel
- [ ] Configure Vercel project environment variables to mirror `.env.local`
- [ ] Trigger a Preview deployment; smoke test login, asset list, basket calculator
- [ ] Promote Preview → Production via Vercel dashboard once validated

## Post-Deploy Guardrails

- [ ] Enable Vercel Analytics or connect Sentry/Logflare for monitoring
- [ ] Set up GitHub Action (or alternative CI) that runs lint + backend tests + Cypress before deploy
- [ ] Record the deployed `NEXT_PUBLIC_API_URL` and share with the team to avoid stale env configs
- [ ] Schedule a recurring review of Hyperliquid keys and rotate secrets as needed

### GitHub Actions quick-start

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run validate:env
      - run: pnpm run lint
      - run: pnpm run test

  e2e:
    runs-on: ubuntu-latest
    needs: lint-test
    services:
      backend:
        image: node:20
        ports:
          - 3001:3001
        options: >-
          --health-cmd "curl --fail http://localhost:3001/health || exit 1"
          --health-interval 10s
          --health-timeout 10s
          --health-retries 3
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run dev:local -- --hostname 0.0.0.0 &
      - run: pnpm exec wait-on http://127.0.0.1:3000
      - run: pnpm exec cypress run --config baseUrl=http://127.0.0.1:3000
```

Check off each item before considering the release “done”.
