// lib/middleware/privy-session.ts
// Simplified session management using Privy's built-in features

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@privy-io/server-auth';
import { auditLogger } from '@/lib/security/audit-logger';

interface SessionInfo {
  isValid: boolean;
  user?: any;
  sessionData?: {
    sessionId: string;
    createdAt: Date;
    lastActivity: Date;
    ipAddress: string;
    userAgent: string;
    isExpired: boolean;
    expiresAt: Date;
  };
  error?: string;
}

/**
 * Get session information from Privy token
 * Privy handles session management internally, we just extract info
 */
export async function getPrivySessionInfo(request: NextRequest): Promise<SessionInfo> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        isValid: false,
        error: 'No authorization token provided'
      };
    }

    const token = authHeader.substring(7);

    // Development bypass
    if (process.env.NODE_ENV === 'development' && token === 'dev-token') {
      return {
        isValid: true,
        user: { id: '550e8400-e29b-41d4-a716-446655440000', email: 'dev@example.com' },
        sessionData: {
          sessionId: 'dev-session',
          createdAt: new Date(),
          lastActivity: new Date(),
          ipAddress: getClientIp(request),
          userAgent: request.headers.get('user-agent') || '',
          isExpired: false,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      };
    }

    // Verify the Privy token
    const verifiedClaims = await verifyAuthToken(
      token,
      process.env.PRIVY_APP_SECRET!
    );

    if (!verifiedClaims || !verifiedClaims.userId) {
      return {
        isValid: false,
        error: 'Invalid or expired token'
      };
    }

    // Extract session information from Privy token
    const sessionData = {
      sessionId: verifiedClaims.sessionId || verifiedClaims.jti || 'unknown',
      createdAt: verifiedClaims.iat ? new Date(verifiedClaims.iat * 1000) : new Date(),
      lastActivity: new Date(), // Current request time
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent') || '',
      isExpired: verifiedClaims.exp ? Date.now() / 1000 > verifiedClaims.exp : false,
      expiresAt: verifiedClaims.exp ? new Date(verifiedClaims.exp * 1000) : new Date()
    };

    // Log session activity (simplified)
    await auditLogger.logApiAccess({
      endpoint: new URL(request.url).pathname,
      method: request.method,
      outcome: 'success',
      responseCode: 200,
      userId: verifiedClaims.userId,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent
    });

    return {
      isValid: true,
      user: verifiedClaims,
      sessionData
    };

  } catch (_error) {
    console.error('❌ Session verification failed:', _error);
    return {
      isValid: false,
      error: 'Session verification failed'
    };
  }
}

/**
 * Simplified session validation middleware
 * Privy handles most session logic internally
 */
export async function validatePrivySession(request: NextRequest): Promise<{
  isValid: boolean;
  user?: any;
  response?: NextResponse;
}> {
  const sessionInfo = await getPrivySessionInfo(request);

  if (!sessionInfo.isValid) {
    return {
      isValid: false,
      response: NextResponse.json(
        { success: false, error: sessionInfo.error || 'Invalid session' },
        { status: 401 }
      )
    };
  }

  if (sessionInfo.sessionData?.isExpired) {
    return {
      isValid: false,
      response: NextResponse.json(
        { success: false, error: 'Session expired' },
        { status: 401 }
      )
    };
  }

  return {
    isValid: true,
    user: sessionInfo.user
  };
}

/**
 * Create logout handler that works with Privy
 */
export async function handlePrivyLogout(request: NextRequest): Promise<NextResponse> {
  try {
    const sessionInfo = await getPrivySessionInfo(request);

    if (sessionInfo.isValid && sessionInfo.user) {
      // Log the logout event
      await auditLogger.logAuthentication({
        action: 'logout',
        outcome: 'success',
        userId: sessionInfo.user.userId,
        ipAddress: sessionInfo.sessionData?.ipAddress || 'unknown',
        userAgent: sessionInfo.sessionData?.userAgent || '',
        additionalData: {
          sessionId: sessionInfo.sessionData?.sessionId,
          sessionDuration: sessionInfo.sessionData ? 
            Date.now() - sessionInfo.sessionData.createdAt.getTime() : 0
        }
      });
    }

    // Privy handles token invalidation on the client side
    // Server-side logout is just for logging and cleanup
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (_error) {
    console.error('❌ Logout handling failed:', _error);
    return NextResponse.json(
      { success: false, error: 'Logout failed' },
      { status: 500 }
    );
  }
}

/**
 * Get session statistics for monitoring
 */
export async function getSessionStatistics(): Promise<{
  activeSessions: number;
  averageSessionDuration: number;
  sessionsByHour: number[];
  topUserAgents: string[];
  topIpAddresses: string[];
}> {
  try {
    // Since we're using Privy's session management, we get this data from audit logs
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // This would query audit logs to get session statistics
    // For now, return mock data
    return {
      activeSessions: 0,
      averageSessionDuration: 0,
      sessionsByHour: new Array(24).fill(0),
      topUserAgents: [],
      topIpAddresses: []
    };
  } catch (_error) {
    console.error('❌ Failed to get session statistics:', _error);
    return {
      activeSessions: 0,
      averageSessionDuration: 0,
      sessionsByHour: new Array(24).fill(0),
      topUserAgents: [],
      topIpAddresses: []
    };
  }
}

/**
 * Security check for suspicious session activity
 */
export async function checkSessionSecurity(request: NextRequest): Promise<{
  isSuspicious: boolean;
  reasons: string[];
  riskScore: number;
}> {
  try {
    const sessionInfo = await getPrivySessionInfo(request);
    
    if (!sessionInfo.isValid || !sessionInfo.sessionData) {
      return {
        isSuspicious: false,
        reasons: [],
        riskScore: 0
      };
    }

    const reasons: string[] = [];
    let riskScore = 0;

    // Check for suspicious patterns
    const { sessionData, user } = sessionInfo;

    // Check for rapid requests (basic rate limiting check)
    // This would be more sophisticated in a real implementation
    
    // Check for unusual user agent
    const userAgent = sessionData.userAgent.toLowerCase();
    if (userAgent.includes('bot') || userAgent.includes('crawler')) {
      reasons.push('Suspicious user agent detected');
      riskScore += 30;
    }

    // Check for multiple IPs (would require session history)
    // This would check if the user has been using different IPs recently
    
    // Check session duration
    const sessionDuration = Date.now() - sessionData.createdAt.getTime();
    const maxSessionDuration = 24 * 60 * 60 * 1000; // 24 hours
    
    if (sessionDuration > maxSessionDuration) {
      reasons.push('Unusually long session duration');
      riskScore += 20;
    }

    return {
      isSuspicious: riskScore >= 50,
      reasons,
      riskScore
    };

  } catch (_error) {
    console.error('❌ Session security check failed:', _error);
    return {
      isSuspicious: false,
      reasons: ['Security check failed'],
      riskScore: 0
    };
  }
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  return forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown';
}

// Export utility functions
export const getSessionInfo = getPrivySessionInfo;
export const validateSession = validatePrivySession;
export const handleLogout = handlePrivyLogout;