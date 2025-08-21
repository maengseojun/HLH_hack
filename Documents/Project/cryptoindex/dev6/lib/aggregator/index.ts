export * from './types';
export * from './hyperindex-aggregator';
export * from './gas-estimator';
export * from './index-token-service';

export { OneInchAdapter } from './adapters/oneinch-adapter';
export { JupiterAdapter } from './adapters/jupiter-adapter';
export { ZeroXAdapter } from './adapters/zerox-adapter';

import { HyperindexAggregator } from './hyperindex-aggregator';
import { IndexTokenService } from './index-token-service';
import { GasEstimator } from './gas-estimator';
import { AggregatorConfig } from './types';

export function createHyperindexAggregator(config: AggregatorConfig): HyperindexAggregator {
  return new HyperindexAggregator(config);
}

export function createIndexTokenService(config: AggregatorConfig): IndexTokenService {
  return new IndexTokenService(config);
}

export function createGasEstimator(): GasEstimator {
  return new GasEstimator();
}

export const defaultConfig: Partial<AggregatorConfig> = {
  jupiterUrl: 'https://lite-api.jup.ag',
  defaultSlippage: 0.5,
  maxPriceImpact: 5.0,
  gasLimitBuffer: 1.2,
};