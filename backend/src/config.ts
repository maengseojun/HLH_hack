import 'dotenv/config';

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toAddress = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.startsWith('0x') && trimmed.length === 42 ? trimmed : fallback;
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
    timeout: toNumber(process.env.HYPERCORE_TIMEOUT, 30000),
    coreWriterAddress: toAddress(process.env.CORE_WRITER_ADDRESS, '0x3333333333333333333333333333333333333333'),
    maxSlippageBps: toNumber(process.env.MAX_SLIPPAGE_BPS, 200),
    maxLeverage: toNumber(process.env.MAX_LEVERAGE, 50),
    minNotionalUsd: toNumber(process.env.MIN_NOTIONAL_USD, 1)
  },
  info: {
    apiUrl: process.env.INFO_API_URL ?? 'https://api.testnet.hyperliquid.xyz/info'
  },
  chain: {
    rpcUrl: process.env.CHAIN_RPC_URL ?? 'https://arb-sepolia.arbitrum.io/rpc',
    chainId: toNumber(process.env.CHAIN_ID, 421_614)
  },
  tokens: {
    usdc: toAddress(process.env.USDC_TOKEN_ADDRESS, '0x0000000000000000000000000000000000000000')
  },
  router: {
    payment: toAddress(process.env.PAYMENT_ROUTER_ADDRESS, '0x0000000000000000000000000000000000000000'),
    feeBps: toNumber(process.env.PLATFORM_FEE_BPS, 0)
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
