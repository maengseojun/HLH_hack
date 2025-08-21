// app/api/withdrawal/limits/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePrivyAuth } from '@/lib/middleware/privy-auth';
import { WithdrawalLimitsService } from '@/lib/validation/withdrawal-limits';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if ('status' in authResult) {
      return authResult;
    }

    const { user } = authResult;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'summary';

    const limitsService = WithdrawalLimitsService.getInstance();

    switch (action) {
      case 'summary':
        return await handleGetLimitsSummary(user.id, limitsService);
      
      case 'detailed':
        return await handleGetDetailedLimits(user.id, limitsService);
      
      case 'tier':
        return await handleGetUserTier(user.id, limitsService);
      
      case 'validate':
        return await handleValidateWithdrawal(request, user.id, limitsService);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (_error) {
    console.error('❌ Withdrawal limits GET error:', _error);
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
    const { action, amount, destinationAddress, walletAddress } = body;

    const limitsService = WithdrawalLimitsService.getInstance();

    switch (action) {
      case 'validate':
        return await handleValidateWithdrawalAmount(
          user.id,
          amount,
          destinationAddress,
          walletAddress,
          limitsService
        );
      
      case 'check-limits':
        return await handleCheckLimits(user.id, limitsService);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (_error) {
    console.error('❌ Withdrawal limits POST error:', _error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleGetLimitsSummary(userId: string, limitsService: WithdrawalLimitsService) {
  try {
    const summary = await limitsService.getWithdrawalLimitsSummary(userId);
    
    return NextResponse.json({
      success: true,
      summary
    });
  } catch (_error) {
    console.error('❌ Failed to get limits summary:', _error);
    return NextResponse.json(
      { error: 'Failed to get withdrawal limits summary' },
      { status: 500 }
    );
  }
}

async function handleGetDetailedLimits(userId: string, limitsService: WithdrawalLimitsService) {
  try {
    const limits = await limitsService.getUserLimits(userId);
    const tier = await limitsService.getUserTier(userId);
    
    return NextResponse.json({
      success: true,
      limits,
      tier: {
        current: tier.tier,
        requirements: tier.requirements,
        features: tier.features
      }
    });
  } catch (_error) {
    console.error('❌ Failed to get detailed limits:', _error);
    return NextResponse.json(
      { error: 'Failed to get detailed withdrawal limits' },
      { status: 500 }
    );
  }
}

async function handleGetUserTier(userId: string, limitsService: WithdrawalLimitsService) {
  try {
    const tier = await limitsService.getUserTier(userId);
    
    return NextResponse.json({
      success: true,
      tier
    });
  } catch (_error) {
    console.error('❌ Failed to get user tier:', _error);
    return NextResponse.json(
      { error: 'Failed to get user tier information' },
      { status: 500 }
    );
  }
}

async function handleValidateWithdrawal(
  request: NextRequest,
  userId: string,
  limitsService: WithdrawalLimitsService
) {
  try {
    const { searchParams } = new URL(request.url);
    const amount = parseFloat(searchParams.get('amount') || '0');
    const destinationAddress = searchParams.get('destinationAddress') || '';
    const walletAddress = searchParams.get('walletAddress') || '';

    if (!amount || !destinationAddress || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters: amount, destinationAddress, walletAddress' },
        { status: 400 }
      );
    }

    const validation = await limitsService.validateWithdrawal(
      userId,
      amount,
      destinationAddress,
      walletAddress
    );
    
    return NextResponse.json({
      success: true,
      validation
    });
  } catch (_error) {
    console.error('❌ Failed to validate withdrawal:', _error);
    return NextResponse.json(
      { error: 'Failed to validate withdrawal' },
      { status: 500 }
    );
  }
}

async function handleValidateWithdrawalAmount(
  userId: string,
  amount: number,
  destinationAddress: string,
  walletAddress: string,
  limitsService: WithdrawalLimitsService
) {
  try {
    if (!amount || !destinationAddress || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters: amount, destinationAddress, walletAddress' },
        { status: 400 }
      );
    }

    const validation = await limitsService.validateWithdrawal(
      userId,
      amount,
      destinationAddress,
      walletAddress
    );
    
    return NextResponse.json({
      success: true,
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
        canProceed: validation.isValid && validation.errors.length === 0
      },
      limits: validation.limits,
      tier: validation.tier
    });
  } catch (_error) {
    console.error('❌ Failed to validate withdrawal amount:', _error);
    return NextResponse.json(
      { error: 'Failed to validate withdrawal amount' },
      { status: 500 }
    );
  }
}

async function handleCheckLimits(userId: string, limitsService: WithdrawalLimitsService) {
  try {
    const limits = await limitsService.getUserLimits(userId);
    const tier = await limitsService.getUserTier(userId);
    
    // Calculate utilization percentages
    const utilization = {
      daily: Math.round((limits.daily.current / limits.daily.max) * 100),
      weekly: Math.round((limits.weekly.current / limits.weekly.max) * 100),
      monthly: Math.round((limits.monthly.current / limits.monthly.max) * 100),
      lifetime: Math.round((limits.total.current / limits.total.lifetime) * 100)
    };

    // Determine status
    const getStatus = (percentage: number) => {
      if (percentage >= 90) return 'critical';
      if (percentage >= 70) return 'warning';
      if (percentage >= 50) return 'moderate';
      return 'good';
    };

    return NextResponse.json({
      success: true,
      limits,
      tier: tier.tier,
      utilization,
      status: {
        daily: getStatus(utilization.daily),
        weekly: getStatus(utilization.weekly),
        monthly: getStatus(utilization.monthly),
        lifetime: getStatus(utilization.lifetime)
      },
      recommendations: generateRecommendations(limits, tier, utilization)
    });
  } catch (_error) {
    console.error('❌ Failed to check limits:', _error);
    return NextResponse.json(
      { error: 'Failed to check withdrawal limits' },
      { status: 500 }
    );
  }
}

function generateRecommendations(limits: any, tier: any, utilization: any): string[] {
  const recommendations: string[] = [];

  // High utilization warnings
  if (utilization.daily >= 80) {
    recommendations.push('Daily limit almost reached. Consider waiting until tomorrow for additional withdrawals.');
  }

  if (utilization.weekly >= 80) {
    recommendations.push('Weekly limit almost reached. Consider upgrading your tier for higher limits.');
  }

  if (utilization.monthly >= 80) {
    recommendations.push('Monthly limit almost reached. Upgrade to a higher tier for increased limits.');
  }

  // Tier upgrade suggestions
  if (tier.tier === 'basic' && (utilization.daily >= 50 || utilization.weekly >= 50)) {
    recommendations.push('Consider verifying your account for higher withdrawal limits.');
  }

  if (tier.tier === 'verified' && (utilization.daily >= 70 || utilization.weekly >= 70)) {
    recommendations.push('Upgrade to Premium tier for significantly higher limits.');
  }

  if (tier.tier === 'premium' && (utilization.daily >= 80 || utilization.weekly >= 80)) {
    recommendations.push('Upgrade to VIP tier for the highest available limits.');
  }

  // Security recommendations
  if (tier.requirements.length > 0) {
    recommendations.push(`Complete remaining requirements: ${tier.requirements.join(', ')}`);
  }

  // Usage pattern recommendations
  if (utilization.daily < 20 && utilization.weekly < 20) {
    recommendations.push('Your current tier provides ample limits for your usage pattern.');
  }

  return recommendations;
}