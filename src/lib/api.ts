// API types and functions
export type PositionSide = "long" | "short";

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

export type Candle = {
  t?: number | string;
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
  close?: number;
};

export type BasketItemInput = {
  symbol: string;
  weight: number;
  position: PositionSide;
  leverage: number;
};

export type BasketCalculationPoint = {
  date?: string;
  value?: number;
  nav?: number;
};

export type BasketCalculationResponse = {
  data?: BasketCalculationPoint[];
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test_token_for_testnet_e2e',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

export async function getAssets(): Promise<Asset[]> {
  try {
    return await apiRequest<Asset[]>('/v1/assets');
  } catch (error) {
    console.error('Failed to fetch assets:', error);
    return [];
  }
}

export async function getAsset(symbol: string): Promise<Asset> {
  return await apiRequest<Asset>(`/v1/assets/${symbol}`);
}

export async function getCandles(symbol: string, interval: string): Promise<{ candles: Candle[] }> {
  try {
    return await apiRequest<{ candles: Candle[] }>(`/v1/candles/${symbol}?interval=${interval}`);
  } catch (error) {
    console.error('Failed to fetch candles:', error);
    return { candles: [] };
  }
}

export async function postBasketCalculate(params: {
  interval: string;
  assets: BasketItemInput[];
}): Promise<BasketCalculationResponse> {
  return await apiRequest<BasketCalculationResponse>('/v1/baskets/calculate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}