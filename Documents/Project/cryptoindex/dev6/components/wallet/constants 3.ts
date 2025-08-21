// components/wallet/constants.ts
// Hyperliquid 스타일 지갑 시스템을 위한 상수 정의

import { mainnet, arbitrum, polygon, base, optimism } from 'viem/chains'
import { SupportedChain, TokenBalance } from './types'

/**
 * 지원하는 체인 정보 (Hyperliquid 스타일)
 */
export const SUPPORTED_CHAINS: SupportedChain[] = [
  {
    id: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    icon: '🔷',
    color: '#627EEA',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/demo',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    viemChain: mainnet
  },
  {
    id: 42161,
    name: 'Arbitrum',
    symbol: 'ARB',
    icon: '🔵',
    color: '#28A0F0',
    rpcUrl: 'https://arb-mainnet.g.alchemy.com/v2/demo',
    blockExplorer: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    viemChain: arbitrum
  },
  {
    id: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    icon: '🟣',
    color: '#8247E5',
    rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/demo',
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'Polygon',
      symbol: 'MATIC',
      decimals: 18
    },
    viemChain: polygon
  },
  {
    id: 8453,
    name: 'Base',
    symbol: 'BASE',
    icon: '🔵',
    color: '#0052FF',
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    viemChain: base
  },
  {
    id: 10,
    name: 'Optimism',
    symbol: 'OP',
    icon: '🔴',
    color: '#FF0420',
    rpcUrl: 'https://opt-mainnet.g.alchemy.com/v2/demo',
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    viemChain: optimism
  }
]

/**
 * 체인 ID를 체인 정보로 매핑하는 맵
 */
export const CHAIN_MAP = new Map<number, SupportedChain>(
  SUPPORTED_CHAINS.map(chain => [chain.id, chain])
)

/**
 * 각 체인의 네이티브 토큰 정보
 */
export const NATIVE_TOKENS: Record<number, TokenBalance> = {
  1: {
    address: '0x0000000000000000000000000000000000000000' as any,
    symbol: 'ETH',
    name: 'Ether',
    balance: '0',
    decimals: 18,
    isNative: true,
    logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
  },
  42161: {
    address: '0x0000000000000000000000000000000000000000' as any,
    symbol: 'ETH',
    name: 'Ether',
    balance: '0',
    decimals: 18,
    isNative: true,
    logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
  },
  137: {
    address: '0x0000000000000000000000000000000000000000' as any,
    symbol: 'MATIC',
    name: 'Polygon',
    balance: '0',
    decimals: 18,
    isNative: true,
    logo: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png'
  },
  8453: {
    address: '0x0000000000000000000000000000000000000000' as any,
    symbol: 'ETH',
    name: 'Ether',
    balance: '0',
    decimals: 18,
    isNative: true,
    logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
  },
  10: {
    address: '0x0000000000000000000000000000000000000000' as any,
    symbol: 'ETH',
    name: 'Ether',
    balance: '0',
    decimals: 18,
    isNative: true,
    logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
  }
}

/**
 * 인기 ERC-20 토큰 주소 (체인별)
 */
export const POPULAR_TOKENS: Record<number, TokenBalance[]> = {
  1: [ // Ethereum
    {
      address: '0xA0b86a33E6411F0b79e4E74C1c3F6e5c1f6F1a30' as any,
      symbol: 'USDC',
      name: 'USD Coin',
      balance: '0',
      decimals: 6,
      logo: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png'
    },
    {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as any,
      symbol: 'USDT',
      name: 'Tether USD',
      balance: '0',
      decimals: 6,
      logo: 'https://assets.coingecko.com/coins/images/325/small/Tether-logo.png'
    },
    {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as any,
      symbol: 'WETH',
      name: 'Wrapped Ether',
      balance: '0',
      decimals: 18,
      logo: 'https://assets.coingecko.com/coins/images/2518/small/weth.png'
    }
  ],
  42161: [ // Arbitrum
    {
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as any,
      symbol: 'USDC',
      name: 'USD Coin',
      balance: '0',
      decimals: 6,
      logo: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png'
    },
    {
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' as any,
      symbol: 'WETH',
      name: 'Wrapped Ether',
      balance: '0',
      decimals: 18,
      logo: 'https://assets.coingecko.com/coins/images/2518/small/weth.png'
    }
  ],
  137: [ // Polygon
    {
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as any,
      symbol: 'USDC',
      name: 'USD Coin',
      balance: '0',
      decimals: 6,
      logo: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png'
    },
    {
      address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' as any,
      symbol: 'WETH',
      name: 'Wrapped Ether',
      balance: '0',
      decimals: 18,
      logo: 'https://assets.coingecko.com/coins/images/2518/small/weth.png'
    }
  ]
}

