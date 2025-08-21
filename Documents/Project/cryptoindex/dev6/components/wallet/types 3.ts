// components/wallet/types.ts
// Hyperliquid 스타일 지갑 시스템을 위한 TypeScript 타입 정의

import { Address, Chain } from 'viem'

/**
 * 지갑 연결 상태
 */
export type WalletConnectionState = 
  | 'disconnected'  // 연결되지 않음
  | 'connecting'    // 연결 중
  | 'connected'     // 연결됨
  | 'error'         // 오류 발생

/**
 * 지원하는 체인 정보
 */
export interface SupportedChain {
  id: number
  name: string
  symbol: string
  icon: string
  color: string
  rpcUrl: string
  blockExplorer: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  isTestnet?: boolean
  viemChain?: Chain
}

/**
 * 토큰 잔액 정보
 */
export interface TokenBalance {
  address: Address
  symbol: string
  name: string
  balance: string
  decimals: number
  usdValue?: number
  logo?: string
  isNative?: boolean
}

/**
 * 지갑 계정 정보
 */
export interface WalletAccount {
  address: Address
  isConnected: boolean
  chainId: number
  connector?: string
  balances: TokenBalance[]
}

/**
 * 지갑 버튼 컴포넌트 Props
 */
export interface WalletButtonProps {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showBalance?: boolean
  showChainIcon?: boolean
  onConnect?: () => void
  onDisconnect?: () => void
}

/**
 * 네트워크 선택기 Props
 */
export interface NetworkSelectorProps {
  selectedChainId: number
  onChainChange: (chainId: number) => void
  disabled?: boolean
  className?: string
  showTestnets?: boolean
}

/**
 * 지갑 드롭다운 Props
 */
export interface WalletDropdownProps {
  account: WalletAccount
  onCopyAddress?: () => void
  onDisconnect?: () => void
  onViewExplorer?: () => void
  onSettings?: () => void
  className?: string
}

/**
 * 잔액 표시 컴포넌트 Props
 */
export interface BalanceDisplayProps {
  balance: TokenBalance
  showUsdValue?: boolean
  showIcon?: boolean
  className?: string
  precision?: number
}

/**
 * 체인 선택 모달 Props
 */
export interface ChainSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onChainSelect: (chainId: number) => void
  selectedChainId: number
  showTestnets?: boolean
}

/**
 * 지갑 연결 모달 Props
 */
export interface WalletConnectModalProps {
  isOpen: boolean
  onClose: () => void
  onConnect: (connector: string) => void
}

/**
 * 지갑 상태 (Zustand 스토어용)
 */
export interface WalletState {
  // 연결 상태
  connectionState: WalletConnectionState
  account: WalletAccount | null
  
  // 체인 정보
  supportedChains: SupportedChain[]
  currentChain: SupportedChain | null
  
  // 잔액 정보
  isLoadingBalances: boolean
  balanceError: string | null
  
  // 액션들
  setConnectionState: (state: WalletConnectionState) => void
  setAccount: (account: WalletAccount | null) => void
  setCurrentChain: (chain: SupportedChain | null) => void
  updateBalance: (tokenAddress: Address, balance: TokenBalance) => void
  setLoadingBalances: (loading: boolean) => void
  setBalanceError: (error: string | null) => void
  
  // 편의 함수들
  disconnect: () => void
  switchChain: (chainId: number) => Promise<void>
  refreshBalances: () => Promise<void>
}

/**
 * 토큰 가격 정보
 */
export interface TokenPrice {
  symbol: string
  price: number
  change24h: number
  lastUpdated: number
}

/**
 * 지갑 트랜잭션 정보
 */
export interface WalletTransaction {
  hash: string
  from: Address
  to: Address
  value: string
  timestamp: number
  status: 'pending' | 'confirmed' | 'failed'
  chainId: number
}

/**
 * 지갑 연결 옵션
 */
export interface WalletConnectOptions {
  autoConnect?: boolean
  chainId?: number
  showRecentTransactions?: boolean
  enableTestnets?: boolean
}

/**
 * 에러 타입
 */
export interface WalletError {
  code: string
  message: string
  details?: any
}