// app/api/user/profile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePrivyAuth } from '@/lib/middleware/privy-auth'
import { supabaseAdmin } from '@/lib/supabase/client'

// 프로필 업데이트 스키마
const updateProfileSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력해주세요.').optional(),
  // 추후 다른 프로필 필드 추가 가능
  // name: z.string().min(1, '이름을 입력해주세요.').optional(),
  // profileImage: z.string().url('유효한 URL을 입력해주세요.').optional(),
})

/**
 * GET /api/user/profile - 사용자 프로필 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await requirePrivyAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult // 인증 실패 시 에러 응답 반환
    }

    const { user } = authResult

    // 사용자 정보 조회 (RLS 적용)
    const { data: userProfile, error } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        auth_type,
        email,
        email_verified,
        wallet_address,
        wallet_type,
        privy_user_id,
        created_at,
        last_login,
        is_active
      `)
      .eq('id', user.id)
      .single()

    if (error || !userProfile) {
      return NextResponse.json(
        {
          success: false,
          error: '사용자 정보를 찾을 수 없습니다.'
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: userProfile.id,
          authType: userProfile.auth_type,
          email: userProfile.email,
          emailVerified: userProfile.email_verified,
          walletAddress: userProfile.wallet_address,
          walletType: userProfile.wallet_type,
          privyUserId: userProfile.privy_user_id,
          createdAt: userProfile.created_at,
          lastLogin: userProfile.last_login,
          isActive: userProfile.is_active
        }
      },
      { status: 200 }
    )

  } catch (_error) {
    console.error('Get profile error:', error)

    return NextResponse.json(
      {
        success: false,
        error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/user/profile - 사용자 프로필 업데이트
 */
export async function PUT(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await requirePrivyAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult // 인증 실패 시 에러 응답 반환
    }

    const { user } = authResult

    // 요청 바디 파싱 및 검증
    const body = await request.json()
    const validatedData = updateProfileSchema.parse(body)

    // 이메일 변경 시 중복 확인
    if (validatedData.email && validatedData.email !== user.email) {
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', validatedData.email)
        .neq('id', user.id)
        .single()

      if (existingUser) {
        return NextResponse.json(
          {
            success: false,
            error: '이미 사용 중인 이메일 주소입니다.'
          },
          { status: 400 }
        )
      }

      // 이메일이 변경되면 다시 인증 필요
      if (validatedData.email) {
        (validatedData as any).email_verified = false;
      }
    }

    // 사용자 정보 업데이트
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        ...validatedData,
        email_verified: validatedData.email ? false : undefined
      })
      .eq('id', user.id)
      .select()
      .single()

    if (updateError || !updatedUser) {
      return NextResponse.json(
        {
          success: false,
          error: '프로필 업데이트에 실패했습니다.'
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: '프로필이 성공적으로 업데이트되었습니다.',
        user: {
          id: updatedUser.id,
          authType: updatedUser.auth_type,
          email: updatedUser.email,
          emailVerified: updatedUser.email_verified,
          walletAddress: updatedUser.wallet_address,
          privyUserId: updatedUser.privy_user_id,
          isActive: updatedUser.is_active
        }
      },
      { status: 200 }
    )

  } catch (_error) {
    console.error('Update profile error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: error.errors[0]?.message || '잘못된 요청 형식입니다.',
          details: error.errors
        },
        { status: 400 }
      )
    }

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
