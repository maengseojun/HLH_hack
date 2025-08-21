import { NextRequest, NextResponse } from 'next/server';
import { extractPrivyAuthFromRequest } from '@/lib/middleware/privy-auth';

// GET /api/trading/v2/route-recommendation - V2 라우팅 추천
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await extractPrivyAuthFromRequest(request);
    if (!authResult.authenticated) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const pair = searchParams.get('pair') || 'HYPERINDEX-USDC';
    const side = searchParams.get('side') as 'buy' | 'sell' || 'buy';
    const amount = searchParams.get('amount') || '0';

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    console.log('🎯 V2 Route recommendation request:', { pair, side, amount });

    // V2 HybridSmartRouter 사용
    const { HybridSmartRouterV2 } = await import('@/lib/trading/smart-router-v2');
    const smartRouterV2 = HybridSmartRouterV2.getInstance();
    
    // 최적 라우팅 추천 조회
    const recommendation = await smartRouterV2.getOptimalRoute(pair, side, amount);

    console.log('✅ V2 Route recommendation:', recommendation);

    return NextResponse.json({
      success: true,
      pair,
      side,
      amount,
      recommendation,
      timestamp: Date.now()
    });

  } catch (_error) {
    console.error('❌ V2 Route recommendation error:', _error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get route recommendation',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}