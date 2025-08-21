// app/api/deposit/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePrivyAuth } from '@/lib/middleware/privy-auth';
import { ArbitrumDepositService } from '@/lib/blockchain/arbitrum-service';
import { HyperliquidBridgeService } from '@/lib/blockchain/hyperliquid-bridge';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase configuration missing');
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
    // const walletAddress = searchParams.get('wallet'); // 현재 사용되지 않음

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    // Get transaction details
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_id', user.id) // Ensure user owns this transaction
      .single();

    if (txError || !transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const arbitrumService = ArbitrumDepositService.getInstance();
    const bridgeService = HyperliquidBridgeService.getInstance();

    // Get additional status information
    const statusInfo = await getTransactionStatusInfo(
      transaction,
      arbitrumService,
      bridgeService
    );

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        walletAddress: transaction.wallet_address,
        amount: transaction.amount,
        tokenSymbol: transaction.token_symbol,
        status: transaction.status,
        network: transaction.network,
        txHash: transaction.tx_hash,
        bridgeTxHash: transaction.bridge_tx_hash,
        createdAt: transaction.created_at,
        updatedAt: transaction.updated_at,
        completedAt: transaction.completed_at,
        errorMessage: transaction.error_message,
        retryCount: transaction.retry_count,
        metadata: transaction.metadata,
        ...statusInfo
      }
    });
  } catch (_error) {
    console.error('❌ Get deposit status error:', _error);
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
        return await handleRefreshStatus(user.id, transactionId);
      
      case 'retry':
        return await handleRetryTransaction(user.id, transactionId);
      
      case 'cancel':
        return await handleCancelTransaction(user.id, transactionId);
      
      case 'history':
        return await handleGetTransactionHistory(user.id, walletAddress);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (_error) {
    console.error('❌ Deposit status action error:', _error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getTransactionStatusInfo(
  transaction: any,
  arbitrumService: ArbitrumDepositService,
  bridgeService: HyperliquidBridgeService
) {
  const statusInfo: any = {
    timeline: [],
    estimatedCompletion: null,
    nextStep: null
  };

  // Add timeline events
  statusInfo.timeline.push({
    step: 'initiated',
    status: 'completed',
    timestamp: transaction.created_at,
    description: 'Deposit request initiated'
  });

  if (transaction.tx_hash) {
    statusInfo.timeline.push({
      step: 'arbitrum_submitted',
      status: transaction.status === 'failed' ? 'failed' : 'completed',
      timestamp: transaction.updated_at,
      description: 'Transaction submitted to Arbitrum',
      txHash: transaction.tx_hash
    });
  }

  if (transaction.bridge_tx_hash) {
    statusInfo.timeline.push({
      step: 'bridge_processing',
      status: transaction.status === 'completed' ? 'completed' : 'pending',
      timestamp: transaction.updated_at,
      description: 'Bridge processing deposit',
      txHash: transaction.bridge_tx_hash
    });
  }

  if (transaction.completed_at) {
    statusInfo.timeline.push({
      step: 'completed',
      status: 'completed',
      timestamp: transaction.completed_at,
      description: 'Deposit completed on Hyperliquid'
    });
  }

  // Set next step based on current status
  switch (transaction.status) {
    case 'pending':
      statusInfo.nextStep = 'Waiting for Arbitrum transaction confirmation';
      statusInfo.estimatedCompletion = '1-2 minutes';
      break;
    
    case 'processing':
      statusInfo.nextStep = 'Bridge processing deposit';
      statusInfo.estimatedCompletion = '30-180 seconds';
      break;
    
    case 'completed':
      statusInfo.nextStep = 'Deposit complete';
      statusInfo.estimatedCompletion = 'Completed';
      break;
    
    case 'failed':
      statusInfo.nextStep = 'Transaction failed';
      statusInfo.estimatedCompletion = 'Failed';
      break;
  }

  // Get additional real-time information
  if (transaction.status === 'processing' && transaction.wallet_address) {
    try {
      const bridgeStatus = await bridgeService.checkBridgeStatus(transaction.wallet_address);
      statusInfo.bridgeStatus = bridgeStatus;
    } catch (_error) {
      console.error('❌ Failed to get bridge status:', _error);
    }
  }

  return statusInfo;
}

async function handleRefreshStatus(userId: string, transactionId: string) {
  try {
    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    const arbitrumService = ArbitrumDepositService.getInstance();
    const transaction = await arbitrumService.getTransactionStatus(transactionId);

    if (!transaction || transaction.user_id !== userId) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction,
      refreshedAt: new Date().toISOString()
    });
  } catch (_error) {
    console.error('❌ Refresh status failed:', _error);
    return NextResponse.json(
      { error: 'Failed to refresh status' },
      { status: 500 }
    );
  }
}

async function handleRetryTransaction(userId: string, transactionId: string) {
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
      .single();

    if (error || !transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    if (transaction.status !== 'failed') {
      return NextResponse.json(
        { error: 'Only failed transactions can be retried' },
        { status: 400 }
      );
    }

    // Increment retry count and reset to pending
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'pending',
        retry_count: transaction.retry_count + 1,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId);

    if (updateError) {
      throw new Error(`Failed to update transaction: ${updateError.message}`);
    }

    // Restart monitoring if we have a transaction hash
    if (transaction.tx_hash) {
      const arbitrumService = ArbitrumDepositService.getInstance();
      const bridgeService = HyperliquidBridgeService.getInstance();

      Promise.all([
        arbitrumService.monitorTransaction(transaction.tx_hash, transactionId),
        bridgeService.monitorBridgeDeposit({
          walletAddress: transaction.wallet_address,
          amount: transaction.amount,
          transactionId,
          arbitrumTxHash: transaction.tx_hash
        })
      ]).catch(_error => {
        console.error('❌ Retry monitoring failed:', _error);
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Transaction retry initiated',
      transactionId,
      retryCount: transaction.retry_count + 1
    });
  } catch (_error) {
    console.error('❌ Retry transaction failed:', _error);
    return NextResponse.json(
      { error: 'Failed to retry transaction' },
      { status: 500 }
    );
  }
}

async function handleCancelTransaction(userId: string, transactionId: string) {
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
      .single();

    if (error || !transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    if (transaction.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot cancel completed transaction' },
        { status: 400 }
      );
    }

    if (transaction.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Transaction already cancelled' },
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
      throw new Error(`Failed to cancel transaction: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Transaction cancelled',
      transactionId
    });
  } catch (_error) {
    console.error('❌ Cancel transaction failed:', _error);
    return NextResponse.json(
      { error: 'Failed to cancel transaction' },
      { status: 500 }
    );
  }
}

async function handleGetTransactionHistory(userId: string, walletAddress?: string) {
  try {
    const arbitrumService = ArbitrumDepositService.getInstance();
    const transactions = await arbitrumService.getUserTransactions(userId);

    // Filter by wallet address if provided
    const filteredTransactions = walletAddress
      ? transactions.filter(tx => tx.wallet_address === walletAddress)
      : transactions;

    return NextResponse.json({
      success: true,
      transactions: filteredTransactions,
      totalCount: filteredTransactions.length
    });
  } catch (_error) {
    console.error('❌ Get transaction history failed:', _error);
    return NextResponse.json(
      { error: 'Failed to get transaction history' },
      { status: 500 }
    );
  }
}