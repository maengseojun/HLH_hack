export interface AssetMetadata {
  name: string;
  symbol: string;
  markPx: number;
  dayNtlVlm: number;
  openInterest: number;
  maxLeverage: number;
  change24h: number | null;
  funding: number | null;
  premium: number | null;
}

export interface AssetDetail extends AssetMetadata {
  change7d?: number | null;
  impactPxs?: [number, number];
  fundingHistory?: FundingRecord[];
}

export interface FundingRecord {
  time: number;
  fundingRate: number;
  premium: number;
}
