// lib/config/hypervm-config.ts
/**
 * HyperEVM 네트워크 및 계약 설정
 * 테스트넷 배포를 위한 중앙화된 설정 관리
 */

export interface HyperVMConfig {
  rpcUrl: string;
  chainId: number;
  contracts: {
    router: string;
    factory: string;
    settlement: string;
    hyperIndex: string;
    usdc: string;
    pair: string;
  };
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// HyperEVM Testnet 설정 (Updated: 2025-08-12)
export const HYPERVM_TESTNET_CONFIG: HyperVMConfig = {
  rpcUrl: process.env.HYPERVM_TESTNET_RPC || 'https://api.hyperliquid-testnet.xyz/evm',
  chainId: 998,
  contracts: {
    // ✅ 실제 배포된 주소들 (2025-08-12 배포 완료)
    router: '0xD70399962f491c4d38f4ACf7E6a9345B0B9a3A7A', // DEX Router 주소 (Fixed)
    factory: '0x73bF19534DA1c60772E40136A4e5E77921b7a632', // Factory 주소
    settlement: '0x543C050a536457c47c569D26AABd52Fae17cbA4B', // Settlement 주소
    hyperIndex: '0x6065Ab1ec8334ab6099aF27aF145411902EAef40', // HYPERINDEX 토큰 주소
    usdc: '0x53aE8e677f34BC709148085381Ce2D4b6ceA1Fc3', // Mock USDC 주소
    pair: '0x5706084ad9Cac84393eaA1Eb265Db9b22bA63cd1', // HYPERINDEX-USDC 페어 주소
  },
  blockExplorer: 'https://explorer.hyperliquid-testnet.xyz',
  nativeCurrency: {
    name: 'HyperEVM Testnet',
    symbol: 'HYPE',
    decimals: 18,
  },
};

// HyperEVM Mainnet 설정 (나중에 사용)
export const HYPERVM_MAINNET_CONFIG: HyperVMConfig = {
  rpcUrl: process.env.HYPERVM_MAINNET_RPC || 'https://api.hyperliquid.xyz/evm',
  chainId: 999,
  contracts: {
    router: '0x0000000000000000000000000000000000000000',
    factory: '0x0000000000000000000000000000000000000000',
    settlement: '0x0000000000000000000000000000000000000000',
    hyperIndex: '0x0000000000000000000000000000000000000000',
    usdc: '0x0000000000000000000000000000000000000000',
    pair: '0x0000000000000000000000000000000000000000',
  },
  blockExplorer: 'https://explorer.hyperliquid.xyz',
  nativeCurrency: {
    name: 'HyperEVM',
    symbol: 'HYPE',
    decimals: 18,
  },
};

/**
 * 현재 환경에 맞는 설정 가져오기
 */
export function getHyperVMConfig(): HyperVMConfig {
  const isMainnet = process.env.NODE_ENV === 'production';
  return isMainnet ? HYPERVM_MAINNET_CONFIG : HYPERVM_TESTNET_CONFIG;
}

/**
 * 네트워크 검증 도우미
 */
export function isValidHyperVMChainId(chainId: number): boolean {
  return chainId === 998 || chainId === 999;
}

/**
 * 지갑 연결을 위한 MetaMask 네트워크 설정
 */
export function getMetaMaskNetworkParams(isMainnet = false): {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
} {
  const config = isMainnet ? HYPERVM_MAINNET_CONFIG : HYPERVM_TESTNET_CONFIG;
  
  return {
    chainId: `0x${config.chainId.toString(16)}`,
    chainName: isMainnet ? 'HyperEVM Mainnet' : 'HyperEVM Testnet',
    nativeCurrency: config.nativeCurrency,
    rpcUrls: [config.rpcUrl],
    blockExplorerUrls: [config.blockExplorer],
  };
}