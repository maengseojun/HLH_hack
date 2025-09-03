// lib/dex/multi-dex-integration.ts
/**
 * Multi-DEX Integration for External Chain Token Swaps
 * Supports Jupiter (Solana), PancakeSwap (BSC), Uniswap (Ethereum)
 */

import axios from 'axios';
import { ethers } from 'ethers';
import { jupiterClient, JupiterQuoteRequest } from './jupiter-resilient';

export interface DEXSwapRequest {
  dexType: 'jupiter' | 'pancakeswap' | 'uniswap';
  chainId: string;
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  slippageBps: number;
  recipient: string;
  deadline?: number;
}

export interface DEXSwapResponse {
  success: boolean;
  transactionData?: string;
  estimatedOutput?: number;
  priceImpact?: string;
  fee?: number;
  error?: string;
  route?: any;
}

export interface DEXQuoteRequest {
  dexType: 'jupiter' | 'pancakeswap' | 'uniswap';
  chainId: string;
  inputToken: string;
  outputToken: string;
  inputAmount: number;
}

export interface DEXQuoteResponse {
  success: boolean;
  outputAmount?: number;
  priceImpact?: string;
  fee?: number;
  route?: any;
  error?: string;
}

// Token addresses for different chains
export const TOKEN_ADDRESSES = {
  solana: {
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    SOL: 'So11111111111111111111111111111111111111112',
    BOME: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',
    MEW: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
    WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
  },
  bsc: {
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    BNB: '0x0000000000000000000000000000000000000000',
    BABYDOGE: '0xc748673057861a797275CD8A068AbB95A902e8de',
    FLOKI: '0xfb5B838b6cfEEdC2873aB27866079AC55363D37E',
    CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82'
  },
  ethereum: {
    USDC: '0xA0b86a33E6441d17eC35d66ad5D7f7f41a82D2b8',
    ETH: '0x0000000000000000000000000000000000000000',
    PEPE: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
    SHIB: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE'
  }
} as const;

export class MultiDEXIntegration {
  private jupiterApiUrl: string;
  private bscProvider: ethers.JsonRpcProvider;
  private ethProvider: ethers.JsonRpcProvider;
  private pancakeswapRouter: string;
  private uniswapRouter: string;

  constructor() {
    this.jupiterApiUrl = process.env.JUPITER_API_URL || 'https://quote-api.jup.ag';
    this.bscProvider = new ethers.JsonRpcProvider(
      process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org'
    );
    this.ethProvider = new ethers.JsonRpcProvider(
      process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/your_key'
    );
    this.pancakeswapRouter = process.env.PANCAKESWAP_ROUTER || '0x10ED43C718714eb63d5aA57B78B54704E256024E';
    this.uniswapRouter = process.env.UNISWAP_V3_ROUTER || '0xE592427A0AEce92De3Edee1F18E0157C05861564';
  }

  /**
   * Get quote from any supported DEX
   */
  async getQuote(request: DEXQuoteRequest): Promise<DEXQuoteResponse> {
    try {
      switch (request.dexType) {
        case 'jupiter':
          return await this.getJupiterQuote(request);
        case 'pancakeswap':
          return await this.getPancakeSwapQuote(request);
        case 'uniswap':
          return await this.getUniswapQuote(request);
        default:
          return { success: false, error: `Unsupported DEX: ${request.dexType}` };
      }
    } catch (error) {
      console.error('DEX quote error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown quote error' 
      };
    }
  }

  /**
   * Execute swap on any supported DEX
   */
  async executeSwap(request: DEXSwapRequest): Promise<DEXSwapResponse> {
    try {
      console.log('Executing DEX swap:', {
        dex: request.dexType,
        chain: request.chainId,
        from: request.inputToken,
        to: request.outputToken,
        amount: request.inputAmount
      });

      switch (request.dexType) {
        case 'jupiter':
          return await this.executeJupiterSwap(request);
        case 'pancakeswap':
          return await this.executePancakeSwap(request);
        case 'uniswap':
          return await this.executeUniswapSwap(request);
        default:
          return { success: false, error: `Unsupported DEX: ${request.dexType}` };
      }
    } catch (error) {
      console.error('DEX swap error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown swap error' 
      };
    }
  }

