/**
 * Wallet Components - Index File
 * 
 * This file exports all wallet-related components for easy importing
 * throughout the application.
 * 
 * Usage:
 * import { WalletConnectionButton, WalletDropdown, NetworkSelector } from '@/components/wallet'
 */

// Main wallet components
export { WalletConnectButton } from './WalletConnectButton'
export { WalletDropdown } from './WalletDropdown'
export { NetworkDisplay } from './NetworkDisplay'
// export { NetworkSelector } from './NetworkSelector'
// export { WalletBalanceDisplay } from './WalletBalanceDisplay'

// Utility components (to be implemented)
// export { WalletAddressDisplay } from './WalletAddressDisplay'
// export { WalletConnectModal } from './WalletConnectModal'

// Hooks
export { useNetworkSwitch } from './hooks/useNetworkSwitch'
// export { useWalletBalance } from './hooks/useWalletBalance'
// export { useWalletConnection } from './hooks/useWalletConnection'

// Types and constants
export * from './types'
export * from './constants'

// Utility functions
export * from './utils'

// Temporary placeholder - remove when components are implemented
export const WalletComponents = {
  // This object will be replaced with actual component exports
  placeholder: 'Wallet components will be implemented here'
}