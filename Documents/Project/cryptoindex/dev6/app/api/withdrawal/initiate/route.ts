// app/api/withdrawal/initiate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePrivyAuth } from '@/lib/middleware/privy-auth';
import { requireFreshMfa, MFA_CONFIGS } from '@/lib/middleware/privy-mfa';
import { HyperliquidWithdrawalService } from '@/lib/blockchain/hyperliquid-withdrawal';
import { WithdrawalVerificationService } from '@/lib/security/withdrawal-verification';
import { WithdrawalLimitsService } from '@/lib/validation/withdrawal-limits';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // For withdrawal operations, require fresh MFA verification (within 5 minutes)
    const mfaResult = await requireFreshMfa(request, 5);
    if ('status' in mfaResult) {
      return mfaResult;
    }

    const { user } = mfaResult;
    const body = await request.json();
    const { 
      action, 
      walletAddress, 
      amount, 
      destinationAddress, 
      signature,
      verificationId,
      verificationCode,
      verificationMethod = 'email'
    } = body;

    // Verify wallet belongs to user
    const { data: userWallets, error: walletsError } = await supabase
      .from('user_wallets')
      .select('wallet_address')
      .eq('user_id', user.id)
      .eq('wallet_address', walletAddress);

    if (walletsError || !userWallets || userWallets.length === 0) {
      return NextResponse.json(
        { error: 'Unauthorized wallet address' },
        { status: 403 }
      );
    }

    const withdrawalService = HyperliquidWithdrawalService.getInstance();
    const verificationService = WithdrawalVerificationService.getInstance();
    const limitsService = WithdrawalLimitsService.getInstance();

    switch (action) {
      case 'prepare':
        return await handleWithdrawalPreparation(
          user.id,
          walletAddress,
          amount,
          destinationAddress,
          withdrawalService,
          verificationService,
          limitsService
        );
      
      case 'verify':
        return await handleWithdrawalVerification(
          verificationId,
          verificationCode,
          verificationService
        );
      
      case 'execute':
        return await handleWithdrawalExecution(
          user.id,
          walletAddress,
          amount,
          destinationAddress,
          signature,
          verificationId,
          withdrawalService,
          verificationService
        );
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (_error) {
    console.error('❌ Withdrawal initiation error:', _error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleWithdrawalPreparation(
  userId: string,
  walletAddress: string,
  amount: string,
  destinationAddress: string,
  withdrawalService: HyperliquidWithdrawalService,
  verificationService: WithdrawalVerificationService,
  limitsService: WithdrawalLimitsService
) {
  try {
    // Validate withdrawal request with limits
    const limitsValidation = await limitsService.validateWithdrawal(
      userId,
      parseFloat(amount),
      destinationAddress,
      walletAddress
    );

    if (!limitsValidation.isValid) {
      return NextResponse.json(
        { 
          error: 'Withdrawal validation failed',
          errors: limitsValidation.errors,
          warnings: limitsValidation.warnings,
          limits: limitsValidation.limits,
          tier: limitsValidation.tier
        },
        { status: 400 }
      );
    }

    // Additional service validation
    const validation = withdrawalService.validateWithdrawal({
      walletAddress,
      amount,
      destinationAddress,
      userId
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Get user's Hyperliquid balance
    const balance = await withdrawalService.getHyperliquidBalance(walletAddress);
    const userBalance = parseFloat(balance.formatted);
    const withdrawalAmount = parseFloat(amount);

    if (withdrawalAmount > userBalance) {
      return NextResponse.json(
        { 
          error: 'Insufficient balance',
          currentBalance: balance.formatted,
          requiredAmount: amount
        },
        { status: 400 }
      );
    }

    // Check if additional verification is required
    const additionalVerification = await verificationService.requiresAdditionalVerification(
      userId,
      amount,
      destinationAddress
    );

    // Get withdrawal limits and fees
    const limits = withdrawalService.getWithdrawalLimits();
    const netAmount = withdrawalService.calculateNetAmount(amount);

    // Create verification request using the preferred method
    const verificationMethod = additionalVerification.preferredMethod;
    const verificationRequest = await verificationService.createVerificationRequest(
      userId,
      walletAddress,
      amount,
      destinationAddress,
      verificationMethod
    );

    return NextResponse.json({
      success: true,
      preparation: {
        walletAddress,
        amount,
        destinationAddress,
        currentBalance: balance.formatted,
        netAmount,
        withdrawalFee: limits.fee,
        limits,
        verification: {
          id: verificationRequest.verificationId,
          method: verificationMethod,
          required: additionalVerification.required,
          reasons: additionalVerification.reasons,
          preferredMethod: additionalVerification.preferredMethod
        },
        estimatedTime: '3-4 minutes',
        // Include limits validation results
        limitsValidation: {
          tier: limitsValidation.tier.tier,
          warnings: limitsValidation.warnings,
          remainingLimits: {
            daily: limitsValidation.limits.daily.remaining,
            weekly: limitsValidation.limits.weekly.remaining,
            monthly: limitsValidation.limits.monthly.remaining,
            single: limitsValidation.limits.single.max
          }
        }
      }
    });
  } catch (_error) {
    console.error('❌ Withdrawal preparation failed:', _error);
    return NextResponse.json(
      { error: 'Failed to prepare withdrawal' },
      { status: 500 }
    );
  }
}

async function handleWithdrawalVerification(
  verificationId: string,
  verificationCode: string,
  verificationService: WithdrawalVerificationService
) {
  try {
    if (!verificationId || !verificationCode) {
      return NextResponse.json(
        { error: 'Verification ID and code are required' },
        { status: 400 }
      );
    }

    const verificationResult = await verificationService.verifyWithdrawalCode(
      verificationId,
      verificationCode
    );

    if (!verificationResult.isValid) {
      return NextResponse.json(
        { error: verificationResult.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification successful',
      verificationId
    });
  } catch (_error) {
    console.error('❌ Withdrawal verification failed:', _error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}

async function handleWithdrawalExecution(
  userId: string,
  walletAddress: string,
  amount: string,
  destinationAddress: string,
  signature: string,
  verificationId: string,
  withdrawalService: HyperliquidWithdrawalService,
  verificationService: WithdrawalVerificationService
) {
  try {
    // Verify that verification was completed
    const { data: verification, error } = await supabase
      .from('withdrawal_verifications')
      .select('*')
      .eq('id', verificationId)
      .eq('user_id', userId)
      .single();

    if (error || !verification || !verification.is_verified) {
      return NextResponse.json(
        { error: 'Withdrawal verification required' },
        { status: 400 }
      );
    }

    // Verify signature
    const timestamp = Date.now();
    const signatureVerification = await verificationService.verifyWithdrawalSignature(
      signature,
      walletAddress,
      destinationAddress,
      amount,
      timestamp
    );

    if (!signatureVerification.isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Create withdrawal transaction
    const transactionId = await withdrawalService.createWithdrawalTransaction({
      walletAddress,
      amount,
      destinationAddress,
      userId
    });

    // Sign and submit withdrawal to Hyperliquid
    const { signature: withdrawalSignature, payload } = await withdrawalService.signWithdrawal(
      walletAddress,
      destinationAddress,
      amount
    );

    const submissionResult = await withdrawalService.submitWithdrawal(
      withdrawalSignature,
      payload
    );

    if (!submissionResult.success) {
      // Update transaction as failed
      await withdrawalService.updateWithdrawalStatus(
        transactionId,
        'failed',
        { error_message: submissionResult.error }
      );

      return NextResponse.json(
        { error: submissionResult.error },
        { status: 400 }
      );
    }

    // Start monitoring the withdrawal
    withdrawalService.monitorWithdrawal(
      transactionId,
      walletAddress,
      amount
    ).catch(error => {
      console.error('❌ Background monitoring failed:', error);
    });

    return NextResponse.json({
      success: true,
      transaction: {
        id: transactionId,
        walletAddress,
        amount,
        destinationAddress,
        netAmount: withdrawalService.calculateNetAmount(amount),
        withdrawalFee: withdrawalService.getWithdrawalFee(),
        status: 'processing',
        estimatedTime: '3-4 minutes'
      }
    });
  } catch (_error) {
    console.error('❌ Withdrawal execution failed:', _error);
    return NextResponse.json(
      { error: 'Failed to execute withdrawal' },
      { status: 500 }
    );
  }
}

// GET endpoint for withdrawal information
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if ('status' in authResult) {
      return authResult;
    }

    const { user } = authResult;
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Verify wallet belongs to user
    const { data: userWallets, error: walletsError } = await supabase
      .from('user_wallets')
      .select('wallet_address')
      .eq('user_id', user.id)
      .eq('wallet_address', walletAddress);

    if (walletsError || !userWallets || userWallets.length === 0) {
      return NextResponse.json(
        { error: 'Unauthorized wallet address' },
        { status: 403 }
      );
    }

    const withdrawalService = HyperliquidWithdrawalService.getInstance();

    // Get withdrawal information
    const [balance, limits, stats] = await Promise.all([
      withdrawalService.getHyperliquidBalance(walletAddress),
      withdrawalService.getWithdrawalLimits(),
      withdrawalService.getWithdrawalStatistics()
    ]);

    return NextResponse.json({
      success: true,
      withdrawalInfo: {
        walletAddress,
        balance: {
          hyperliquid: balance.formatted,
          raw: balance.balance
        },
        limits,
        stats,
        requirements: {
          minWithdrawal: limits.min,
          maxWithdrawal: limits.max,
          withdrawalFee: limits.fee,
          requiresVerification: true
        }
      }
    });
  } catch (_error) {
    console.error('❌ Get withdrawal info error:', _error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}