import type { Candle, Position } from '../types/domain.js';

export interface ReturnPoint {
  timestamp: number;
  retPct: number;
}

export interface IndividualResult {
  symbol: string;
  weight: number;
  position: Position;
  leverage: number;
  series: ReturnPoint[];
  individualReturnPct: number;
}

export function computeIndividualReturnSeries(candles: Candle[], position: Position, leverage = 1): ReturnPoint[] {
  if (!candles?.length) return [];
  const base = candles[0].c;
  if (!Number.isFinite(base) || base === 0) return [];

  return candles.map((candle) => {
    const price = candle.c;
    const longReturn = ((price / base) - 1) * 100;
    const shortReturn = ((base / price) - 1) * 100;
    const directional = position === 'long' ? longReturn : shortReturn;

    return {
      timestamp: candle.t,
      retPct: directional * leverage,
    };
  });
}

export function returnsToIndex(series: ReturnPoint[]): { timestamp: number; price: number }[] {
  return series.map((point) => ({
    timestamp: point.timestamp,
    price: 100 * (1 + point.retPct / 100),
  }));
}

export function intersectTimestamps(seriesList: { timestamp: number }[][]): number[] {
  if (!seriesList.length) return [];
  const sets = seriesList.map((series) => new Set(series.map((p) => p.timestamp)));
  return seriesList[0]
    .map((p) => p.timestamp)
    .filter((ts) => sets.every((set) => set.has(ts)));
}

export function buildBasketIndex(
  weightedIndexSeries: { weight: number; index: { timestamp: number; price: number }[] }[],
): { timestamp: number; price: number }[] {
  if (!weightedIndexSeries.length) return [];

  const timestamps = intersectTimestamps(weightedIndexSeries.map((w) => w.index));
  const mapSeries = weightedIndexSeries.map((entry) => ({
    weight: entry.weight,
    map: new Map(entry.index.map((p) => [p.timestamp, p.price] as const)),
  }));

  return timestamps.map((timestamp) => {
    const price = mapSeries.reduce((acc, { weight, map }) => {
      const point = map.get(timestamp);
      return acc + (point ?? 100) * weight;
    }, 0);
    return { timestamp, price };
  });
}

export function indexSeriesReturnPct(indexSeries: { price: number }[]): number {
  if (!indexSeries.length) return 0;
  const first = indexSeries[0].price;
  const last = indexSeries[indexSeries.length - 1].price;
  if (!Number.isFinite(first) || first === 0) return 0;
  return ((last / first) - 1) * 100;
}

export function maxDrawdownPct(indexSeries: { price: number }[]): number {
  let peak = -Infinity;
  let maxDd = 0;
  for (const point of indexSeries) {
    if (!Number.isFinite(point.price)) continue;
    peak = Math.max(peak, point.price);
    if (!Number.isFinite(peak) || peak === 0) continue;
    const drawdown = (point.price / peak - 1) * 100;
    if (drawdown < maxDd) {
      maxDd = drawdown;
    }
  }
  return maxDd;
}

export function weightedReturnPct(components: { weight: number; individualReturnPct: number }[]): number {
  return components.reduce((acc, component) => acc + component.weight * component.individualReturnPct, 0);
}

export function calcBasketFromCandles(
  inputs: { symbol: string; weight: number; position: Position; leverage?: number; candles: Candle[] }[],
): {
  basketPriceHistory: { timestamp: number; price: number }[];
  basketReturnPct: number;
  maxDrawdown: number;
  assets: { symbol: string; weight: number; position: Position; leverage: number; individualReturnPct: number }[];
} {
  const individuals: IndividualResult[] = inputs.map((input) => {
    const leverage = input.leverage ?? 1;
    const series = computeIndividualReturnSeries(input.candles, input.position, leverage);
    const individualReturnPct = series.length ? series[series.length - 1].retPct : 0;
    return {
      symbol: input.symbol,
      weight: input.weight,
      position: input.position,
      leverage,
      series,
      individualReturnPct,
    };
  });

  const basketIndex = buildBasketIndex(
    individuals.map((individual) => ({
      weight: individual.weight,
      index: returnsToIndex(individual.series),
    })),
  );

  const basketReturnPct = indexSeriesReturnPct(basketIndex);
  const basketMdd = maxDrawdownPct(basketIndex);

  return {
    basketPriceHistory: basketIndex,
    basketReturnPct,
    maxDrawdown: basketMdd,
    assets: individuals.map((individual) => ({
      symbol: individual.symbol,
      weight: individual.weight,
      position: individual.position,
      leverage: individual.leverage,
      individualReturnPct: individual.individualReturnPct,
    })),
  };
}
