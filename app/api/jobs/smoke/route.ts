import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const traceId = crypto.randomUUID();
  const startTime = Date.now();

  // Only run in production/preview or when explicitly requested
  const isScheduled = request.headers.get('x-vercel-cron') === '1';
  const isManual = request.nextUrl.searchParams.get('manual') === 'true';

  if (!isScheduled && !isManual) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log(`[SMOKE] Starting smoke test - traceId: ${traceId}`);

    const results = await runSmokeTest(traceId);

    const smokeResult = {
      status: results.success ? 'passed' : 'failed',
      timestamp: new Date().toISOString(),
      traceId,
      results,
      latency_ms: Date.now() - startTime,
      environment: process.env.VERCEL_ENV || 'development'
    };

    console.log(`[SMOKE] Completed - Status: ${smokeResult.status}, Latency: ${smokeResult.latency_ms}ms`);

    return NextResponse.json(smokeResult, {
      status: results.success ? 200 : 500,
      headers: {
        'X-Trace-ID': traceId,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error(`[SMOKE] Error - traceId: ${traceId}`, error);

    const errorResponse = {
      status: 'error',
      timestamp: new Date().toISOString(),
      traceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      latency_ms: Date.now() - startTime
    };

    return NextResponse.json(errorResponse, {
      status: 500,
      headers: {
        'X-Trace-ID': traceId,
        'Cache-Control': 'no-store'
      }
    });
  }
}

async function runSmokeTest(traceId: string) {
  const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
  const authToken = process.env.DEMO_BEARER_TOKEN || 'test_token_for_testnet_e2e';

  const steps = {
    assets: false,
    basket_calculation: false,
    hyperliquid_api: false
  };

  try {
    // Step 1: Test assets endpoint
    console.log(`[SMOKE] ${traceId} - Testing assets endpoint`);
    const assetsResponse = await fetch(`${backendUrl}/v1/assets`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      signal: AbortSignal.timeout(10000)
    });

    if (assetsResponse.ok) {
      const assets = await assetsResponse.json();
      steps.assets = Array.isArray(assets) && assets.length > 0;
      console.log(`[SMOKE] ${traceId} - Assets: ${steps.assets ? 'PASS' : 'FAIL'} (${assets.length} assets)`);
    }

    // Step 2: Test basket calculation with minimal valid data
    console.log(`[SMOKE] ${traceId} - Testing basket calculation`);
    const basketResponse = await fetch(`${backendUrl}/v1/baskets/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        interval: '1h',
        assets: [
          { symbol: 'BTC', weight: 0.5, position: 'long', leverage: 1 },
          { symbol: 'ETH', weight: 0.5, position: 'long', leverage: 1 }
        ]
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (basketResponse.ok) {
      const basketData = await basketResponse.json();
      steps.basket_calculation = basketData && typeof basketData === 'object';
      console.log(`[SMOKE] ${traceId} - Basket calculation: ${steps.basket_calculation ? 'PASS' : 'FAIL'}`);
    } else {
      console.log(`[SMOKE] ${traceId} - Basket calculation: FAIL (${basketResponse.status})`);
    }

    // Step 3: Test HyperLiquid API directly
    console.log(`[SMOKE] ${traceId} - Testing HyperLiquid API`);
    const hlResponse = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      signal: AbortSignal.timeout(10000)
    });

    if (hlResponse.ok) {
      const hlData = await hlResponse.json();
      steps.hyperliquid_api = Array.isArray(hlData) && hlData.length >= 2;
      console.log(`[SMOKE] ${traceId} - HyperLiquid API: ${steps.hyperliquid_api ? 'PASS' : 'FAIL'}`);
    }

  } catch (error) {
    console.error(`[SMOKE] ${traceId} - Step failed:`, error);
  }

  const success = Object.values(steps).every(step => step === true);

  return {
    success,
    steps,
    passed_count: Object.values(steps).filter(Boolean).length,
    total_count: Object.keys(steps).length
  };
}