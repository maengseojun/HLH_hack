import { ProtocolAdapter, SwapParams, PriceQuote, SupportedChain } from '../types';

export class ZeroXAdapter implements ProtocolAdapter {
  public name = '0x';
  public supportedChains = [SupportedChain.ETHEREUM, SupportedChain.POLYGON, SupportedChain.ARBITRUM];
  
  private apiKey: string;
  private baseUrl = 'https://api.0x.org';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getNetworkPath(chain: SupportedChain): string {
    const networkMap = {
      [SupportedChain.ETHEREUM]: '',
      [SupportedChain.POLYGON]: 'polygon/',
      [SupportedChain.ARBITRUM]: 'arbitrum/',
    };
    return networkMap[chain as keyof typeof networkMap] || '';
  }

  private async makeRequest(url: string, options: RequestInit = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        '0x-api-key': this.apiKey,
        'accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`0x API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  async getQuote(params: SwapParams): Promise<PriceQuote> {
    const networkPath = this.getNetworkPath(params.chain);
    const quoteUrl = `${this.baseUrl}/${networkPath}swap/v1/quote`;
    
    const searchParams = new URLSearchParams({
      sellToken: params.tokenIn.address,
      buyToken: params.tokenOut.address,
      sellAmount: params.amountIn,
      slippagePercentage: (params.slippage / 100).toString(),
    });

    try {
      const response = await this.makeRequest(`${quoteUrl}?${searchParams}`);
      
      const gasCostUSD = await this.estimateGasCost(params.chain, response.gas);
      
      return {
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
        amountOut: response.buyAmount,
        price: parseFloat(response.buyAmount) / parseFloat(params.amountIn),
        priceImpact: parseFloat(response.estimatedPriceImpact || '0') * 100,
        gasCostUSD,
        protocol: '0x',
        chain: params.chain,
        route: response.orders,
        estimatedGas: response.gas,
      };
    } catch (_error) {
      console.error('0x quote error:', _error);
      throw new Error(`Failed to get 0x quote: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`);
    }
  }

  async executeSwap(params: SwapParams, route?: any): Promise<string> {
    const networkPath = this.getNetworkPath(params.chain);
    const swapUrl = `${this.baseUrl}/${networkPath}swap/v1/quote`;
    
    const searchParams = new URLSearchParams({
      sellToken: params.tokenIn.address,
      buyToken: params.tokenOut.address,
      sellAmount: params.amountIn,
      takerAddress: params.userAddress,
      slippagePercentage: (params.slippage / 100).toString(),
    });

    try {
      const response = await this.makeRequest(`${swapUrl}?${searchParams}`);
      
      return response.data;
    } catch (_error) {
      console.error('0x swap error:', _error);
      throw new Error(`Failed to execute 0x swap: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`);
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
    const networkPath = this.getNetworkPath(chain);
    const tokensUrl = `${this.baseUrl}/${networkPath}swap/v1/tokens`;

    try {
      const response = await this.makeRequest(tokensUrl);
      return response.records;
    } catch (_error) {
      console.error('0x tokens error:', _error);
      throw new Error(`Failed to get supported tokens: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`);
    }
  }

  async getPrice(params: SwapParams) {
    const networkPath = this.getNetworkPath(params.chain);
    const priceUrl = `${this.baseUrl}/${networkPath}swap/v1/price`;
    
    const searchParams = new URLSearchParams({
      sellToken: params.tokenIn.address,
      buyToken: params.tokenOut.address,
      sellAmount: params.amountIn,
    });

    try {
      const response = await this.makeRequest(`${priceUrl}?${searchParams}`);
      return response;
    } catch (_error) {
      console.error('0x price error:', _error);
      throw new Error(`Failed to get price: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`);
    }
  }
}