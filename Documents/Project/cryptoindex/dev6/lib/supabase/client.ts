// lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js'
import { Database } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 클라이언트 사이드용 Supabase 클라이언트
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// 서버 사이드용 Supabase 클라이언트 (Service Role)
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// 사용자별 Supabase 클라이언트 생성 (RLS 적용)
export const createUserSupabaseClient = (accessToken: string) => {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  })
}
