import { HyperindexAggregator } from './hyperindex-aggregator';
import { GasEstimator } from './gas-estimator';
import {
  SwapParams,
  OptimalRoute,
  SupportedChain,
  TokenInfo,
  AggregatorConfig,
} from './types';

export interface IndexTokenComponent {
  symbol: string;
  name: string;
  targetRatio: number;
  targetAmount: string;
  addresses: Record<SupportedChain, string>;
}

export interface IndexTokenCreationRequest {
  name: string;
  symbol: string;
  components: IndexTokenComponent[];
  totalValueUSD: number;
  userAddress: string;
  preferredChains?: SupportedChain[];
  maxSlippage?: number;
}

export interface OptimizedIndexPlan {
  totalCostUSD: number;
  estimatedGasCostUSD: number;
  totalSavings: number;
  averageConfidence: number;
  executionRoutes: Array<{
    component: IndexTokenComponent;
    route: OptimalRoute;
    chain: SupportedChain;
    executionOrder: number;
  }>;
  riskAssessment: {
    priceImpactRisk: 'low' | 'medium' | 'high';
    liquidityRisk: 'low' | 'medium' | 'high';
    executionRisk: 'low' | 'medium' | 'high';
  };
}

export class IndexTokenService {
  private aggregator: HyperindexAggregator;
  private gasEstimator: GasEstimator;

  constructor(config: AggregatorConfig) {
    this.aggregator = new HyperindexAggregator(config);
    this.gasEstimator = new GasEstimator();
  }

  async createOptimizedIndexPlan(request: IndexTokenCreationRequest): Promise<OptimizedIndexPlan> {
    const routes: OptimizedIndexPlan['executionRoutes'] = [];
    let totalCostUSD = 0;
    let totalSavings = 0;
    let totalConfidence = 0;
    let estimatedGasCostUSD = 0;

    console.log(`🔄 Creating optimized index plan for: ${request.name} (${request.symbol})`);
    console.log(`📊 Components: ${request.components.length}, Total Value: $${request.totalValueUSD}`);

    for (let i = 0; i < request.components.length; i++) {
      const component = request.components[i];
      const targetValueUSD = (request.totalValueUSD * component.targetRatio) / 10000;

      console.log(`\n🎯 Processing component ${i + 1}/${request.components.length}: ${component.symbol}`);
      console.log(`💰 Target value: $${targetValueUSD}`);

      try {
        const crossChainRoutes = await this.findBestCrossChainRouteForComponent(
          component,
          targetValueUSD.toString(),
          request.userAddress,
          request.preferredChains,
          request.maxSlippage || 0.5
        );

        if (crossChainRoutes.length === 0) {
          throw new Error(`No routes found for component: ${component.symbol}`);
        }

        const bestRoute = crossChainRoutes[0];
        const bestChain = bestRoute.bestQuote.chain;

        const gasEstimate = await this.gasEstimator.estimateTransactionCost(bestChain, 'swap');
        estimatedGasCostUSD += gasEstimate.gasCostUSD;

        routes.push({
          component,
          route: bestRoute,
          chain: bestChain,
          executionOrder: i + 1,
        });

        totalCostUSD += parseFloat(bestRoute.bestQuote.amountOut);
        totalSavings += bestRoute.totalSavings;
        totalConfidence += bestRoute.confidence;

        console.log(`✅ Best route found on ${bestChain}: ${bestRoute.bestQuote.protocol}`);
        console.log(`💡 Savings: $${bestRoute.totalSavings.toFixed(2)}, Confidence: ${(bestRoute.confidence * 100).toFixed(1)}%`);

      } catch (_error) {
        console.error(`❌ Failed to find route for ${component.symbol}:`, _error);
        throw new Error(`Failed to optimize component ${component.symbol}: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`);
      }
    }

    const averageConfidence = totalConfidence / request.components.length;
    const riskAssessment = this.assessRisk(routes);

    const plan: OptimizedIndexPlan = {
      totalCostUSD,
      estimatedGasCostUSD,
      totalSavings,
      averageConfidence,
      executionRoutes: routes,
      riskAssessment,
    };

    console.log(`\n🎉 Optimization complete!`);
    console.log(`💰 Total cost: $${totalCostUSD.toFixed(2)}`);
    console.log(`⛽ Gas cost: $${estimatedGasCostUSD.toFixed(2)}`);
    console.log(`💡 Total savings: $${totalSavings.toFixed(2)}`);
    console.log(`📊 Average confidence: ${(averageConfidence * 100).toFixed(1)}%`);

    return plan;
  }

