// app/api/auth/2fa/route.ts
// ⚠️ DEPRECATED: This custom 2FA system has been replaced with Privy's native MFA
// Use /api/auth/privy-mfa for new implementations
// This endpoint is kept for backward compatibility only
import { NextRequest, NextResponse } from 'next/server';
import { requirePrivyAuth } from '@/lib/middleware/privy-auth';
import { TwoFactorService } from '@/lib/security/2fa-service';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if ('status' in authResult) {
      return authResult;
    }

    const { user } = authResult;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    const twoFactorService = TwoFactorService.getInstance();

    switch (action) {
      case 'status':
        return await handleGetTwoFactorStatus(user.id, twoFactorService);
      
      case 'stats':
        return await handleGetTwoFactorStats(twoFactorService);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (_error) {
    console.error('❌ 2FA GET error:', _error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if ('status' in authResult) {
      return authResult;
    }

    const { user } = authResult;
    const body = await request.json();
    const { action, setupToken, totpCode } = body;

    const twoFactorService = TwoFactorService.getInstance();

    switch (action) {
      case 'setup':
        return await handleSetupTwoFactor(user.id, twoFactorService);
      
      case 'verify-setup':
        return await handleVerifyTwoFactorSetup(user.id, setupToken, totpCode, twoFactorService);
      
      case 'verify-code':
        return await handleVerifyTwoFactorCode(user.id, totpCode, twoFactorService);
      
      case 'disable':
        return await handleDisableTwoFactor(user.id, totpCode, twoFactorService);
      
      case 'generate-backup-codes':
        return await handleGenerateBackupCodes(user.id, totpCode, twoFactorService);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (_error) {
    console.error('❌ 2FA POST error:', _error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleGetTwoFactorStatus(userId: string, twoFactorService: TwoFactorService) {
  try {
    const status = await twoFactorService.getTwoFactorStatus(userId);
    
    return NextResponse.json({
      success: true,
      twoFactor: status
    });
  } catch (_error) {
    console.error('❌ Failed to get 2FA status:', _error);
    return NextResponse.json(
      { error: 'Failed to get 2FA status' },
      { status: 500 }
    );
  }
}

async function handleGetTwoFactorStats(twoFactorService: TwoFactorService) {
  try {
    const stats = await twoFactorService.getTwoFactorStats();
    
    return NextResponse.json({
      success: true,
      stats
    });
  } catch (_error) {
    console.error('❌ Failed to get 2FA stats:', _error);
    return NextResponse.json(
      { error: 'Failed to get 2FA statistics' },
      { status: 500 }
    );
  }
}

async function handleSetupTwoFactor(userId: string, twoFactorService: TwoFactorService) {
  try {
    // Check if 2FA is already enabled
    const isEnabled = await twoFactorService.isTwoFactorEnabled(userId);
    if (isEnabled) {
      return NextResponse.json(
        { error: '2FA is already enabled' },
        { status: 400 }
      );
    }

    const setup = await twoFactorService.generateTwoFactorSetup(userId);
    
    return NextResponse.json({
      success: true,
      setup: {
        qrCodeUrl: setup.qrCodeUrl,
        backupCodes: setup.backupCodes,
        setupToken: setup.setupToken
      }
    });
  } catch (_error) {
    console.error('❌ Failed to setup 2FA:', _error);
    return NextResponse.json(
      { error: 'Failed to setup 2FA' },
      { status: 500 }
    );
  }
}

async function handleVerifyTwoFactorSetup(
  userId: string,
  setupToken: string,
  totpCode: string,
  twoFactorService: TwoFactorService
) {
  try {
    if (!setupToken || !totpCode) {
      return NextResponse.json(
        { error: 'Setup token and TOTP code are required' },
        { status: 400 }
      );
    }

    const result = await twoFactorService.verifyTwoFactorSetup(userId, setupToken, totpCode);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '2FA has been successfully enabled'
    });
  } catch (_error) {
    console.error('❌ Failed to verify 2FA setup:', _error);
    return NextResponse.json(
      { error: 'Failed to verify 2FA setup' },
      { status: 500 }
    );
  }
}

async function handleVerifyTwoFactorCode(
  userId: string,
  totpCode: string,
  twoFactorService: TwoFactorService
) {
  try {
    if (!totpCode) {
      return NextResponse.json(
        { error: 'TOTP code is required' },
        { status: 400 }
      );
    }

    const verification = await twoFactorService.verifyTwoFactorCode(userId, totpCode);
    
    if (!verification.isValid) {
      return NextResponse.json(
        { error: verification.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Code verified successfully',
      backupCodeUsed: verification.backupCodeUsed
    });
  } catch (_error) {
    console.error('❌ Failed to verify 2FA code:', _error);
    return NextResponse.json(
      { error: 'Failed to verify 2FA code' },
      { status: 500 }
    );
  }
}

async function handleDisableTwoFactor(
  userId: string,
  totpCode: string,
  twoFactorService: TwoFactorService
) {
  try {
    if (!totpCode) {
      return NextResponse.json(
        { error: 'TOTP code is required to disable 2FA' },
        { status: 400 }
      );
    }

    const result = await twoFactorService.disableTwoFactor(userId, totpCode);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '2FA has been successfully disabled'
    });
  } catch (_error) {
    console.error('❌ Failed to disable 2FA:', _error);
    return NextResponse.json(
      { error: 'Failed to disable 2FA' },
      { status: 500 }
    );
  }
}

async function handleGenerateBackupCodes(
  userId: string,
  totpCode: string,
  twoFactorService: TwoFactorService
) {
  try {
    if (!totpCode) {
      return NextResponse.json(
        { error: 'TOTP code is required to generate new backup codes' },
        { status: 400 }
      );
    }

    // Verify current 2FA code before generating new backup codes
    const verification = await twoFactorService.verifyTwoFactorCode(userId, totpCode, false);
    
    if (!verification.isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    const newBackupCodes = await twoFactorService.generateNewBackupCodes(userId);
    
    return NextResponse.json({
      success: true,
      backupCodes: newBackupCodes,
      message: 'New backup codes generated successfully'
    });
  } catch (_error) {
    console.error('❌ Failed to generate backup codes:', _error);
    return NextResponse.json(
      { error: 'Failed to generate backup codes' },
      { status: 500 }
    );
  }
}