import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Check if critical services are ready
    const checks = {
      environment: !!process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({
      status: 'ready',
      checks,
      service: 'hlh-frontend'
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'not ready',
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'hlh-frontend'
      },
      { status: 503 }
    )
  }
}

export async function POST() {
  return GET()
}