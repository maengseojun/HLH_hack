// backend/src/services/hypercore.ts
import axios from 'axios';
import { config } from '../config.js';
import { cacheService } from '../cache/cacheService.js';
import { fetchAssetDetail } from './hyperliquid.js';
import { once } from '../utils/inflight.js';
import { withRetry } from '../utils/retry.js';
import { AppError } from '../utils/httpError.js';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

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

export async function getCandles(
  symbol: string,
  interval: '1h' | '1d' | '7d',
  from: number,
  to: number,
): Promise<Candle[]> {
  const coin = normalizeSymbol(symbol);
  const plan = resolveCandlePlan(interval, from, to);
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
        message: `No candles returned for ${coin}`,
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
