// lib/auth/privy-jwt.ts
import { jwtVerify, createRemoteJWKSet } from 'jose'

const PRIVY_APP_ID = process.env.PRIVY_APP_ID!
const PRIVY_JWKS_ENDPOINT = process.env.PRIVY_JWKS_ENDPOINT!

// Privy JWKS를 이용한 원격 검증 설정
const JWKS = createRemoteJWKSet(new URL(PRIVY_JWKS_ENDPOINT))

export interface PrivyJWTPayload {
  iss: string        // issuer
  sub: string        // subject (privy user id)
  aud: string        // audience (app id)
  exp: number        // expiration time
  iat: number        // issued at
  auth_time?: number // authentication time
  sid?: string       // session id
  wallet?: {
    address: string
    chain_type: string
    chain_id?: string
    wallet_client_type: string
    connector_type: string
  }
  email?: {
    address: string
    verified: boolean
  }
  phone?: {
    number: string
    verified: boolean
  }
}

/**
 * Privy JWT 토큰 검증
 */
export async function verifyPrivyJWT(token: string): Promise<{
  valid: boolean
  payload?: PrivyJWTPayload
  error?: string
}> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: 'privy.io',
      audience: PRIVY_APP_ID,
    })

    return {
      valid: true,
      payload: payload as PrivyJWTPayload
    }
  } catch (_error) {
    console.error('Privy JWT verification failed:', error)
    
    if (error instanceof Error) {
      return {
        valid: false,
        error: (_error as Error)?.message || String(_error)
      }
    }
    
    return {
      valid: false,
      error: 'Invalid JWT token'
    }
  }
}

/**
 * Privy 사용자 ID 추출 (간단 버전)
 */
export function extractPrivyUserId(token: string): string | null {
  try {
    // 개발 환경에서는 간단한 디코딩
    if (process.env.NODE_ENV === 'development') {
      const parts = token.split('.')
      if (parts.length !== 3) return null
      
      const payload = JSON.parse(atob(parts[1]))
      return payload.sub || payload.privy_user_id
    }
    
    // 운영 환경에서는 실제 검증 필요
    return null
  } catch (_error) {
    return null
  }
}

/**
 * Privy 토큰에서 이메일 정보 추출
 */
export function extractEmailFromPrivyToken(payload: PrivyJWTPayload): {
  email?: string
  verified: boolean
} {
  if (payload.email) {
    return {
      email: payload.email.address,
      verified: payload.email.verified
    }
  }
  
  return { verified: false }
}

/**
 * Privy 토큰에서 지갑 정보 추출
 */
export function extractWalletFromPrivyToken(payload: PrivyJWTPayload): {
  address?: string
  chainType?: string
  walletType?: string
} {
  if (payload.wallet) {
    return {
      address: payload.wallet.address,
      chainType: payload.wallet.chain_type,
      walletType: payload.wallet.wallet_client_type
    }
  }
  
  return {}
}

/**
 * Privy JWT 페이로드에서 사용자 타입 결정
 */
export function determineAuthType(payload: PrivyJWTPayload): 'email' | 'wallet' {
  // 지갑이 있으면 지갑 사용자, 없으면 이메일 사용자
  if (payload.wallet?.address) {
    return 'wallet'
  }
  return 'email'
}
