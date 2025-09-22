import { z } from './common.js';
import { zAddress } from './common.js';
import { zodIssues } from './common.js';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['test', 'development', 'production', 'testnet']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),

    HYPERLIQUID_API_URL: z.string().url().default('https://api.testnet.hyperliquid.xyz'),
    REQUEST_TIMEOUT_MS: z.coerce.number().int().min(0).default(10_000),

    HYPERCORE_RPC_URL: z.string().url().default('https://testnet.hypercore.hyperliquid.xyz'),
    HYPERCORE_WALLET_KEY: z.string().default(''),
    HYPERCORE_TIMEOUT: z.coerce.number().int().min(0).default(30_000),
    CORE_WRITER_ADDRESS: zAddress.default('0x3333333333333333333333333333333333333333'),
    MAX_SLIPPAGE_BPS: z.coerce.number().int().min(0).default(200),
    MAX_LEVERAGE: z.coerce.number().int().min(1).default(50),
    MIN_NOTIONAL_USD: z.coerce.number().min(0).default(1),

    INFO_API_URL: z.string().url().default('https://api.testnet.hyperliquid.xyz/info'),

    CHAIN_RPC_URL: z.string().url().default('https://arb-sepolia.arbitrum.io/rpc'),
    CHAIN_ID: z.coerce.number().int().default(421_614),

    USDC_TOKEN_ADDRESS: zAddress.default('0x0000000000000000000000000000000000000000'),
    PAYMENT_ROUTER_ADDRESS: zAddress.default('0x0000000000000000000000000000000000000000'),
    PLATFORM_FEE_BPS: z.coerce.number().int().min(0).default(0),

    CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(60),
    CACHE_STALE_TTL: z.coerce.number().int().min(0).default(180),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(0).default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(0).default(100),

    DEMO_TOKEN: z.string().optional(),
  })
  .passthrough();

export type Env = z.infer<typeof EnvSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = JSON.stringify(zodIssues(parsed.error), null, 2);
    throw new Error(`ENV_INVALID: ${issues}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export const env = loadEnv();

