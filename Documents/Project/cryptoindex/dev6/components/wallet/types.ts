/**
 * Wallet Types - TypeScript Type Definitions
 * 
 * This file contains all TypeScript type definitions for wallet-related
 * components and functionality.
 */

import { Chain } from 'viem'

/**
 * Wallet connection state enum
 */
export enum WalletConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

/**
 * Network status enum
 */
export enum NetworkStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  UNSUPPORTED = 'unsupported'
}

/**
 * Supported blockchain networks
 */
export interface SupportedChain {
  id: number
  name: string
  shortName: string
  symbol: string
  rpcUrl: string
  blockExplorerUrl: string
  iconUrl: string
  isTestnet: boolean
  viemChain: Chain
}

/**
 * Token balance information
 */
export interface TokenBalance {
  symbol: string
  name: string
  balance: string
  balanceFormatted: string
  usdValue?: number
  decimals: number
  contractAddress?: string
  isNative: boolean
}

/**
 * Wallet dropdown component props
 */
export interface WalletDropdownProps {
  isOpen: boolean
  onClose: () => void
  onDisconnect: () => void
  walletAddress: string
  chainId: number
  balance?: TokenBalance[]
  className?: string
}

/**
 * Network selector component props
 */
export interface NetworkSelectorProps {
  currentChain: SupportedChain
  onNetworkChange: (chain: SupportedChain) => void
  disabled?: boolean
  className?: string
}

/**
 * Wallet connection button props
 */
export interface WalletConnectionButtonProps {
  connectionState: WalletConnectionState
  onConnect: () => void
  onDisconnect: () => void
  walletAddress?: string
  chainId?: number
  className?: string
}

/**
 * Wallet balance display props
 */
export interface WalletBalanceDisplayProps {
  balance: TokenBalance[]
  isLoading: boolean
  error?: string
  showUsdValue?: boolean
  className?: string
}

/**
 * Wallet address display props
 */
export interface WalletAddressDisplayProps {
  address: string
  showCopyButton?: boolean
  truncate?: boolean
  className?: string
}

/**
 * Custom hook return types
 */
export interface UseWalletBalanceReturn {
  balances: TokenBalance[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export interface UseNetworkSwitchReturn {
  switchNetwork: (chainId: number) => Promise<void>
  isLoading: boolean
  error: string | null
}

export interface UseWalletConnectionReturn {
  connectionState: WalletConnectionState
  walletAddress: string | null
  chainId: number | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  reconnect: () => Promise<void>
}

/**
 * Wallet connection error types
 */
export interface WalletError {
  code: string
  message: string
  details?: any
}

/**
 * Chain switching error types
 */
export interface ChainSwitchError extends WalletError {
  requestedChainId: number
  currentChainId: number
}