import { z } from 'zod';
import { AppError } from '../utils/httpError.js';

// 개별 자산 정보 스키마 (실제 HyperLiquid 응답에 맞춤)
const AssetMetaSchema = z.object({
  name: z.string().optional(),
  szDecimals: z.number().int().min(0).max(18).optional(),
  maxLeverage: z.number().positive().optional(),
  marginTableId: z.number().int().nonnegative().optional(),
  // 레거시 지원
  coin: z.string().optional(),
  ticker: z.string().optional(),
  sizeDecimals: z.number().int().min(0).max(18).optional(),
  priceDecimals: z.number().int().min(0).max(18).optional(),
  assetId: z.number().int().nonnegative().optional(),
});

const AssetContextSchema = z.object({
  markPx: z.union([z.string(), z.number(), z.null()]).optional(),
  prevDayPx: z.union([z.string(), z.number(), z.null()]).optional(),
  funding: z.union([z.string(), z.number(), z.null()]).optional(),
  openInterest: z.union([z.string(), z.number(), z.null()]).optional(),
  dayNtlVlm: z.union([z.string(), z.number(), z.null()]).optional(),
  premium: z.union([z.string(), z.number(), z.null()]).optional(),
  oraclePx: z.union([z.string(), z.number(), z.null()]).optional(),
  midPx: z.union([z.string(), z.number(), z.null()]).optional(),
  impactPxs: z.array(z.union([z.string(), z.number()])).nullable().optional(),
  dayBaseVlm: z.union([z.string(), z.number(), z.null()]).optional(),
});

// 응답 형식 유니온: [객체, 배열] 또는 객체
const MetaAndAssetCtxsInputSchema = z.union([
  // 실제 HyperLiquid 형식: [{ universe: [...], marginTables: [...] }, [...]]
  z.tuple([
    z.object({
      universe: z.array(AssetMetaSchema),
      marginTables: z.array(z.any()).optional(), // marginTables는 사용하지 않음
    }),
    z.array(AssetContextSchema),
  ]),
  // 레거시 형식 지원: { universe: [...], assetCtxs: [...] }
  z.object({
    universe: z.array(AssetMetaSchema),
    assetCtxs: z.array(AssetContextSchema),
  }),
]);

// 표준화된 자산 정보
export interface NormalizedAsset {
  assetId: number;
  symbol: string;
  name: string;
  szDecimals: number;
  priceDecimals: number;
  maxLeverage: number | null;
  markPx: number | null;
  prevDayPx: number | null;
  funding: number | null;
  openInterest: number | null;
  dayNtlVlm: number | null;
  premium: number | null;
}

// 표준화된 응답 구조
export interface NormalizedMetaAndAssetCtxs {
  list: NormalizedAsset[];
  byAssetId: Map<number, NormalizedAsset>;
  bySymbol: Map<string, NormalizedAsset>;
  version: string;
}

