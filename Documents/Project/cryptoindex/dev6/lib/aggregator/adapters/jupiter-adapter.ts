import { ProtocolAdapter, SwapParams, PriceQuote, SupportedChain } from '../types';

export class JupiterAdapter implements ProtocolAdapter {
  public name = 'Jupiter';
  public supportedChains = [SupportedChain.SOLANA];
  
  private baseUrl: string;

  constructor(baseUrl = 'https://lite-api.jup.ag') {
    this.baseUrl = baseUrl;
  }

  private async makeRequest(url: string, options: RequestInit = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jupiter API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  async getQuote(params: SwapParams): Promise<PriceQuote> {
    if (params.chain !== SupportedChain.SOLANA) {
      throw new Error('Jupiter only supports Solana network');
    }

    const quoteUrl = `${this.baseUrl}/v6/quote`;
    const searchParams = new URLSearchParams({
      inputMint: params.tokenIn.address,
      outputMint: params.tokenOut.address,
      amount: params.amountIn,
      slippageBps: Math.floor(params.slippage * 100).toString(),
    });

    try {
      const response = await this.makeRequest(`${quoteUrl}?${searchParams}`);
      
      const gasCostUSD = await this.estimateSolanaFee();
      const priceImpact = response.priceImpactPct ? parseFloat(response.priceImpactPct) : 0;
      
      return {
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
        amountOut: response.outAmount,
        price: parseFloat(response.outAmount) / parseFloat(params.amountIn),
        priceImpact: Math.abs(priceImpact),
        gasCostUSD,
        protocol: 'Jupiter',
        chain: params.chain,
        route: response.routePlan,
        estimatedGas: '5000',
      };
    } catch (_error) {
      console.error('Jupiter quote error:', _error);
      throw new Error(`Failed to get Jupiter quote: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`);
    }
  }

  async executeSwap(params: SwapParams, route?: any): Promise<string> {
    if (params.chain !== SupportedChain.SOLANA) {
      throw new Error('Jupiter only supports Solana network');
    }

    const swapUrl = `${this.baseUrl}/v6/swap`;
    
    const quoteResponse = await this.getQuote(params);
    
    const swapPayload = {
      quoteResponse,
      userPublicKey: params.userAddress,
      wrapAndUnwrapSol: true,
      useSharedAccounts: true,
    };

    try {
      const response = await this.makeRequest(swapUrl, {
        method: 'POST',
        body: JSON.stringify(swapPayload),
      });

      return response.swapTransaction;
    } catch (_error) {
      console.error('Jupiter swap error:', _error);
      throw new Error(`Failed to execute Jupiter swap: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`);
    }
  }

  private async estimateSolanaFee(): Promise<number> {
    const solPriceUSD = 120;
    const averageFeeSOL = 0.00005;
    
    return averageFeeSOL * solPriceUSD;
  }

  async getSupportedTokens() {
    const tokensUrl = `${this.baseUrl}/v6/tokens`;

    try {
      const response = await this.makeRequest(tokensUrl);
      return response;
    } catch (_error) {
      console.error('Jupiter tokens error:', _error);
      throw new Error(`Failed to get supported tokens: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`);
    }
  }

  async getIndexedRouteMap() {
    const routeMapUrl = `${this.baseUrl}/v6/indexed-route-map`;

    try {
      const response = await this.makeRequest(routeMapUrl);
      return response;
    } catch (_error) {
      console.error('Jupiter route map error:', _error);
      throw new Error(`Failed to get route map: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`);
    }
  }
}