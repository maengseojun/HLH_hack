// components/wallet/index.ts
// Hyperliquid 스타일 지갑 시스템 - 중앙화된 Export

// 타입 정의
export type {
  WalletConnectionState,
  SupportedChain,
  TokenBalance,
  WalletAccount,
  WalletButtonProps,
  NetworkSelectorProps,
  WalletDropdownProps,
  BalanceDisplayProps,
  ChainSelectorModalProps,
  WalletConnectModalProps,
  WalletState,
  TokenPrice,
  WalletTransaction,
  WalletConnectOptions,
  WalletError
} from './types'

// 상수 정의
export {
  SUPPORTED_CHAINS,
  CHAIN_MAP,
  NATIVE_TOKENS,
  POPULAR_TOKENS,
  WALLET_COLORS,
  API_ENDPOINTS,
  WALLET_CONFIG,
  WALLET_CONNECTORS,
  DEFAULT_WALLET_CONFIG,
  BALANCE_DISPLAY_CONFIG
} from './constants'

// 커스텀 훅 (향후 구현 예정)
// export * from './hooks'

/**
 * 다음 단계에서 추가될 컴포넌트들:
 * 
 * - WalletButton: 지갑 연결/연결됨 버튼
 * - NetworkSelector: 네트워크 선택기
 * - WalletDropdown: 지갑 정보 드롭다운
 * - BalanceDisplay: 잔액 표시 컴포넌트
 * - ChainSelectorModal: 체인 선택 모달
 * - WalletConnectModal: 지갑 연결 모달
 * - TokenList: 토큰 목록 표시
 * - TransactionHistory: 트랜잭션 기록
 */

// 향후 export 예정
// export { WalletButton } from './WalletButton'
// export { NetworkSelector } from './NetworkSelector'
// export { WalletDropdown } from './WalletDropdown'
// export { BalanceDisplay } from './BalanceDisplay'
// export { ChainSelectorModal } from './ChainSelectorModal'
// export { WalletConnectModal } from './WalletConnectModal'
// export { TokenList } from './TokenList'
// export { TransactionHistory } from './TransactionHistory'

/**
 * 지갑 시스템 사용법 예시:
 * 
 * ```tsx
 * import { 
 *   WalletButton, 
 *   NetworkSelector, 
 *   WalletDropdown,
 *   SUPPORTED_CHAINS,
 *   WALLET_COLORS 
 * } from '@/components/wallet'
 * 
 * function App() {
 *   return (
 *     <div className="flex items-center gap-4">
 *       <NetworkSelector 
 *         selectedChainId={1}
 *         onChainChange={handleChainChange}
 *       />
 *       <WalletButton 
 *         showBalance={true}
 *         showChainIcon={true}
 *       />
 *     </div>
 *   )
 * }
 * ```
 */