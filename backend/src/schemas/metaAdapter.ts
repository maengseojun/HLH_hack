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
  isDelisted: z.boolean().optional(),
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

// Spot 관련 스키마
const SpotTokenSchema = z.object({
  name: z.string(),
  szDecimals: z.number().int().min(0).max(18),
  weiDecimals: z.number().int().min(0).max(18),
  index: z.number().int().nonnegative(),
  tokenId: z.string(),
  isCanonical: z.boolean(),
  evmContract: z.string().nullable(),
  fullName: z.string().nullable(),
});

const SpotUniverseSchema = z.object({
  name: z.string(),
  tokens: z.array(z.number().int().nonnegative()),
  index: z.number().int().nonnegative(),
  isCanonical: z.boolean(),
});

const SpotMetaAndAssetCtxsSchema = z.tuple([
  z.object({
    tokens: z.array(SpotTokenSchema),
    universe: z.array(SpotUniverseSchema),
  }),
  z.array(AssetContextSchema),
]);

// 응답 형식 유니온: [객체, 배열] 또는 객체 또는 {perp, spot} 형식
const MetaAndAssetCtxsInputSchema = z.union([
  // 새로운 통합 형식: { perp: [...], spot: [...] }
  z.object({
    perp: z.union([
      z.tuple([
        z.object({
          universe: z.array(AssetMetaSchema),
          marginTables: z.array(z.any()).optional(),
        }),
        z.array(AssetContextSchema),
      ]),
      z.object({
        universe: z.array(AssetMetaSchema),
        assetCtxs: z.array(AssetContextSchema),
      }),
    ]),
    spot: SpotMetaAndAssetCtxsSchema,
  }),
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
  marketType: 'perp' | 'spot';
  szDecimals: number;
  priceDecimals: number;
  maxLeverage: number | null;
  markPx: number | null;
  prevDayPx: number | null;
  funding: number | null;
  openInterest: number | null;
  dayNtlVlm: number | null;
  premium: number | null;
  spotIndex?: number; // spot 자산의 경우 @{index} 형식으로 사용할 index
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
  // assetId가 있고 유니크하면 사용, 아니면 index 사용 (marginTableId는 중복이 많아서 제외)
  if (typeof meta.assetId === 'number' && meta.assetId >= 0) {
    return meta.assetId;
  }
  // marginTableId는 중복이 많으므로 사용하지 않고 index를 사용
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

  const byAssetId = new Map<number, NormalizedAsset>();
  const bySymbol = new Map<string, NormalizedAsset>();
  const list: NormalizedAsset[] = [];

  // 새로운 통합 형식인지 확인
  if ('perp' in parsed && 'spot' in parsed) {
    // Perp 데이터 처리
    const perpData = parsed.perp;
    let perpUniverse: z.infer<typeof AssetMetaSchema>[];
    let perpAssetCtxs: z.infer<typeof AssetContextSchema>[];

    if (Array.isArray(perpData)) {
      const [metaObj, contexts] = perpData;
      perpUniverse = metaObj.universe || [];
      perpAssetCtxs = contexts || [];
    } else {
      perpUniverse = perpData.universe || [];
      perpAssetCtxs = perpData.assetCtxs || [];
    }

    // Perp 자산 처리
    const perpMinLen = Math.min(perpUniverse.length, perpAssetCtxs.length);
    console.log(`🔍 Processing ${perpMinLen} perp assets from Hyperliquid API`);

    for (let i = 0; i < perpMinLen; i++) {
      const meta = perpUniverse[i] ?? {};
      const ctx = perpAssetCtxs[i] ?? {};

      const { symbol, name } = resolveSymbolAndName(meta, i);
      const { sz, px } = resolveDecimals(meta);
      const assetId = resolveAssetId(meta, i);
      const maxLeverage = (typeof meta.maxLeverage === 'number' && meta.maxLeverage > 0) ? meta.maxLeverage : null;

      const perpAsset: NormalizedAsset = {
        assetId,
        symbol,
        name,
        marketType: 'perp',
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

      if (!byAssetId.has(assetId)) {
        byAssetId.set(assetId, perpAsset);
        bySymbol.set(symbol, perpAsset);
        list.push(perpAsset);
      }
    }

    // Spot 데이터 처리
    const [spotMetaObj, spotContexts] = parsed.spot;
    const tokens = spotMetaObj.tokens || [];
    const spotUniverse = spotMetaObj.universe || [];
    
    console.log(`🔍 Processing ${spotUniverse.length} spot assets from Hyperliquid API`);

    for (let i = 0; i < Math.min(spotUniverse.length, spotContexts.length); i++) {
      const spotPair = spotUniverse[i];
      const ctx = spotContexts[i] ?? {};

      // Spot 심볼은 원래 이름 그대로 사용 (PURR/USDC, @1 등)
      const symbol = spotPair.name;
      const name = symbol;
      
      // Spot 자산 ID는 10000 + index로 설정하여 perp와 충돌 방지
      const assetId = 10000 + spotPair.index;
      
      // 토큰 정보에서 decimals 정보 추출
      const baseTokenIndex = spotPair.tokens[0];
      const baseToken = tokens.find(t => t.index === baseTokenIndex);
      const sz = baseToken?.szDecimals ?? 6;
      const px = 6; // spot은 일반적으로 6자리 소수점

      const spotAsset: NormalizedAsset = {
        assetId,
        symbol,
        name,
        marketType: 'spot',
        szDecimals: sz,
        priceDecimals: px,
        maxLeverage: 1, // spot은 레버리지 1x
        markPx: toNumber(ctx.markPx),
        prevDayPx: toNumber(ctx.prevDayPx),
        funding: null, // spot에는 funding 없음
        openInterest: null, // spot에는 open interest 없음
        dayNtlVlm: toNumber(ctx.dayNtlVlm),
        premium: null, // spot에는 premium 없음
        spotIndex: spotPair.index, // @{index} 형식으로 사용할 index
      };

      if (!byAssetId.has(assetId) && !bySymbol.has(symbol)) {
        byAssetId.set(assetId, spotAsset);
        bySymbol.set(symbol, spotAsset);
        list.push(spotAsset);
      }
    }
  } else {
    // 레거시 형식 처리 (perp만)
    let universe: z.infer<typeof AssetMetaSchema>[];
    let assetCtxs: z.infer<typeof AssetContextSchema>[];

    if (Array.isArray(parsed)) {
      const [metaObj, contexts] = parsed;
      universe = metaObj.universe || [];
      assetCtxs = contexts || [];
    } else {
      universe = parsed.universe || [];
      assetCtxs = parsed.assetCtxs || [];
    }

    const minLen = Math.min(universe.length, assetCtxs.length);
    console.log(`🔍 Processing ${minLen} assets from Hyperliquid API (legacy format)`);

    for (let i = 0; i < minLen; i++) {
      const meta = universe[i] ?? {};
      const ctx = assetCtxs[i] ?? {};

      const { symbol, name } = resolveSymbolAndName(meta, i);
      const { sz, px } = resolveDecimals(meta);
      const assetId = resolveAssetId(meta, i);
      const maxLeverage = (typeof meta.maxLeverage === 'number' && meta.maxLeverage > 0) ? meta.maxLeverage : null;

      const perpAsset: NormalizedAsset = {
        assetId,
        symbol,
        name,
        marketType: 'perp',
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

      if (!byAssetId.has(assetId)) {
        byAssetId.set(assetId, perpAsset);
        bySymbol.set(symbol, perpAsset);
        list.push(perpAsset);
      }

      // 레거시 형식에서는 mock spot 자산도 생성
      const spotSymbol = name;
      const spotAssetId = assetId * 10 + 1;
      if (!bySymbol.has(spotSymbol)) {
        const spotAsset: NormalizedAsset = {
          ...perpAsset,
          assetId: spotAssetId,
          symbol: spotSymbol,
          marketType: 'spot',
          maxLeverage: 1,
          funding: null,
          premium: null,
        };
        byAssetId.set(spotAssetId, spotAsset);
        bySymbol.set(spotSymbol, spotAsset);
        list.push(spotAsset);
      }
    }
  }

  // 안정적인 정렬: symbol 기준 ASC
  list.sort((a, b) => a.symbol.localeCompare(b.symbol));
  
  console.log(`📊 Final asset list: ${list.length} assets`);
  const spotAssets = list.filter(a => a.marketType === 'spot');
  const perpAssets = list.filter(a => a.marketType === 'perp');
  console.log(`📊 Assets breakdown: ${perpAssets.length} perp, ${spotAssets.length} spot`);

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
  
  // 1. 직접 매치 시도 (spot 심볼 포함)
  const direct = norm.bySymbol.get(normalized);
  if (direct) {
    return direct;
  }
  
  // 2. 원본 심볼로도 시도 (케이스 보존)
  const original = symbol.trim();
  const originalMatch = norm.bySymbol.get(original);
  if (originalMatch) {
    return originalMatch;
  }
  
  // 3. Perp 형식으로 변환해서 시도
  const perpSymbol = toPerpSymbol(normalized);
  const perpMatch = norm.bySymbol.get(perpSymbol);
  if (perpMatch) {
    return perpMatch;
  }
  
  // 4. 모든 가능한 변형 시도
  for (const [key, asset] of norm.bySymbol) {
    if (key.toLowerCase() === symbol.toLowerCase()) {
      return asset;
    }
  }
  
  throw new AppError(400, {
    code: 'UNSUPPORTED_SYMBOL',
    message: `Unknown instrument: ${symbol}`,
  });
}
