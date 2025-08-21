// app/api/withdrawal/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePrivyAuth } from '@/lib/middleware/privy-auth';
import { HyperliquidWithdrawalService } from '@/lib/blockchain/hyperliquid-withdrawal';
import { WithdrawalVerificationService } from '@/lib/security/withdrawal-verification';
import { WithdrawalFeeManager } from '@/lib/fees/withdrawal-fee-manager';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if ('status' in authResult) {
      return authResult;
    }

    const { user } = authResult;
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('id');

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    // Get withdrawal transaction details
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select(`
        *,
        withdrawal_fees (
          gross_amount,
          base_fee,
          applicable_fee,
          net_amount,
          discount_tier,
          discount_percentage,
          fee_waived,
          waiver_reason
        )
      `)
      .eq('id', transactionId)
      .eq('user_id', user.id)
      .eq('transaction_type', 'withdrawal')
      .single();

    if (txError || !transaction) {
      return NextResponse.json(
        { error: 'Withdrawal transaction not found' },
        { status: 404 }
      );
    }

    const withdrawalService = HyperliquidWithdrawalService.getInstance();

    // Get additional status information
    const statusInfo = await getWithdrawalStatusInfo(transaction, withdrawalService);

    return NextResponse.json({
      success: true,
      withdrawal: {
        id: transaction.id,
        walletAddress: transaction.wallet_address,
        destinationAddress: transaction.metadata?.destination_address,
        amount: transaction.amount,
        tokenSymbol: transaction.token_symbol,
        status: transaction.status,
        network: transaction.network,
        txHash: transaction.tx_hash,
        createdAt: transaction.created_at,
        updatedAt: transaction.updated_at,
        completedAt: transaction.completed_at,
        errorMessage: transaction.error_message,
        retryCount: transaction.retry_count,
        metadata: transaction.metadata,
        feeInfo: transaction.withdrawal_fees?.[0],
        ...statusInfo
      }
    });
  } catch (_error) {
    console.error('❌ Get withdrawal status error:', _error);
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
    const { action, transactionId, walletAddress } = body;

    switch (action) {
      case 'refresh':
        return await handleRefreshWithdrawalStatus(user.id, transactionId);
      
      case 'cancel':
        return await handleCancelWithdrawal(user.id, transactionId);
      
      case 'history':
        return await handleGetWithdrawalHistory(user.id, walletAddress);
      
      case 'statistics':
        return await handleGetWithdrawalStatistics(user.id);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (_error) {
    console.error('❌ Withdrawal status action error:', _error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getWithdrawalStatusInfo(
  transaction: any,
  withdrawalService: HyperliquidWithdrawalService
) {
  const statusInfo: any = {
    timeline: [],
    estimatedCompletion: null,
    nextStep: null,
    processingTime: null
  };

  // Add timeline events
  statusInfo.timeline.push({
    step: 'initiated',
    status: 'completed',
    timestamp: transaction.created_at,
    description: 'Withdrawal request initiated'
  });

  if (transaction.status === 'processing') {
    statusInfo.timeline.push({
      step: 'verification_completed',
      status: 'completed',
      timestamp: transaction.updated_at,
      description: 'Verification completed, processing withdrawal'
    });

    statusInfo.timeline.push({
      step: 'hyperliquid_processing',
      status: 'in_progress',
      timestamp: transaction.updated_at,
      description: 'Processing withdrawal on Hyperliquid'
    });
  }

  if (transaction.completed_at) {
    statusInfo.timeline.push({
      step: 'completed',
      status: 'completed',
      timestamp: transaction.completed_at,
      description: 'Withdrawal completed and sent to destination'
    });

    // Calculate processing time
    const created = new Date(transaction.created_at).getTime();
    const completed = new Date(transaction.completed_at).getTime();
    statusInfo.processingTime = Math.round((completed - created) / 1000); // seconds
  }

  // Set next step and estimated completion based on current status
  switch (transaction.status) {
    case 'pending':
      statusInfo.nextStep = 'Awaiting verification';
      statusInfo.estimatedCompletion = 'Pending verification';
      break;
    
    case 'processing':
      statusInfo.nextStep = 'Processing on Hyperliquid network';
      statusInfo.estimatedCompletion = '2-3 minutes';
      break;
    
    case 'completed':
      statusInfo.nextStep = 'Withdrawal complete';
      statusInfo.estimatedCompletion = 'Completed';
      break;
    
    case 'failed':
      statusInfo.nextStep = 'Withdrawal failed';
      statusInfo.estimatedCompletion = 'Failed';
      break;
    
    case 'cancelled':
      statusInfo.nextStep = 'Withdrawal cancelled';
      statusInfo.estimatedCompletion = 'Cancelled';
      break;
  }

  return statusInfo;
}

async function handleRefreshWithdrawalStatus(userId: string, transactionId: string) {
  try {
    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    // Get current transaction status
    const { data: transaction, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_id', userId)
      .eq('transaction_type', 'withdrawal')
      .single();

    if (error || !transaction) {
      return NextResponse.json(
        { error: 'Withdrawal transaction not found' },
        { status: 404 }
      );
    }

    // If transaction is still processing, check Hyperliquid status
    if (transaction.status === 'processing') {
      const withdrawalService = HyperliquidWithdrawalService.getInstance();
      
      try {
        const balance = await withdrawalService.getHyperliquidBalance(transaction.wallet_address);
        // You could implement more sophisticated balance checking here
        
        console.log(`🔄 Refreshed withdrawal status for ${transactionId}`);
      } catch (_error) {
        console.error('❌ Error checking Hyperliquid balance:', _error);
      }
    }

    return NextResponse.json({
      success: true,
      transaction,
      refreshedAt: new Date().toISOString()
    });
  } catch (_error) {
    console.error('❌ Refresh withdrawal status failed:', _error);
    return NextResponse.json(
      { error: 'Failed to refresh status' },
      { status: 500 }
    );
  }
}

async function handleCancelWithdrawal(userId: string, transactionId: string) {
  try {
    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    const { data: transaction, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_id', userId)
      .eq('transaction_type', 'withdrawal')
      .single();

    if (error || !transaction) {
      return NextResponse.json(
        { error: 'Withdrawal transaction not found' },
        { status: 404 }
      );
    }

    // Only allow cancellation of pending withdrawals
    if (transaction.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending withdrawals can be cancelled' },
        { status: 400 }
      );
    }

    // Update transaction status to cancelled
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId);

    if (updateError) {
      throw new Error(`Failed to cancel withdrawal: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Withdrawal cancelled successfully',
      transactionId
    });
  } catch (_error) {
    console.error('❌ Cancel withdrawal failed:', _error);
    return NextResponse.json(
      { error: 'Failed to cancel withdrawal' },
      { status: 500 }
    );
  }
}

async function handleGetWithdrawalHistory(userId: string, walletAddress?: string) {
  try {
    let query = supabase
      .from('transactions')
      .select(`
        *,
        withdrawal_fees (
          gross_amount,
          base_fee,
          applicable_fee,
          net_amount,
          discount_tier,
          fee_waived
        )
      `)
      .eq('user_id', userId)
      .eq('transaction_type', 'withdrawal')
      .order('created_at', { ascending: false })
      .limit(50);

    if (walletAddress) {
      query = query.eq('wallet_address', walletAddress);
    }

    const { data: transactions, error } = await query;

    if (error) {
      throw new Error(`Failed to get withdrawal history: ${(_error as Error)?.message || String(_error)}`);
    }

    return NextResponse.json({
      success: true,
      withdrawals: transactions || [],
      totalCount: transactions?.length || 0
    });
  } catch (_error) {
    console.error('❌ Get withdrawal history failed:', _error);
    return NextResponse.json(
      { error: 'Failed to get withdrawal history' },
      { status: 500 }
    );
  }
}

async function handleGetWithdrawalStatistics(userId: string) {
  try {
    const withdrawalService = HyperliquidWithdrawalService.getInstance();
    const feeManager = WithdrawalFeeManager.getInstance();

    const [withdrawalStats, feeDiscount] = await Promise.all([
      withdrawalService.getWithdrawalStatistics(),
      feeManager.getUserFeeDiscount(userId)
    ]);

    // Get user-specific statistics
    const { data: userWithdrawals, error } = await supabase
      .from('transactions')
      .select(`
        *,
        withdrawal_fees (
          gross_amount,
          applicable_fee,
          discount_tier
        )
      `)
      .eq('user_id', userId)
      .eq('transaction_type', 'withdrawal')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

    if (error) {
      console.error('❌ Failed to get user withdrawal stats:', _error);
    }

    const userStats = {
      totalWithdrawals: userWithdrawals?.length || 0,
      totalVolume: userWithdrawals?.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) || 0,
      totalFeesPaid: userWithdrawals?.reduce((sum, tx) => sum + (tx.withdrawal_fees?.[0]?.applicable_fee || 0), 0) || 0,
      averageWithdrawal: userWithdrawals?.length > 0 
        ? (userWithdrawals.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) / userWithdrawals.length) 
        : 0
    };

    return NextResponse.json({
      success: true,
      statistics: {
        global: withdrawalStats,
        user: userStats,
        feeDiscount
      }
    });
  } catch (_error) {
    console.error('❌ Get withdrawal statistics failed:', _error);
    return NextResponse.json(
      { error: 'Failed to get withdrawal statistics' },
      { status: 500 }
    );
  }
}