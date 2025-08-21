// app/api/deposit/initiate/route.ts
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

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult; // Authentication failed
    }

    const { user } = authResult;
    const body = await request.json();
    const { walletAddress, amount, txHash } = body;

    // Validate required fields
    if (!walletAddress || !amount) {
      return NextResponse.json(
        { error: 'Wallet address and amount are required' },
        { status: 400 }
      );
    }

    // Verify wallet belongs to user using JOIN query with privy_user_id
    const { data: userWallets, error: walletsError } = await supabase
      .from('user_wallets')
      .select(`
        wallet_address,
        users!inner(privy_user_id)
      `)
      .eq('users.privy_user_id', user.privyUserId)
      .eq('wallet_address', walletAddress);

    if (walletsError || !userWallets || userWallets.length === 0) {
      console.error('Wallet authorization failed:', {
        privyUserId: user.privyUserId,
        walletAddress,
        error: walletsError?.message,
        walletsFound: userWallets?.length || 0
      });
      
      return NextResponse.json(
        { error: 'Unauthorized wallet address' },
        { status: 403 }
      );
    }

    const arbitrumService = ArbitrumDepositService.getInstance();
    const bridgeService = HyperliquidBridgeService.getInstance();

    // If txHash is provided, this is a transaction confirmation
    if (txHash) {
      return await handleTransactionConfirmation(
        user.id,
        walletAddress,
        amount,
        txHash,
        arbitrumService,
        bridgeService
      );
    }

    // Otherwise, this is a deposit preparation request
    return await handleDepositPreparation(
      user.id,
      walletAddress,
      amount,
      arbitrumService
    );
  } catch (_error) {
    console.error('❌ Deposit initiation error:', _error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleDepositPreparation(
  userId: string,
  walletAddress: string,
  amount: string,
  arbitrumService: ArbitrumDepositService
) {
  try {
    // Validate deposit
    const validation = arbitrumService.validateDeposit({
      walletAddress,
      amount,
      userId
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Get user's current USDC balance
    const balance = await arbitrumService.getUSDCBalance(walletAddress);
    const userBalance = parseFloat(balance.formatted);
    const depositAmount = parseFloat(amount);

    if (userBalance < depositAmount) {
      return NextResponse.json(
        { 
          error: 'Insufficient USDC balance',
          currentBalance: balance.formatted,
          requiredAmount: amount
        },
        { status: 400 }
      );
    }

    // Check allowance
    const allowance = await arbitrumService.checkAllowance(walletAddress);
    const currentAllowance = parseFloat(allowance);
    const needsApproval = currentAllowance < depositAmount;

    // Prepare transaction data
    const txData = arbitrumService.prepareDepositData({
      walletAddress,
      amount,
      userId
    });

    // Get deposit configuration
    const config = arbitrumService.getDepositConfig();

    return NextResponse.json({
      success: true,
      preparation: {
        walletAddress,
        amount,
        currentBalance: balance.formatted,
        allowance,
        needsApproval,
        txData,
        config: {
          minAmount: config.minAmount,
          maxAmount: config.maxAmount,
          usdcAddress: config.usdcAddress,
          bridgeAddress: config.bridgeAddress
        }
      }
    });
  } catch (_error) {
    console.error('❌ Deposit preparation failed:', _error);
    return NextResponse.json(
      { error: 'Failed to prepare deposit' },
      { status: 500 }
    );
  }
}

async function handleTransactionConfirmation(
  userId: string,
  walletAddress: string,
  amount: string,
  txHash: string,
  arbitrumService: ArbitrumDepositService,
  bridgeService: HyperliquidBridgeService
) {
  try {
    // Validate transaction hash
    if (!txHash.startsWith('0x') || txHash.length !== 66) {
      return NextResponse.json(
        { error: 'Invalid transaction hash' },
        { status: 400 }
      );
    }

    // Create transaction record
    const transactionId = await arbitrumService.createDepositTransaction({
      walletAddress,
      amount,
      userId
    });

    // Start monitoring the transaction
    Promise.all([
      arbitrumService.monitorTransaction(txHash, transactionId),
      bridgeService.monitorBridgeDeposit({
        walletAddress,
        amount,
        transactionId,
        arbitrumTxHash: txHash
      })
    ]).catch(_error => {
      console.error('❌ Background monitoring failed:', _error);
    });

    // Get bridge processing time estimates
    const bridgeTime = bridgeService.getBridgeProcessingTime();

    return NextResponse.json({
      success: true,
      transaction: {
        id: transactionId,
        walletAddress,
        amount,
        txHash,
        status: 'pending',
        network: 'arbitrum',
        estimatedTime: {
          arbitrumConfirmation: '1-2 minutes',
          bridgeProcessing: `${bridgeTime.min}-${bridgeTime.max} seconds`,
          total: `${Math.ceil(bridgeTime.max / 60) + 2} minutes`
        }
      }
    });
  } catch (_error) {
    console.error('❌ Transaction confirmation failed:', _error);
    return NextResponse.json(
      { error: 'Failed to confirm transaction' },
      { status: 500 }
    );
  }
}

// GET endpoint for deposit information
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult; // Authentication failed
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

    // Verify wallet belongs to user using JOIN query with privy_user_id
    const { data: userWallets, error: walletsError } = await supabase
      .from('user_wallets')
      .select(`
        wallet_address,
        users!inner(privy_user_id)
      `)
      .eq('users.privy_user_id', user.privyUserId)
      .eq('wallet_address', walletAddress);

    if (walletsError || !userWallets || userWallets.length === 0) {
      console.error('Wallet authorization failed:', {
        privyUserId: user.privyUserId,
        walletAddress,
        error: walletsError?.message,
        walletsFound: userWallets?.length || 0
      });
      
      return NextResponse.json(
        { error: 'Unauthorized wallet address' },
        { status: 403 }
      );
    }

    const arbitrumService = ArbitrumDepositService.getInstance();
    const bridgeService = HyperliquidBridgeService.getInstance();

    // Get deposit information
    const [balance, allowance, config, hyperliquidBalance, bridgeStats] = await Promise.all([
      arbitrumService.getUSDCBalance(walletAddress),
      arbitrumService.checkAllowance(walletAddress),
      arbitrumService.getDepositConfig(),
      bridgeService.getHyperliquidBalance(walletAddress),
      bridgeService.getBridgeStatistics()
    ]);

    return NextResponse.json({
      success: true,
      depositInfo: {
        walletAddress,
        arbitrumBalance: {
          usdc: balance.formatted,
          raw: balance.balance
        },
        hyperliquidBalance,
        allowance,
        config,
        bridgeStats,
        requirements: {
          minDeposit: config.minAmount,
          maxDeposit: config.maxAmount,
          needsApproval: parseFloat(allowance) < config.minAmount
        }
      }
    });
  } catch (_error) {
    console.error('❌ Get deposit info error:', _error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}