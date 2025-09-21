// backend/src/services/hypercore.ts
import axios from 'axios';
import { config } from '../config.js';
import { cacheService } from '../cache/cacheService.js';
import { fetchAssetDetail } from './hyperliquid.js';
import { once } from '../utils/inflight.js';
import { withRetry } from '../utils/retry.js';
import { AppError } from '../utils/httpError.js';
import type { Candle } from '../types/domain.js';

type FundingHistoryPoint = { timestamp: number; value: number };

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const FIVE_THOUSAND = 5000;
const FUNDING_HISTORY_DEFAULT_LIMIT = 168;
const FUNDING_HISTORY_TTL_SECONDS = 60;
const FUNDING_HISTORY_STALE_SECONDS = 120;
const CHANGE_7D_WINDOW_MS = 7 * DAY_MS;

export interface OnChainAsset {
  symbol: string;
  markPx: number;
  maxLeverage: number;
  fundingRate: number;
}

const baseApiUrl = config.hyperliquid.apiUrl.replace(/\/$/, '');
const infoUrl = baseApiUrl.endsWith('/info') ? baseApiUrl : `${baseApiUrl}/info`;

async function callInfo<T>(body: Record<string, unknown>): Promise<T> {
  return withRetry(
    async () => {
      const { data } = await axios.post<T>(infoUrl, body, {
        timeout: 10_000,
        headers: { 'Content-Type': 'application/json' },
      });
      return data;
    },
    { retries: 3, minDelayMs: 300, factor: 2 },
  );
}

function normalizeSymbol(symbol: string): string {
  const trimmed = symbol.trim().toUpperCase();
  return trimmed.endsWith('-PERP') ? trimmed.replace('-PERP', '') : trimmed;
}

function alignToHour(timestamp: number): number {
  return Math.floor(timestamp / HOUR_MS) * HOUR_MS;
}

function resolveCandlePlan(
  interval: '1h' | '1d' | '7d',
  from: number,
  to: number,
): { candleInterval: '1h' | '1d'; startTime: number; endTime: number } {
  if (interval === '7d') {
    const endTime = to || Date.now();
    const startTime = from || endTime - 7 * 24 * 60 * 60 * 1000;
    return { candleInterval: '1d', startTime, endTime };
  }

  return {
    candleInterval: interval,
    startTime: from,
    endTime: to,
  };
}

function parseCandles(rawData: unknown): Candle[] {
  const raw = Array.isArray((rawData as any)?.candles) ? (rawData as any).candles : [];
  const seen = new Set<number>();
  const candles: Candle[] = [];

  for (const row of raw) {
    if (!Array.isArray(row)) continue;

    const timestamp = Number(row[0]);
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    const volume = Number(row[5]);

    if (!Number.isFinite(timestamp) || ![open, high, low, close, volume].every(Number.isFinite)) {
      continue;
    }

    if (seen.has(timestamp)) continue;
    seen.add(timestamp);

    candles.push({ timestamp, open, high, low, close, volume });
  }

  candles.sort((a, b) => a.timestamp - b.timestamp);
  return candles;
}

function parseFundingHistory(rawData: unknown, limit: number): FundingHistoryPoint[] {
  const fundingRoot = Array.isArray((rawData as any)?.funding)
    ? (rawData as any).funding
    : (rawData as any)?.req && Array.isArray((rawData as any).req.funding)
      ? (rawData as any).req.funding
      : undefined;

  const rawArray = Array.isArray(rawData)
    ? rawData
    : fundingRoot ?? [];

  const seen = new Set<number>();
  const history: FundingHistoryPoint[] = [];

  for (const record of rawArray) {
    const timeValue = (record as any)?.time ?? (record as any)?.timestamp ?? (Array.isArray(record) ? record[0] : undefined);
    const fundingValue = (record as any)?.fundingRate ?? (record as any)?.value ?? (Array.isArray(record) ? record[1] : undefined);

    const timestamp = Number(timeValue);
    const value = Number(fundingValue);

    if (!Number.isFinite(timestamp) || !Number.isFinite(value)) {
      continue;
    }

    if (seen.has(timestamp)) {
      continue;
    }

    seen.add(timestamp);
    history.push({ timestamp, value });
  }

  history.sort((a, b) => a.timestamp - b.timestamp);
  if (limit > 0 && history.length > limit) {
    return history.slice(-limit);
  }
  return history;
}

