// lib/testnet/faucet-service.ts
import { ethers } from 'ethers';

// Arbitrum Sepolia Testnet Configuration
export const ARBITRUM_SEPOLIA_CONFIG = {
  chainId: '0x66EEB', // 421611
  chainName: 'Arbitrum Sepolia',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
  blockExplorerUrls: ['https://sepolia.arbiscan.io'],
  
  // Test tokens
  tokens: {
    usdc: {
      address: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia USDC
      decimals: 6,
      symbol: 'USDC',
      faucetUrl: 'https://faucet.circle.com/',
    },
  },
  
  // Faucets
  ethFaucet: 'https://faucet.quicknode.com/arbitrum/sepolia',
};

// Hyperliquid Testnet Configuration  
export const HYPERLIQUID_TESTNET_CONFIG = {
  chainId: '0x3E6', // 998
  chainName: 'Hyperliquid Testnet',
  nativeCurrency: {
    name: 'HYPE',
    symbol: 'HYPE',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.hyperliquid-testnet.xyz/evm'],
  blockExplorerUrls: ['https://api.hypurrscan.io/ui/'],
  
  // Testnet API
  apiUrl: 'https://api.hyperliquid-testnet.xyz',
  faucetInfo: 'Contact Hyperliquid Discord for testnet tokens',
};

export interface TestnetTokenRequest {
  walletAddress: string;
  tokenSymbol: 'USDC' | 'ETH';
  amount: string;
  network: 'arbitrum-sepolia' | 'hyperliquid-testnet';
}

export class TestnetFaucetService {
  private static instance: TestnetFaucetService;

  static getInstance(): TestnetFaucetService {
    if (!TestnetFaucetService.instance) {
      TestnetFaucetService.instance = new TestnetFaucetService();
    }
    return TestnetFaucetService.instance;
  }

  /**
   * Get EVM-compatible provider (avoid Phantom/Solana wallets)
   */
  private getEVMProvider(): any {
    if (typeof window === 'undefined') {
      throw new Error('Window not available');
    }

    const windowEthereum = (window as any).ethereum;

    // Debug: Check what's available
    console.log('🔍 Debugging wallet detection:', {
      hasEthereum: !!windowEthereum,
      ethereumProviders: windowEthereum ? Object.keys(windowEthereum).filter(key => key.includes('is')) : [],
      isMetaMask: windowEthereum?.isMetaMask,
      isCoinbaseWallet: windowEthereum?.isCoinbaseWallet,
      isRabby: windowEthereum?.isRabby,
      isPhantom: windowEthereum?.isPhantom,
      providers: windowEthereum?.providers ? `Array of ${windowEthereum.providers.length} providers` : 'No providers array',
      allWindowKeys: Object.keys(window as any).filter(key => key.toLowerCase().includes('ethereum') || key.toLowerCase().includes('metamask'))
    });

    // Check if there are multiple providers
    if (windowEthereum?.providers && Array.isArray(windowEthereum.providers)) {
      console.log('🔍 Multiple providers detected:', windowEthereum.providers.map((p: any, index: number) => ({
        index,
        isMetaMask: p.isMetaMask,
        isCoinbaseWallet: p.isCoinbaseWallet,
        isRabby: p.isRabby,
        isPhantom: p.isPhantom,
        isBraveWallet: p.isBraveWallet,
        constructor: p.constructor?.name,
        _metamask: !!p._metamask
      })));
      
      // Find MetaMask - look for provider that has MetaMask characteristics but is NOT Phantom
      const metaMaskProvider = windowEthereum.providers.find((p: any) => {
        return (
          p.isMetaMask && 
          !p.isPhantom && 
          !p.isSolana &&
          (p._metamask || p.constructor?.name === 'MetaMaskInpageProvider')
        );
      });
      
      if (metaMaskProvider) {
        console.log('✅ Found genuine MetaMask in providers array');
        return metaMaskProvider;
      }

      // Fallback: find any EVM provider that's not Phantom
      const evmProvider = windowEthereum.providers.find((p: any) => {
        return !p.isPhantom && !p.isSolana && (p.isMetaMask || p.isCoinbaseWallet || p.isRabby);
      });
      
      if (evmProvider) {
        console.log('✅ Found EVM provider:', evmProvider.constructor?.name || 'Unknown');
        return evmProvider;
      }
    }

    // Single provider checks
    if (windowEthereum) {
      // Check if it's genuine MetaMask (not Phantom masquerading)
      if (windowEthereum.isMetaMask && !windowEthereum.isPhantom && !windowEthereum.isSolana) {
        // Additional verification for genuine MetaMask
        if (windowEthereum._metamask || windowEthereum.constructor?.name === 'MetaMaskInpageProvider') {
          console.log('✅ Genuine MetaMask found as main ethereum provider');
          return windowEthereum;
        }
      }

      // Check for other EVM providers
      if (windowEthereum.isCoinbaseWallet && !windowEthereum.isPhantom) {
        console.log('✅ Coinbase Wallet found');
        return windowEthereum;
      }

      if (windowEthereum.isRabby && !windowEthereum.isPhantom) {
        console.log('✅ Rabby found');
        return windowEthereum;
      }

      // Last resort: use ethereum provider if it's not Phantom/Solana
      if (!windowEthereum.isPhantom && !windowEthereum.isSolana) {
        console.log('✅ Generic EVM provider found (last resort)');
        return windowEthereum;
      }
    }

    // Check for MetaMask specifically via other methods
    if ((window as any).web3?.currentProvider?.isMetaMask && !(window as any).web3?.currentProvider?.isPhantom) {
      console.log('✅ MetaMask found via web3');
      return (window as any).web3.currentProvider;
    }

    // Direct MetaMask check
    if ((window as any).MetaMask) {
      console.log('✅ MetaMask found via window.MetaMask');
      return (window as any).MetaMask;
    }

    throw new Error('No EVM-compatible wallet found. Please install MetaMask, disable Phantom, and refresh the page.');
  }

  /**
   * Add testnet networks to wallet
   */
  async addTestnetNetworks(): Promise<{ arbitrum: boolean; hyperliquid: boolean }> {
    const results = { arbitrum: false, hyperliquid: false };

    const provider = this.getEVMProvider();

    try {
      // Add Arbitrum Sepolia
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [ARBITRUM_SEPOLIA_CONFIG],
      });
      results.arbitrum = true;
      console.log('✅ Arbitrum Sepolia added');
    } catch (error: any) {
      if (error.code === 4001) {
        console.log('❌ User rejected Arbitrum Sepolia addition');
      } else if (error.code === -32602) {
        results.arbitrum = true; // Already exists
        console.log('✅ Arbitrum Sepolia already exists');
      } else {
        console.error('❌ Failed to add Arbitrum Sepolia:', _error);
      }
    }

    try {
      // Add Hyperliquid Testnet
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [HYPERLIQUID_TESTNET_CONFIG],
      });
      results.hyperliquid = true;
      console.log('✅ Hyperliquid Testnet added');
    } catch (error: any) {
      if (error.code === 4001) {
        console.log('❌ User rejected Hyperliquid Testnet addition');
      } else if (error.code === -32602) {
        results.hyperliquid = true; // Already exists
        console.log('✅ Hyperliquid Testnet already exists');
      } else {
        console.error('❌ Failed to add Hyperliquid Testnet:', _error);
      }
    }

    return results;
  }

  /**
   * Switch to specific testnet
   */
  async switchToTestnet(network: 'arbitrum-sepolia' | 'hyperliquid-testnet'): Promise<boolean> {
    const provider = this.getEVMProvider();
    const chainId = network === 'arbitrum-sepolia' 
      ? ARBITRUM_SEPOLIA_CONFIG.chainId 
      : HYPERLIQUID_TESTNET_CONFIG.chainId;

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      });
      console.log(`✅ Switched to ${network}`);
      return true;
    } catch (error: any) {
      if (error.code === 4902) {
        // Network not added yet, try to add it
        console.log(`📝 ${network} not found, attempting to add...`);
        const results = await this.addTestnetNetworks();
        return network === 'arbitrum-sepolia' ? results.arbitrum : results.hyperliquid;
      }
      console.error(`❌ Failed to switch to ${network}:`, _error);
      return false;
    }
  }

  /**
   * Check testnet balances
   */
  async checkTestnetBalances(walletAddress: string): Promise<{
    arbitrumSepolia: { eth: string; usdc: string };
    hyperliquidTestnet: { hype: string };
  }> {
    try {
      // Check Arbitrum Sepolia
      const arbProvider = new ethers.JsonRpcProvider(ARBITRUM_SEPOLIA_CONFIG.rpcUrls[0]);
      const arbEthBalance = await arbProvider.getBalance(walletAddress);
      
      // Check USDC on Arbitrum Sepolia
      const usdcContract = new ethers.Contract(
        ARBITRUM_SEPOLIA_CONFIG.tokens.usdc.address,
        ['function balanceOf(address) view returns (uint256)'],
        arbProvider
      );
      const arbUsdcBalance = await usdcContract.balanceOf(walletAddress);

      // Check Hyperliquid Testnet
      const hypeProvider = new ethers.JsonRpcProvider(HYPERLIQUID_TESTNET_CONFIG.rpcUrls[0]);
      const hypeBalance = await hypeProvider.getBalance(walletAddress);

      return {
        arbitrumSepolia: {
          eth: ethers.formatEther(arbEthBalance),
          usdc: ethers.formatUnits(arbUsdcBalance, 6),
        },
        hyperliquidTestnet: {
          hype: ethers.formatEther(hypeBalance),
        },
      };
    } catch (_error) {
      console.error('❌ Failed to check testnet balances:', _error);
      return {
        arbitrumSepolia: { eth: '0', usdc: '0' },
        hyperliquidTestnet: { hype: '0' },
      };
    }
  }

  /**
   * Get faucet instructions
   */
  getFaucetInstructions(): {
    arbitrumSepolia: { eth: string; usdc: string };
    hyperliquidTestnet: string;
  } {
    return {
      arbitrumSepolia: {
        eth: `Get Arbitrum Sepolia ETH from: ${ARBITRUM_SEPOLIA_CONFIG.ethFaucet}`,
        usdc: `Get test USDC from: ${ARBITRUM_SEPOLIA_CONFIG.tokens.usdc.faucetUrl}`,
      },
      hyperliquidTestnet: HYPERLIQUID_TESTNET_CONFIG.faucetInfo,
    };
  }

  /**
   * Get testnet bridge instructions
   */
  getTestnetBridgeInstructions(): string[] {
    return [
      '🔗 Testnet Bridge Process:',
      '1. Get Arbitrum Sepolia ETH (gas fees)',
      '2. Get Arbitrum Sepolia USDC (test tokens)',
      '3. Approve USDC for bridge contract',
      '4. Execute bridge transaction',
      '5. Wait for Hyperliquid testnet confirmation',
      '',
      '⚠️ Note: Testnet bridge may have different contracts and delay times',
    ];
  }

  /**
   * Validate testnet environment
   */
  isTestnetEnvironment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Get current network info
   */
  async getCurrentNetwork(): Promise<{
    chainId: string;
    networkName: string;
    isTestnet: boolean;
  }> {
    const provider = this.getEVMProvider();
    const chainId = await provider.request({ method: 'eth_chainId' });
    
    let networkName = 'Unknown';
    let isTestnet = false;

    switch (chainId) {
      case ARBITRUM_SEPOLIA_CONFIG.chainId:
        networkName = 'Arbitrum Sepolia';
        isTestnet = true;
        break;
      case HYPERLIQUID_TESTNET_CONFIG.chainId:
        networkName = 'Hyperliquid Testnet';
        isTestnet = true;
        break;
      case '0xA4B1': // Arbitrum One
        networkName = 'Arbitrum One';
        isTestnet = false;
        break;
      case '0x3E7': // Hyperliquid Mainnet
        networkName = 'Hyperliquid Mainnet';
        isTestnet = false;
        break;
      default:
        networkName = `Chain ID: ${parseInt(chainId, 16)}`;
    }

    return { chainId, networkName, isTestnet };
  }
}