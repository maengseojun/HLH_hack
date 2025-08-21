export enum SupportedChain {
  ETHEREUM = 1,
  POLYGON = 137,
  ARBITRUM = 42161,
  SOLANA = 'solana',
}

export interface ChainInfo {
  chainId: string | number;
  name: string;
  isActive: boolean;
  nativeToken: string;
  rpcUrl: string;
  blockExplorer: string;
  avgBlockTime: number;
}

export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  coingeckoId?: string;
}

export interface PriceQuote {
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: string;
  amountOut: string;
  price: number;
  priceImpact: number;
  gasCostUSD: number;
  protocol: string;
  chain: SupportedChain;
  route: any;
  estimatedGas?: string;
}

export interface SwapParams {
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: string;
  slippage: number;
  userAddress: string;
  chain: SupportedChain;
}

export interface OptimalRoute {
  bestQuote: PriceQuote;
  alternativeQuotes: PriceQuote[];
  totalSavings: number;
  executionTime: number;
  confidence: number;
}

export interface AggregatorConfig {
  oneInchApiKey: string;
  zeroXApiKey: string;
  jupiterUrl: string;
  defaultSlippage: number;
  maxPriceImpact: number;
  gasLimitBuffer: number;
}

export interface ProtocolAdapter {
  name: string;
  supportedChains: SupportedChain[];
  getQuote(params: SwapParams): Promise<PriceQuote>;
  executeSwap(params: SwapParams, route: any): Promise<string>;
}