// lib/middleware/privy-auth.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyPrivyJWT, extractPrivyUserId, PrivyJWTPayload } from '@/lib/auth/privy-jwt'

/**
 * 인증이 필요한 라우트 목록
 */
const PROTECTED_ROUTES = [
  '/dashboard',
  '/profile',
  '/wallet',
  '/trade',
  '/api/user',
  '/api/wallet',
  '/api/trade'
]

/**
 * 공개 라우트 목록 (인증 불필요)
 */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/verify-email',
  '/api/auth/send-otp',
  '/api/health'
]

/**
 * 관리자 전용 라우트
 */
const ADMIN_ROUTES = [
  '/admin',
  '/api/admin'
]

/**
 * 요청이 보호된 라우트인지 확인
 */
export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route))
}

/**
 * 요청이 공개 라우트인지 확인
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route))
}

/**
 * 요청이 관리자 라우트인지 확인
 */
export function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some(route => pathname.startsWith(route))
}

/**
 * Privy JWT 토큰에서 인증 정보 추출
 */
export async function extractPrivyAuthFromRequest(request: NextRequest) {
  try {
    // Authorization 헤더에서 Bearer 토큰 추출
    const authHeader = request.headers.get('authorization')
    let token = authHeader?.replace('Bearer ', '')

    // 헤더에 없으면 쿠키에서 추출
    if (!token) {
      token = request.cookies.get('privy-token')?.value
    }

    if (!token) {
      return { authenticated: false, error: 'No Privy token provided' }
    }

    // 개발 환경에서는 간단한 검증
    if (process.env.NODE_ENV === 'development') {
      const privyUserId = extractPrivyUserId(token)
      if (!privyUserId) {
        return { authenticated: false, error: 'Invalid Privy token' }
      }

      // 개발용 사용자 정보 반환
      return {
        authenticated: true,
        user: {
          id: privyUserId,
          privyUserId: privyUserId,
          authType: 'email' as const,
          email: 'dev@cryptoindex.com',
          walletAddress: undefined,
          emailVerified: true,
          isActive: true
        },
        privyToken: token
      }
    }

    // 운영 환경에서는 실제 Privy JWT 검증
    const verificationResult = await verifyPrivyJWT(token)
    if (!verificationResult.valid || !verificationResult.payload) {
      return { 
        authenticated: false, 
        error: verificationResult.error || 'Invalid Privy token' 
      }
    }

    const payload = verificationResult.payload
    
    return {
      authenticated: true,
      user: {
        id: payload.sub,
        privyUserId: payload.sub,
        authType: payload.wallet ? 'wallet' as const : 'email' as const,
        email: payload.email?.address,
        walletAddress: payload.wallet?.address,
        emailVerified: payload.email?.verified || false,
        isActive: true
      },
      privyToken: token
    }
  } catch (_error) {
    console.error('Error extracting Privy auth from request:', error)
    return { authenticated: false, error: 'Authentication failed' }
  }
}

/**
 * API 라우트용 Privy 인증 미들웨어
 */
export async function requirePrivyAuth(request: NextRequest) {
  const authResult = await extractPrivyAuthFromRequest(request)
  
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: authResult.error, authenticated: false },
      { status: 401 }
    )
  }

  return {
    user: authResult.user,
    privyToken: authResult.privyToken
  }
}

/**
 * 관리자 권한 확인 (Privy 기반)
 */
export async function requirePrivyAdminAuth(request: NextRequest) {
  const authResult = await extractPrivyAuthFromRequest(request)
  
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: authResult.error, authenticated: false },
      { status: 401 }
    )
  }

  // 관리자 권한 확인
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',')
  const isAdmin = authResult.user?.email && adminEmails.includes(authResult.user.email)
  
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required', authenticated: true, authorized: false },
      { status: 403 }
    )
  }

  return {
    user: authResult.user,
    privyToken: authResult.privyToken
  }
}

/**
 * Rate Limiting 미들웨어
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function rateLimit(
  identifier: string, 
  maxRequests: number = 100, 
  windowMs: number = 15 * 60 * 1000 // 15분
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const record = rateLimitMap.get(identifier)

  if (!record || now > record.resetTime) {
    // 새로운 윈도우 시작
    const resetTime = now + windowMs
    rateLimitMap.set(identifier, { count: 1, resetTime })
    return { allowed: true, remaining: maxRequests - 1, resetTime }
  }

  if (record.count >= maxRequests) {
    // 제한 초과
    return { allowed: false, remaining: 0, resetTime: record.resetTime }
  }

  // 카운트 증가
  record.count++
  return { allowed: true, remaining: maxRequests - record.count, resetTime: record.resetTime }
}

/**
 * IP 기반 Rate Limiting
 */
export function rateLimitByIP(request: NextRequest, maxRequests: number = 1000, windowMs: number = 15 * 60 * 1000) {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
  return rateLimit(`ip:${ip}`, maxRequests, windowMs)
}

/**
 * 사용자 기반 Rate Limiting
 */
export function rateLimitByUser(userId: string, maxRequests: number = 1000, windowMs: number = 60 * 60 * 1000) {
  return rateLimit(`user:${userId}`, maxRequests, windowMs)
}