  private async findBestCrossChainRouteForComponent(
    component: IndexTokenComponent,
    amountUSD: string,
    userAddress: string,
    preferredChains?: SupportedChain[],
    slippage: number = 0.5
  ): Promise<OptimalRoute[]> {
    const chainsToCheck = preferredChains || this.aggregator.getSupportedChains();
    const routes: OptimalRoute[] = [];

    for (const chain of chainsToCheck) {
      try {
        if (!component.addresses[chain]) {
          console.log(`⚠️ No address for ${component.symbol} on ${chain}`);
          continue;
        }

        const tokenInfo = this.buildTokenInfoForChain(component, chain);
        if (!tokenInfo) continue;

        const params: SwapParams = {
          tokenIn: tokenInfo.stablecoin,
          tokenOut: tokenInfo.target,
          amountIn: this.convertUSDToStablecoinAmount(amountUSD, chain),
          slippage,
          userAddress,
          chain,
        };

        console.log(`🔍 Checking route on ${chain} for ${component.symbol}...`);
        const route = await this.aggregator.findBestRoute(params);
        routes.push(route);

        console.log(`✅ Route found on ${chain}: ${route.bestQuote.protocol} (Confidence: ${(route.confidence * 100).toFixed(1)}%)`);

      } catch (_error) {
        console.warn(`⚠️ Failed to get route on ${chain} for ${component.symbol}:`, error);
      }
    }

    return routes.sort((a, b) => {
      const aNetReturn = this.calculateNetReturn(a.bestQuote) - a.bestQuote.gasCostUSD;
      const bNetReturn = this.calculateNetReturn(b.bestQuote) - b.bestQuote.gasCostUSD;
      return bNetReturn - aNetReturn;
    });
  }

  private buildTokenInfoForChain(component: IndexTokenComponent, chain: SupportedChain): {
    stablecoin: TokenInfo;
    target: TokenInfo;
  } | null {
    const stablecoinAddresses: Record<SupportedChain, { address: string; symbol: string }> = {
      [SupportedChain.ETHEREUM]: { address: '0xA0b86a33E6441d1b1B80BB51e3ee7C80E60b0E00', symbol: 'USDC' },
      [SupportedChain.POLYGON]: { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC' },
      [SupportedChain.ARBITRUM]: { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', symbol: 'USDC' },
      [SupportedChain.SOLANA]: { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' },
    };

    const stablecoin = stablecoinAddresses[chain];
    const targetAddress = component.addresses[chain];

    if (!stablecoin || !targetAddress) {
      return null;
    }

    return {
      stablecoin: {
        symbol: stablecoin.symbol,
        name: 'USD Coin',
        address: stablecoin.address,
        decimals: 6,
      },
      target: {
        symbol: component.symbol,
        name: component.name,
        address: targetAddress,
        decimals: 18,
      },
    };
  }

  private convertUSDToStablecoinAmount(amountUSD: string, chain: SupportedChain): string {
    const decimals = 6;
    const amount = parseFloat(amountUSD);
    return (amount * Math.pow(10, decimals)).toString();
  }

  private calculateNetReturn(quote: any): number {
    const outputValue = parseFloat(quote.amountOut);
    const priceImpactCost = outputValue * (quote.priceImpact / 100);
    return outputValue - priceImpactCost;
  }

  private assessRisk(routes: OptimizedIndexPlan['executionRoutes']): OptimizedIndexPlan['riskAssessment'] {
    const avgPriceImpact = routes.reduce((sum, r) => sum + r.route.bestQuote.priceImpact, 0) / routes.length;
    const avgConfidence = routes.reduce((sum, r) => sum + r.route.confidence, 0) / routes.length;
    const highGasRoutes = routes.filter(r => r.route.bestQuote.gasCostUSD > 50).length;

    return {
      priceImpactRisk: avgPriceImpact > 2 ? 'high' : avgPriceImpact > 0.5 ? 'medium' : 'low',
      liquidityRisk: avgConfidence < 0.6 ? 'high' : avgConfidence < 0.8 ? 'medium' : 'low',
      executionRisk: highGasRoutes > routes.length / 2 ? 'high' : highGasRoutes > 0 ? 'medium' : 'low',
    };
  }

  async executeIndexCreation(plan: OptimizedIndexPlan): Promise<{
    success: boolean;
    transactions: Array<{ component: string; txHash: string; status: string }>;
    errors: Array<{ component: string; error: string }>;
  }> {
    const transactions: Array<{ component: string; txHash: string; status: string }> = [];
    const errors: Array<{ component: string; error: string }> = [];

    for (const executionRoute of plan.executionRoutes) {
      try {
        console.log(`🔄 Executing swap for ${executionRoute.component.symbol} on ${executionRoute.chain}...`);

        const params: SwapParams = {
          tokenIn: executionRoute.route.bestQuote.tokenIn,
          tokenOut: executionRoute.route.bestQuote.tokenOut,
          amountIn: executionRoute.route.bestQuote.amountIn,
          slippage: 0.5,
          userAddress: '',
          chain: executionRoute.chain,
        };

        const txData = await this.aggregator.executeOptimalSwap(params, executionRoute.route);
        
        transactions.push({
          component: executionRoute.component.symbol,
          txHash: txData,
          status: 'submitted',
        });

        console.log(`✅ Transaction submitted for ${executionRoute.component.symbol}: ${txData}`);

      } catch (_error) {
        const errorMessage = error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error';
        errors.push({
          component: executionRoute.component.symbol,
          error: errorMessage,
        });

        console.error(`❌ Failed to execute swap for ${executionRoute.component.symbol}:`, _error);
      }
    }

    return {
      success: errors.length === 0,
      transactions,
      errors,
    };
  }

  getAggregator(): HyperindexAggregator {
    return this.aggregator;
  }

  getGasEstimator(): GasEstimator {
    return this.gasEstimator;
  }
}