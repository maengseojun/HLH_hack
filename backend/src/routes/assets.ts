import { Router } from 'express';
import { z } from 'zod';
import { cacheService } from '../cache/cacheService.js';
import { fetchAllAssetsData, fetchAssetDetail } from '../services/hyperliquid.js';
import { getCandles, getOnChainAsset } from '../services/hypercore.js';
import { AssetMetadata, AssetDetail } from '../types/asset.js';
import { AppError } from '../utils/httpError.js';
import { resolvePresetRange } from '../utils/candlePresets.js';

const router = Router();

const ALL_ASSETS_CACHE_KEY = 'assets:all';
const DETAIL_CACHE_KEY = (symbol: string) => `assets:detail:${symbol}`;

const candlesQuerySchema = z.object({
  interval: z.enum(['1h', '1d', '7d']).default('1d'),
  start: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : undefined))
    .refine((value) => value === undefined || Number.isFinite(value), {
      message: 'start must be a number',
    }),
  end: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : undefined))
    .refine((value) => value === undefined || Number.isFinite(value), {
      message: 'end must be a number',
    }),
});

router.get('/', async (_req, res, next) => {
  try {
    const cached = cacheService.get<AssetMetadata[]>(ALL_ASSETS_CACHE_KEY);
    if (cached) {
      return res.json(cached);
    }

    const data = await fetchAllAssetsData();
    cacheService.set(ALL_ASSETS_CACHE_KEY, data);
    res.json(data);
  } catch (error) {
    const stale = cacheService.get<AssetMetadata[]>(ALL_ASSETS_CACHE_KEY, { allowStale: true });
    if (stale) {
      return res.json(stale);
    }
    next(error);
  }
});

router.get('/:symbol/candles', async (req, res, next) => {
  try {
    const symbol = req.params.symbol;
    const parsed = candlesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new AppError(400, {
        code: 'INVALID_QUERY',
        message: 'Query parameter validation failed',
        details: parsed.error.flatten(),
      });
    }

    const { interval, start, end } = parsed.data;
    const range = resolvePresetRange({ interval, from: start, to: end });

    const candles = await getCandles(symbol, interval, range.from, range.to);
    return res.json({
      symbol,
      interval,
      from: range.from,
      to: range.to,
      candles,
      meta: {
        coinNormalization: 'SYMBOL-PERP->SYMBOL',
        source: 'hyperliquid.info.candleSnapshot',
        rangeMs: range.durationMs,
        presetDurationMs: range.presetDurationMs,
        staleWhileRevalidate: true,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:symbol', async (req, res, next) => {
  const symbol = req.params.symbol.trim().toUpperCase();
  const cacheKey = DETAIL_CACHE_KEY(symbol);

  try {
    const cached = cacheService.get<AssetDetail>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Hyperliquid API 데이터 가져오기
    const data = await fetchAssetDetail(symbol);
    if (!data) {
      throw new AppError(404, {
        code: 'ASSET_NOT_FOUND',
        message: `Asset ${symbol} not found`,
      });
    }

    // HyperCore 온체인 데이터 추가로 가져오기
    try {
      const onChainData = await getOnChainAsset(symbol);
      // 온체인 데이터로 기존 데이터 보강
      data.markPx = onChainData.markPx;
      data.maxLeverage = onChainData.maxLeverage;
      data.funding = onChainData.fundingRate;
    } catch (onChainError) {
      console.warn(`Failed to fetch on-chain data for ${symbol}:`, onChainError);
      // 온체인 데이터 실패해도 기존 데이터는 반환
    }

    cacheService.set(cacheKey, data);
    res.json(data);
  } catch (error) {
    const stale = cacheService.get<AssetDetail>(cacheKey, { allowStale: true });
    if (stale) {
      return res.json(stale);
    }
    next(error);
  }
});

// 온체인 데이터만 조회하는 별도 엔드포인트
router.get('/:symbol/onchain', async (req, res, next) => {
  const symbol = req.params.symbol.trim().toUpperCase();
  
  try {
    const onChainData = await getOnChainAsset(symbol);
    res.json(onChainData);
  } catch (error) {
    next(error);
  }
});

export { router as assetsRouter };
