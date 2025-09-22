import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // 토큰 검증
    const auth = request.headers.get('authorization') || ''
    const expectedToken = `Bearer ${process.env.JOB_TOKEN || 'dev-smoke-token'}`

    if (auth !== expectedToken) {
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401 }
      )
    }

    // 스모크 테스트 실행
    const smokeResult = await runSmokeTest()

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      result: smokeResult
    })

  } catch (error) {
    console.error('Smoke test failed:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}

async function runSmokeTest() {
  const results = []

  try {
    // 1. Health check
    results.push('✅ API endpoint accessible')

    // 2. Environment check
    const hasRequiredEnvs = process.env.NEXT_PUBLIC_API_BASE_URL && process.env.HYPERLIQUID_API_URL
    results.push(hasRequiredEnvs ? '✅ Environment variables configured' : '⚠️ Missing environment variables')

    // 3. Basic API test (if backend URL is available)
    if (process.env.NEXT_PUBLIC_API_BASE_URL) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/healthz`, {
          method: 'GET',
          timeout: 10000
        })

        if (response.ok) {
          results.push('✅ Backend health check passed')
        } else {
          results.push(`⚠️ Backend health check failed: ${response.status}`)
        }
      } catch (err) {
        results.push(`⚠️ Backend connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    // 4. External API test (Hyperliquid)
    if (process.env.HYPERLIQUID_API_URL) {
      try {
        const response = await fetch(`${process.env.HYPERLIQUID_API_URL}/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'meta' }),
          timeout: 10000
        })

        if (response.ok) {
          results.push('✅ Hyperliquid API accessible')
        } else {
          results.push(`⚠️ Hyperliquid API failed: ${response.status}`)
        }
      } catch (err) {
        results.push(`⚠️ Hyperliquid API connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    results.push('✅ Smoke test completed')
    return results

  } catch (error) {
    results.push(`❌ Smoke test error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}