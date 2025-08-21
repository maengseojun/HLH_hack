// lib/hyperliquid/network.ts
import { WalletClient } from '@privy-io/react-auth';

export const HYPERLIQUID_NETWORK_CONFIG = {
  chainId: '0x3E7', // 999 in hex
  chainName: 'Hyperliquid',
  nativeCurrency: {
    name: 'HYPE',
    symbol: 'HYPE',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.hyperliquid.xyz/evm'],
  blockExplorerUrls: ['https://api.hypurrscan.io/ui/'],
};

export const HYPERLIQUID_TESTNET_CONFIG = {
  chainId: '0x3E6', // 998 in hex
  chainName: 'Hyperliquid Testnet',
  nativeCurrency: {
    name: 'HYPE',
    symbol: 'HYPE',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.hyperliquid-testnet.xyz/evm'],
  blockExplorerUrls: ['https://explorer.hyperliquid-testnet.xyz'],
};

/**
 * Adds Hyperliquid network to user's wallet
 */
export const addHyperliquidNetwork = async (
  provider: any,
  isTestnet: boolean = false
): Promise<boolean> => {
  try {
    const networkConfig = isTestnet ? HYPERLIQUID_TESTNET_CONFIG : HYPERLIQUID_NETWORK_CONFIG;
    
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [networkConfig],
    });

    console.log(`✅ ${networkConfig.chainName} network added successfully`);
    return true;
  } catch (error: any) {
    if (error.code === 4001) {
      console.log('❌ User rejected network addition');
      return false;
    }
    
    console.error('❌ Failed to add Hyperliquid network:', _error);
    return false;
  }
};

/**
 * Switches to Hyperliquid network
 */
export const switchToHyperliquidNetwork = async (
  provider: any,
  isTestnet: boolean = false
): Promise<boolean> => {
  try {
    const chainId = isTestnet ? HYPERLIQUID_TESTNET_CONFIG.chainId : HYPERLIQUID_NETWORK_CONFIG.chainId;
    
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });

    console.log(`✅ Switched to Hyperliquid ${isTestnet ? 'Testnet' : 'Mainnet'}`);
    return true;
  } catch (error: any) {
    if (error.code === 4902) {
      // Network not added yet, try to add it
      console.log('📝 Network not found, attempting to add...');
      return await addHyperliquidNetwork(provider, isTestnet);
    }
    
    console.error('❌ Failed to switch to Hyperliquid network:', _error);
    return false;
  }
};

/**
 * Checks if user is on Hyperliquid network
 */
export const isOnHyperliquidNetwork = (chainId: string): boolean => {
  return chainId === HYPERLIQUID_NETWORK_CONFIG.chainId || 
         chainId === HYPERLIQUID_TESTNET_CONFIG.chainId;
};

/**
 * Gets the appropriate network config based on environment
 */
export const getHyperliquidNetworkConfig = (isTestnet: boolean = false) => {
  return isTestnet ? HYPERLIQUID_TESTNET_CONFIG : HYPERLIQUID_NETWORK_CONFIG;
};

/**
 * Utility function to format chain ID for display
 */
export const formatChainId = (chainId: string): string => {
  const decimalChainId = parseInt(chainId, 16);
  switch (decimalChainId) {
    case 999:
      return 'Hyperliquid Mainnet';
    case 998:
      return 'Hyperliquid Testnet';
    case 42161:
      return 'Arbitrum One';
    case 1:
      return 'Ethereum Mainnet';
    default:
      return `Chain ID: ${decimalChainId}`;
  }
};