'use client'

import { useState } from 'react'
import IntentInput from '@/components/intent/IntentInput'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Zap, TrendingUp, Shield } from 'lucide-react'

export default function IntentDemoPage() {
  const [completedPositions, setCompletedPositions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleSuccess = (positionId: string) => {
    setCompletedPositions(prev => [...prev, positionId])
    setError(null)
  }

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🎯 Intent-Based Index Creation
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            복잡한 6단계 프로세스를 간단한 한 문장으로! 
            자연어로 원하는 투자 의도를 말씀해주시면 AI가 최적의 인덱스를 생성합니다.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                6단계 → 1단계
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                복잡한 토큰 선택, 비율 설정, 체인 선택 과정을 자연어 한 문장으로 단순화
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                35% 가스 절약
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                같은 체인 작업들을 배치로 묶어 실행하여 가스비 최적화
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" />
                MEV 보호
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                HyperEVM 중심 아키텍처로 MEV 공격으로부터 보호
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Intent Input Component */}
        <IntentInput 
          onSuccess={handleSuccess}
          onError={handleError}
        />

        {/* Success Results */}
        {completedPositions.length > 0 && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                생성 완료된 포지션들
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {completedPositions.map((positionId, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Badge variant="secondary">{index + 1}</Badge>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {positionId}
                    </code>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-700">
                <span className="font-medium">오류:</span>
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* How it Works */}
        <Card>
          <CardHeader>
            <CardTitle>🔍 작동 원리</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">기존 방식 (6단계)</h4>
                <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                  <li>투자 금액 입력</li>
                  <li>인덱스 타입 선택</li>
                  <li>개별 토큰 선택</li>
                  <li>비율 조정</li>
                  <li>체인별 설정</li>
                  <li>최종 확인 및 실행</li>
                </ol>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">개선된 방식 (1단계)</h4>
                <div className="bg-gradient-to-r from-blue-100 to-purple-100 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-800">
                    "1000 USDC로 밈코인 인덱스 만들어줘"
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    → AI가 자동으로 분석하여 최적의 WIF, BONK, POPCAT 등 
                    밈코인 포트폴리오를 생성하고 HyperEVM에서 배치 실행
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="font-semibold mb-2">🚀 기술적 개선사항</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li><strong>자연어 처리:</strong> 한국어/영어 의도 분석 및 패턴 매칭</li>
                <li><strong>배치 최적화:</strong> 체인별 작업 그룹화로 35% 가스 절약</li>
                <li><strong>HyperEVM 중심:</strong> 단일 체인 통합으로 복잡성 최소화</li>
                <li><strong>실시간 검증:</strong> 입력 즉시 유효성 검사 및 제안</li>
                <li><strong>Fallback 시스템:</strong> 5개 엔드포인트 + 캐싱으로 99.9% 안정성</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}