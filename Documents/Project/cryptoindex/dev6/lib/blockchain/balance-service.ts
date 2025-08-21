// lib/blockchain/balance-service.ts
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';

interface TokenBalance {
  token: string;
  symbol: string;
  balance: string;
  decimals: number;
  formatted: string;
}

interface NetworkBalance {
  network: string;
  nativeBalance: string;
  nativeSymbol: string;
  tokenBalances: TokenBalance[];
  totalUsdValue?: string;
}

interface BalanceCache {
  walletAddress: string;
  network: string;
  balances: NetworkBalance;
  timestamp: number;
  expiresAt: number;
}

export class BalanceService {
  private static instance: BalanceService;
  private cache: Map<string, BalanceCache> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private supabase;

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  static getInstance(): BalanceService {
    if (!BalanceService.instance) {
      BalanceService.instance = new BalanceService();
    }
    return BalanceService.instance;
  }

  /**
   * Get user balance for a specific network
   */
  async getUserBalance(
    walletAddress: string, 
    network: 'arbitrum' | 'hyperliquid' | 'ethereum'
  ): Promise<NetworkBalance | null> {
    try {
      // 1. Check cache first
      const cached = this.getCachedBalance(walletAddress, network);
      if (cached) {
        console.log(`✅ Cache hit for ${walletAddress} on ${network}`);
        return cached;
      }

      // 2. Query blockchain
      console.log(`🔄 Fetching balance for ${walletAddress} on ${network}`);
      const balance = await this.queryBlockchainBalance(walletAddress, network);
      
      if (balance) {
        // 3. Cache the result
        this.setCachedBalance(walletAddress, network, balance);
        console.log(`✅ Balance cached for ${walletAddress} on ${network}`);
      }

      return balance;
    } catch (_error) {
      console.error(`❌ Error fetching balance for ${walletAddress} on ${network}:`, _error);
      return null;
    }
  }

  /**
   * Get balances across all supported networks
   */
  async getAllBalances(walletAddress: string): Promise<NetworkBalance[]> {
    const networks: ('arbitrum' | 'hyperliquid' | 'ethereum')[] = [
      'arbitrum', 
      'hyperliquid', 
      'ethereum'
    ];

    const balancePromises = networks.map(network => 
      this.getUserBalance(walletAddress, network)
    );

    const results = await Promise.allSettled(balancePromises);
    
    return results
      .filter((result): result is PromiseFulfilledResult<NetworkBalance> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);
  }

  /**
   * Query blockchain for actual balance
   */
  private async queryBlockchainBalance(
    walletAddress: string, 
    network: string
  ): Promise<NetworkBalance | null> {
    try {
      const networkConfig = await this.getNetworkConfig(network);
      if (!networkConfig) {
        throw new Error(`Network config not found for ${network}`);
      }

      const provider = new ethers.JsonRpcProvider(networkConfig.rpc_url);
      
      // Get native token balance
      const nativeBalance = await provider.getBalance(walletAddress);
      
      // Get token balances
      const tokenBalances = await this.getTokenBalances(
        walletAddress, 
        networkConfig.supported_tokens || [], 
        provider
      );

      return {
        network,
        nativeBalance: ethers.formatEther(nativeBalance),
        nativeSymbol: networkConfig.native_token_symbol,
        tokenBalances,
      };
    } catch (_error) {
      console.error(`❌ Blockchain query failed for ${network}:`, _error);
      return null;
    }
  }

  /**
   * Get token balances for ERC20 tokens
   */
  private async getTokenBalances(
    walletAddress: string,
    tokens: any[],
    provider: ethers.JsonRpcProvider
  ): Promise<TokenBalance[]> {
    const balances: TokenBalance[] = [];

    for (const token of tokens) {
      try {
        if (token.address === '0x0000000000000000000000000000000000000000') {
          // Skip native token
          continue;
        }

        const contract = new ethers.Contract(
          token.address,
          [
            'function balanceOf(address) view returns (uint256)',
            'function decimals() view returns (uint8)',
            'function symbol() view returns (string)',
          ],
          provider
        );

        const balance = await contract.balanceOf(walletAddress);
        const decimals = token.decimals || await contract.decimals();
        const symbol = token.symbol || await contract.symbol();

        balances.push({
          token: token.address,
          symbol,
          balance: balance.toString(),
          decimals,
          formatted: ethers.formatUnits(balance, decimals),
        });
      } catch (_error) {
        console.error(`❌ Failed to get balance for token ${token.address}:`, _error);
      }
    }

    return balances;
  }

  /**
   * Get network configuration from database
   */
  private async getNetworkConfig(network: string) {
    const { data, error } = await this.supabase
      .from('network_configs')
      .select('*')
      .eq('network_name', network)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error(`❌ Failed to get network config for ${network}:`, _error);
      return null;
    }

    return data;
  }

  /**
   * Get cached balance
   */
  private getCachedBalance(walletAddress: string, network: string): NetworkBalance | null {
    const cacheKey = `${walletAddress}_${network}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() < cached.expiresAt) {
      return cached.balances;
    }

    if (cached) {
      this.cache.delete(cacheKey);
    }

    return null;
  }

  /**
   * Cache balance result
   */
  private setCachedBalance(
    walletAddress: string, 
    network: string, 
    balances: NetworkBalance
  ): void {
    const cacheKey = `${walletAddress}_${network}`;
    const now = Date.now();
    
    this.cache.set(cacheKey, {
      walletAddress,
      network,
      balances,
      timestamp: now,
      expiresAt: now + this.CACHE_TTL,
    });
  }

  /**
   * Clear cache for specific wallet
   */
  clearCache(walletAddress?: string): void {
    if (walletAddress) {
      const keysToDelete: string[] = [];
      this.cache.forEach((value, key) => {
        if (value.walletAddress === walletAddress) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    const entries: string[] = [];
    this.cache.forEach((value, key) => {
      entries.push(`${key}: expires at ${new Date(value.expiresAt).toISOString()}`);
    });
    
    return {
      size: this.cache.size,
      entries,
    };
  }
}