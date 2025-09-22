import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const traceId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const checks = {
      backend: await checkBackendAPI(),
      hyperliquid: await checkHyperLiquidAPI(),
      environment: checkEnvironmentVars()
    };

    const allHealthy = Object.values(checks).every(check => check.status === 'healthy');

    const readiness = {
      status: allHealthy ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      traceId,
      checks,
      latency_ms: Date.now() - startTime
    };

    return NextResponse.json(readiness, {
      status: allHealthy ? 200 : 503,
      headers: {
        'X-Trace-ID': traceId,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    const errorResponse = {
      status: 'error',
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

async function checkBackendAPI() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/v1/assets`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.DEMO_BEARER_TOKEN || 'test_token_for_testnet_e2e'}`
      },
      signal: AbortSignal.timeout(5000)
    });

    return {
      status: response.ok ? 'healthy' : 'unhealthy',
      latency_ms: Date.now(),
      details: response.ok ? 'API responding' : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: error instanceof Error ? error.message : 'Backend unreachable'
    };
  }
}

async function checkHyperLiquidAPI() {
  try {
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      signal: AbortSignal.timeout(5000)
    });

    return {
      status: response.ok ? 'healthy' : 'unhealthy',
      latency_ms: Date.now(),
      details: response.ok ? 'HyperLiquid API responding' : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: error instanceof Error ? error.message : 'HyperLiquid unreachable'
    };
  }
}

function checkEnvironmentVars() {
  const required = [
    'NEXT_PUBLIC_API_BASE_URL',
    'DEMO_BEARER_TOKEN'
  ];

  const missing = required.filter(env => !process.env[env]);

  return {
    status: missing.length === 0 ? 'healthy' : 'unhealthy',
    details: missing.length === 0 ? 'All env vars present' : `Missing: ${missing.join(', ')}`
  };
}