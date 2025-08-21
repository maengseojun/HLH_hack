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
      email_verification_codes: {
        Row: {
          id: string
          email: string
          code: string
          expires_at: string
          used: boolean
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          code: string
          expires_at: string
          used?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          code?: string
          expires_at?: string
          used?: boolean
          created_at?: string
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
        }
        Insert: {
          id?: string
          user_id: string
          session_token: string
          privy_access_token?: string | null
          expires_at: string
          created_at?: string
          last_accessed?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_token?: string
          privy_access_token?: string | null
          expires_at?: string
          created_at?: string
          last_accessed?: string
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
      user_2fa: {
        Row: {
          user_id: string
          secret_key: string
          backup_codes: string[]
          enabled: boolean
          created_at: string
        }
        Insert: {
          user_id: string
          secret_key: string
          backup_codes: string[]
          enabled?: boolean
          created_at?: string
        }
        Update: {
          user_id?: string
          secret_key?: string
          backup_codes?: string[]
          enabled?: boolean
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

export type EmailVerificationCode = Database['public']['Tables']['email_verification_codes']['Row']
export type EmailVerificationCodeInsert = Database['public']['Tables']['email_verification_codes']['Insert']

export type UserSession = Database['public']['Tables']['user_sessions']['Row']
export type UserSessionInsert = Database['public']['Tables']['user_sessions']['Insert']

export type UserWallet = Database['public']['Tables']['user_wallets']['Row']
export type UserWalletInsert = Database['public']['Tables']['user_wallets']['Insert']

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

export interface LoginRequest {
  email: string
  code?: string
}

export interface VerifyEmailRequest {
  email: string
  code: string
}

export interface AuthResponse {
  success: boolean
  user?: AuthUser
  sessionToken?: string
  message?: string
  error?: string
}