function enforceCandleLimit(interval: '1h' | '1d' | '7d', start: number, end: number) {
  const duration = end - start;
  if (duration <= 0) {
    return;
  }

  const perCandleMs = interval === '1h' ? HOUR_MS : DAY_MS;
  const estimatedCandles = Math.ceil(duration / perCandleMs);
  if (estimatedCandles > FIVE_THOUSAND) {
    throw new AppError(400, {
      code: 'LOOKBACK_EXCEEDED',
      message: 'Requested range exceeds the 5000-candle window enforced by Hyperliquid',
      details: {
        interval,
        estimatedCandles,
        maxCandles: FIVE_THOUSAND,
      },
    });
  }
}

export async function getCandles(
  symbol: string,
  interval: '1h' | '1d' | '7d',
  from: number,
  to: number,
): Promise<Candle[]> {
  const coin = normalizeSymbol(symbol);
  const plan = resolveCandlePlan(interval, from, to);
  const effectiveEnd = plan.endTime ?? plan.startTime;
  enforceCandleLimit(plan.candleInterval, plan.startTime, effectiveEnd);
  const cacheKey = `candles:${coin}:${plan.candleInterval}:${plan.startTime}:${plan.endTime}`;
  const cacheHit = cacheService.getWithMeta<Candle[]>(cacheKey);

  const body = {
    type: 'candleSnapshot',
    req: {
      coin,
      interval: plan.candleInterval,
      startTime: plan.startTime,
      endTime: plan.endTime,
    },
  };

  const fetchAndCache = async () => {
    const data = await callInfo(body);
    const candles = parseCandles(data);

    if (!candles.length) {
      throw new AppError(503, {
        code: 'EMPTY_CANDLES',
        message: `No candles returned for ${coin} (official API exposes only the most recent 5000 candles)`,
      });
    }

    cacheService.set(cacheKey, candles, 60);
    return candles;
  };

  if (cacheHit) {
    if (!cacheHit.isStale) {
      return cacheHit.value;
    }

    void once(cacheKey, fetchAndCache).catch((error) => {
      console.warn(`Failed to revalidate cache for ${cacheKey}:`, error);
    });

    return cacheHit.value;
  }

  return once(cacheKey, fetchAndCache);
}

export async function getOnChainAsset(symbol: string): Promise<OnChainAsset> {
  const cacheKey = `onchain:${symbol}`;
  const cached = cacheService.get<OnChainAsset>(cacheKey);
  if (cached) {
    return cached;
  }

  const detail = await fetchAssetDetail(symbol.trim().toUpperCase());
  if (!detail) {
    throw new Error(`Asset ${symbol} not found`);
  }

  const result: OnChainAsset = {
    symbol,
    markPx: detail.markPx,
    maxLeverage: detail.maxLeverage,
    fundingRate: detail.funding ?? 0,
  };

  cacheService.set(cacheKey, result);
  return result;
}

export async function getFundingHistory(
  symbol: string,
  options: { limit?: number } = {},
): Promise<FundingHistoryPoint[]> {
  const coin = normalizeSymbol(symbol);
  const limit = Math.max(1, Math.min(options.limit ?? FUNDING_HISTORY_DEFAULT_LIMIT, 1000));
  const cacheKey = `fundingHistory:${coin}:${limit}`;
  const cacheHit = cacheService.getWithMeta<FundingHistoryPoint[]>(cacheKey);

  const fetchAndCache = async () => {
    const endTime = alignToHour(Date.now());
    const startTime = endTime - limit * HOUR_MS;

    const data = await callInfo<unknown>({
      type: 'fundingHistory',
      req: {
        coin,
        startTime,
        endTime,
      },
    });

    const history = parseFundingHistory(data, limit);
    cacheService.set(cacheKey, history, FUNDING_HISTORY_TTL_SECONDS, { staleSeconds: FUNDING_HISTORY_STALE_SECONDS });
    return history;
  };

  if (cacheHit) {
    if (!cacheHit.isStale) {
      return cacheHit.value;
    }

    void once(cacheKey, fetchAndCache).catch((error) => {
      console.warn(`Failed to revalidate funding history for ${coin}:`, error);
    });

    return cacheHit.value;
  }

  return once(cacheKey, fetchAndCache);
}

export async function getChange7dPct(symbol: string): Promise<number | null> {
  const endTime = Date.now();
  const startTime = endTime - CHANGE_7D_WINDOW_MS;

  const candles = await getCandles(symbol, '7d', startTime, endTime);
  if (!candles.length) {
    return null;
  }

  const first = candles[0]?.close;
  const last = candles[candles.length - 1]?.close;

  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) {
    return null;
  }

  const change = ((last / first) - 1) * 100;
  return Number.isFinite(change) ? change : null;
}
