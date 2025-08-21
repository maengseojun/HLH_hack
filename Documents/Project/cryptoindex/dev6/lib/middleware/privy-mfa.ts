// lib/middleware/privy-mfa.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@privy-io/server-auth';
import { auditLogger } from '@/lib/security/audit-logger';

interface PrivyMfaConfig {
  requireMfa: boolean;
  allowedMethods: string[];
  gracePeriodHours?: number;
  bypassRoles?: string[];
}

interface MfaVerificationResult {
  isAuthenticated: boolean;
  isMfaRequired: boolean;
  isMfaCompleted: boolean;
  user?: any;
  response?: NextResponse;
  mfaMethods?: string[];
}

export async function verifyPrivyMfaAuth(
  request: NextRequest,
  config: PrivyMfaConfig = {
    requireMfa: true,
    allowedMethods: ['totp', 'sms']
  }
): Promise<MfaVerificationResult> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        isAuthenticated: false,
        isMfaRequired: false,
        isMfaCompleted: false,
        response: NextResponse.json(
          { success: false, error: 'No authorization token provided' },
          { status: 401 }
        )
      };
    }

    const token = authHeader.substring(7);

    // Development bypass
    if (process.env.NODE_ENV === 'development' && token === 'dev-token') {
      console.log('🚧 Development mode: bypassing auth');
      return {
        isAuthenticated: true,
        isMfaRequired: false,
        isMfaCompleted: true,
        user: { id: '550e8400-e29b-41d4-a716-446655440000', email: 'dev@example.com' }
      };
    }

    // Verify the Privy token
    const verifiedClaims = await verifyAuthToken(
      token,
      process.env.PRIVY_APP_SECRET!
    );

    if (!verifiedClaims || !verifiedClaims.userId) {
      await auditLogger.logAuthentication({
        action: 'token_verification_failed',
        outcome: 'failure',
        ipAddress: getClientIp(request),
        userAgent: request.headers.get('user-agent') || '',
        errorMessage: 'Invalid or expired token'
      });

      return {
        isAuthenticated: false,
        isMfaRequired: false,
        isMfaCompleted: false,
        response: NextResponse.json(
          { success: false, error: 'Invalid or expired token' },
          { status: 401 }
        )
      };
    }

    // Extract MFA information from Privy token
    const mfaStatus = extractMfaStatus(verifiedClaims);
    
    // Check if MFA is required
    const isMfaRequired = shouldRequireMfa(verifiedClaims, config);
    
    // Check if MFA is completed (if required)
    const isMfaCompleted = !isMfaRequired || mfaStatus.isCompleted;

    // Log successful authentication
    await auditLogger.logAuthentication({
      action: 'token_verified',
      outcome: 'success',
      userId: verifiedClaims.userId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent') || '',
      additionalData: {
        mfaRequired: isMfaRequired,
        mfaCompleted: isMfaCompleted,
        mfaMethods: mfaStatus.methods
      }
    });

    if (isMfaRequired && !isMfaCompleted) {
      return {
        isAuthenticated: true,
        isMfaRequired: true,
        isMfaCompleted: false,
        user: verifiedClaims,
        mfaMethods: mfaStatus.availableMethods,
        response: NextResponse.json(
          { 
            success: false, 
            error: 'MFA verification required',
            mfaRequired: true,
            availableMethods: mfaStatus.availableMethods
          },
          { status: 403 }
        )
      };
    }

    return {
      isAuthenticated: true,
      isMfaRequired,
      isMfaCompleted,
      user: verifiedClaims,
      mfaMethods: mfaStatus.methods
    };

  } catch (_error) {
    console.error('❌ Privy MFA verification failed:', _error);
    
    await auditLogger.logAuthentication({
      action: 'mfa_verification_error',
      outcome: 'failure',
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent') || '',
      errorMessage: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
    });

    return {
      isAuthenticated: false,
      isMfaRequired: false,
      isMfaCompleted: false,
      response: NextResponse.json(
        { success: false, error: 'Authentication verification failed' },
        { status: 500 }
      )
    };
  }
}

/**
 * Extract MFA status from Privy token claims
 */
function extractMfaStatus(claims: any): {
  isCompleted: boolean;
  methods: string[];
  availableMethods: string[];
  lastVerified?: Date;
} {
  // Privy includes MFA information in the token claims
  const mfaData = claims.mfa || {};
  
  return {
    isCompleted: mfaData.verified === true,
    methods: mfaData.methods || [],
    availableMethods: mfaData.availableMethods || ['totp', 'sms'],
    lastVerified: mfaData.verifiedAt ? new Date(mfaData.verifiedAt) : undefined
  };
}

