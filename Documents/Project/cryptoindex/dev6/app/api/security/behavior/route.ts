// app/api/security/behavior/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePrivyAuth } from '@/lib/middleware/privy-auth';
import { behaviorAnalyzer, analyzeBehaviorPatterns, detectBehaviorAnomalies } from '@/lib/security/behavior-analyzer';
import { auditLogger } from '@/lib/security/audit-logger';
import { rateLimit } from '@/lib/utils/rate-limit';

/**
 * POST /api/security/behavior
 * 
 * Actions:
 * - start_session: Initialize behavior tracking for a session
 * - track_activity: Track user activity within a session
 * - end_session: End behavior tracking and perform analysis
 * - analyze_patterns: Analyze user behavior patterns over time
 * - detect_anomalies: Detect behavioral anomalies in real-time
 * - get_profile: Get user behavior profile
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, 'behavior_api', 100, 60); // 100 requests per minute
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if ('status' in authResult) {
      return authResult;
    }

    const body = await request.json();
    const { action, ...params } = body;
    const userId = authResult.user.id;
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Log API access
    await auditLogger.logApiAccess({
      endpoint: '/api/security/behavior',
      method: 'POST',
      outcome: 'success',
      responseCode: 200,
      userId,
      ipAddress,
      userAgent,
      requestData: { action }
    });

    switch (action) {
      case 'start_session':
        return await handleStartSession(userId, params, ipAddress, userAgent);
      
      case 'track_activity':
        return await handleTrackActivity(params);
      
      case 'end_session':
        return await handleEndSession(params);
      
      case 'analyze_patterns':
        return await handleAnalyzePatterns(userId, params);
      
      case 'detect_anomalies':
        return await handleDetectAnomalies(userId, params);
      
      case 'get_profile':
        return await handleGetProfile(userId);
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (_error) {
    console.error('❌ Behavior API error:', _error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/security/behavior
 * Get behavior analysis summary
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, 'behavior_api', 50, 60); // 50 requests per minute
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if ('status' in authResult) {
      return authResult;
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const userId = authResult.user.id;

    switch (action) {
      case 'summary':
        return await handleGetSummary(userId);
      
      case 'alerts':
        return await handleGetAlerts(userId);
      
      case 'sessions':
        return await handleGetSessions(userId, url.searchParams);
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (_error) {
    console.error('❌ Behavior API GET error:', _error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handler functions

async function handleStartSession(
  userId: string,
  params: any,
  ipAddress: string,
  userAgent: string
) {
  try {
    const { sessionId, deviceFingerprint, geolocation } = params;
    
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    await behaviorAnalyzer.startSession(userId, sessionId, {
      ipAddress,
      userAgent,
      deviceFingerprint,
      geolocation
    });

    return NextResponse.json({
      success: true,
      message: 'Behavior tracking started',
      sessionId
    });
  } catch (_error) {
    console.error('❌ Failed to start session:', _error);
    return NextResponse.json(
      { success: false, error: 'Failed to start behavior tracking' },
      { status: 500 }
    );
  }
}

async function handleTrackActivity(params: any) {
  try {
    const { sessionId, activity } = params;
    
    if (!sessionId || !activity) {
      return NextResponse.json(
        { success: false, error: 'Session ID and activity are required' },
        { status: 400 }
      );
    }

    await behaviorAnalyzer.trackActivity(sessionId, activity);

    return NextResponse.json({
      success: true,
      message: 'Activity tracked'
    });
  } catch (_error) {
    console.error('❌ Failed to track activity:', _error);
    return NextResponse.json(
      { success: false, error: 'Failed to track activity' },
      { status: 500 }
    );
  }
}

async function handleEndSession(params: any) {
  try {
    const { sessionId } = params;
    
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    await behaviorAnalyzer.endSession(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Behavior tracking ended'
    });
  } catch (_error) {
    console.error('❌ Failed to end session:', _error);
    return NextResponse.json(
      { success: false, error: 'Failed to end behavior tracking' },
      { status: 500 }
    );
  }
}

async function handleAnalyzePatterns(userId: string, params: any) {
  try {
    const { timeframe } = params;
    
    const defaultTimeframe = {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: new Date()
    };

    const analysisTimeframe = timeframe || defaultTimeframe;
    
    const analysis = await analyzeBehaviorPatterns(userId, {
      start: new Date(analysisTimeframe.start),
      end: new Date(analysisTimeframe.end)
    });

    return NextResponse.json({
      success: true,
      analysis
    });
  } catch (_error) {
    console.error('❌ Failed to analyze patterns:', _error);
    return NextResponse.json(
      { success: false, error: 'Failed to analyze behavior patterns' },
      { status: 500 }
    );
  }
}

async function handleDetectAnomalies(userId: string, params: any) {
  try {
    const { currentActivity } = params;
    
    if (!currentActivity) {
      return NextResponse.json(
        { success: false, error: 'Current activity is required' },
        { status: 400 }
      );
    }

    const anomalies = await detectBehaviorAnomalies(userId, currentActivity);

    return NextResponse.json({
      success: true,
      anomalies: anomalies.map(anomaly => ({
        id: anomaly.id,
        type: anomaly.alertType,
        severity: anomaly.severity,
        title: anomaly.title,
        description: anomaly.description,
        confidence: anomaly.confidence,
        createdAt: anomaly.createdAt
      }))
    });
  } catch (_error) {
    console.error('❌ Failed to detect anomalies:', _error);
    return NextResponse.json(
      { success: false, error: 'Failed to detect anomalies' },
      { status: 500 }
    );
  }
}

async function handleGetProfile(userId: string) {
  try {
    // Generate ML features for the user
    const mlFeatures = await behaviorAnalyzer.generateMLFeatures(userId);

    return NextResponse.json({
      success: true,
      profile: {
        userId,
        mlFeatures,
        lastUpdated: new Date()
      }
    });
  } catch (_error) {
    console.error('❌ Failed to get profile:', _error);
    return NextResponse.json(
      { success: false, error: 'Failed to get behavior profile' },
      { status: 500 }
    );
  }
}

async function handleGetSummary(_userId: string) {
  try {
    // This would fetch summary data from the database
    const summary = {
      totalSessions: 0,
      averageSessionDuration: 0,
      anomaliesDetected: 0,
      riskScore: 0,
      profileType: 'normal',
      lastActivity: new Date()
    };

    return NextResponse.json({
      success: true,
      summary
    });
  } catch (_error) {
    console.error('❌ Failed to get summary:', _error);
    return NextResponse.json(
      { success: false, error: 'Failed to get behavior summary' },
      { status: 500 }
    );
  }
}

async function handleGetAlerts(_userId: string) {
  try {
    // This would fetch alerts from the database
    const alerts: any[] = [];

    return NextResponse.json({
      success: true,
      alerts
    });
  } catch (_error) {
    console.error('❌ Failed to get alerts:', _error);
    return NextResponse.json(
      { success: false, error: 'Failed to get behavior alerts' },
      { status: 500 }
    );
  }
}

async function handleGetSessions(userId: string, searchParams: URLSearchParams) {
  try {
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // This would fetch session data from the database
    const sessions: any[] = [];

    return NextResponse.json({
      success: true,
      sessions,
      pagination: {
        limit,
        offset,
        total: 0,
        hasMore: false
      }
    });
  } catch (_error) {
    console.error('❌ Failed to get sessions:', _error);
    return NextResponse.json(
      { success: false, error: 'Failed to get sessions' },
      { status: 500 }
    );
  }
}