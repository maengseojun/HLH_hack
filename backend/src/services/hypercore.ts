// backend/src/services/hypercore.ts
import axios from 'axios';
import { config } from '../config.js';
import { cacheService } from '../cache/cacheService.js';
import { fetchAssetDetail } from './hyperliquid.js';
import { once } from '../utils/inflight.js';
import { withRetry } from '../utils/retry.js';
import { AppError } from '../utils/httpError.js';
import { CandleSnapshotSchema } from '../schemas/rpc.js';
import { z, zodIssues } from '../schemas/common.js';
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

// Use mainnet API for candleSnapshot since it's only available on public API
const baseApiUrl = config.hyperliquid.apiUrl.replace(/\/$/, '');
const infoUrl = baseApiUrl.endsWith('/info') ? baseApiUrl : `${baseApiUrl}/info`;
const publicInfoUrl = 'https://api.hyperliquid.xyz/info'; // Always use public API for candles

async function callInfo<T>(body: Record<string, unknown>): Promise<T> {
  // Use public API for candleSnapshot, regular API for other requests
  const apiUrl = body.type === 'candleSnapshot' ? publicInfoUrl : infoUrl;
  
  return withRetry(
    async () => {
      try {
        console.log(`🌐 Using API: ${apiUrl} for request type: ${body.type}`);
        console.log(`📤 Request body:`, JSON.stringify(body, null, 2));
        const { data } = await axios.post<T>(apiUrl, body, {
          timeout: 10_000,
          headers: { 'Content-Type': 'application/json' },
        });
        console.log(`📥 Response data:`, JSON.stringify(data).substring(0, 200) + '...');
        return data;
      } catch (error: any) {
        console.error('>>> AXIOS ERROR:', error.message);
        console.error('>>> AXIOS RESPONSE BODY:', JSON.stringify(error.response?.data));
        console.error('>>> FULL ERROR:', error);
        throw error;
      }
    },
    { retries: 3, minDelayMs: 300, factor: 2 },
  );
}

function normalizeSymbol(symbol: string): string {
  const trimmed = symbol.trim().toUpperCase();
  return trimmed.endsWith('-PERP') ? trimmed.replace('-PERP', '') : trimmed;
}

async function resolveSymbolForCandles(symbol: string, marketType?: 'perp' | 'spot', spotIndex?: number): Promise<string> {
  // Spot 자산인 경우 @{index} 형식으로 변환
  if (marketType === 'spot') {
    // 이미 @index 형식인 경우 그대로 사용
    if (symbol.trim().startsWith('@')) {
      return symbol.trim();
    }
    
    // spotIndex가 제공된 경우 @{index} 형식으로 변환
    if (typeof spotIndex === 'number') {
      return `@${spotIndex}`;
    }
    
    // fallback: 원본 심볼 그대로 사용
    return symbol.trim();
  }
  
  // Perp 자산인 경우 기존 로직 사용
  return normalizeSymbol(symbol);
}

function alignToHour(timestamp: number): number {
  return Math.floor(timestamp / HOUR_MS) * HOUR_MS;
}

function resolveCandlePlan(
  interval: '5m' | '1h' | '1d' | '7d',
  from: number,
  to: number,
): { candleInterval: '5m' | '1h' | '1d'; startTime: number; endTime: number } {
  const candleInterval = interval === '7d' ? '1d' : interval;
  return {
    candleInterval,
    startTime: from,
    endTime: to,
  };
}

function parseCandles(rawData: unknown): Candle[] {
  const parsed = CandleSnapshotSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new AppError(503, {
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'candleSnapshot response malformed',
      details: zodIssues(parsed.error),
    });
  }

  const raw = parsed.data;
  const seen = new Set<number>();
  const candles: Candle[] = [];

  for (const row of raw) {
    const timestamp = Number(row.t);
    const open = Number(row.o);
    const high = Number(row.h);
    const low = Number(row.l);
    const close = Number(row.c);
    const volume = Number(row.v);

    if (!Number.isFinite(timestamp) || ![open, high, low, close, volume].every(Number.isFinite)) {
      continue;
    }

    if (seen.has(timestamp)) continue;
    seen.add(timestamp);

    candles.push({ 
      t: timestamp, 
      o: open, 
      h: high, 
      l: low, 
      c: close, 
      v: volume 
    });
  }

  candles.sort((a, b) => a.t - b.t);
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