/**
 * Hyperliquid 스타일 색상 시스템
 */
export const WALLET_COLORS = {
  // 상태별 색상
  connected: '#10B981',     // 연결됨 (초록)
  connecting: '#F59E0B',    // 연결 중 (주황)
  disconnected: '#6B7280', // 연결 안됨 (회색)
  error: '#EF4444',        // 오류 (빨강)
  
  // 체인별 색상
  ethereum: '#627EEA',
  arbitrum: '#28A0F0',
  polygon: '#8247E5',
  base: '#0052FF',
  optimism: '#FF0420',
  
  // UI 색상
  background: '#0B0E11',
  surface: '#1A1D23',
  border: '#2A2D35',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  accent: '#3B82F6'
} as const

/**
 * API 엔드포인트 설정
 */
export const API_ENDPOINTS = {
  coingecko: 'https://api.coingecko.com/api/v3',
  alchemy: 'https://eth-mainnet.g.alchemy.com/v2',
  infura: 'https://mainnet.infura.io/v3'
} as const

/**
 * 지갑 연결 설정
 */
export const WALLET_CONFIG = {
  // 자동 연결 시간 (밀리초)
  AUTO_CONNECT_DELAY: 1000,
  
  // 잔액 새로고침 간격 (밀리초)
  BALANCE_REFRESH_INTERVAL: 30000,
  
  // 가격 새로고침 간격 (밀리초)
  PRICE_REFRESH_INTERVAL: 60000,
  
  // 트랜잭션 타임아웃 (밀리초)
  TRANSACTION_TIMEOUT: 300000,
  
  // 최대 재시도 횟수
  MAX_RETRY_ATTEMPTS: 3,
  
  // 로컬 스토리지 키
  STORAGE_KEYS: {
    WALLET_PREFERENCE: 'wallet_preference',
    CHAIN_PREFERENCE: 'chain_preference',
    RECENT_TRANSACTIONS: 'recent_transactions'
  }
} as const

/**
 * 지갑 커넥터 정보
 */
export const WALLET_CONNECTORS = {
  metamask: {
    name: 'MetaMask',
    icon: '🦊',
    color: '#F6851B',
    downloadUrl: 'https://metamask.io/download'
  },
  walletconnect: {
    name: 'WalletConnect',
    icon: '🔗',
    color: '#3B99FC',
    downloadUrl: 'https://walletconnect.org'
  },
  coinbase: {
    name: 'Coinbase Wallet',
    icon: '💙',
    color: '#0052FF',
    downloadUrl: 'https://wallet.coinbase.com'
  },
  privy: {
    name: 'Privy',
    icon: '🔐',
    color: '#676FFF',
    downloadUrl: 'https://privy.io'
  }
} as const

/**
 * 지갑 기본 설정
 */
export const DEFAULT_WALLET_CONFIG = {
  autoConnect: true,
  chainId: 1, // Ethereum 메인넷
  showRecentTransactions: true,
  enableTestnets: false
} as const

/**
 * 잔액 표시 설정
 */
export const BALANCE_DISPLAY_CONFIG = {
  // 소수점 표시 자릿수
  DEFAULT_PRECISION: 4,
  USD_PRECISION: 2,
  
  // 최소 표시 금액
  MIN_DISPLAY_AMOUNT: 0.0001,
  
  // 큰 숫자 표시 형식
  LARGE_NUMBER_THRESHOLD: 1000000,
  
  // 업데이트 애니메이션 시간
  UPDATE_ANIMATION_DURATION: 300
} as const