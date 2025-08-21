// lib/supabase/types.ts
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          auth_type: 'email' | 'wallet'
          email: string | null
          email_verified: boolean
          wallet_address: string | null
          wallet_type: string | null
          privy_user_id: string | null
          created_at: string
          last_login: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          auth_type: 'email' | 'wallet'
          email?: string | null
          email_verified?: boolean
          wallet_address?: string | null
          wallet_type?: string | null
          privy_user_id?: string | null
          created_at?: string
          last_login?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          auth_type?: 'email' | 'wallet'
          email?: string | null
          email_verified?: boolean
          wallet_address?: string | null
          wallet_type?: string | null
          privy_user_id?: string | null
          created_at?: string
          last_login?: string | null
          is_active?: boolean
        }
      }
      user_sessions: {
        Row: {
          id: string
          user_id: string
          session_token: string
          privy_access_token: string | null
          expires_at: string
          created_at: string
          last_accessed: string
          ip_address: string | null
          user_agent: string | null
          is_revoked: boolean
          revoked_at: string | null
          revoked_reason: string | null
          session_type: 'web' | 'mobile' | 'api'
          device_fingerprint: string | null
          location_country: string | null
          location_city: string | null
          is_suspicious: boolean
          last_activity_at: string
          session_metadata: any
        }
        Insert: {
          id?: string
          user_id: string
          session_token: string
          privy_access_token?: string | null
          expires_at: string
          created_at?: string
          last_accessed?: string
          ip_address?: string | null
          user_agent?: string | null
          is_revoked?: boolean
          revoked_at?: string | null
          revoked_reason?: string | null
          session_type?: 'web' | 'mobile' | 'api'
          device_fingerprint?: string | null
          location_country?: string | null
          location_city?: string | null
          is_suspicious?: boolean
          last_activity_at?: string
          session_metadata?: any
        }
        Update: {
          id?: string
          user_id?: string
          session_token?: string
          privy_access_token?: string | null
          expires_at?: string
          created_at?: string
          last_accessed?: string
          ip_address?: string | null
          user_agent?: string | null
          is_revoked?: boolean
          revoked_at?: string | null
          revoked_reason?: string | null
          session_type?: 'web' | 'mobile' | 'api'
          device_fingerprint?: string | null
          location_country?: string | null
          location_city?: string | null
          is_suspicious?: boolean
          last_activity_at?: string
          session_metadata?: any
        }
      }
      user_wallets: {
        Row: {
          id: string
          user_id: string
          wallet_address: string
          encrypted_private_key: string | null
          wallet_provider: string
          is_primary: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          wallet_address: string
          encrypted_private_key?: string | null
          wallet_provider?: string
          is_primary?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          wallet_address?: string
          encrypted_private_key?: string | null
          wallet_provider?: string
          is_primary?: boolean
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          wallet_address: string
          transaction_type: 'deposit' | 'withdrawal'
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
          network: 'arbitrum' | 'hyperliquid' | 'ethereum'
          amount: string
          token_symbol: string
          tx_hash: string | null
          bridge_tx_hash: string | null
          created_at: string
          updated_at: string
          completed_at: string | null
          error_message: string | null
          retry_count: number
          metadata: any
        }
        Insert: {
          id?: string
          user_id: string
          wallet_address: string
          transaction_type: 'deposit' | 'withdrawal'
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
          network: 'arbitrum' | 'hyperliquid' | 'ethereum'
          amount: string
          token_symbol?: string
          tx_hash?: string | null
          bridge_tx_hash?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
          error_message?: string | null
          retry_count?: number
          metadata?: any
        }
        Update: {
          id?: string
          user_id?: string
          wallet_address?: string
          transaction_type?: 'deposit' | 'withdrawal'
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
          network?: 'arbitrum' | 'hyperliquid' | 'ethereum'
          amount?: string
          token_symbol?: string
          tx_hash?: string | null
          bridge_tx_hash?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
          error_message?: string | null
          retry_count?: number
          metadata?: any
        }
      }
      network_configs: {
        Row: {
          id: string
          network_name: string
          network_type: 'mainnet' | 'testnet'
          chain_id: number
          rpc_url: string
          websocket_url: string | null
          bridge_contract_address: string | null
          bridge_abi: any | null
          native_token_symbol: string
          native_token_decimals: number
          supported_tokens: any
          min_deposit_amount: string | null
          max_deposit_amount: string | null
          min_withdrawal_amount: string | null
          max_withdrawal_amount: string | null
          deposit_fee: string
          withdrawal_fee: string
          gas_fee_multiplier: string
          is_active: boolean
          is_maintenance: boolean
          required_confirmations: number
          average_block_time: number
          block_explorer_url: string | null
          block_explorer_api_url: string | null
          metadata: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          network_name: string
          network_type: 'mainnet' | 'testnet'
          chain_id: number
          rpc_url: string
          websocket_url?: string | null
          bridge_contract_address?: string | null
          bridge_abi?: any | null
          native_token_symbol: string
          native_token_decimals?: number
          supported_tokens?: any
          min_deposit_amount?: string | null
          max_deposit_amount?: string | null
          min_withdrawal_amount?: string | null
          max_withdrawal_amount?: string | null
          deposit_fee?: string
          withdrawal_fee?: string
          gas_fee_multiplier?: string
          is_active?: boolean
          is_maintenance?: boolean
          required_confirmations?: number
          average_block_time?: number
          block_explorer_url?: string | null
          block_explorer_api_url?: string | null
          metadata?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          network_name?: string
          network_type?: 'mainnet' | 'testnet'
          chain_id?: number
          rpc_url?: string
          websocket_url?: string | null
          bridge_contract_address?: string | null
          bridge_abi?: any | null
          native_token_symbol?: string
          native_token_decimals?: number
          supported_tokens?: any
          min_deposit_amount?: string | null
          max_deposit_amount?: string | null
          min_withdrawal_amount?: string | null
          max_withdrawal_amount?: string | null
          deposit_fee?: string
          withdrawal_fee?: string
          gas_fee_multiplier?: string
          is_active?: boolean
          is_maintenance?: boolean
          required_confirmations?: number
          average_block_time?: number
          block_explorer_url?: string | null
          block_explorer_api_url?: string | null
          metadata?: any
          created_at?: string
          updated_at?: string
        }
      }
      session_security_events: {
        Row: {
          id: string
          session_id: string
          user_id: string
          event_type: 'login' | 'logout' | 'token_refresh' | 'suspicious_activity' | 'location_change' | 'device_change' | 'concurrent_session'
          severity: 'info' | 'warning' | 'critical'
          description: string | null
          ip_address: string | null
          user_agent: string | null
          location_country: string | null
          location_city: string | null
          metadata: any
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          event_type: 'login' | 'logout' | 'token_refresh' | 'suspicious_activity' | 'location_change' | 'device_change' | 'concurrent_session'
          severity?: 'info' | 'warning' | 'critical'
          description?: string | null
          ip_address?: string | null
          user_agent?: string | null
          location_country?: string | null
          location_city?: string | null
          metadata?: any
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          event_type?: 'login' | 'logout' | 'token_refresh' | 'suspicious_activity' | 'location_change' | 'device_change' | 'concurrent_session'
          severity?: 'info' | 'warning' | 'critical'
          description?: string | null
          ip_address?: string | null
          user_agent?: string | null
          location_country?: string | null
          location_city?: string | null
          metadata?: any
          created_at?: string
        }
      }
    }
  }
}

