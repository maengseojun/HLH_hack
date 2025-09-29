export interface Asset {
  assetId: number;
  szDecimals: number;
  priceDecimals?: number;
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
  t: number; // timestamp
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
}

export type Position = 'long' | 'short';
