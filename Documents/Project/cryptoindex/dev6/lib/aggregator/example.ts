import {
  createHyperindexAggregator,
  createIndexTokenService,
  AggregatorConfig,
  SupportedChain,
  SwapParams,
  IndexTokenCreationRequest,
} from './index';

async function exampleUsage() {
  const config: AggregatorConfig = {
    oneInchApiKey: process.env.ONEINCH_API_KEY!,
    zeroXApiKey: process.env.ZEROX_API_KEY!,
    jupiterUrl: process.env.JUPITER_API_URL || 'https://lite-api.jup.ag',
    defaultSlippage: 0.5,
    maxPriceImpact: 5.0,
    gasLimitBuffer: 1.2,
  };

  console.log('🚀 Hyperindex Aggregator Example\n');

  const aggregator = createHyperindexAggregator(config);
  
  console.log('✅ Aggregator initialized');
  console.log('📊 Supported chains:', aggregator.getSupportedChains().join(', '));
  console.log('');

  const sampleSwapParams: SwapParams = {
    tokenIn: {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xA0b86a33E6441d1b1B80BB51e3ee7C80E60b0E00',
      decimals: 6,
    },
    tokenOut: {
      symbol: 'WETH',
      name: 'Wrapped Ethereum',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
    },
    amountIn: '1000000000',
    slippage: 0.5,
    userAddress: '0x1234567890123456789012345678901234567890',
    chain: SupportedChain.ETHEREUM,
  };

  console.log('🔍 Finding best route for USDC -> WETH swap...');
  try {
    const route = await aggregator.findBestRoute(sampleSwapParams);
    
    console.log('✅ Best route found:');
    console.log(`   Protocol: ${route.bestQuote.protocol}`);
    console.log(`   Price: ${route.bestQuote.price}`);
    console.log(`   Amount out: ${route.bestQuote.amountOut}`);
    console.log(`   Gas cost: $${route.bestQuote.gasCostUSD.toFixed(2)}`);
    console.log(`   Price impact: ${route.bestQuote.priceImpact.toFixed(2)}%`);
    console.log(`   Savings: $${route.totalSavings.toFixed(2)}`);
    console.log(`   Confidence: ${(route.confidence * 100).toFixed(1)}%\n`);
  } catch (_error) {
    console.error('❌ Failed to find route:', _error);
  }

  console.log('🏗️ Index Token Creation Example\n');
  
  const indexService = createIndexTokenService(config);
  
  const indexRequest: IndexTokenCreationRequest = {
    name: 'DeFi Blue Chip Index',
    symbol: 'DEFI',
    totalValueUSD: 50000,
    userAddress: '0x1234567890123456789012345678901234567890',
    components: [
      {
        symbol: 'WETH',
        name: 'Wrapped Ethereum',
        targetRatio: 4000,
        targetAmount: '20000',
        addresses: {
          [SupportedChain.ETHEREUM]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          [SupportedChain.POLYGON]: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
          [SupportedChain.ARBITRUM]: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
          [SupportedChain.SOLANA]: 'So11111111111111111111111111111111111111112',
        },
      },
      {
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        targetRatio: 3000,
        targetAmount: '15000',
        addresses: {
          [SupportedChain.ETHEREUM]: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
          [SupportedChain.POLYGON]: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
          [SupportedChain.ARBITRUM]: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
          [SupportedChain.SOLANA]: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
        },
      },
      {
        symbol: 'UNI',
        name: 'Uniswap',
        targetRatio: 2000,
        targetAmount: '10000',
        addresses: {
          [SupportedChain.ETHEREUM]: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
          [SupportedChain.POLYGON]: '0xb33EaAd8d922B1083446DC23f610c2567fB5180f',
          [SupportedChain.ARBITRUM]: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',
          [SupportedChain.SOLANA]: 'DEhAasscXF4kEGxFgJ3bq4PpVGp5wyUxMRvn6TzGVHaw',
        },
      },
      {
        symbol: 'LINK',
        name: 'Chainlink',
        targetRatio: 1000,
        targetAmount: '5000',
        addresses: {
          [SupportedChain.ETHEREUM]: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
          [SupportedChain.POLYGON]: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39',
          [SupportedChain.ARBITRUM]: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
          [SupportedChain.SOLANA]: 'CWE8jPTUYhdCTZYWPTe1o5DFqfdjzWKc9WKz6rSjQUdG',
        },
      },
    ],
    preferredChains: [SupportedChain.ARBITRUM, SupportedChain.POLYGON],
    maxSlippage: 1.0,
  };

  console.log('📋 Creating optimized index plan...');
  try {
    const plan = await indexService.createOptimizedIndexPlan(indexRequest);
    
    console.log('\n✅ Optimization complete!');
    console.log(`💰 Total cost: $${plan.totalCostUSD.toFixed(2)}`);
    console.log(`⛽ Est. gas cost: $${plan.estimatedGasCostUSD.toFixed(2)}`);
    console.log(`💡 Total savings: $${plan.totalSavings.toFixed(2)}`);
    console.log(`📊 Avg confidence: ${(plan.averageConfidence * 100).toFixed(1)}%`);
    console.log('🎯 Risk assessment:');
    console.log(`   Price Impact: ${plan.riskAssessment.priceImpactRisk}`);
    console.log(`   Liquidity: ${plan.riskAssessment.liquidityRisk}`);
    console.log(`   Execution: ${plan.riskAssessment.executionRisk}`);
    
    console.log('\n📊 Execution routes:');
    plan.executionRoutes.forEach((route, i) => {
      console.log(`   ${i + 1}. ${route.component.symbol} on ${route.chain}`);
      console.log(`      Protocol: ${route.route.bestQuote.protocol}`);
      console.log(`      Confidence: ${(route.route.confidence * 100).toFixed(1)}%`);
      console.log(`      Gas cost: $${route.route.bestQuote.gasCostUSD.toFixed(2)}`);
    });
    
    console.log('\n🚀 Ready for execution! Call executeIndexCreation(plan) when ready.');
    
  } catch (_error) {
    console.error('❌ Failed to create index plan:', _error);
  }
}

if (require.main === module) {
  exampleUsage().catch(console.error);
}

export { exampleUsage };