  /**
   * Jupiter (Solana) Integration
   */
  private async getJupiterQuote(request: DEXQuoteRequest): Promise<DEXQuoteResponse> {
    try {
      console.log('🔄 Getting Jupiter quote with resilient client...');
      
      const jupiterRequest: JupiterQuoteRequest = {
        inputMint: request.inputToken,
        outputMint: request.outputToken,
        amount: request.inputAmount,
        slippageBps: 50, // 0.5% slippage
        onlyDirectRoutes: false
      };

      const response = await jupiterClient.getQuote(jupiterRequest);

      if (response.success && response.data) {
        console.log(`✅ Jupiter quote success via: ${response.usedEndpoint}`);
        
        return {
          success: true,
          outputAmount: parseInt(response.data.outAmount || '0'),
          priceImpact: response.data.priceImpactPct || '0',
          fee: parseInt(response.data.inAmount || '0') - parseInt(response.data.outAmount || '0'),
          route: response.data.routePlan || response.data
        };
      } else {
        // Graceful fallback - don't fail the entire operation
        console.warn(`⚠️ Jupiter unavailable: ${response.error}, continuing without Solana DEX`);
        
        return {
          success: false,
          error: `Jupiter temporarily unavailable: ${response.error}. Using other DEXes.`
        };
      }
    } catch (error) {
      console.warn(`⚠️ Jupiter error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return { 
        success: false, 
        error: `Jupiter service unavailable. Other DEXes still available.` 
      };
    }
  }

  private async executeJupiterSwap(request: DEXSwapRequest): Promise<DEXSwapResponse> {
    try {
      // First get quote
      const quote = await this.getJupiterQuote({
        dexType: 'jupiter',
        chainId: request.chainId,
        inputToken: request.inputToken,
        outputToken: request.outputToken,
        inputAmount: request.inputAmount
      });

      if (!quote.success) {
        return { success: false, error: 'Failed to get Jupiter quote' };
      }

      // Get swap transaction
      const swapRequest = {
        quoteResponse: quote.route,
        userPublicKey: request.recipient,
        wrapAndUnwrapSol: true,
        computeUnitPriceMicroLamports: 1000000 // 0.001 SOL priority fee
      };

      const swapResponse = await axios.post(
        `${this.jupiterApiUrl}/swap`,
        swapRequest,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000
        }
      );

      return {
        success: true,
        transactionData: swapResponse.data.swapTransaction,
        estimatedOutput: quote.outputAmount,
        priceImpact: quote.priceImpact,
        fee: quote.fee
      };
    } catch (error) {
      return { 
        success: false, 
        error: `Jupiter swap failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * PancakeSwap (BSC) Integration
   */
  private async getPancakeSwapQuote(request: DEXQuoteRequest): Promise<DEXQuoteResponse> {
    try {
      // PancakeSwap V3 quoter
      const quoterABI = [
        "function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut)"
      ];

      const quoter = new ethers.Contract(
        '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997', // PancakeSwap V3 Quoter
        quoterABI,
        this.bscProvider
      );

      const quoteParams = {
        tokenIn: request.inputToken,
        tokenOut: request.outputToken,
        fee: 2500, // 0.25% fee tier
        amountIn: request.inputAmount,
        sqrtPriceLimitX96: 0
      };

      const amountOut = await quoter.quoteExactInputSingle(quoteParams);
      
      return {
        success: true,
        outputAmount: Number(amountOut),
        priceImpact: '0.1%', // Estimated
        fee: Math.floor(request.inputAmount * 0.0025) // 0.25% fee
      };
    } catch (error) {
      return { 
        success: false, 
        error: `PancakeSwap quote failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private async executePancakeSwap(request: DEXSwapRequest): Promise<DEXSwapResponse> {
    try {
      // PancakeSwap V3 Router
      const routerABI = [
        "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut)"
      ];

      const router = new ethers.Contract(
        this.pancakeswapRouter,
        routerABI,
        this.bscProvider
      );

      const swapParams = {
        tokenIn: request.inputToken,
        tokenOut: request.outputToken,
        fee: 2500, // 0.25% fee tier
        recipient: request.recipient,
        deadline: request.deadline || Math.floor(Date.now() / 1000) + 1200, // 20 minutes
        amountIn: request.inputAmount,
        amountOutMinimum: Math.floor(request.inputAmount * (10000 - request.slippageBps) / 10000),
        sqrtPriceLimitX96: 0
      };

      // Get transaction data (not actually sending)
      const txData = router.interface.encodeFunctionData('exactInputSingle', [swapParams]);

      return {
        success: true,
        transactionData: txData,
        estimatedOutput: Math.floor(request.inputAmount * 0.997), // Estimate with 0.3% slippage
        priceImpact: '0.1%',
        fee: Math.floor(request.inputAmount * 0.0025)
      };
    } catch (error) {
      return { 
        success: false, 
        error: `PancakeSwap execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Uniswap (Ethereum) Integration
   */
  private async getUniswapQuote(request: DEXQuoteRequest): Promise<DEXQuoteResponse> {
    try {
      // Uniswap V3 quoter
      const quoterABI = [
        "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)"
      ];

      const quoter = new ethers.Contract(
        '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6', // Uniswap V3 Quoter
        quoterABI,
        this.ethProvider
      );

      const amountOut = await quoter.quoteExactInputSingle(
        request.inputToken,
        request.outputToken,
        3000, // 0.3% fee tier
        request.inputAmount,
        0
      );
      
      return {
        success: true,
        outputAmount: Number(amountOut),
        priceImpact: '0.15%', // Estimated
        fee: Math.floor(request.inputAmount * 0.003) // 0.3% fee
      };
    } catch (error) {
      return { 
        success: false, 
        error: `Uniswap quote failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private async executeUniswapSwap(request: DEXSwapRequest): Promise<DEXSwapResponse> {
    try {
      // Uniswap V3 Router
      const routerABI = [
        "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut)"
      ];

      const router = new ethers.Contract(
        this.uniswapRouter,
        routerABI,
        this.ethProvider
      );

      const swapParams = {
        tokenIn: request.inputToken,
        tokenOut: request.outputToken,
        fee: 3000, // 0.3% fee tier
        recipient: request.recipient,
        deadline: request.deadline || Math.floor(Date.now() / 1000) + 1200,
        amountIn: request.inputAmount,
        amountOutMinimum: Math.floor(request.inputAmount * (10000 - request.slippageBps) / 10000),
        sqrtPriceLimitX96: 0
      };

      // Get transaction data
      const txData = router.interface.encodeFunctionData('exactInputSingle', [swapParams]);

      return {
        success: true,
        transactionData: txData,
        estimatedOutput: Math.floor(request.inputAmount * 0.997), // Estimate
        priceImpact: '0.15%',
        fee: Math.floor(request.inputAmount * 0.003)
      };
    } catch (error) {
      return { 
        success: false, 
        error: `Uniswap execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Get optimal route across multiple DEXs
   */
  async getOptimalRoute(
    inputToken: string,
    outputToken: string,
    inputAmount: number,
    targetChain?: string
  ): Promise<{
    bestDex: 'jupiter' | 'pancakeswap' | 'uniswap';
    bestQuote: DEXQuoteResponse;
    allQuotes: Array<{ dex: string; quote: DEXQuoteResponse }>;
  }> {
    const availableDEXs = this.getAvailableDEXsForTokens(inputToken, outputToken, targetChain);
    const quotes: Array<{ dex: string; quote: DEXQuoteResponse }> = [];

    // Get quotes from all available DEXs
    for (const dex of availableDEXs) {
      try {
        const quote = await this.getQuote({
          dexType: dex.type,
          chainId: dex.chainId,
          inputToken: this.getTokenAddress(inputToken, dex.chainId),
          outputToken: this.getTokenAddress(outputToken, dex.chainId),
          inputAmount
        });

        quotes.push({
          dex: dex.type,
          quote
        });
      } catch (error) {
        console.warn(`Failed to get quote from ${dex.type}:`, error);
      }
    }

    // Find best quote (highest output amount)
    const successfulQuotes = quotes.filter(q => q.quote.success);
    
    if (successfulQuotes.length === 0) {
      throw new Error('No successful quotes found');
    }

    const bestQuote = successfulQuotes.reduce((best, current) => 
      (current.quote.outputAmount || 0) > (best.quote.outputAmount || 0) ? current : best
    );

    return {
      bestDex: bestQuote.dex as 'jupiter' | 'pancakeswap' | 'uniswap',
      bestQuote: bestQuote.quote,
      allQuotes: quotes
    };
  }

  /**
   * Health check for all DEX integrations
   */
  async healthCheck(): Promise<{
    jupiter: boolean;
    pancakeswap: boolean;
    uniswap: boolean;
    overall: boolean;
  }> {
    const checks = await Promise.allSettled([
      this.checkJupiterHealth(),
      this.checkPancakeSwapHealth(),
      this.checkUniswapHealth()
    ]);

    const jupiter = checks[0].status === 'fulfilled' && checks[0].value;
    const pancakeswap = checks[1].status === 'fulfilled' && checks[1].value;
    const uniswap = checks[2].status === 'fulfilled' && checks[2].value;

    return {
      jupiter,
      pancakeswap,
      uniswap,
      overall: jupiter && pancakeswap && uniswap
    };
  }

  // Helper methods
  private getAvailableDEXsForTokens(inputToken: string, outputToken: string, targetChain?: string) {
    const dexs = [];

    if (!targetChain || targetChain === 'solana') {
      dexs.push({ type: 'jupiter' as const, chainId: 'solana' });
    }
    if (!targetChain || targetChain === '56') {
      dexs.push({ type: 'pancakeswap' as const, chainId: '56' });
    }
    if (!targetChain || targetChain === '1') {
      dexs.push({ type: 'uniswap' as const, chainId: '1' });
    }

    return dexs;
  }

  private getTokenAddress(symbol: string, chainId: string): string {
    switch (chainId) {
      case 'solana':
        return TOKEN_ADDRESSES.solana[symbol as keyof typeof TOKEN_ADDRESSES.solana] || symbol;
      case '56':
        return TOKEN_ADDRESSES.bsc[symbol as keyof typeof TOKEN_ADDRESSES.bsc] || symbol;
      case '1':
        return TOKEN_ADDRESSES.ethereum[symbol as keyof typeof TOKEN_ADDRESSES.ethereum] || symbol;
      default:
        return symbol;
    }
  }

  private async checkJupiterHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.jupiterApiUrl}/tokens`, { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  private async checkPancakeSwapHealth(): Promise<boolean> {
    try {
      const blockNumber = await this.bscProvider.getBlockNumber();
      return blockNumber > 0;
    } catch {
      return false;
    }
  }

  private async checkUniswapHealth(): Promise<boolean> {
    try {
      const blockNumber = await this.ethProvider.getBlockNumber();
      return blockNumber > 0;
    } catch {
      return false;
    }
  }
}

export default MultiDEXIntegration;