# Environment Variable Schema

Maintain this table alongside `.env.example`, `backend/.env.example`, and `backend/src/schemas/env.ts`. Values without the `NEXT_PUBLIC_` prefix must never be exposed to the browser or committed to Git.

## Shared keys

| Variable | Scope | Description | Example |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Frontend, Vercel | Base URL for REST calls (include `/v1` prefix). | `http://localhost:3001/v1` |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend, Backend | Supabase project URL. | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend, Backend | Public anon key for Supabase client. | `public-anon-key` |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend only | Supabase service role key used by server utilities. | `service-role-key` |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Frontend, Backend | Privy application identifier used for auth flows. | `app-id` |
| `PRIVY_APP_SECRET` | Backend only | Privy server secret for webhook/token validation. | `super-secret` |

## Frontend-only keys

| Variable | Description | Example |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Fully qualified frontend URL (used in redirects). | `http://localhost:3000` |
| `PORT` | Port consumed by `npm run dev:local`. | `3000` |

## Backend-only keys

| Variable | Description | Example |
| --- | --- | --- |
| `NODE_ENV` | Execution environment. | `development` |
| `PORT` | Express server port. | `3001` |
| `LOG_LEVEL` | Pino logging level. | `info` |
| `AUTH_MODE` | Authentication mode (`bearer` or `jwt`). | `bearer` |
| `DEMO_BEARER_TOKEN` | Shared token for demo auth. | `hyperindex-demo-token-2024` |
| `DEMO_TOKEN` | Cypress/demo token for tests. | `test_token_for_e2e` |
| `HYPERLIQUID_API_URL` | Hyperliquid REST endpoint. | `https://api.testnet.hyperliquid.xyz` |
| `INFO_API_URL` | Info API endpoint. | `https://api.testnet.hyperliquid.xyz/info` |
| `REQUEST_TIMEOUT_MS` | Upstream timeout for REST calls (ms). | `10000` |
| `HYPERCORE_RPC_URL` | Hypercore RPC endpoint. | `https://testnet.hypercore.hyperliquid.xyz` |
| `HYPERCORE_WALLET_KEY` | Testnet private key for read/write. | `0x...` |
| `HYPERCORE_TIMEOUT` | Hypercore RPC timeout (ms). | `30000` |
| `CORE_WRITER_ADDRESS` | Core writer contract address. | `0x...` |
| `MAX_SLIPPAGE_BPS` | Max slippage in basis points. | `200` |
| `MAX_LEVERAGE` | Maximum leverage multiplier. | `50` |
| `MIN_NOTIONAL_USD` | Minimum notional amount. | `1` |
| `CHAIN_RPC_URL` | Settlement chain RPC endpoint. | `https://arb-sepolia.arbitrum.io/rpc` |
| `CHAIN_ID` | Settlement chain ID. | `421614` |
| `USDC_TOKEN_ADDRESS` | USDC token address on settlement chain. | `0x...` |
| `PAYMENT_ROUTER_ADDRESS` | Payment router address. | `0x...` |
| `PLATFORM_FEE_BPS` | Platform fee in basis points. | `0` |
| `CACHE_TTL_SECONDS` | Cache TTL (seconds). | `60` |
| `CACHE_STALE_TTL` | SWR stale TTL (seconds). | `180` |
| `RATE_LIMIT_WINDOW_MS` | Rate-limit window (ms). | `60000` |
| `RATE_LIMIT_MAX` | Requests per window. | `100` |
| `SMOKE_BASE_URL` | Optional override for smoke tests. | `http://localhost:3000/v1` |

Update this file whenever a new environment variable is introduced or renamed to keep the templates and runtime validation in sync.
