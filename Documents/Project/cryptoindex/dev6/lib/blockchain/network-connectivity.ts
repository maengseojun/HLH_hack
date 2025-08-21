// lib/blockchain/network-connectivity.ts
import { ethers } from 'ethers';
import { HYPERLIQUID_NETWORK_CONFIG } from '@/lib/hyperliquid/network';

interface NetworkConnectivityResult {
  network: string;
  connected: boolean;
  latency?: number;
  blockNumber?: number;
  error?: string;
}

export class NetworkConnectivityChecker {
  /**
   * Check if a wallet address has connectivity to a specific network
   */
  static async checkNetworkConnectivity(
    walletAddress: string,
    network: 'arbitrum' | 'hyperliquid' | 'ethereum'
  ): Promise<NetworkConnectivityResult> {
    const startTime = Date.now();
    
    try {
      const rpcUrl = this.getRpcUrl(network);
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Test 1: Basic RPC connectivity
      const blockNumber = await provider.getBlockNumber();
      
      // Test 2: Wallet balance query (confirms address can be queried)
      const balance = await provider.getBalance(walletAddress);
      
      // Test 3: Check if address has any transaction history
      const transactionCount = await provider.getTransactionCount(walletAddress);
      
      const latency = Date.now() - startTime;
      
      return {
        network,
        connected: true,
        latency,
        blockNumber,
      };
    } catch (_error) {
      return {
        network,
        connected: false,
        error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error',
      };
    }
  }

  /**
   * Check connectivity across all networks for a wallet
   */
  static async checkAllNetworks(
    walletAddress: string
  ): Promise<NetworkConnectivityResult[]> {
    const networks: ('arbitrum' | 'hyperliquid' | 'ethereum')[] = [
      'arbitrum',
      'hyperliquid', 
      'ethereum'
    ];

    const results = await Promise.allSettled(
      networks.map(network => this.checkNetworkConnectivity(walletAddress, network))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          network: networks[index],
          connected: false,
          error: result.reason?.message || 'Promise rejected',
        };
      }
    });
  }

  /**
   * Quick connectivity test - just RPC ping
   */
  static async quickConnectivityTest(
    network: 'arbitrum' | 'hyperliquid' | 'ethereum'
  ): Promise<{ connected: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const rpcUrl = this.getRpcUrl(network);
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Just get current block number - minimal RPC call
      await provider.getBlockNumber();
      
      return {
        connected: true,
        latency: Date.now() - startTime,
      };
    } catch (_error) {
      return {
        connected: false,
        error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error',
      };
    }
  }

  /**
   * Check if embedded wallet can access network
   */
  static async checkEmbeddedWalletNetworkAccess(
    walletAddress: string,
    targetNetwork: 'arbitrum' | 'hyperliquid' | 'ethereum'
  ): Promise<{
    canAccess: boolean;
    currentNetwork?: string;
    supportedNetworks: string[];
    error?: string;
  }> {
    try {
      // For embedded wallets, check if they can switch to target network
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const provider = (window as any).ethereum;
        
        // Get current network
        const currentChainId = await provider.request({ method: 'eth_chainId' });
        
        // Try to switch to target network
        const targetChainId = this.getChainId(targetNetwork);
        
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: targetChainId }],
          });
          
          return {
            canAccess: true,
            currentNetwork: this.formatChainId(currentChainId),
            supportedNetworks: ['arbitrum', 'hyperliquid', 'ethereum'],
          };
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            // Network not supported by wallet
            return {
              canAccess: false,
              currentNetwork: this.formatChainId(currentChainId),
              supportedNetworks: ['arbitrum', 'ethereum'], // Limited support
              error: `Network ${targetNetwork} not supported by embedded wallet`,
            };
          }
          throw switchError;
        }
      }
      
      // Fallback: just test RPC connectivity
      const result = await this.checkNetworkConnectivity(walletAddress, targetNetwork);
      return {
        canAccess: result.connected,
        supportedNetworks: result.connected ? [targetNetwork] : [],
        error: result.error,
      };
    } catch (_error) {
      return {
        canAccess: false,
        supportedNetworks: [],
        error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error',
      };
    }
  }

  private static getRpcUrl(network: string): string {
    switch (network) {
      case 'arbitrum':
        return 'https://arb1.arbitrum.io/rpc';
      case 'hyperliquid':
        return 'https://rpc.hyperliquid.xyz/evm';
      case 'ethereum':
        return 'https://eth.llamarpc.com';
      default:
        throw new Error(`Unknown network: ${network}`);
    }
  }

  private static getChainId(network: string): string {
    switch (network) {
      case 'arbitrum':
        return '0xA4B1'; // 42161
      case 'hyperliquid':
        return '0x3E7';  // 999
      case 'ethereum':
        return '0x1';    // 1
      default:
        throw new Error(`Unknown network: ${network}`);
    }
  }

  private static formatChainId(chainId: string): string {
    const decimalChainId = parseInt(chainId, 16);
    switch (decimalChainId) {
      case 999:
        return 'Hyperliquid Mainnet';
      case 42161:
        return 'Arbitrum One';
      case 1:
        return 'Ethereum Mainnet';
      default:
        return `Chain ID: ${decimalChainId}`;
    }
  }
}