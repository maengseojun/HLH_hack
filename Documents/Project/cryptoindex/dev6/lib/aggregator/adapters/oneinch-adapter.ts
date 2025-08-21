import { ProtocolAdapter, SwapParams, PriceQuote, SupportedChain } from '../types';

export class OneInchAdapter implements ProtocolAdapter {
  public name = '1inch';
  public supportedChains = [SupportedChain.ETHEREUM, SupportedChain.POLYGON, SupportedChain.ARBITRUM];
  
  private apiKey: string;
  private baseUrl = 'https://api.1inch.dev/swap/v6.0';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getChainId(chain: SupportedChain): number {
    const chainMap = {
      [SupportedChain.ETHEREUM]: 1,
      [SupportedChain.POLYGON]: 137,
      [SupportedChain.ARBITRUM]: 42161,
    };
    return chainMap[chain as keyof typeof chainMap];
  }

  private async makeRequest(url: string, options: RequestInit = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`1inch API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  async getQuote(params: SwapParams): Promise<PriceQuote> {
    const chainId = this.getChainId(params.chain);
    
    const quoteUrl = `${this.baseUrl}/${chainId}/quote`;
    const searchParams = new URLSearchParams({
      src: params.tokenIn.address,
      dst: params.tokenOut.address,
      amount: params.amountIn,
    });

    try {
      const response = await this.makeRequest(`${quoteUrl}?${searchParams}`);
      
      const gasCostUSD = await this.estimateGasCost(params.chain, response.gas);
      
      return {
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
        amountOut: response.dstAmount,
        price: parseFloat(response.dstAmount) / parseFloat(params.amountIn),
        priceImpact: parseFloat(response.protocols?.[0]?.[0]?.[0]?.priceImpact || '0'),
        gasCostUSD,
        protocol: '1inch',
        chain: params.chain,
        route: response.protocols,
        estimatedGas: response.gas,
      };
    } catch (_error) {
      console.error('1inch quote error:', _error);
      throw new Error(`Failed to get 1inch quote: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`);
    }
  }

  async executeSwap(params: SwapParams, route?: any): Promise<string> {
    const chainId = this.getChainId(params.chain);
    
    const swapUrl = `${this.baseUrl}/${chainId}/swap`;
    const swapParams = new URLSearchParams({
      src: params.tokenIn.address,
      dst: params.tokenOut.address,
      amount: params.amountIn,
      from: params.userAddress,
      slippage: params.slippage.toString(),
      disableEstimate: 'true',
    });

    try {
      const response = await this.makeRequest(`${swapUrl}?${swapParams}`);
      
      return response.tx.data;
    } catch (_error) {
      console.error('1inch swap error:', _error);
      throw new Error(`Failed to execute 1inch swap: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`);
    }
  }

  private async estimateGasCost(chain: SupportedChain, gasEstimate: string): Promise<number> {
    const gasPriceMap = {
      [SupportedChain.ETHEREUM]: 25,
      [SupportedChain.POLYGON]: 35,
      [SupportedChain.ARBITRUM]: 0.1,
    };

    const ethPriceUSD = 3500;
    const gasPrice = gasPriceMap[chain as keyof typeof gasPriceMap] || 20;
    const gasUsed = parseInt(gasEstimate) || 150000;
    
    return (gasUsed * gasPrice * ethPriceUSD) / 1e18;
  }

  async getSupportedTokens(chain: SupportedChain) {
    const chainId = this.getChainId(chain);
    const tokensUrl = `${this.baseUrl}/${chainId}/tokens`;

    try {
      const response = await this.makeRequest(tokensUrl);
      return response.tokens;
    } catch (_error) {
      console.error('1inch tokens error:', _error);
      throw new Error(`Failed to get supported tokens: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`);
    }
  }
}