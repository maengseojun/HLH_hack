// lib/config/network-config.ts
export interface NetworkConfig {
  ensRegistry?: string;
  rpcUrl?: string;
  hasENS: boolean;
  name: string;
  chainId: number;
}

export const getNetworkConfig = (): NetworkConfig => {
  const networkId = process.env.NEXT_PUBLIC_NETWORK_ID || '1';
  
  switch (networkId) {
    case '1': // Ethereum Mainnet
      return {
        ensRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
        rpcUrl: process.env.NEXT_PUBLIC_ETH_RPC_URL,
        hasENS: true,
        name: 'Ethereum Mainnet',
        chainId: 1,
      };
      
    case '11155111': // Sepolia Testnet
      return {
        ensRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
        rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
        hasENS: true,
        name: 'Sepolia Testnet',
        chainId: 11155111,
      };
      
    case '421614': // Arbitrum Sepolia (Hyperliquid-compatible)
      return {
        rpcUrl: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
        hasENS: false, // Arbitrum doesn't support ENS natively
        name: 'Arbitrum Sepolia',
        chainId: 421614,
      };
      
    case '998': // HyperEVM Testnet
      return {
        rpcUrl: process.env.NEXT_PUBLIC_HYPERVM_TESTNET_RPC || 'https://api.hyperliquid.xyz/evm',
        hasENS: false, // HyperEVM doesn't support ENS
        name: 'HyperEVM Testnet',
        chainId: 998,
      };
      
    default:
      console.warn(`Unknown network ID: ${networkId}, falling back to no ENS support`);
      return {
        rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
        hasENS: false,
        name: 'Unknown Network',
        chainId: parseInt(networkId),
      };
  }
};

export const isENSSupported = (): boolean => {
  const config = getNetworkConfig();
  return config.hasENS && !!config.rpcUrl && !!config.ensRegistry;
};

export const getContractAddresses = () => {
  return {
    hyperIndex: process.env.NEXT_PUBLIC_HYPERINDEX_TOKEN_ADDRESS || '',
    usdc: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || '',
    ammRouter: process.env.NEXT_PUBLIC_AMM_ROUTER_ADDRESS || '',
    factory: process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '',
  };
};

export const validateContractAddresses = () => {
  const addresses = getContractAddresses();
  const missing = Object.entries(addresses)
    .filter(([_, address]) => !address || address === '')
    .map(([key]) => key);
    
  if (missing.length > 0) {
    console.warn(`Missing contract addresses: ${missing.join(', ')}`);
    return false;
  }
  
  return true;
};