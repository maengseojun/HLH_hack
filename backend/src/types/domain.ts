export interface Asset {
  assetId: number;
  szDecimals: number;
  name: string;
  symbol: string;
  markPx: number;
  openInterest: number;
  dayNtlVlm: number;
  maxLeverage: number;
  funding: number;
  premium: number;
}

export interface AssetDetail extends Asset {
  impactPxs?: { bid?: number; ask?: number };
  fundingHistory?: Array<{ timestamp: number; value: number }>;
  change7d?: number | null;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Position = 'long' | 'short';
