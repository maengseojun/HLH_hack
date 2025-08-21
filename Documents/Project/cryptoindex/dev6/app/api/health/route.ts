// app/api/health/route.ts - Enhanced Trading System Health Check
import { NextRequest, NextResponse } from 'next/server';
import { checkRedisHealth, getRedisInfo } from '@/lib/redis/client';
import { ParallelMatchingEngine } from '@/lib/orderbook/parallel-matching-engine';
import { createClient } from '@supabase/supabase-js';

export async function GET(_request: NextRequest) {
  const startTime = Date.now();
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV,
    services: {} as Record<string, { status: string; message?: string; uptime?: number; responseTime?: string; info?: any; error?: string; orderbookBids?: number; orderbookAsks?: number }>,
    performance: {} as Record<string, number | string>,
    config: {} as Record<string, string | boolean | number>,
    errors: [] as string[]
  };

  try {
    // 1. Redis Health Check
    const redisStart = Date.now();
    const redisHealthy = await checkRedisHealth();
    const redisTime = Date.now() - redisStart;
    
    if (redisHealthy) {
      const redisInfo = await getRedisInfo();
      healthCheck.services.redis = {
        status: 'healthy',
        responseTime: `${redisTime}ms`,
        info: redisInfo
      };
    } else {
      healthCheck.services.redis = {
        status: 'unhealthy',
        responseTime: `${redisTime}ms`,
        error: 'Redis connection failed'
      };
      healthCheck.errors.push('Redis connection failed');
    }

    // 2. Supabase Health Check
    const supabaseStart = Date.now();
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing');
      }
      
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { error } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      const supabaseTime = Date.now() - supabaseStart;
      
      if (!error) {
        healthCheck.services.supabase = {
          status: 'healthy',
          responseTime: `${supabaseTime}ms`,
        };
      } else {
        throw _error;
      }
    } catch (_error) {
      const supabaseTime = Date.now() - supabaseStart;
      healthCheck.services.supabase = {
        status: 'unhealthy',
        responseTime: `${supabaseTime}ms`,
        error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
      };
      healthCheck.errors.push('Supabase connection failed');
    }

    // 3. Matching Engine Health Check
    const engineStart = Date.now();
    try {
      const matchingEngine = ParallelMatchingEngine.getInstance();
      const testOrderbook = await matchingEngine.getOrderbook('HYPERINDEX-USDC', 1);
      const engineTime = Date.now() - engineStart;
      
      healthCheck.services.matchingEngine = {
        status: 'healthy',
        responseTime: `${engineTime}ms`,
        orderbookBids: testOrderbook.bids.length,
        orderbookAsks: testOrderbook.asks.length
      };
    } catch (_error) {
      const engineTime = Date.now() - engineStart;
      healthCheck.services.matchingEngine = {
        status: 'unhealthy',
        responseTime: `${engineTime}ms`,
        error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
      };
      healthCheck.errors.push('Matching Engine failed');
    }

    // 4. Environment Configuration Check
    healthCheck.config = {
      redis: !!process.env.REDIS_URL,
      supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      privy: !!process.env.NEXT_PUBLIC_PRIVY_APP_ID && !!process.env.PRIVY_APP_SECRET,
      hypervm: !!process.env.HYPERVM_TESTNET_RPC,
      allConfigured: true // Will be calculated below
    };
    
    healthCheck.config.allConfigured = Object.values(healthCheck.config).every(Boolean);

    // 5. Performance Metrics
    const totalTime = Date.now() - startTime;
    healthCheck.performance = {
      totalResponseTime: `${totalTime}ms`,
      redisLatency: healthCheck.services.redis.responseTime,
      supabaseLatency: healthCheck.services.supabase.responseTime,
      matchingEngineLatency: healthCheck.services.matchingEngine.responseTime,
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      uptime: `${Math.floor(process.uptime())}s`
    };

    // 6. Overall Status
    const hasErrors = healthCheck.errors.length > 0;
    const configIncomplete = !healthCheck.config.allConfigured;
    
    if (hasErrors) {
      healthCheck.status = 'unhealthy';
    } else if (configIncomplete) {
      healthCheck.status = 'degraded';
    } else {
      healthCheck.status = 'healthy';
    }

    const statusCode = hasErrors ? 503 : (configIncomplete ? 206 : 200);
    
    return NextResponse.json(healthCheck, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': 'v2',
        'X-Response-Time': `${totalTime}ms`
      }
    });

  } catch (_error) {
    console.error('Health check failed:', _error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error',
      responseTime: `${Date.now() - startTime}ms`
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': 'v2'
      }
    });
  }
}
