// lib/solana/jupiter-integration.ts
/**
 * Jupiter API Integration for Single-Chain SCV System
 * Handles all Solana token swaps for cross-chain index composition
 */

import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import axios from 'axios';

export interface JupiterSwapRequest {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps: number;
  userPublicKey: string;
}

export interface JupiterSwapResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
  }>;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
}

// Solana Token Mint Addresses (주요 밈코인들)
export const SOLANA_TOKEN_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  BOME: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',
  MEW: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
  POPCAT: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
  PEPE: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  SHIB: 'CiKu4eHsVrc1eueVQeHn7qhXTcVu95gSQmBpX44r2ofK'
} as const;

export class JupiterSolanaIntegration {
  private connection: Connection;
  private jupiterApiUrl: string;
  private apiKey?: string;

  constructor(
    rpcEndpoint: string = process.env.SOLANA_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
    jupiterApiUrl: string = process.env.JUPITER_API_URL || 'https://quote-api.jup.ag',
    apiKey?: string
  ) {
    this.connection = new Connection(rpcEndpoint, 'confirmed');
    this.jupiterApiUrl = jupiterApiUrl;
    this.apiKey = apiKey || process.env.JUPITER_API_KEY;
  }

  /**
   * Get quote for token swap
   */
  async getSwapQuote(request: JupiterSwapRequest): Promise<JupiterSwapResponse> {
    try {
      // Jupiter Lite API 방식 (제공된 예시 기반)
      const params = new URLSearchParams({
        inputMint: request.inputMint,
        outputMint: request.outputMint,
        amount: request.amount.toString(),
        slippageBps: request.slippageBps.toString(),
        onlyDirectRoutes: 'false'   // 중간 풀 허용
      });

      // API 키는 선택사항 (무료 사용시 불필요)
      if (this.apiKey) {
        params.append('apiKey', this.apiKey);
      }

      const url = `${this.jupiterApiUrl}/v1/quote?${params.toString()}`;
      const response = await axios.get(url, {
        method: 'GET',
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Jupiter quote error:', error);
      throw new Error(`Failed to get Jupiter quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get swap transaction
   */
  async getSwapTransaction(
    quote: JupiterSwapResponse,
    userPublicKey: string,
    priorityFee: number = 0
  ): Promise<string> {
    try {
      const swapRequest = {
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol: true,
        useSharedAccounts: true,
        feeAccount: undefined,
        trackingAccount: undefined,
        computeUnitPriceMicroLamports: priorityFee > 0 ? priorityFee : undefined,
        skipUserAccountsRpcCalls: false,
        maxAccounts: 64
      };

      const response = await axios.post(
        `${this.jupiterApiUrl}/swap`,
        swapRequest,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
          },
          timeout: 15000
        }
      );

      return response.data.swapTransaction;
    } catch (error) {
      console.error('Jupiter swap transaction error:', error);
      throw new Error(`Failed to get swap transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute token swap with retry logic
   */
  async executeSwap(
    swapRequest: JupiterSwapRequest,
    maxRetries: number = 3
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Jupiter swap attempt ${attempt}/${maxRetries}:`, {
          from: swapRequest.inputMint,
          to: swapRequest.outputMint,
          amount: swapRequest.amount,
          slippage: swapRequest.slippageBps / 100 + '%'
        });

        // Get quote
        const quote = await this.getSwapQuote(swapRequest);
        
        console.log('Jupiter quote received:', {
          inputAmount: quote.inAmount,
          outputAmount: quote.outAmount,
          priceImpact: quote.priceImpactPct
        });

        // Get transaction
        const transactionBase64 = await this.getSwapTransaction(
          quote,
          swapRequest.userPublicKey,
          attempt * 1000 // Increase priority fee with each retry
        );

        // For now, return the transaction base64 - actual signing/sending should be done by caller
        return transactionBase64;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown swap error');
        console.error(`Jupiter swap attempt ${attempt} failed:`, lastError.message);
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Get token information
   */
  async getTokenInfo(tokenMint: string): Promise<TokenInfo | null> {
    try {
      const response = await axios.get(`${this.jupiterApiUrl}/tokens/${tokenMint}`);
      return response.data;
    } catch (error) {
      console.warn(`Could not fetch token info for ${tokenMint}:`, error);
      return null;
    }
  }

  /**
   * Get supported tokens list
   */
  async getSupportedTokens(): Promise<TokenInfo[]> {
    try {
      const response = await axios.get(`${this.jupiterApiUrl}/tokens`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch supported tokens:', error);
      return [];
    }
  }

  /**
   * Calculate optimal swap routes for multiple tokens
   */
  async calculateIndexSwapRoutes(
    inputToken: string,
    indexComposition: Record<string, number>,
    totalAmount: number,
    maxSlippageBps: number = 100
  ): Promise<Array<{ token: string, amount: number, quote: JupiterSwapResponse }>> {
    const routes = [];

    for (const [tokenSymbol, percentage] of Object.entries(indexComposition)) {
      const tokenMint = SOLANA_TOKEN_MINTS[tokenSymbol as keyof typeof SOLANA_TOKEN_MINTS];
      if (!tokenMint) {
        console.warn(`Unknown token symbol: ${tokenSymbol}`);
        continue;
      }

      const swapAmount = Math.floor(totalAmount * percentage / 100);
      
      if (swapAmount > 0 && tokenMint !== inputToken) {
        try {
          const quote = await this.getSwapQuote({
            inputMint: inputToken,
            outputMint: tokenMint,
            amount: swapAmount,
            slippageBps: maxSlippageBps,
            userPublicKey: '' // Will be filled by caller
          });

          routes.push({
            token: tokenSymbol,
            amount: swapAmount,
            quote
          });
        } catch (error) {
          console.error(`Failed to get quote for ${tokenSymbol}:`, error);
        }
      }
    }

    return routes;
  }

  /**
   * Health check for Jupiter API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.jupiterApiUrl}/tokens`, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      console.error('Jupiter health check failed:', error);
      return false;
    }
  }
}

// Default export
export default JupiterSolanaIntegration;