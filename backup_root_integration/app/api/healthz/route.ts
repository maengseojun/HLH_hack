import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const traceId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Basic health indicators
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      traceId,
      service: 'CoreIndex',
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'unknown',
      environment: process.env.VERCEL_ENV || 'development',
      uptime: process.uptime?.() || 'unknown'
    };

    return NextResponse.json(health, {
      status: 200,
      headers: {
        'X-Trace-ID': traceId,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    const errorResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      traceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      latency_ms: Date.now() - startTime
    };

    return NextResponse.json(errorResponse, {
      status: 503,
      headers: {
        'X-Trace-ID': traceId,
        'Cache-Control': 'no-store'
      }
    });
  }
}