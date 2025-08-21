/**
 * Wallet Constants - Chain Information & Configuration
 * 
 * This file contains all constant values, chain configurations,
 * and token addresses used throughout the wallet system.
 */

import { mainnet, arbitrum, polygon, base, optimism } from 'viem/chains'
import { SupportedChain } from './types'

/**
 * Supported blockchain networks configuration
 */
export const SUPPORTED_CHAINS: Record<number, SupportedChain> = {
  [mainnet.id]: {
    id: mainnet.id,
    name: 'Ethereum',
    shortName: 'ETH',
    symbol: 'ETH',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/your-api-key',
    blockExplorerUrl: 'https://etherscan.io',
    iconUrl: '/chains/ethereum.svg',
    isTestnet: false,
    viemChain: mainnet
  },
  [arbitrum.id]: {
    id: arbitrum.id,
    name: 'Arbitrum One',
    shortName: 'ARB',
    symbol: 'ETH',
    rpcUrl: 'https://arb-mainnet.g.alchemy.com/v2/your-api-key',
    blockExplorerUrl: 'https://arbiscan.io',
    iconUrl: '/chains/arbitrum.svg',
    isTestnet: false,
    viemChain: arbitrum
  },
  [polygon.id]: {
    id: polygon.id,
    name: 'Polygon',
    shortName: 'MATIC',
    symbol: 'MATIC',
    rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/your-api-key',
    blockExplorerUrl: 'https://polygonscan.com',
    iconUrl: '/chains/polygon.svg',
    isTestnet: false,
    viemChain: polygon
  },
  [base.id]: {
    id: base.id,
    name: 'Base',
    shortName: 'BASE',
    symbol: 'ETH',
    rpcUrl: 'https://base-mainnet.g.alchemy.com/v2/your-api-key',
    blockExplorerUrl: 'https://basescan.org',
    iconUrl: '/chains/base.svg',
    isTestnet: false,
    viemChain: base
  },
  [optimism.id]: {
    id: optimism.id,
    name: 'Optimism',
    shortName: 'OP',
    symbol: 'ETH',
    rpcUrl: 'https://opt-mainnet.g.alchemy.com/v2/your-api-key',
    blockExplorerUrl: 'https://optimistic.etherscan.io',
    iconUrl: '/chains/optimism.svg',
    isTestnet: false,
    viemChain: optimism
  }
}

/**
 * Default chain ID (Ethereum Mainnet)
 */
export const DEFAULT_CHAIN_ID = mainnet.id

/**
 * Popular ERC-20 token addresses by chain
 */
export const TOKEN_ADDRESSES = {
  [mainnet.id]: {
    USDC: '0xA0b86a33E6441fA0Ad4B85b8D5e01a48c05e0c5e',
    USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    DAI: '0x6b175474e89094c44da98b954eedeac495271d0f'
  },
  [arbitrum.id]: {
    USDC: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    USDT: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
    WETH: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    DAI: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1'
  },
  [polygon.id]: {
    USDC: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    USDT: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
    WETH: '0x7ceb23fd6f88dc65b7db0bb70abc8829db122d4f',
    DAI: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063'
  },
  [base.id]: {
    USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    WETH: '0x4200000000000000000000000000000000000006',
    DAI: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb'
  },
  [optimism.id]: {
    USDC: '0x7f5c764cbc14f9669b88837ca1490cca17c31607',
    USDT: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
    WETH: '0x4200000000000000000000000000000000000006',
    DAI: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1'
  }
}

/**
 * Wallet connection timeouts and retry settings
 */
export const WALLET_CONFIG = {
  CONNECTION_TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  BALANCE_REFRESH_INTERVAL: 30000, // 30 seconds
  TRANSACTION_TIMEOUT: 300000 // 5 minutes
}

/**
 * UI Constants
 */
export const UI_CONFIG = {
  WALLET_ADDRESS_DISPLAY_LENGTH: {
    PREFIX: 6,
    SUFFIX: 4
  },
  BALANCE_DECIMALS: 6,
  USD_DECIMALS: 2,
  ANIMATION_DURATION: 200 // milliseconds
}

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  CONNECTION_FAILED: 'Failed to connect to wallet',
  NETWORK_SWITCH_FAILED: 'Failed to switch network',
  BALANCE_FETCH_FAILED: 'Failed to fetch balance',
  TRANSACTION_FAILED: 'Transaction failed',
  UNSUPPORTED_CHAIN: 'Unsupported chain',
  WALLET_NOT_FOUND: 'Wallet not found',
  USER_REJECTED: 'User rejected the request'
}

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  WALLET_CONNECTED: 'Wallet connected successfully',
  NETWORK_SWITCHED: 'Network switched successfully',
  ADDRESS_COPIED: 'Address copied to clipboard',
  TRANSACTION_CONFIRMED: 'Transaction confirmed'
}

/**
 * Hyperliquid-style color constants
 */
export const THEME_COLORS = {
  PRIMARY: '#00D4FF',
  SECONDARY: '#1A1A1A',
  SUCCESS: '#00FF88',
  WARNING: '#FFB800',
  ERROR: '#FF4444',
  BACKGROUND: '#0A0A0A',
  SURFACE: '#1A1A1A',
  TEXT_PRIMARY: '#FFFFFF',
  TEXT_SECONDARY: '#CCCCCC',
  BORDER: '#333333'
}