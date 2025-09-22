// lib/supabase/types.ts
import { PostgrestResponse } from '@supabase/supabase-js';

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

// Supabase response types
export type UserResponse = PostgrestResponse<User>;
export type UserSessionResponse = PostgrestResponse<UserSession>;
export type UserWalletResponse = PostgrestResponse<UserWallet>;