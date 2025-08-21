// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePrivyAuth } from '@/lib/middleware/privy-auth'

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await requirePrivyAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult // 인증 실패 시 에러 응답 반환
    }

    // authResult에서 사용자 정보 추출 (현재 사용되지 않음)
    // const { user, privyToken } = authResult

    // 현재 세션만 삭제 (기본값)
    let logoutAll = false
    
    try {
      const body = await request.json()
      logoutAll = body.logoutAll === true
    } catch (_error) {
      // body가 없거나 파싱 실패 시 무시
    }

    // Privy 세션은 클라이언트 측에서 처리됨
    // 서버에서는 쿠키만 삭제

    // 성공 응답
    const response = NextResponse.json(
      {
        success: true,
        message: logoutAll ? '모든 기기에서 로그아웃되었습니다.' : '로그아웃되었습니다.'
      },
      { status: 200 }
    )

    // 쿠키에서 Privy 토큰 제거
    response.cookies.set('privy-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/'
    })

    return response

  } catch (_error) {
    console.error('Logout error:', _error)

    return NextResponse.json(
      {
        success: false,
        error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      },
      { status: 500 }
    )
  }
}

// OPTIONS 요청 처리 (CORS)
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}
