// lib/dex/jupiter-resilient.ts
/**
 * Jupiter API Resilient Client with Fallback and Retry Logic
 * Handles server failures, SSL issues, and API outages gracefully
 */

import axios from 'axios';

export interface JupiterQuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
  onlyDirectRoutes?: boolean;
}

export interface JupiterQuoteResponse {
  success: boolean;
  data?: any;
  error?: string;
  usedEndpoint?: string;
  retryAttempt?: number;
}

// Cache interface for storing recent successful responses
interface CachedResponse {
  data: any;
  timestamp: number;
  expiresIn: number; // milliseconds
}

export class JupiterResilientClient {
  private endpoints: string[];
  private retries: number;
  private delay: number;
  private cache: Map<string, CachedResponse>;
  private cacheTimeout: number; // 5 minutes default

  constructor() {
    // Multiple Jupiter endpoints for failover
    this.endpoints = [
      'https://quote-api.jup.ag/v1',
      'https://quote-api.jup.ag/v2', 
      'https://public-api.jupiter-xyz.com',
      'https://api.jup.ag/v6',
      process.env.JUPITER_API_URL || 'https://quote-api.jup.ag'
    ].filter((endpoint, index, self) => self.indexOf(endpoint) === index); // Remove duplicates

    this.retries = 3;
    this.delay = 1000; // Start with 1 second
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Fetch with automatic retry logic and exponential backoff
   */
  private async fetchWithRetry(
    url: string, 
    options: any = {}, 
    retries: number = this.retries, 
    delay: number = this.delay
  ): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`Jupiter API attempt ${i + 1}/${retries}: ${url}`);
        
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'HyperIndex-SCV/1.0'
          },
          ...options
        });

        if (response.status !== 200) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        console.log(`✅ Jupiter API success on attempt ${i + 1}`);
        return response.data;

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`⚠️ Jupiter API attempt ${i + 1} failed: ${errorMsg}`);

        // If this is not the last attempt, wait before retrying
        if (i < retries - 1) {
          const waitTime = delay * Math.pow(2, i); // Exponential backoff
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Try multiple endpoints until one succeeds
   */
  private async tryMultipleEndpoints(path: string, params: URLSearchParams): Promise<any> {
    let lastError: Error | null = null;

    for (let i = 0; i < this.endpoints.length; i++) {
      const endpoint = this.endpoints[i];
      const url = `${endpoint}${path}?${params.toString()}`;

      try {
        const result = await this.fetchWithRetry(url);
        
        // Success! Move this endpoint to front for next time
        if (i > 0) {
          this.endpoints.unshift(this.endpoints.splice(i, 1)[0]);
        }

        return {
          success: true,
          data: result,
          usedEndpoint: endpoint,
          retryAttempt: i + 1
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown endpoint error');
        console.warn(`❌ Endpoint ${endpoint} failed: ${lastError.message}`);
        continue;
      }
    }

    // All endpoints failed
    throw lastError || new Error('All Jupiter endpoints failed');
  }

  /**
   * Generate cache key for request
   */
  private getCacheKey(request: JupiterQuoteRequest): string {
    return `${request.inputMint}-${request.outputMint}-${request.amount}-${request.slippageBps || 50}`;
  }

  /**
   * Get cached response if available and not expired
   */
  private getCachedResponse(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.expiresIn) {
      this.cache.delete(key);
      return null;
    }

    console.log('📋 Using cached Jupiter response');
    return cached.data;
  }

  /**
   * Store response in cache
   */
  private setCachedResponse(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresIn: this.cacheTimeout
    });
  }

  /**
   * Get Jupiter quote with resilient error handling
   */
  async getQuote(request: JupiterQuoteRequest): Promise<JupiterQuoteResponse> {
    const cacheKey = this.getCacheKey(request);

    try {
      // Build request parameters
      const params = new URLSearchParams({
        inputMint: request.inputMint,
        outputMint: request.outputMint,
        amount: request.amount.toString(),
        slippageBps: (request.slippageBps || 50).toString(),
        onlyDirectRoutes: (request.onlyDirectRoutes || false).toString()
      });

      // Try to get fresh data from API
      console.log('🚀 Fetching Jupiter quote from API...');
      const result = await this.tryMultipleEndpoints('/quote', params);
      
      // Cache successful response
      this.setCachedResponse(cacheKey, result.data);
      
      return {
        success: true,
        data: result.data,
        usedEndpoint: result.usedEndpoint,
        retryAttempt: result.retryAttempt
      };

    } catch (error) {
      console.error('❌ All Jupiter endpoints failed:', error);

      // Try to use cached response as fallback
      const cachedData = this.getCachedResponse(cacheKey);
      if (cachedData) {
        console.log('📋 Using cached data as fallback');
        return {
          success: true,
          data: cachedData,
          usedEndpoint: 'cache',
          error: 'API unavailable, using cached data'
        };
      }

      // No cache available, return error
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Jupiter API unavailable',
        usedEndpoint: 'none'
      };
    }
  }

  /**
   * Get list of supported tokens with resilient handling
   */
  async getTokens(): Promise<JupiterQuoteResponse> {
    try {
      console.log('🪙 Fetching Jupiter token list...');
      const result = await this.tryMultipleEndpoints('/tokens', new URLSearchParams());
      
      return {
        success: true,
        data: result.data,
        usedEndpoint: result.usedEndpoint
      };

    } catch (error) {
      console.error('❌ Failed to fetch Jupiter token list:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token list unavailable',
        usedEndpoint: 'none'
      };
    }
  }

  /**
   * Health check across all endpoints
   */
  async healthCheck(): Promise<{
    overall: boolean;
    endpoints: Array<{
      url: string;
      status: 'ok' | 'error';
      responseTime?: number;
      error?: string;
    }>;
  }> {
    const results = [];
    let healthyCount = 0;

    for (const endpoint of this.endpoints) {
      const startTime = Date.now();
      try {
        await axios.get(`${endpoint}/tokens`, { 
          timeout: 5000,
          headers: { 'User-Agent': 'HyperIndex-HealthCheck/1.0' }
        });
        
        const responseTime = Date.now() - startTime;
        results.push({
          url: endpoint,
          status: 'ok' as const,
          responseTime
        });
        healthyCount++;

      } catch (error) {
        results.push({
          url: endpoint,
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      overall: healthyCount > 0,
      endpoints: results
    };
  }

  /**
   * Clear expired cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.expiresIn) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      endpoints: this.endpoints,
      cacheTimeout: this.cacheTimeout
    };
  }
}

// Export singleton instance
export const jupiterClient = new JupiterResilientClient();
export default jupiterClient;