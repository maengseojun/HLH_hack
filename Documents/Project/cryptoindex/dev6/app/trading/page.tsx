'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
// Dynamic import workaround for Privy hooks
const { usePrivy } = require('@privy-io/react-auth')
import TradingLayout from '@/components/trading/TradingLayout'

export default function TradingPage() {
  const { user, authenticated, ready } = usePrivy()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  // 인증 체크
  useEffect(() => {
    if (ready) {
      if (!authenticated) {
        router.push('/privy-login')
      } else {
        setIsLoading(false)
      }
    }
  }, [authenticated, ready, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!authenticated || !user) {
    return null // 리다이렉트 중
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <TradingLayout />
    </div>
  )
}