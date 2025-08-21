// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { 
  isProtectedRoute, 
  isPublicRoute, 
  isAdminRoute, 
  extractPrivyAuthFromRequest,
  rateLimitByIP 
} from '@/lib/middleware/privy-auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Health check는 항상 허용
  if (pathname === '/api/health') {
    return NextResponse.next()
  }

  // IP 기반 Rate Limiting (모든 요청에 적용)
  const rateLimitResult = rateLimitByIP(request, 1000, 15 * 60 * 1000) // 15분간 1000회
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { 
        error: 'Too many requests',
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
      },
      { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': '1000',
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
        }
      }
    )
  }

  // Rate Limit 헤더 추가
  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Limit', '1000')
  response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
  response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString())

  // 공개 라우트는 인증 없이 통과
  if (isPublicRoute(pathname)) {
    return response
  }

  // 정적 파일 및 Next.js 내부 라우트는 건너뛰기
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/_next/') ||
    pathname.includes('.') // 정적 파일 (이미지, CSS, JS 등)
  ) {
    return response
  }

  // 인증이 필요한 라우트 확인
  if (isProtectedRoute(pathname) || isAdminRoute(pathname)) {
    const authResult = await extractPrivyAuthFromRequest(request)

    if (!authResult.authenticated) {
      // API 라우트는 JSON 응답
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: authResult.error, authenticated: false },
          { status: 401 }
        )
      }

      // 웹 페이지는 로그인 페이지로 리다이렉트
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // 관리자 라우트 추가 확인
    if (isAdminRoute(pathname)) {
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',')
      const isAdmin = authResult.user?.email && adminEmails.includes(authResult.user.email)
      
      if (!isAdmin) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: 'Admin access required', authenticated: true, authorized: false },
            { status: 403 }
          )
        }
        
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    // Privy 인증된 사용자 정보를 헤더에 추가 (API 라우트에서 사용 가능)
    if (authResult.user) {
      response.headers.set('x-privy-user-id', authResult.user.privyUserId || '')
      response.headers.set('x-user-id', authResult.user.id)
      response.headers.set('x-user-auth-type', authResult.user.authType)
      if (authResult.user.email) {
        response.headers.set('x-user-email', authResult.user.email)
      }
      if (authResult.user.walletAddress) {
        response.headers.set('x-user-wallet-address', authResult.user.walletAddress)
      }
    }
  }

  return response
}

// 미들웨어가 실행될 경로 설정
export const config = {
  matcher: [
    /*
     * 다음 경로들을 제외한 모든 요청에 미들웨어 적용:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
