import 'dotenv/config';

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: toNumber(process.env.PORT, 3000),
  hyperliquid: {
    apiUrl: process.env.HYPERLIQUID_API_URL ?? 'https://api.testnet.hyperliquid.xyz',
    timeoutMs: toNumber(process.env.REQUEST_TIMEOUT_MS, 10000)
  },
  hypercore: {
    rpcUrl: process.env.HYPERCORE_RPC_URL ?? 'https://testnet.hypercore.hyperliquid.xyz',
    walletPrivateKey: process.env.HYPERCORE_WALLET_KEY ?? '',
    timeout: toNumber(process.env.HYPERCORE_TIMEOUT, 30000)
  },
  info: {
    apiUrl: process.env.INFO_API_URL ?? 'https://api.testnet.hyperliquid.xyz/info'
  },
  cache: {
    ttlSeconds: toNumber(process.env.CACHE_TTL_SECONDS, 60),
    staleSeconds: toNumber(process.env.CACHE_STALE_TTL, 180)
  },
  rateLimit: {
    windowMs: toNumber(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: toNumber(process.env.RATE_LIMIT_MAX, 100)
  }
} as const;