// 편의를 위한 타입 alias
export type User = Database['public']['Tables']['users']['Row']
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserUpdate = Database['public']['Tables']['users']['Update']

export type UserSession = Database['public']['Tables']['user_sessions']['Row']
export type UserSessionInsert = Database['public']['Tables']['user_sessions']['Insert']
export type UserSessionUpdate = Database['public']['Tables']['user_sessions']['Update']

export type UserWallet = Database['public']['Tables']['user_wallets']['Row']
export type UserWalletInsert = Database['public']['Tables']['user_wallets']['Insert']
export type UserWalletUpdate = Database['public']['Tables']['user_wallets']['Update']

export type Transaction = Database['public']['Tables']['transactions']['Row']
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert']
export type TransactionUpdate = Database['public']['Tables']['transactions']['Update']

export type NetworkConfig = Database['public']['Tables']['network_configs']['Row']
export type NetworkConfigInsert = Database['public']['Tables']['network_configs']['Insert']
export type NetworkConfigUpdate = Database['public']['Tables']['network_configs']['Update']

export type SessionSecurityEvent = Database['public']['Tables']['session_security_events']['Row']
export type SessionSecurityEventInsert = Database['public']['Tables']['session_security_events']['Insert']
export type SessionSecurityEventUpdate = Database['public']['Tables']['session_security_events']['Update']

// 인증 관련 타입
export interface AuthUser {
  id: string
  authType: 'email' | 'wallet'
  email?: string
  walletAddress?: string
  privyUserId?: string
  emailVerified: boolean
  isActive: boolean
}

export interface AuthResponse {
  success: boolean
  user?: AuthUser
  sessionToken?: string
  message?: string
  error?: string
}

// 잔액 관련 타입
export interface TokenBalance {
  token: string
  symbol: string
  balance: string
  decimals: number
  formatted: string
}

export interface NetworkBalance {
  network: string
  nativeBalance: string
  nativeSymbol: string
  tokenBalances: TokenBalance[]
  totalUsdValue?: string
}

export interface BalanceResponse {
  success: boolean
  wallet: string
  network?: string
  balance?: NetworkBalance
  balances?: NetworkBalance[]
  totalNetworks?: number
  cached?: boolean
  error?: string
}

// 트랜잭션 관련 타입
export interface TransactionRequest {
  walletAddress: string
  transactionType: 'deposit' | 'withdrawal'
  network: 'arbitrum' | 'hyperliquid' | 'ethereum'
  amount: string
  tokenSymbol?: string
}

export interface TransactionResponse {
  success: boolean
  transaction?: Transaction
  message?: string
  error?: string
}
