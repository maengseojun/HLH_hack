import { OneInchAdapter } from './adapters/oneinch-adapter';
import { JupiterAdapter } from './adapters/jupiter-adapter';
import { ZeroXAdapter } from './adapters/zerox-adapter';
import {
  ProtocolAdapter,
  SwapParams,
  PriceQuote,
  OptimalRoute,
  AggregatorConfig,
  SupportedChain,
  TokenInfo,
} from './types';

export class HyperindexAggregator {
  private adapters: Map<string, ProtocolAdapter>;
  private config: AggregatorConfig;

  constructor(config: AggregatorConfig) {
    this.config = config;
    this.adapters = new Map();

    this.initializeAdapters();
  }

  private initializeAdapters() {
    if (this.config.oneInchApiKey) {
      this.adapters.set('1inch', new OneInchAdapter(this.config.oneInchApiKey));
    }

    if (this.config.zeroXApiKey) {
      this.adapters.set('0x', new ZeroXAdapter(this.config.zeroXApiKey));
    }

    this.adapters.set('jupiter', new JupiterAdapter(this.config.jupiterUrl));
  }

  async findBestRoute(params: SwapParams): Promise<OptimalRoute> {
    const quotes: PriceQuote[] = [];
    const errors: { adapter: string; error: Error }[] = [];

    const relevantAdapters = Array.from(this.adapters.values()).filter(adapter =>
      adapter.supportedChains.includes(params.chain)
    );

    if (relevantAdapters.length === 0) {
      throw new Error(`No adapters support chain: ${params.chain}`);
    }

    const quotePromises = relevantAdapters.map(async (adapter) => {
      try {
        const quote = await adapter.getQuote(params);
        return { quote, adapter: adapter.name };
      } catch (_error) {
        errors.push({ adapter: adapter.name, error: error as Error });
        return null;
      }
    });

    const results = await Promise.allSettled(quotePromises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        quotes.push(result.value.quote);
      }
    });

    if (quotes.length === 0) {
      console.error('All adapters failed:', errors);
      throw new Error('No quotes available from any adapter');
    }

    const sortedQuotes = this.rankQuotes(quotes);
    const bestQuote = sortedQuotes[0];
    const alternativeQuotes = sortedQuotes.slice(1);

    const savings = this.calculateSavings(bestQuote, alternativeQuotes);
    const confidence = this.calculateConfidence(quotes, bestQuote);

    return {
      bestQuote,
      alternativeQuotes,
      totalSavings: savings,
      executionTime: this.estimateExecutionTime(bestQuote),
      confidence,
    };
  }

  async findBestCrossChainRoute(
    tokenSymbol: string,
    amountIn: string,
    userAddress: string,
    targetChains?: SupportedChain[]
  ): Promise<OptimalRoute[]> {
    const chainsToCheck = targetChains || Object.values(SupportedChain);
    const crossChainRoutes: OptimalRoute[] = [];

    const tokenMap = await this.buildTokenMap(tokenSymbol);

    for (const chain of chainsToCheck) {
      if (chain === 'solana' && !tokenMap.solana) continue;
      if (typeof chain === 'number' && !tokenMap.evm) continue;

      try {
        const tokenInfo = this.getTokenInfoForChain(tokenSymbol, chain, tokenMap);
        if (!tokenInfo) continue;

        const params: SwapParams = {
          tokenIn: tokenInfo.tokenIn,
          tokenOut: tokenInfo.tokenOut,
          amountIn,
          slippage: this.config.defaultSlippage,
          userAddress,
          chain,
        };

        const route = await this.findBestRoute(params);
        crossChainRoutes.push(route);
      } catch (_error) {
        console.warn(`Failed to get route for ${chain}:`, error);
      }
    }

    return crossChainRoutes.sort((a, b) => 
      this.calculateNetReturn(b.bestQuote) - this.calculateNetReturn(a.bestQuote)
    );
  }

  private rankQuotes(quotes: PriceQuote[]): PriceQuote[] {
    return quotes.sort((a, b) => {
      const aNetReturn = this.calculateNetReturn(a);
      const bNetReturn = this.calculateNetReturn(b);
      
      if (Math.abs(aNetReturn - bNetReturn) < 0.001) {
        return a.gasCostUSD - b.gasCostUSD;
      }
      
      return bNetReturn - aNetReturn;
    });
  }

  private calculateNetReturn(quote: PriceQuote): number {
    const outputValue = parseFloat(quote.amountOut);
    const gasCost = quote.gasCostUSD || 0;
    const priceImpactCost = outputValue * (quote.priceImpact / 100);
    
    return outputValue - gasCost - priceImpactCost;
  }

  private calculateSavings(bestQuote: PriceQuote, alternatives: PriceQuote[]): number {
    if (alternatives.length === 0) return 0;

    const bestReturn = this.calculateNetReturn(bestQuote);
    const avgAlternativeReturn = alternatives.reduce((sum, quote) => 
      sum + this.calculateNetReturn(quote), 0
    ) / alternatives.length;

    return Math.max(0, bestReturn - avgAlternativeReturn);
  }

  private calculateConfidence(quotes: PriceQuote[], bestQuote: PriceQuote): number {
    if (quotes.length === 1) return 0.7;

    const returns = quotes.map(q => this.calculateNetReturn(q));
    const bestReturn = this.calculateNetReturn(bestQuote);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    const outperformance = (bestReturn - avgReturn) / avgReturn;
    const consistency = Math.max(0, 1 - (stdDev / avgReturn));

    return Math.min(1, 0.5 + (outperformance * 0.3) + (consistency * 0.2));
  }

  private estimateExecutionTime(quote: PriceQuote): number {
    const chainTimes = {
      [SupportedChain.ETHEREUM]: 15,
      [SupportedChain.POLYGON]: 2,
      [SupportedChain.ARBITRUM]: 1,
      [SupportedChain.SOLANA]: 0.5,
    };

    return chainTimes[quote.chain] || 10;
  }

  private async buildTokenMap(tokenSymbol: string): Promise<{
    evm: Record<SupportedChain, TokenInfo>;
    solana: TokenInfo;
  }> {
    return {
      evm: {} as Record<SupportedChain, TokenInfo>,
      solana: {} as TokenInfo,
    };
  }

  private getTokenInfoForChain(
    tokenSymbol: string,
    chain: SupportedChain,
    tokenMap: any
  ): { tokenIn: TokenInfo; tokenOut: TokenInfo } | null {
    return null;
  }

  async executeOptimalSwap(params: SwapParams, route: OptimalRoute): Promise<string> {
    const adapter = this.adapters.get(route.bestQuote.protocol);
    if (!adapter) {
      throw new Error(`Adapter not found for protocol: ${route.bestQuote.protocol}`);
    }

    return adapter.executeSwap(params, route.bestQuote.route);
  }

  getAdapter(name: string): ProtocolAdapter | undefined {
    return this.adapters.get(name);
  }

  getSupportedChains(): SupportedChain[] {
    const chains = new Set<SupportedChain>();
    this.adapters.forEach(adapter => {
      adapter.supportedChains.forEach(chain => chains.add(chain));
    });
    return Array.from(chains);
  }

  updateConfig(newConfig: Partial<AggregatorConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.initializeAdapters();
  }
}