import axios from 'axios';
import { AppError } from '../utils/httpError.js';
import { config } from '../config.js';
import {
  normalizeMetaAndAssetCtxs,
  getAssetBySymbolOrThrow,
  getAssetByIdOrThrow,
  type NormalizedMetaAndAssetCtxs,
  type NormalizedAsset
} from '../schemas/metaAdapter.js';

type CacheEntry<T> = { ts: number; val: T; inflight?: Promise<T> };
const cache = new Map<string, CacheEntry<any>>();
const META_TTL_MS = 15_000;

const infoUrl = config.info.apiUrl;

function swr<T>(key: string, loader: () => Promise<T>, ttlMs = META_TTL_MS): Promise<T> {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.ts < ttlMs) {
    return Promise.resolve(hit.val as T);
  }
  if (hit?.inflight) {
    return hit.inflight as Promise<T>;
  }
  const inflight = loader()
    .then((val) => {
      cache.set(key, { ts: Date.now(), val });
      return val;
    })
    .finally(() => {
      const entry = cache.get(key);
      if (entry) entry.inflight = undefined;
    });
  cache.set(key, { ts: 0, val: hit?.val, inflight });
  return inflight;
}

async function fetchMetaAndCtxs(): Promise<NormalizedMetaAndAssetCtxs> {
  try {
    const { data } = await axios.post(infoUrl, { type: 'metaAndAssetCtxs' }, { timeout: 10_000 });
    return normalizeMetaAndAssetCtxs(data); // 여기서 경계 정규화 수행
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, { code: 'UPSTREAM_UNAVAILABLE', message: 'metaAndAssetCtxs fetch failed', details: `${error}` });
  }
}

// 호환성을 위한 타입 별칭들
export type Instrument = NormalizedAsset;
export type InstrumentRow = NormalizedAsset;
export type InstrumentsIndex = NormalizedMetaAndAssetCtxs;

// 호환성을 위한 AssetCtx 타입
export type AssetCtx = {
  markPx: number | null;
  prevDayPx: number | null;
  funding: number | null;
  openInterest: number | null;
  dayNtlVlm: number | null;
  premium: number | null;
};

export async function getInstrumentsIndex(): Promise<InstrumentsIndex> {
  return swr('meta:index:v4', async () => await fetchMetaAndCtxs(), META_TTL_MS);
}

export async function resolveInstrument(key: string): Promise<InstrumentRow> {
  const idx = await getInstrumentsIndex();
  return getAssetBySymbolOrThrow(idx, key);
}

export async function resolveInstrumentByAssetId(assetId: number): Promise<InstrumentRow> {
  const idx = await getInstrumentsIndex();
  return getAssetByIdOrThrow(idx, assetId);
}

export function change24hPct(markPx: number | null, prevDayPx: number | null): number | null {
  if (markPx == null || prevDayPx == null || prevDayPx === 0) {
    return null;
  }
  return ((markPx / prevDayPx) - 1) * 100;
}

export async function refreshInstrumentsIndex(): Promise<InstrumentsIndex> {
  const normalized = await fetchMetaAndCtxs();
  cache.set('meta:index:v4', { ts: Date.now(), val: normalized });
  return normalized;
}
