import { change24hPct, getInstrumentsIndex, resolveInstrument } from './meta.js';

export type Asset = {
  name: string;
  symbol: string;
  marketType: 'perp' | 'spot';
  spotIndex?: number;
  markPx: number | null;
  prevDayPx: number | null;
  change24hPct: number | null;
  funding: number | null;
  openInterest: number | null;
  dayNtlVlm: number | null;
  premium: number | null;
  maxLeverage: number | null;
  szDecimals: number;
  priceDecimals: number;
};

export async function listAssets(): Promise<Asset[]> {
  const idx = await getInstrumentsIndex();
  return idx.list.map((row) => ({
    name: row.name,
    symbol: row.symbol,
    marketType: row.marketType,
    spotIndex: row.spotIndex,
    markPx: row.markPx,
    prevDayPx: row.prevDayPx,
    change24hPct: change24hPct(row.markPx, row.prevDayPx),
    funding: row.funding,
    openInterest: row.openInterest,
    dayNtlVlm: row.dayNtlVlm,
    premium: row.premium,
    maxLeverage: row.maxLeverage,
    szDecimals: row.szDecimals,
    priceDecimals: row.priceDecimals,
  }));
}

export async function getAsset(symbol: string): Promise<Asset> {
  const row = await resolveInstrument(symbol);
  return {
    name: row.name,
    symbol: row.symbol,
    marketType: row.marketType,
    spotIndex: row.spotIndex,
    markPx: row.markPx,
    prevDayPx: row.prevDayPx,
    change24hPct: change24hPct(row.markPx, row.prevDayPx),
    funding: row.funding,
    openInterest: row.openInterest,
    dayNtlVlm: row.dayNtlVlm,
    premium: row.premium,
    maxLeverage: row.maxLeverage,
    szDecimals: row.szDecimals,
    priceDecimals: row.priceDecimals,
  };
}