function enforceCandleLimit(interval: '5m' | '1h' | '1d' | '7d', start: number, end: number) {
  const duration = end - start;
  if (duration <= 0) {
    return;
  }

  const normalized = interval === '7d' ? '1d' : interval;
  const perCandleMs = normalized === '5m' ? 5 * 60 * 1000 : normalized === '1h' ? HOUR_MS : DAY_MS;
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
  interval: '5m' | '1h' | '1d' | '7d',
  from: number,
  to: number,
  marketType?: 'perp' | 'spot',
  spotIndex?: number,
): Promise<Candle[]> {
  const coin = await resolveSymbolForCandles(symbol, marketType, spotIndex);
  const plan = resolveCandlePlan(interval, from, to);
  const effectiveEnd = plan.endTime ?? plan.startTime;
  enforceCandleLimit(plan.candleInterval, plan.startTime, effectiveEnd);
  const cacheKey = `candles:${coin}:${plan.candleInterval}:${plan.startTime}:${plan.endTime}:${marketType || 'perp'}`;
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
    console.log(`🔍 Requesting candles for ${coin} (original: ${symbol}):`, {
      interval: plan.candleInterval,
      startTime: plan.startTime,
      endTime: plan.endTime,
      startTimeISO: new Date(plan.startTime).toISOString(),
      endTimeISO: new Date(plan.endTime).toISOString(),
      isValidStart: Number.isFinite(plan.startTime) && plan.startTime > 0,
      isValidEnd: Number.isFinite(plan.endTime) && plan.endTime > 0,
    });
    
    const data = await callInfo(body);
    console.log(`🔄 Parsing candles data...`);
    const candles = parseCandles(data);
    console.log(`✅ Successfully parsed ${candles.length} candles`);
    
    console.log(`📊 Raw candles response for ${coin}:`, {
      candlesCount: candles.length,
      firstCandle: candles[0] ? new Date(candles[0].t).toISOString() : 'none',
      lastCandle: candles[candles.length - 1] ? new Date(candles[candles.length - 1].t).toISOString() : 'none'
    });

    if (!candles.length) {
      // Try with a more recent time range (last 24 hours) for newly listed assets
      console.log(`⚠️ No candles for ${coin} in requested range, trying recent data...`);
      
      const recentEndTime = Date.now();
      const recentStartTime = recentEndTime - (24 * 60 * 60 * 1000); // Last 24 hours
      
      const recentBody = {
        type: 'candleSnapshot',
        req: {
          coin,
          interval: '1h', // Use 1h for better coverage
          startTime: recentStartTime,
          endTime: recentEndTime,
        },
      };
      
      const recentData = await callInfo(recentBody);
      const recentCandles = parseCandles(recentData);
      
      console.log(`📊 Recent candles for ${coin}:`, {
        candlesCount: recentCandles.length,
        firstCandle: recentCandles[0] ? new Date(recentCandles[0].t).toISOString() : 'none',
        lastCandle: recentCandles[recentCandles.length - 1] ? new Date(recentCandles[recentCandles.length - 1].t).toISOString() : 'none'
      });
      
      if (!recentCandles.length) {
        throw new AppError(503, {
          code: 'EMPTY_CANDLES',
          message: `No candles returned for ${coin} (asset may be too recently listed or delisted). Requested period: ${new Date(plan.startTime).toISOString()} to ${new Date(plan.endTime).toISOString()}`,
        });
      }
      
      // Cache and return recent candles
      cacheService.set(cacheKey, recentCandles, 60);
      return recentCandles;
    }

    console.log(`💾 Caching ${candles.length} candles...`);
    cacheService.set(cacheKey, candles, 60);
    console.log(`🎉 Returning ${candles.length} candles to client`);
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

  const candles = await getCandles(symbol, '1d', startTime, endTime);
  if (!candles.length) {
    return null;
  }

  const first = candles[0]?.c;
  const last = candles[candles.length - 1]?.c;

  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) {
    return null;
  }

  const change = ((last / first) - 1) * 100;
  return Number.isFinite(change) ? change : null;
}
