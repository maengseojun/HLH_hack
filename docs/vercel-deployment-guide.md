# Vercel Deployment Guide

This document captures decision points and repeatable steps for deploying HyperIndex to Vercel, both with and without the standalone Express backend.

## 1. Prerequisites

- Git repository pushed to GitHub/GitLab/Bitbucket
- `frontend` (Next.js) builds successfully with `npm run build`
- `.env.local` mirrors production-ready values (never commit secrets)
- Optional: backend hosted separately (AWS, Render, Fly.io, etc.) if you are not moving endpoints into Next.js API Routes

## 2. Frontend-Only Deployment (Backend Hosted Elsewhere)

1. **Create a Vercel project** targeting the repo and set the framework root to the repository root (`/`).
2. **Build settings**
   - Build command: `npm run build`
   - Install command: `npm install`
   - Output directory: `.next`
3. **Environment variables** (Project Settings → Environment Variables)
   - `NEXT_PUBLIC_API_URL=https://your-backend-host/v1`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_PRIVY_APP_ID`
   - `PRIVY_APP_SECRET`
   - Any additional feature flags from `.env.local`
4. **Preview deployments** inherit environment variables when you select “Automatically expose to Preview Deployments”. Add masked values for production secrets.
5. Trigger a deployment by pushing to the default branch. Verify the URL once Vercel finishes building.

## 3. Migrating Express Endpoints to Next.js API Routes

To consolidate hosting on Vercel, port targeted backend handlers into `app/api/*` routes.

1. **Identify candidate routes**: Focus on read-only or lightweight POST endpoints (e.g., `/v1/assets`, `/v1/baskets/calculate`). Leave heavy WebSocket streaming or long-running jobs on the dedicated backend.
2. **Create mirrored route files** inside `app/api/v1/.../route.ts`:

```ts
// app/api/v1/assets/route.ts
import { NextResponse } from 'next/server';
import { listAssets } from '../../../../backend/src/services/assets';

export async function GET() {
  try {
    const assets = await listAssets();
    return NextResponse.json(assets, { status: 200 });
  } catch (error) {
    console.error('assets GET failed', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
```

3. **Add equivalent handlers for write or parameterised endpoints**. For example:

```ts
// app/api/v1/baskets/calculate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { calcBasketFromCandles } from '../../../../backend/src/services/basket';
import { getCandles } from '../../../../backend/src/services/hypercore';

export async function POST(request: NextRequest) {
  const payload = await request.json();
  try {
    const candles = await Promise.all(
      payload.assets.map(async (asset: { symbol: string; weight: number; position: string; leverage?: number }) => ({
        symbol: asset.symbol,
        weight: asset.weight,
        position: asset.position,
        leverage: asset.leverage,
        candles: await getCandles(asset.symbol, payload.interval),
      })),
    );
    const result = calcBasketFromCandles(candles);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('basket calculate failed', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
```

```ts
// app/api/v1/assets/[symbol]/candles/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCandles } from '../../../../backend/src/services/hypercore';

export async function GET(request: NextRequest, { params }: { params: { symbol: string } }) {
  const interval = request.nextUrl.searchParams.get('interval') ?? '1d';
  try {
    const candles = await getCandles(params.symbol, interval);
    return NextResponse.json(candles, { status: 200 });
  } catch (error) {
    console.error('candles fetch failed', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
```

4. **Share business logic** by moving pure functions from `backend/src` into a shared workspace (e.g., `packages/shared` or `lib/server`). Avoid duplicating request validation.

| V1 Endpoint | Current backend source | Suggested Next.js route |
| --- | --- | --- |
| `GET /v1/assets` | `backend/src/routes/assets.ts` | `app/api/v1/assets/route.ts` |
| `POST /v1/baskets/calculate` | `backend/src/routes/baskets.ts` | `app/api/v1/baskets/calculate/route.ts` |
| `GET /v1/assets/:symbol/candles` | `backend/src/routes/assets.ts` | `app/api/v1/assets/[symbol]/candles/route.ts` |

5. **Rewrite external calls** to respect Vercel execution limits:
   - Use `fetch` with `AbortController` timeouts < 10 seconds
   - Cache frequently accessed data with `unstable_cache` or `revalidateTag`
6. **Update `next.config.mjs`** to keep friendly URLs:

```js
const nextConfig = {
  async rewrites() {
    return [
      { source: '/v1/:path*', destination: '/api/v1/:path*' },
    ]
  },
}

export default nextConfig
```

7. **Remove or guard server-only secrets**: API Routes run on the server, but anything prefixed with `NEXT_PUBLIC_` is exposed to the browser. Move sensitive values (e.g., `HYPERCORE_WALLET_KEY`) to server-side only modules.
8. **Regression test** locally via `npm run dev:local` and the existing Cypress suites before deploying.

## 4. Vercel + Standalone Backend (Hybrid)

If the backend remains on another host:

- Keep `NEXT_PUBLIC_API_URL` pointing at the external base URL.
- Use Vercel “Environment Variables → Link” to sync secrets from a central vault if available.
- Allow CORS on the backend to accept requests from the Vercel domain or configure Next.js rewrites to proxy calls through `/api` to avoid CORS entirely.

Example rewrite staying within Vercel while the backend lives elsewhere:

```js
export default {
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: 'https://api.your-backend.com/v1/:path*',
      },
    ];
  },
}
```

## 5. Post-Deployment Validation

- Open the Vercel Preview/Production URL and perform: login → dashboard → basket calculation.
- Confirm API responses via browser DevTools (`/v1/assets`, `/v1/baskets/calculate`, `/v1/candles`).
- Review Vercel build logs for warnings about unresolved environment variables or edge/serverless timeouts.
- Enable Vercel Analytics or hook into Sentry/Logflare for centralized monitoring.
- (Optional) Configure a GitHub Action that runs `npm run lint`, `npm run test:backend`, and `npx cypress run` before Vercel deployments.

## 6. Rollback Strategy

- Use Vercel’s “Redeploy” dropdown to pin a previous deployment if a release fails.
- Keep the standalone backend on a separate deploy pipeline so you can revert independently from the frontend.
- Maintain versioned `.env.production` files in your secret manager to avoid mismatches between environments.

Following these steps keeps the Vercel project reproducible and minimizes surprises between local integration tests and production deployments.
