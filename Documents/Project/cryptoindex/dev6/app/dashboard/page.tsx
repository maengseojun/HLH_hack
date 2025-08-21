// app/dashboard/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
// Dynamic import workaround for Privy hooks
const { usePrivy, useLogout } = require('@privy-io/react-auth')
import { useSupabaseWithPrivy } from '@/lib/privy/config'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import RiskMonitor from '@/components/security/RiskMonitor'
import { LogOut, Mail, Shield, User, Wallet } from 'lucide-react'

export default function DashboardPage() {
  const { user, authenticated, ready } = usePrivy()
  const { logout } = useLogout()
  const { createOrUpdateUser } = useSupabaseWithPrivy()
  const router = useRouter()

  // 인증되지 않은 경우 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/privy-login')
    }
  }, [authenticated, ready, router])

  // 사용자 데이터를 Supabase에 동기화
  useEffect(() => {
    if (authenticated && user) {
      createOrUpdateUser();
    }
  }, [authenticated, user, createOrUpdateUser])

  const handleLogout = async () => {
    try {
      await logout()
      router.push('/privy-login')
    } catch (error) {
      // Handle logout error silently
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!authenticated || !user) {
    return null // 리다이렉트 중
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">CryptoPayback</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Avatar>
                  <AvatarFallback>
                    {user.email?.address ? user.email.address[0].toUpperCase() : 
                     user.wallet?.address ? user.wallet.address.slice(0, 2) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-gray-700">
                  {user.email?.address || 
                   (user.wallet?.address ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}` : '사용자')}
                </span>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                로그아웃
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">대시보드</h2>
          <p className="mt-2 text-gray-600">안전한 P2P 거래를 시작하세요</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 사용자 프로필 카드 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                사용자 프로필
              </CardTitle>
              <CardDescription>계정 정보 및 설정</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">인증 방식</span>
                <Badge variant={user.email ? 'default' : 'secondary'}>
                  {user.email ? '이메일' : '지갑'}
                </Badge>
              </div>
              
              {user.email && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">이메일</span>
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{user.email.address}</span>
                  </div>
                </div>
              )}
              
              {user.wallet && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">지갑</span>
                  <div className="flex items-center space-x-2">
                    <Wallet className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{user.wallet.address.slice(0, 6)}...{user.wallet.address.slice(-4)}</span>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">이메일 인증</span>
                <Badge variant={user.email?.verified ? 'success' : 'destructive'}>
                  {user.email?.verified ? '인증됨' : '미인증'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">계정 상태</span>
                <Badge variant="success">
                  활성
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* 보안 카드 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                보안 설정
              </CardTitle>
              <CardDescription>계정 보안을 강화하세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600">
                <p>• 2단계 인증 설정 (곧 출시)</p>
                <p>• 지갑 연결 관리</p>
                <p>• 로그인 히스토리</p>
              </div>
              <Button variant="outline" className="w-full" disabled>
                보안 설정 (준비중)
              </Button>
            </CardContent>
          </Card>

          {/* 거래 카드 */}
          <Card>
            <CardHeader>
              <CardTitle>거래 시작하기</CardTitle>
              <CardDescription>P2P 거래를 시작해보세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600">
                <p>• 안전한 P2P 거래</p>
                <p>• 실시간 시세 확인</p>
                <p>• 거래 내역 관리</p>
              </div>
              <Button className="w-full" disabled>
                거래 시작 (준비중)
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Risk Monitoring Section */}
        {user?.wallet?.address && (
          <div className="mt-8">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-gray-900">포트폴리오 리스크 모니터링</h3>
              <p className="text-sm text-gray-600 mt-1">
                Hyperliquid 네트워크에서의 다중 플랫폼 사용량을 모니터링합니다.
              </p>
            </div>
            <RiskMonitor 
              walletAddress={user.wallet.address}
              currentPlatformUsage={{
                marginUsed: 0, // Will be populated when trading is implemented
                totalBalance: 0,
                openPositions: 0
              }}
            />
          </div>
        )}

        {/* 최근 활동 */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>최근 활동</CardTitle>
              <CardDescription>계정의 최근 활동 내역</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <p>아직 활동 내역이 없습니다.</p>
                <p className="text-sm mt-2">거래를 시작하면 내역이 여기에 표시됩니다.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
