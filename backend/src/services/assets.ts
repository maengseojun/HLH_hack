import { change24hPct, getInstrumentsIndex, resolveInstrument } from './meta.js';

export type Asset = {
  name: string;
  symbol: string;
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
    name: row.base,
    symbol: row.symbol,
    markPx: row.ctx.markPx,
    prevDayPx: row.ctx.prevDayPx,
    change24hPct: change24hPct(row.ctx.markPx, row.ctx.prevDayPx),
    funding: row.ctx.funding,
    openInterest: row.ctx.openInterest,
    dayNtlVlm: row.ctx.dayNtlVlm,
    premium: row.ctx.premium,
    maxLeverage: row.maxLeverage,
    szDecimals: row.szDecimals,
    priceDecimals: row.priceDecimals,
  }));
}

export async function getAsset(symbol: string): Promise<Asset> {
  const row = await resolveInstrument(symbol);
  return {
    name: row.base,
    symbol: row.symbol,
    markPx: row.ctx.markPx,
    prevDayPx: row.ctx.prevDayPx,
    change24hPct: change24hPct(row.ctx.markPx, row.ctx.prevDayPx),
    funding: row.ctx.funding,
    openInterest: row.ctx.openInterest,
    dayNtlVlm: row.ctx.dayNtlVlm,
    premium: row.ctx.premium,
    maxLeverage: row.maxLeverage,
    szDecimals: row.szDecimals,
    priceDecimals: row.priceDecimals,
  };
}
