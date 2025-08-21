# Hyperindex Aggregator

A comprehensive multi-chain aggregator for optimal price discovery and execution across Ethereum, Polygon, Arbitrum, and Solana networks.

## Features

- **Multi-Chain Support**: Ethereum, Polygon, Arbitrum, Solana
- **Protocol Integration**: 1inch, 0x Protocol, Jupiter
- **Price Optimization**: Find the best prices across all supported chains
- **Gas Estimation**: Real-time gas cost calculation
- **Index Token Creation**: Optimized token basket creation with multi-chain routing

## Setup

1. **Environment Variables**

Create a `.env.local` file in your project root:

```env
# API Keys
ONEINCH_API_KEY=bHiqhozNvh7LHsdYIg2JawoivyHGaEJp
ZEROX_API_KEY=c8a1383c-3dea-4856-aa95-5a4baf77d76b

# Jupiter (free endpoint)
JUPITER_API_URL=https://lite-api.jup.ag
```

2. **Installation**

```bash
npm install
```

## Usage

### Basic Aggregator Setup

```typescript
import { createHyperindexAggregator, AggregatorConfig, SupportedChain } from '@/lib/aggregator';

const config: AggregatorConfig = {
  oneInchApiKey: process.env.ONEINCH_API_KEY!,
  zeroXApiKey: process.env.ZEROX_API_KEY!,
  jupiterUrl: process.env.JUPITER_API_URL || 'https://lite-api.jup.ag',
  defaultSlippage: 0.5,
  maxPriceImpact: 5.0,
  gasLimitBuffer: 1.2,
};

const aggregator = createHyperindexAggregator(config);
```

### Finding Best Routes

```typescript
import { SwapParams, SupportedChain } from '@/lib/aggregator';

const params: SwapParams = {
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
  amountIn: '1000000000', // 1000 USDC (6 decimals)
  slippage: 0.5,
  userAddress: '0x...',
  chain: SupportedChain.ETHEREUM,
};

const route = await aggregator.findBestRoute(params);
console.log('Best quote:', route.bestQuote);
console.log('Savings:', route.totalSavings);
console.log('Confidence:', route.confidence);
```

### Index Token Creation

```typescript
import { createIndexTokenService, IndexTokenCreationRequest } from '@/lib/aggregator';

const indexService = createIndexTokenService(config);

const request: IndexTokenCreationRequest = {
  name: 'Crypto Index Fund',
  symbol: 'CIF',
  totalValueUSD: 10000,
  userAddress: '0x...',
  components: [
    {
      symbol: 'WETH',
      name: 'Wrapped Ethereum',
      targetRatio: 4000, // 40%
      targetAmount: '4000',
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
      targetRatio: 3000, // 30%
      targetAmount: '3000',
      addresses: {
        [SupportedChain.ETHEREUM]: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        [SupportedChain.POLYGON]: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
        [SupportedChain.ARBITRUM]: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
        [SupportedChain.SOLANA]: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
      },
    },
  ],
  preferredChains: [SupportedChain.ARBITRUM, SupportedChain.POLYGON],
  maxSlippage: 1.0,
};

// Create optimized execution plan
const plan = await indexService.createOptimizedIndexPlan(request);
console.log('Total cost:', plan.totalCostUSD);
console.log('Gas cost:', plan.estimatedGasCostUSD);
console.log('Savings:', plan.totalSavings);
console.log('Risk assessment:', plan.riskAssessment);

// Execute the plan
const result = await indexService.executeIndexCreation(plan);
console.log('Execution result:', result);
```

### Gas Estimation

```typescript
import { createGasEstimator, SupportedChain } from '@/lib/aggregator';

const gasEstimator = createGasEstimator();

const gasEstimate = await gasEstimator.estimateTransactionCost(
  SupportedChain.ETHEREUM,
  'swap',
  'standard'
);

console.log('Gas cost in USD:', gasEstimate.gasCostUSD);
console.log('Gas limit:', gasEstimate.gasLimit);
console.log('Gas price:', gasEstimate.gasPrice);
```

## Supported Protocols

### 1inch (Ethereum, Polygon, Arbitrum)
- Advanced routing algorithms
- MEV protection
- Gas optimization

### Jupiter (Solana)
- Best-in-class Solana aggregation
- Route optimization
- Low latency quotes

### 0x Protocol (Multi-chain)
- Professional-grade liquidity
- Gasless approvals
- RFQ system

## API Rate Limits

- **1inch**: 500 requests/hour (with API key)
- **Jupiter**: No limits (public endpoint)
- **0x**: 1000 requests/hour (with API key)

## Error Handling

The aggregator includes comprehensive error handling:

```typescript
try {
  const route = await aggregator.findBestRoute(params);
} catch (error) {
  if (error.message.includes('No quotes available')) {
    // Handle case where no protocols can fulfill the request
    console.log('Try different parameters or check token addresses');
  } else if (error.message.includes('API error')) {
    // Handle API-specific errors
    console.log('API temporarily unavailable, try again later');
  }
}
```

## Architecture

```
lib/aggregator/
├── index.ts                 # Main exports
├── types.ts                 # TypeScript interfaces
├── hyperindex-aggregator.ts # Main aggregator class
├── gas-estimator.ts         # Gas cost estimation
├── index-token-service.ts   # Index token creation service
├── adapters/
│   ├── oneinch-adapter.ts   # 1inch integration
│   ├── jupiter-adapter.ts   # Jupiter integration
│   └── zerox-adapter.ts     # 0x Protocol integration
└── README.md               # This file
```

## Contributing

1. Add new protocol adapters in the `adapters/` directory
2. Implement the `ProtocolAdapter` interface
3. Register the adapter in `HyperindexAggregator`
4. Update tests and documentation

## License

MIT License