// app/api/trading/v1/balance/cross-chain/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePrivyAuth } from '@/lib/middleware/privy-auth';
import { CrossChainBalanceService } from '@/lib/trading/cross-chain-balance-service';
// import { ethers } from 'ethers'; // Currently not used
import { z } from 'zod';

const QuerySchema = z.object({
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  forceSync: z.string().transform(val => val === 'true').optional()
});

/**
 * GET /api/trading/v1/balance/cross-chain - Get cross-chain balances
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if ('status' in authResult) {
      return authResult;
    }

    const { user } = authResult;
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const queryData = Object.fromEntries(searchParams);
    const validationResult = QuerySchema.safeParse(queryData);
    
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const { tokenAddress, forceSync } = validationResult.data;

    // Get cross-chain balance service
    const balanceService = CrossChainBalanceService.getInstance();

    // Force sync if requested
    if (forceSync) {
      const syncResult = await balanceService.syncBalances(
        user.id,
        tokenAddress ? [tokenAddress] : undefined
      );
      
      if (!syncResult.success) {
        console.warn(`⚠️ Balance sync failed: ${syncResult.error}`);
      }
    }

    let balances;

    if (tokenAddress) {
      // Get balance for specific token
      const balance = await balanceService.getUnifiedBalance(user.id, tokenAddress);
      balances = balance ? [balance] : [];
    } else {
      // Get all cross-chain balances
      balances = await balanceService.getUserCrossChainBalances(user.id);
    }

    // Format response
    const formattedBalances = balances.map(balance => ({
      tokenAddress: balance.tokenAddress,
      symbol: balance.symbol,
      decimals: balance.decimals,
      balances: {
        evm: {
          available: balance.balances.evm.available,
          locked: balance.balances.evm.locked,
          total: balance.balances.evm.total
        },
        hypercore: {
          available: balance.balances.hypercore.available,
          locked: balance.balances.hypercore.locked, 
          total: balance.balances.hypercore.total
        },
        combined: {
          available: balance.balances.combined.available,
          locked: balance.balances.combined.locked,
          total: balance.balances.combined.total
        }
      },
      lastSynced: balance.lastSynced.toISOString(),
      syncStatus: balance.syncStatus,
      syncError: balance.syncError
    }));

    return NextResponse.json({
      success: true,
      balances: formattedBalances,
      meta: {
        totalTokens: formattedBalances.length,
        lastUpdated: new Date().toISOString(),
        forceSync: !!forceSync
      }
    });

  } catch (_error) {
    console.error('❌ Get cross-chain balance error:', _error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trading/v1/balance/cross-chain - Sync cross-chain balances
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if ('status' in authResult) {
      return authResult;
    }

    const { user } = authResult;
    const body = await request.json();

    const SyncSchema = z.object({
      tokenAddresses: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).optional()
    });

    const validationResult = SyncSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input',
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const { tokenAddresses } = validationResult.data;

    // Get cross-chain balance service
    const balanceService = CrossChainBalanceService.getInstance();

    // Sync balances
    console.log(`🔄 Syncing balances for user ${user.id}`);
    const syncResult = await balanceService.syncBalances(user.id, tokenAddresses);

    if (!syncResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: syncResult.error || 'Balance sync failed'
        },
        { status: 500 }
      );
    }

    // Get updated balances
    const updatedBalances = tokenAddresses
      ? await Promise.all(
          tokenAddresses.map(addr => balanceService.getUnifiedBalance(user.id, addr))
        )
      : await balanceService.getUserCrossChainBalances(user.id);

    const validBalances = updatedBalances.filter(Boolean);

    return NextResponse.json({
      success: true,
      message: 'Balances synced successfully',
      syncedTokens: validBalances.length,
      balances: validBalances.map(balance => ({
        tokenAddress: balance!.tokenAddress,
        symbol: balance!.symbol,
        balances: balance!.balances,
        lastSynced: balance!.lastSynced.toISOString(),
        syncStatus: balance!.syncStatus
      }))
    });

  } catch (_error) {
    console.error('❌ Sync cross-chain balance error:', _error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}