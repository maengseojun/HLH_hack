// Lightweight API client for HyperIndex v1 endpoints
// Reads NEXT_PUBLIC_API_BASE (should include the /v1 prefix)

export type ApiErrorCode =
  | "INVALID_QUERY"
  | "WEIGHT_SUM_INVALID"
  | "RANGE_TOO_LARGE"
  | "UPSTREAM_503"
  | string;

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
    retryAfterSec?: number;
  };
}

export interface Asset {
  name: string;
  symbol: string;
  markPx: number;
  dayNtlVlm: number;
  openInterest: number;
  maxLeverage: number;
  change24h?: number | null;
  funding?: number | null;
  premium?: number | null;
}

export interface AssetDetail extends Asset {
  change7d?: number | null;
  impactPxs?: number[];
}

export interface Candle {
  t: number; // timestamp (ms or s depending on backend)
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

export interface CandlesResponse<TMeta = unknown> {
  data?: Candle[];
  candles?: Candle[]; // allow either key
  meta?: TMeta;
}

export type PositionSide = "long" | "short";

export interface BasketItemInput {
  symbol: string; // e.g., BTC-PERP
  weight: number; // sum to 1.0 (±1e-6)
  position: PositionSide;
  leverage?: number; // optional per IA
}

export interface BasketCalculateInput {
  interval: "1d" | "7d" | string;
  assets: BasketItemInput[];
}

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");

function codeToMessage(code: ApiErrorCode): string {
  switch (code) {
    case "WEIGHT_SUM_INVALID":
      return "Weights must sum to 1.0";
    case "RANGE_TOO_LARGE":
      return "Requested time range is too large";
    case "UPSTREAM_503":
      return "Upstream temporarily unavailable. Please try again";
    case "INVALID_QUERY":
      return "Invalid query parameters";
    default:
      return "Unexpected error";
  }
}

async function fetchJson<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE is not set");
  const url = `${API_BASE}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init?.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      signal: controller.signal,
    });

    const text = await res.text();
    let json: unknown = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      // leave json undefined
    }

    if (!res.ok) {
      const env = json as ApiErrorEnvelope | undefined;
      const code = env?.error?.code ?? `${res.status}`;
      const message = env?.error?.message ?? codeToMessage(code);
      const retryAfterSec = env?.error?.retryAfterSec;
      const error: Error & { code?: ApiErrorCode; retryAfterSec?: number; details?: unknown } = new Error(message);
      error.code = code;
      if (retryAfterSec) error.retryAfterSec = retryAfterSec;
      error.details = env?.error?.details;
      throw error;
    }

    return (json as T) ?? ({} as T);
  } finally {
    clearTimeout(timeout);
  }
}

// Public endpoints

export async function getAssets(): Promise<Asset[]> {
  return fetchJson<Asset[]>(`/assets`);
}

export async function getAsset(symbol: string): Promise<AssetDetail> {
  return fetchJson<AssetDetail>(`/assets/${encodeURIComponent(symbol)}`);
}

export async function getCandles(symbol: string, interval: string): Promise<CandlesResponse> {
  return fetchJson<CandlesResponse>(`/assets/${encodeURIComponent(symbol)}/candles?interval=${encodeURIComponent(interval)}`);
}

export function validateWeightsSumOne(items: BasketItemInput[]): { ok: true } | { ok: false; sum: number } {
  const sum = items.reduce((a, b) => a + (Number.isFinite(b.weight) ? b.weight : 0), 0);
  return Math.abs(sum - 1) <= 1e-6 ? { ok: true } : { ok: false, sum };
}

export async function postBasketCalculate(input: BasketCalculateInput): Promise<unknown> {
  const check = validateWeightsSumOne(input.assets);
  if (!check.ok) {
    const err = new Error(`Weights must sum to 1.0 (got ${check.sum.toFixed(4)})`);
    (err as any).code = "WEIGHT_SUM_INVALID" as ApiErrorCode;
    throw err;
  }
  return fetchJson<unknown>(`/baskets/calculate`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Health endpoint (outside /v1 in some envs). Use best effort.
export async function getHealth(): Promise<unknown> {
  // If API_BASE already has /v1, go up one level for /health
  const base = API_BASE.endsWith("/v1") ? API_BASE.slice(0, -3) : API_BASE;
  const url = `${base}/health`;
  const res = await fetch(url, { cache: "no-store" });
  return res.json().catch(() => ({}));
}

