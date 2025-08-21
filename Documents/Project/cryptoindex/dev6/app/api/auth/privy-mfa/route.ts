// app/api/auth/privy-mfa/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyPrivyMfaAuth, checkPrivyMfaStatus } from '@/lib/middleware/privy-mfa';
import { auditLogger } from '@/lib/security/audit-logger';

/**
 * GET /api/auth/privy-mfa
 * Get user's Privy MFA status and available methods
 */
export async function GET(request: NextRequest) {
  try {
    // Basic auth check (without MFA requirement for this endpoint)
    const authResult = await verifyPrivyMfaAuth(request, {
      requireMfa: false,
      allowedMethods: ['totp', 'sms', 'email']
    });

    if ('status' in authResult) {
      return authResult;
    }

    const { user } = authResult;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    switch (action) {
      case 'status':
        return await handleGetMfaStatus(user);
      
      case 'methods':
        return await handleGetAvailableMethods(user);
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (_error) {
    console.error('❌ Privy MFA GET error:', _error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/privy-mfa
 * Trigger MFA verification or manage MFA settings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, method, phoneNumber } = body;

    // Basic auth check
    const authResult = await verifyPrivyMfaAuth(request, {
      requireMfa: false,
      allowedMethods: ['totp', 'sms', 'email']
    });

    if ('status' in authResult) {
      return authResult;
    }

    const { user } = authResult;
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || '';

    // Log the MFA action attempt
    await auditLogger.logAuthentication({
      action: 'mfa_setup' as const,
      outcome: 'success',
      userId: user.userId,
      ipAddress,
      userAgent,
      additionalData: { method, action }
    });

    switch (action) {
      case 'enable':
        return await handleEnableMfa(user, method, phoneNumber);
      
      case 'disable':
        return await handleDisableMfa(user);
      
      case 'send_code':
        return await handleSendMfaCode(user, method);
      
      case 'verify_code':
        return await handleVerifyMfaCode(user, body.code, method);
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (_error) {
    console.error('❌ Privy MFA POST error:', _error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleGetMfaStatus(user: any) {
  try {
    const mfaStatus = await checkPrivyMfaStatus(user.userId);
    
    // Extract MFA info from Privy user object
    const userMfaInfo = {
      enabled: user.mfa?.enabled || false,
      methods: user.mfa?.methods || [],
      enrolledMethods: user.mfa?.enrolledMethods || [],
      lastVerified: user.mfa?.lastVerified || null,
      requiresSetup: !user.mfa?.enabled,
      canEnable: mfaStatus.canEnable
    };

    return NextResponse.json({
      success: true,
      mfa: userMfaInfo
    });
  } catch (_error) {
    console.error('❌ Failed to get MFA status:', _error);
    return NextResponse.json(
      { success: false, error: 'Failed to get MFA status' },
      { status: 500 }
    );
  }
}

async function handleGetAvailableMethods(user: any) {
  try {
    // Privy supports these MFA methods
    const availableMethods = [
      {
        type: 'totp',
        name: 'Authenticator App',
        description: 'Use an authenticator app like Google Authenticator or Authy',
        enabled: user.mfa?.methods?.includes('totp') || false,
        recommended: true
      },
      {
        type: 'sms',
        name: 'SMS',
        description: 'Receive verification codes via text message',
        enabled: user.mfa?.methods?.includes('sms') || false,
        recommended: false,
        requiresPhone: true
      },
      {
        type: 'email',
        name: 'Email',
        description: 'Receive verification codes via email',
        enabled: user.mfa?.methods?.includes('email') || false,
        recommended: false
      }
    ];

    return NextResponse.json({
      success: true,
      methods: availableMethods
    });
  } catch (_error) {
    console.error('❌ Failed to get available methods:', _error);
    return NextResponse.json(
      { success: false, error: 'Failed to get available methods' },
      { status: 500 }
    );
  }
}

async function handleEnableMfa(user: any, method: string, phoneNumber?: string) {
  try {
    // This would call Privy's Management API to enable MFA
    // For now, we'll return a mock response
    
    const supportedMethods = ['totp', 'sms', 'email'];
    if (!supportedMethods.includes(method)) {
      return NextResponse.json(
        { success: false, error: 'Unsupported MFA method' },
        { status: 400 }
      );
    }

    if (method === 'sms' && !phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Phone number required for SMS MFA' },
        { status: 400 }
      );
    }

    // Log MFA enablement
    await auditLogger.logSecurity({
      action: 'suspicious_activity' as const,
      severity: 'info',
      outcome: 'success',
      userId: user.userId,
      additionalData: {
        method,
        phoneNumber: phoneNumber ? `***-***-${phoneNumber.slice(-4)}` : undefined
      }
    });

    // Mock response - in real implementation, this would interact with Privy's API
    return NextResponse.json({
      success: true,
      message: `MFA enabled successfully using ${method}`,
      nextStep: method === 'totp' ? 'scan_qr_code' : 'verify_code',
      qrCode: method === 'totp' ? 'data:image/png;base64,mock-qr-code' : undefined
    });
  } catch (_error) {
    console.error('❌ Failed to enable MFA:', _error);
    return NextResponse.json(
      { success: false, error: 'Failed to enable MFA' },
      { status: 500 }
    );
  }
}

async function handleDisableMfa(user: any) {
  try {
    // This would call Privy's Management API to disable MFA
    // Usually requires current MFA verification
    
    // Log MFA disablement
    await auditLogger.logSecurity({
      action: 'suspicious_activity' as const,
      severity: 'warning',
      outcome: 'success', 
      userId: user.userId,
      additionalData: {
        type: 'mfa_disabled',
        disabledAt: new Date().toISOString()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'MFA disabled successfully'
    });
  } catch (_error) {
    console.error('❌ Failed to disable MFA:', _error);
    return NextResponse.json(
      { success: false, error: 'Failed to disable MFA' },
      { status: 500 }
    );
  }
}

async function handleSendMfaCode(user: any, method: string) {
  try {
    // This would trigger Privy to send an MFA code
    const supportedMethods = ['sms', 'email'];
    
    if (!supportedMethods.includes(method)) {
      return NextResponse.json(
        { success: false, error: 'Code sending not supported for this method' },
        { status: 400 }
      );
    }

    // Log code sending
    await auditLogger.logSecurity({
      action: 'suspicious_activity' as const,
      severity: 'info',
      outcome: 'success',
      userId: user.userId,
      additionalData: { method }
    });

    return NextResponse.json({
      success: true,
      message: `Verification code sent via ${method}`,
      expiresIn: 300 // 5 minutes
    });
  } catch (_error) {
    console.error('❌ Failed to send MFA code:', _error);
    return NextResponse.json(
      { success: false, error: 'Failed to send verification code' },
      { status: 500 }
    );
  }
}

async function handleVerifyMfaCode(user: any, code: string, method: string) {
  try {
    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Verification code is required' },
        { status: 400 }
      );
    }

    // This would verify the code with Privy
    // For now, we'll simulate verification
    const isValid = code.length === 6 && /^\d{6}$/.test(code);

    if (!isValid) {
      await auditLogger.logSecurity({
        action: 'suspicious_activity' as const,
        severity: 'warning',
        outcome: 'failure',
        userId: user.userId,
        additionalData: { method, reason: 'invalid_code' }
      });

      return NextResponse.json(
        { success: false, error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Log successful verification
    await auditLogger.logSecurity({
      action: 'suspicious_activity' as const,
      severity: 'info',
      outcome: 'success',
      userId: user.userId,
      additionalData: { method }
    });

    return NextResponse.json({
      success: true,
      message: 'MFA verification successful',
      verified: true
    });
  } catch (_error) {
    console.error('❌ Failed to verify MFA code:', _error);
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  return forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown';
}