// 유틸리티 함수들
const toNumber = (value: unknown): number | null => {
  if (value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clampInt = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const normalizeName = (s: string) => s.trim().toUpperCase();

const toPerpSymbol = (base: string) => `${normalizeName(base)}-PERP`;

function resolveDecimals(meta: z.infer<typeof AssetMetaSchema>) {
  const sz = clampInt(meta.szDecimals ?? meta.sizeDecimals ?? 0, 0, 18);
  const px = clampInt(meta.priceDecimals ?? (6 - sz), 0, 18);
  return { sz, px };
}

function resolveSymbolAndName(meta: z.infer<typeof AssetMetaSchema>, index: number) {
  const baseRaw = (meta.name ?? meta.coin ?? meta.ticker ?? '').toString();
  if (!baseRaw) {
    return {
      symbol: `ASSET_${index}`,
      name: `Asset ${index}`,
    };
  }
  const base = normalizeName(baseRaw);
  return {
    symbol: toPerpSymbol(base),
    name: base,
  };
}

function resolveAssetId(meta: z.infer<typeof AssetMetaSchema>, index: number): number {
  // assetId > marginTableId > index 순으로 우선순위
  if (typeof meta.assetId === 'number' && meta.assetId >= 0) {
    return meta.assetId;
  }
  if (typeof meta.marginTableId === 'number' && meta.marginTableId >= 0) {
    return meta.marginTableId;
  }
  return index;
}

// 핵심 정규화 함수: 어떤 입력이든 표준형으로 변환
export function normalizeMetaAndAssetCtxs(input: unknown): NormalizedMetaAndAssetCtxs {
  let parsed;
  try {
    parsed = MetaAndAssetCtxsInputSchema.parse(input);
  } catch (error) {
    throw new AppError(503, {
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'metaAndAssetCtxs malformed',
      details: error instanceof z.ZodError ? error.flatten() : `${error}`,
    });
  }

  // 배열/객체 형식 정규화
  let universe: z.infer<typeof AssetMetaSchema>[];
  let assetCtxs: z.infer<typeof AssetContextSchema>[];

  if (Array.isArray(parsed)) {
    // [{ universe: [...] }, [...]] 형식
    const [metaObj, contexts] = parsed;
    universe = metaObj.universe || [];
    assetCtxs = contexts || [];
  } else {
    // { universe: [...], assetCtxs: [...] } 형식
    universe = parsed.universe || [];
    assetCtxs = parsed.assetCtxs || [];
  }

  const byAssetId = new Map<number, NormalizedAsset>();
  const bySymbol = new Map<string, NormalizedAsset>();
  const list: NormalizedAsset[] = [];

  const minLen = Math.min(universe.length, assetCtxs.length);

  for (let i = 0; i < minLen; i++) {
    const meta = universe[i] ?? {};
    const ctx = assetCtxs[i] ?? {};

    const { symbol, name } = resolveSymbolAndName(meta, i);
    const { sz, px } = resolveDecimals(meta);
    const assetId = resolveAssetId(meta, i);
    const maxLeverage = (typeof meta.maxLeverage === 'number' && meta.maxLeverage > 0) ? meta.maxLeverage : null;

    const asset: NormalizedAsset = {
      assetId,
      symbol,
      name,
      szDecimals: sz,
      priceDecimals: px,
      maxLeverage,
      markPx: toNumber(ctx.markPx),
      prevDayPx: toNumber(ctx.prevDayPx),
      funding: toNumber(ctx.funding),
      openInterest: toNumber(ctx.openInterest),
      dayNtlVlm: toNumber(ctx.dayNtlVlm),
      premium: toNumber(ctx.premium),
    };

    // 중복 제거: 첫 번째 값 우선 정책
    if (!byAssetId.has(assetId)) {
      byAssetId.set(assetId, asset);
      bySymbol.set(symbol, asset);
      list.push(asset);
    }
  }

  // 안정적인 정렬: symbol 기준 ASC
  list.sort((a, b) => a.symbol.localeCompare(b.symbol));

  return {
    list,
    byAssetId,
    bySymbol,
    version: `len=${list.length};ts=${Date.now()}`,
  };
}

// 헬퍼 함수들
export function getAssetByIdOrThrow(norm: NormalizedMetaAndAssetCtxs, assetId: number): NormalizedAsset {
  const asset = norm.byAssetId.get(assetId);
  if (!asset) {
    throw new AppError(400, {
      code: 'ASSET_NOT_FOUND',
      message: `Asset not found: ${assetId}`,
    });
  }
  return asset;
}

export function getAssetBySymbolOrThrow(norm: NormalizedMetaAndAssetCtxs, symbol: string): NormalizedAsset {
  const normalized = symbol.trim().toUpperCase();
  const lookup = normalized.endsWith('-PERP') ? norm.bySymbol.get(normalized) : norm.bySymbol.get(toPerpSymbol(normalized));
  if (!lookup) {
    throw new AppError(400, {
      code: 'UNSUPPORTED_SYMBOL',
      message: `Unknown instrument: ${symbol}`,
    });
  }
  return lookup;
}