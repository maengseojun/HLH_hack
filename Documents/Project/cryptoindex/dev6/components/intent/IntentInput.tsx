// components/intent/IntentInput.tsx
/**
 * Intent-Based UI Component
 * 사용자가 자연어로 인덱스 생성 의도를 입력
 */

'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle2, AlertCircle, Shield } from 'lucide-react'
import { processIntent, executeIntentPlan, type IntentExecutionPlan } from '@/lib/intent/intent-solver'
import { usePrivy } from '@privy-io/react-auth'

interface IntentInputProps {
  onSuccess?: (positionId: string) => void
  onError?: (error: string) => void
}

export default function IntentInput({ onSuccess, onError }: IntentInputProps) {
  const [intentText, setIntentText] = useState('')
  const [status, setStatus] = useState<'idle' | 'processing' | 'confirmed' | 'executing' | 'done' | 'error'>('idle')
  const [executionPlan, setExecutionPlan] = useState<IntentExecutionPlan | null>(null)
  const [positionId, setPositionId] = useState<string | null>(null)
  const { user } = usePrivy()

  // 예시 Intent 템플릿들
  const examples = [
    "1000 USDC로 밈코인 인덱스 만들어줘",
    "500달러로 WIF, BONK, POPCAT 균등분할해줘",
    "내 포지션 리밸런싱해줘",
    "2000 USDC로 안전한 인덱스 추천해줘"
  ]

  const handleSubmit = async () => {
    if (!intentText.trim()) return

    setStatus('processing')
    setExecutionPlan(null)

    try {
      console.log('🎯 Processing user intent:', intentText)

      // 1. Intent 파싱 및 실행 계획 생성
      const plan = await processIntent(intentText)
      setExecutionPlan(plan)

      console.log('📋 Execution plan generated:', plan)

      // 2. 실행 계획을 사용자에게 보여주고 확인 받기
      setStatus('confirmed')

    } catch (error) {
      console.error('❌ Intent processing error:', error)
      setStatus('error')
      
      if (onError) {
        onError(error instanceof Error ? error.message : 'Intent 처리 중 오류가 발생했습니다')
      }
    }
  }

  const handleExecute = async () => {
    if (!executionPlan || !user?.wallet?.address) return

    setStatus('executing')

    try {
      console.log('🚀 Executing intent plan...')

      // Privy auth token 가져오기
      const authToken = await user.getAccessToken?.() || 'dev-token'

      // 3. 실제 SCV 포지션 생성 실행
      const result = await executeIntentPlan(executionPlan, user.wallet.address, authToken)
      
      if (result.success && result.positionId) {
        setPositionId(result.positionId)
        setStatus('done')
        
        if (onSuccess) {
          onSuccess(result.positionId)
        }
      } else {
        throw new Error(result.message || '실행 중 오류가 발생했습니다')
      }

    } catch (error) {
      console.error('❌ Intent execution error:', error)
      setStatus('error')
      
      if (onError) {
        onError(error instanceof Error ? error.message : '실행 중 오류가 발생했습니다')
      }
    }
  }

  const handleExampleClick = (example: string) => {
    setIntentText(example)
    setStatus('idle')
    setExecutionPlan(null)
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Intent 입력 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🎯 간단한 말로 원하는 인덱스를 만들어보세요
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 예시 버튼들 */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-600">예시:</span>
            {examples.map((example, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleExampleClick(example)}
                className="text-xs"
              >
                {example}
              </Button>
            ))}
          </div>

          {/* Intent 입력 텍스트박스 */}
          <Textarea
            value={intentText}
            onChange={(e) => setIntentText(e.target.value)}
            placeholder="예: 1000 USDC로 밈코인 3종 균등 분배해줘"
            rows={3}
            className="w-full"
          />

          {/* 실행 버튼 */}
          <Button
            onClick={handleSubmit}
            disabled={!intentText.trim() || status === 'processing'}
            className="w-full"
            size="lg"
          >
            {status === 'processing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {status === 'processing' ? 'AI가 최적 전략을 분석 중...' : '전략 분석하기'}
          </Button>
        </CardContent>
      </Card>

      {/* 실행 계획 표시 */}
      {executionPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {status === 'done' ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : status === 'executing' ? (
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              ) : (
                <AlertCircle className="h-5 w-5 text-orange-500" />
              )}
              실행 계획
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium">투자 금액:</span>
                  <span className="ml-2">{executionPlan.investmentAmount} USDC</span>
                </div>
                <div>
                  <span className="font-medium">선택 인덱스:</span>
                  <span className="ml-2">{executionPlan.indexId}</span>
                </div>
              </div>

              <div>
                <span className="font-medium">토큰 구성:</span>
                <ul className="mt-1 ml-4">
                  {executionPlan.tokenAllocation.map((token, index) => (
                    <li key={index} className="text-sm">
                      • {token.symbol}: {token.percentage}% ({token.chain} 체인)
                    </li>
                  ))}
                </ul>
              </div>

              <div className="text-sm text-gray-600">
                <span className="font-medium">예상 실행 시간:</span>
                <span className="ml-2">{executionPlan.estimatedTime}</span>
              </div>

              <div className="text-sm text-gray-600">
                <span className="font-medium">예상 가스비:</span>
                <span className="ml-2">{executionPlan.estimatedGas}</span>
              </div>

              {/* MEV 보호 정보 */}
              {executionPlan.mevProtection && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-800">MEV 보호</span>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-blue-700">
                    <div>
                      <span>보호 방식: </span>
                      <span className="font-medium">{executionPlan.mevProtection.protectionMethod}</span>
                    </div>
                    <div>
                      <span>예상 절약: </span>
                      <span className="font-medium text-green-600">{executionPlan.mevProtection.estimatedSavings}</span>
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      {executionPlan.mevProtection.enabled 
                        ? '샌드위치 공격으로부터 보호됩니다' 
                        : '소액 거래로 MEV 보호가 비활성화됩니다'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 확인 및 실행 버튼 */}
            {status === 'confirmed' && (
              <div className="mt-4 space-y-2">
                <Button
                  onClick={handleExecute}
                  disabled={!user?.wallet?.address}
                  className="w-full"
                  size="lg"
                >
                  실제 포지션 생성하기
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  {!user?.wallet?.address && "지갑을 연결해주세요"}
                </p>
              </div>
            )}

            {/* 실행 중 표시 */}
            {status === 'executing' && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="font-medium">포지션 생성 중...</span>
                </div>
                <p className="text-sm text-blue-600 mt-1">
                  크로스체인 거래를 실행하고 있습니다. 잠시만 기다려주세요.
                </p>
              </div>
            )}

            {/* 완료 표시 */}
            {status === 'done' && positionId && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">포지션 생성 완료!</span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  포지션 ID: {positionId}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 에러 표시 */}
      {status === 'error' && (
        <Card className="border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">처리 중 오류가 발생했습니다</span>
            </div>
            <p className="text-sm text-red-600 mt-1">
              다시 시도하거나 더 구체적으로 입력해주세요.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}