/**
 * Determine if MFA should be required for this user/request
 */
function shouldRequireMfa(claims: any, config: PrivyMfaConfig): boolean {
  // Don't require MFA if not configured
  if (!config.requireMfa) {
    return false;
  }

  // Check if user has bypass role
  if (config.bypassRoles && claims.role && config.bypassRoles.includes(claims.role)) {
    return false;
  }

  // Check grace period for new users
  if (config.gracePeriodHours) {
    const userCreated = claims.createdAt ? new Date(claims.createdAt) : new Date();
    const gracePeriodEnd = new Date(userCreated.getTime() + config.gracePeriodHours * 60 * 60 * 1000);
    
    if (new Date() < gracePeriodEnd) {
      return false;
    }
  }

  // MFA is required
  return true;
}

/**
 * Get client IP address from request
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  return forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown';
}

/**
 * Create MFA enforcement middleware for specific routes
 */
export function createMfaMiddleware(config: PrivyMfaConfig) {
  return async (request: NextRequest) => {
    const result = await verifyPrivyMfaAuth(request, config);
    
    if (!result.isAuthenticated || !result.isMfaCompleted) {
      return result.response;
    }
    
    // Add user info to request headers for downstream handlers
    const response = NextResponse.next();
    response.headers.set('x-user-id', result.user.userId);
    response.headers.set('x-user-email', result.user.email || '');
    response.headers.set('x-mfa-verified', result.isMfaCompleted.toString());
    
    return response;
  };
}

/**
 * High-security operations requiring fresh MFA verification
 */
export async function requireFreshMfa(
  request: NextRequest,
  maxAgeMinutes: number = 5
): Promise<MfaVerificationResult> {
  const result = await verifyPrivyMfaAuth(request, {
    requireMfa: true,
    allowedMethods: ['totp', 'sms']
  });

  if (!result.isAuthenticated || !result.isMfaCompleted) {
    return result;
  }

  // Check if MFA verification is fresh enough
  const claims = result.user;
  const mfaVerifiedAt = claims.mfa?.verifiedAt ? new Date(claims.mfa.verifiedAt) : null;
  
  if (!mfaVerifiedAt) {
    return {
      ...result,
      isMfaCompleted: false,
      response: NextResponse.json(
        { 
          success: false, 
          error: 'Fresh MFA verification required',
          mfaRequired: true,
          reason: 'no_recent_verification'
        },
        { status: 403 }
      )
    };
  }

  const maxAge = maxAgeMinutes * 60 * 1000;
  const isStale = Date.now() - mfaVerifiedAt.getTime() > maxAge;

  if (isStale) {
    return {
      ...result,
      isMfaCompleted: false,
      response: NextResponse.json(
        { 
          success: false, 
          error: 'Fresh MFA verification required',
          mfaRequired: true,
          reason: 'stale_verification',
          lastVerified: mfaVerifiedAt.toISOString()
        },
        { status: 403 }
      )
    };
  }

  return result;
}

/**
 * Utility function to check if user has MFA enabled in Privy
 */
export async function checkPrivyMfaStatus(userId: string): Promise<{
  enabled: boolean;
  methods: string[];
  canEnable: boolean;
}> {
  try {
    // This would use Privy's Management API to check MFA status
    // For now, we'll return a placeholder
    return {
      enabled: false,
      methods: [],
      canEnable: true
    };
  } catch (_error) {
    console.error('❌ Failed to check Privy MFA status:', _error);
    return {
      enabled: false,
      methods: [],
      canEnable: false
    };
  }
}

// Export commonly used configurations
export const MFA_CONFIGS = {
  // Standard MFA for regular operations
  STANDARD: {
    requireMfa: true,
    allowedMethods: ['totp', 'sms'],
    gracePeriodHours: 24
  },
  
  // Strict MFA for sensitive operations
  STRICT: {
    requireMfa: true,
    allowedMethods: ['totp'],
    gracePeriodHours: 0
  },
  
  // Optional MFA for low-risk operations
  OPTIONAL: {
    requireMfa: false,
    allowedMethods: ['totp', 'sms', 'email'],
    gracePeriodHours: 168 // 1 week
  },
  
  // High-security operations
  HIGH_SECURITY: {
    requireMfa: true,
    allowedMethods: ['totp'],
    gracePeriodHours: 0,
    bypassRoles: [] // No bypasses for high security
  }
} as const;