import { SupportedChain } from './types';

interface GasPrice {
  fast: number;
  standard: number;
  slow: number;
}

interface ChainGasData {
  gasPrice: GasPrice;
  nativeTokenPriceUSD: number;
  lastUpdated: number;
}

export class GasEstimator {
  private gasCache: Map<SupportedChain, ChainGasData> = new Map();
  private readonly CACHE_TTL = 60 * 1000; // 1 minute

  async getGasEstimate(
    chain: SupportedChain,
    gasLimit: number,
    priority: 'slow' | 'standard' | 'fast' = 'standard'
  ): Promise<{ gasCostUSD: number; gasPrice: number }> {
    const gasData = await this.getGasData(chain);
    const gasPrice = gasData.gasPrice[priority];
    const gasCostUSD = (gasLimit * gasPrice * gasData.nativeTokenPriceUSD) / 1e18;

    return {
      gasCostUSD,
      gasPrice,
    };
  }

  private async getGasData(chain: SupportedChain): Promise<ChainGasData> {
    const cached = this.gasCache.get(chain);
    const now = Date.now();

    if (cached && (now - cached.lastUpdated) < this.CACHE_TTL) {
      return cached;
    }

    const gasData = await this.fetchGasData(chain);
    this.gasCache.set(chain, gasData);
    return gasData;
  }

  private async fetchGasData(chain: SupportedChain): Promise<ChainGasData> {
    switch (chain) {
      case SupportedChain.ETHEREUM:
        return this.fetchEthereumGasData();
      case SupportedChain.POLYGON:
        return this.fetchPolygonGasData();
      case SupportedChain.ARBITRUM:
        return this.fetchArbitrumGasData();
      case SupportedChain.SOLANA:
        return this.fetchSolanaGasData();
      default:
        throw new Error(`Unsupported chain: ${chain}`);
    }
  }

  private async fetchEthereumGasData(): Promise<ChainGasData> {
    try {
      const [gasResponse, priceResponse] = await Promise.all([
        fetch('https://api.etherscan.io/api?module=gastracker&action=gasoracle'),
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
      ]);

      const gasData = await gasResponse.json();
      const priceData = await priceResponse.json();

      return {
        gasPrice: {
          slow: parseInt(gasData.result.SafeGasPrice) * 1e9,
          standard: parseInt(gasData.result.StandardGasPrice) * 1e9,
          fast: parseInt(gasData.result.FastGasPrice) * 1e9,
        },
        nativeTokenPriceUSD: priceData.ethereum.usd,
        lastUpdated: Date.now(),
      };
    } catch (_error) {
      console.warn('Failed to fetch Ethereum gas data, using fallback');
      return this.getFallbackGasData(SupportedChain.ETHEREUM);
    }
  }

  private async fetchPolygonGasData(): Promise<ChainGasData> {
    try {
      const [gasResponse, priceResponse] = await Promise.all([
        fetch('https://gasstation-mainnet.matic.network/v2'),
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd')
      ]);

      const gasData = await gasResponse.json();
      const priceData = await priceResponse.json();

      return {
        gasPrice: {
          slow: gasData.safeLow.maxFee * 1e9,
          standard: gasData.standard.maxFee * 1e9,
          fast: gasData.fast.maxFee * 1e9,
        },
        nativeTokenPriceUSD: priceData['matic-network'].usd,
        lastUpdated: Date.now(),
      };
    } catch (_error) {
      console.warn('Failed to fetch Polygon gas data, using fallback');
      return this.getFallbackGasData(SupportedChain.POLYGON);
    }
  }

  private async fetchArbitrumGasData(): Promise<ChainGasData> {
    try {
      const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const priceData = await priceResponse.json();

      return {
        gasPrice: {
          slow: 0.1 * 1e9,
          standard: 0.15 * 1e9,
          fast: 0.2 * 1e9,
        },
        nativeTokenPriceUSD: priceData.ethereum.usd,
        lastUpdated: Date.now(),
      };
    } catch (_error) {
      console.warn('Failed to fetch Arbitrum gas data, using fallback');
      return this.getFallbackGasData(SupportedChain.ARBITRUM);
    }
  }

  private async fetchSolanaGasData(): Promise<ChainGasData> {
    try {
      const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      const priceData = await priceResponse.json();

      return {
        gasPrice: {
          slow: 5000,
          standard: 5000,
          fast: 5000,
        },
        nativeTokenPriceUSD: priceData.solana.usd,
        lastUpdated: Date.now(),
      };
    } catch (_error) {
      console.warn('Failed to fetch Solana gas data, using fallback');
      return this.getFallbackGasData(SupportedChain.SOLANA);
    }
  }

  private getFallbackGasData(chain: SupportedChain): ChainGasData {
    const fallbackData: Record<SupportedChain, ChainGasData> = {
      [SupportedChain.ETHEREUM]: {
        gasPrice: { slow: 20e9, standard: 25e9, fast: 35e9 },
        nativeTokenPriceUSD: 3500,
        lastUpdated: Date.now(),
      },
      [SupportedChain.POLYGON]: {
        gasPrice: { slow: 30e9, standard: 35e9, fast: 45e9 },
        nativeTokenPriceUSD: 0.9,
        lastUpdated: Date.now(),
      },
      [SupportedChain.ARBITRUM]: {
        gasPrice: { slow: 0.1e9, standard: 0.15e9, fast: 0.2e9 },
        nativeTokenPriceUSD: 3500,
        lastUpdated: Date.now(),
      },
      [SupportedChain.SOLANA]: {
        gasPrice: { slow: 5000, standard: 5000, fast: 5000 },
        nativeTokenPriceUSD: 120,
        lastUpdated: Date.now(),
      },
    };

    return fallbackData[chain];
  }

  clearCache() {
    this.gasCache.clear();
  }

  async estimateTransactionCost(
    chain: SupportedChain,
    transactionType: 'simple_transfer' | 'erc20_transfer' | 'swap' | 'complex_defi',
    priority: 'slow' | 'standard' | 'fast' = 'standard'
  ): Promise<{ gasCostUSD: number; gasLimit: number; gasPrice: number }> {
    const gasLimits = {
      simple_transfer: 21000,
      erc20_transfer: 65000,
      swap: 150000,
      complex_defi: 300000,
    };

    const gasLimit = gasLimits[transactionType];
    const { gasCostUSD, gasPrice } = await this.getGasEstimate(chain, gasLimit, priority);

    return {
      gasCostUSD,
      gasLimit,
      gasPrice,
    };
  }
}