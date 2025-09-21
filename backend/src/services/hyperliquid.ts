import { InfoClient, HttpTransport } from '@nktkas/hyperliquid';
import { config } from '../config.js';
import type { Asset, AssetDetail } from '../types/domain.js';

interface RawAssetMeta {
  name?: string;
  symbol?: string;
  sz?: string;
  maxLeverage?: number | string;
  assetId?: number | string;
  szDecimals?: number | string;
  [key: string]: unknown;
}

interface RawAssetCtx {
  markPx?: unknown;
  prevDayPx?: unknown;
  dayNtlVlm?: unknown;
  openInterest?: unknown;
  funding?: unknown;
  premium?: unknown;
  impactPxs?: unknown;
  [key: string]: unknown;
}

interface CombinedAsset {
  meta: RawAssetMeta;
  ctx: RawAssetCtx;
}

const transport = new HttpTransport({
  timeout: config.hyperliquid.timeoutMs,
  server: {
    mainnet: {
      api: config.hyperliquid.apiUrl
    }
  }
});

const client = new InfoClient({ transport });

const numeric = (value: unknown): number | null => {
  // Hyperliquid info endpoints return numeric values as strings per official schemas.
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toCombinedAssets = (metaAndCtxs: unknown): CombinedAsset[] => {
  if (!Array.isArray(metaAndCtxs) || metaAndCtxs.length < 2) {
    return [];
  }

  const [meta, contexts] = metaAndCtxs as [
    { universe?: RawAssetMeta[] } | undefined,
    RawAssetCtx[] | undefined
  ];

  const metaList = Array.isArray(meta?.universe) ? meta!.universe : [];
  const ctxList = Array.isArray(contexts) ? contexts : [];

  return metaList.map((metaItem, index) => ({
    meta: metaItem ?? {},
    ctx: ctxList[index] ?? {}
  }));
};

const symbolFromMeta = (meta: RawAssetMeta, fallbackIndex: number): string => {
  if (typeof meta.symbol === 'string' && meta.symbol.trim().length > 0) {
    return meta.symbol.trim();
  }
  if (typeof meta.name === 'string' && meta.name.trim().length > 0) {
    return meta.name.trim();
  }
  if (typeof meta.sz === 'string' && meta.sz.trim().length > 0) {
    return meta.sz.trim();
  }
  return `ASSET_${fallbackIndex}`;
};

const nameFromMeta = (meta: RawAssetMeta, symbol: string): string => {
  if (typeof meta.name === 'string' && meta.name.trim().length > 0) {
    return meta.name.trim();
  }
  return symbol;
};

const toAsset = (asset: CombinedAsset, index: number): Asset => {
  const symbol = symbolFromMeta(asset.meta, index);
  const name = nameFromMeta(asset.meta, symbol);

  const markPx = numeric(asset.ctx.markPx);
  const dayNtlVlm = numeric(asset.ctx.dayNtlVlm);
  const openInterest = numeric(asset.ctx.openInterest);
  const maxLeverage = numeric(asset.meta.maxLeverage);
  const funding = numeric(asset.ctx.funding);
  const premium = numeric(asset.ctx.premium);

  const assetId = extractAssetId(asset.meta, index);
  const szDecimals = extractSzDecimals(asset.meta);
  const priceDecimals = extractPriceDecimals(asset.meta, szDecimals);

  return {
    assetId,
    szDecimals,
    priceDecimals,
    name,
    symbol,
    markPx: markPx ?? 0,
    dayNtlVlm: dayNtlVlm ?? 0,
    openInterest: openInterest ?? 0,
    maxLeverage: maxLeverage ?? 0,
    funding: funding ?? 0,
    premium: premium ?? 0,
  };
};

const toImpactPrices = (ctx: RawAssetCtx): { bid?: number; ask?: number } | undefined => {
  const impact = ctx.impactPxs;
  if (!Array.isArray(impact)) return undefined;

  const bid = numeric(impact[0]);
  const ask = numeric(impact[1]);

  if (bid === null && ask === null) return undefined;

  const result: { bid?: number; ask?: number } = {};
  if (bid !== null) result.bid = bid;
  if (ask !== null) result.ask = ask;
  return result;
};

const normaliseSymbol = (symbol: string): string => symbol.trim().toUpperCase();

const extractAssetId = (meta: RawAssetMeta, fallback: number): number => {
  const value = meta.assetId ?? (meta as any)?.index;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const extractSzDecimals = (meta: RawAssetMeta): number => {
  const value = meta.szDecimals ?? (meta.sz ? decimalsFromString(meta.sz) : undefined);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
};

const decimalsFromString = (input: string): number => {
  const parts = input.trim().split('.');
  return parts[1]?.length ?? 0;
};

const extractPriceDecimals = (meta: RawAssetMeta, szDecimals: number): number => {
  const value = (meta as any)?.priceDecimals;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Math.max(0, 6 - szDecimals);
};

export const fetchAllAssetsData = async (): Promise<Asset[]> => {
  const metaAndCtxs = await client.metaAndAssetCtxs();
  const combined = toCombinedAssets(metaAndCtxs);
  return combined.map(toAsset);
};

export const fetchAssetDetail = async (symbol: string): Promise<AssetDetail | null> => {
  const requested = normaliseSymbol(symbol);
  const metaAndCtxs = await client.metaAndAssetCtxs();
  const combined = toCombinedAssets(metaAndCtxs);

  const matchIndex = combined.findIndex((asset, index) => {
    const candidateSymbol = normaliseSymbol(symbolFromMeta(asset.meta, index));
    return candidateSymbol === requested;
  });

  if (matchIndex === -1) {
    return null;
  }

  const asset = combined[matchIndex];
  const base = toAsset(asset, matchIndex);

  return {
    ...base,
    change7d: null,
    impactPxs: toImpactPrices(asset.ctx),
    fundingHistory: undefined,
  };
};
