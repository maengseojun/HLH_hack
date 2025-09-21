import { InfoClient, HttpTransport } from '@nktkas/hyperliquid';
import { config } from '../config.js';
import { AssetMetadata, AssetDetail } from '../types/asset.js';

interface RawAssetMeta {
  name?: string;
  symbol?: string;
  sz?: string;
  maxLeverage?: number | string;
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
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const roundTo = (value: number | null, decimals = 2): number | null => {
  if (value === null) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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

const toAssetMetadata = (asset: CombinedAsset, index: number): AssetMetadata => {
  const symbol = symbolFromMeta(asset.meta, index);
  const name = nameFromMeta(asset.meta, symbol);

  const markPx = numeric(asset.ctx.markPx);
  const prevDayPx = numeric(asset.ctx.prevDayPx);
  const dayNtlVlm = numeric(asset.ctx.dayNtlVlm);
  const openInterest = numeric(asset.ctx.openInterest);
  const maxLeverage = numeric(asset.meta.maxLeverage);
  const funding = numeric(asset.ctx.funding);
  const premium = numeric(asset.ctx.premium);

  let change24h: number | null = null;
  if (markPx !== null && prevDayPx !== null && prevDayPx !== 0) {
    change24h = roundTo(((markPx - prevDayPx) / prevDayPx) * 100, 2);
  }

  return {
    name,
    symbol,
    markPx: markPx ?? 0,
    dayNtlVlm: dayNtlVlm ?? 0,
    openInterest: openInterest ?? 0,
    maxLeverage: maxLeverage ?? 0,
    change24h,
    funding,
    premium
  };
};

const toImpactPrices = (ctx: RawAssetCtx): [number, number] | undefined => {
  const impact = ctx.impactPxs;
  if (!Array.isArray(impact) || impact.length < 2) return undefined;
  const bid = numeric(impact[0]);
  const ask = numeric(impact[1]);
  if (bid === null || ask === null) return undefined;
  return [bid, ask];
};

const normaliseSymbol = (symbol: string): string => symbol.trim().toUpperCase();

export const fetchAllAssetsData = async (): Promise<AssetMetadata[]> => {
  const metaAndCtxs = await client.metaAndAssetCtxs();
  const combined = toCombinedAssets(metaAndCtxs);
  return combined.map(toAssetMetadata);
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
  const base = toAssetMetadata(asset, matchIndex);

  return {
    ...base,
    change7d: null,
    impactPxs: toImpactPrices(asset.ctx),
    fundingHistory: undefined
  };
};
