import axios from 'axios';
import { z } from 'zod';
import { AppError } from '../utils/httpError.js';
import { config } from '../config.js';

const UniverseItem = z.object({
  name: z.string().optional(),
  coin: z.string().optional(),
  ticker: z.string().optional(),
  szDecimals: z.number().int().nonnegative().optional(),
  sizeDecimals: z.number().int().nonnegative().optional(),
  priceDecimals: z.number().int().nonnegative().optional(),
  maxLeverage: z.number().positive().optional(),
  assetId: z.number().int().nonnegative().optional(),
});

const AssetCtxItem = z.object({
  markPx: z.union([z.string(), z.number()]).optional(),
  prevDayPx: z.union([z.string(), z.number()]).optional(),
  funding: z.union([z.string(), z.number()]).optional(),
  openInterest: z.union([z.string(), z.number()]).optional(),
  dayNtlVlm: z.union([z.string(), z.number()]).optional(),
  premium: z.union([z.string(), z.number()]).optional(),
});

const MetaAndCtxsResp = z.object({
  universe: z.array(UniverseItem),
  assetCtxs: z.array(AssetCtxItem),
});

type TMeta = z.infer<typeof MetaAndCtxsResp>;
type TUni = z.infer<typeof UniverseItem>;
type TCtx = z.infer<typeof AssetCtxItem>;

type CacheEntry<T> = { ts: number; val: T; inflight?: Promise<T> };
const cache = new Map<string, CacheEntry<any>>();
const META_TTL_MS = 15_000;

const infoUrl = config.info.apiUrl;

const clampInt = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const normBase = (s: string) => s.trim().toUpperCase();
const toPerpSymbol = (base: string) => `${normBase(base)}-PERP`;

const toNum = (value: unknown): number | null => {
  if (value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function resolveDecimals(u: TUni) {
  const sz = clampInt(u.szDecimals ?? u.sizeDecimals ?? 0, 0, 18);
  const px = clampInt(u.priceDecimals ?? (6 - sz), 0, 18);
  return { sz, px };
}

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

async function fetchMetaAndCtxs(): Promise<TMeta> {
  try {
    const { data } = await axios.post(infoUrl, { type: 'metaAndAssetCtxs' }, { timeout: 10_000 });
    const parsed = MetaAndCtxsResp.safeParse(data);
    if (!parsed.success) {
      throw new AppError(503, {
        code: 'UPSTREAM_UNAVAILABLE',
        message: 'metaAndAssetCtxs malformed',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, { code: 'UPSTREAM_UNAVAILABLE', message: 'metaAndAssetCtxs fetch failed', details: `${error}` });
  }
}

export type Instrument = {
  assetId: number;
  base: string;
  symbol: string;
  szDecimals: number;
  priceDecimals: number;
  maxLeverage: number | null;
};

export type AssetCtx = {
  markPx: number | null;
  prevDayPx: number | null;
  funding: number | null;
  openInterest: number | null;
  dayNtlVlm: number | null;
  premium: number | null;
};

export type InstrumentRow = Instrument & { ctx: AssetCtx };

export type InstrumentsIndex = {
  list: InstrumentRow[];
  byBase: Map<string, InstrumentRow>;
  bySymbol: Map<string, InstrumentRow>;
  byAssetId: Map<number, InstrumentRow>;
  version: string;
};

function buildIndex(resp: TMeta): InstrumentsIndex {
  const byBase = new Map<string, InstrumentRow>();
  const bySymbol = new Map<string, InstrumentRow>();
  const byAssetId = new Map<number, InstrumentRow>();
  const list: InstrumentRow[] = [];

  const minLen = Math.min(resp.universe.length, resp.assetCtxs.length);

  for (let i = 0; i < minLen; i++) {
    const uni = resp.universe[i] ?? {};
    const ctx = resp.assetCtxs[i] ?? {};

    const baseRaw = (uni.name ?? uni.coin ?? uni.ticker ?? '').toString();
    if (!baseRaw) continue;
    const base = normBase(baseRaw);

    const { sz, px } = resolveDecimals(uni);
    const assetId = (typeof uni.assetId === 'number' && uni.assetId >= 0) ? uni.assetId : i;
    const maxLeverage = (typeof uni.maxLeverage === 'number' && uni.maxLeverage > 0) ? uni.maxLeverage : null;

    const instrument: Instrument = {
      assetId,
      base,
      symbol: toPerpSymbol(base),
      szDecimals: sz,
      priceDecimals: px,
      maxLeverage,
    };

    const ctxEntry: AssetCtx = {
      markPx: toNum(ctx.markPx),
      prevDayPx: toNum(ctx.prevDayPx),
      funding: toNum(ctx.funding),
      openInterest: toNum(ctx.openInterest),
      dayNtlVlm: toNum(ctx.dayNtlVlm),
      premium: toNum(ctx.premium),
    };

    const row: InstrumentRow = { ...instrument, ctx: ctxEntry };
    byBase.set(base, row);
    bySymbol.set(row.symbol, row);
    byAssetId.set(assetId, row);
    list.push(row);
  }

  return {
    list,
    byBase,
    bySymbol,
    byAssetId,
    version: `len=${list.length};ts=${Date.now()}`,
  };
}

export async function getInstrumentsIndex(): Promise<InstrumentsIndex> {
  return swr('meta:index:v3', async () => buildIndex(await fetchMetaAndCtxs()), META_TTL_MS);
}

export async function resolveInstrument(key: string): Promise<InstrumentRow> {
  const idx = await getInstrumentsIndex();
  const normalized = key.trim().toUpperCase();
  const lookup = normalized.endsWith('-PERP') ? idx.bySymbol.get(normalized) : idx.byBase.get(normalized);
  if (!lookup) {
    throw new AppError(400, { code: 'UNSUPPORTED_SYMBOL', message: `Unknown instrument: ${key}` });
  }
  return lookup;
}

export async function resolveInstrumentByAssetId(assetId: number): Promise<InstrumentRow> {
  const idx = await getInstrumentsIndex();
  const row = idx.byAssetId.get(assetId);
  if (!row) {
    throw new AppError(400, { code: 'UNSUPPORTED_SYMBOL', message: `Unknown assetId: ${assetId}` });
  }
  return row;
}

export function change24hPct(markPx: number | null, prevDayPx: number | null): number | null {
  if (markPx == null || prevDayPx == null || prevDayPx === 0) {
    return null;
  }
  return ((markPx / prevDayPx) - 1) * 100;
}

export async function refreshInstrumentsIndex(): Promise<InstrumentsIndex> {
  const built = buildIndex(await fetchMetaAndCtxs());
  cache.set('meta:index:v3', { ts: Date.now(), val: built });
  return built;
}
