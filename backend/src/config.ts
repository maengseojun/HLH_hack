import 'dotenv/config';
import { loadEnv } from './schemas/env.js';

const loaded = loadEnv();

export const config = {
  port: loaded.PORT,
  hyperliquid: {
    apiUrl: loaded.HYPERLIQUID_API_URL,
    timeoutMs: loaded.REQUEST_TIMEOUT_MS,
  },
  hypercore: {
    rpcUrl: loaded.HYPERCORE_RPC_URL,
    walletPrivateKey: loaded.HYPERCORE_WALLET_KEY,
    timeout: loaded.HYPERCORE_TIMEOUT,
    coreWriterAddress: loaded.CORE_WRITER_ADDRESS,
    maxSlippageBps: loaded.MAX_SLIPPAGE_BPS,
    maxLeverage: loaded.MAX_LEVERAGE,
    minNotionalUsd: loaded.MIN_NOTIONAL_USD,
  },
  info: {
    apiUrl: loaded.INFO_API_URL,
  },
  chain: {
    rpcUrl: loaded.CHAIN_RPC_URL,
    chainId: loaded.CHAIN_ID,
  },
  tokens: {
    usdc: loaded.USDC_TOKEN_ADDRESS,
  },
  router: {
    payment: loaded.PAYMENT_ROUTER_ADDRESS,
    feeBps: loaded.PLATFORM_FEE_BPS,
  },
  cache: {
    ttlSeconds: loaded.CACHE_TTL_SECONDS,
    staleSeconds: loaded.CACHE_STALE_TTL,
  },
  rateLimit: {
    windowMs: loaded.RATE_LIMIT_WINDOW_MS,
    max: loaded.RATE_LIMIT_MAX,
  },
} as const;
