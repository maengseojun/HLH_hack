// app/api/balance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePrivyAuth } from '@/lib/middleware/privy-auth';
import { BalanceService } from '@/lib/blockchain/balance-service';
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
    const network = searchParams.get('network');
    const walletAddress = searchParams.get('address');

    // Get user's wallet addresses from database
    const { data: userWallets, error: walletsError } = await supabase
      .from('user_wallets')
      .select('wallet_address')
      .eq('user_id', user.id);

    if (walletsError) {
      console.error('❌ Failed to fetch user wallets:', walletsError);
      return NextResponse.json(
        { error: 'Failed to fetch user wallets' },
        { status: 500 }
      );
    }

    if (!userWallets || userWallets.length === 0) {
      return NextResponse.json(
        { error: 'No wallets found for user' },
        { status: 404 }
      );
    }

    // If specific wallet address is provided, verify it belongs to the user
    let targetAddress: string;
    if (walletAddress) {
      const hasPermission = userWallets.some(w => 
        w.wallet_address.toLowerCase() === walletAddress.toLowerCase()
      );
      
      if (!hasPermission) {
        return NextResponse.json(
          { error: 'Unauthorized wallet address' },
          { status: 403 }
        );
      }
      
      targetAddress = walletAddress;
    } else {
      // Use the first wallet address
      targetAddress = userWallets[0].wallet_address;
    }

    const balanceService = BalanceService.getInstance();

    // Get balance for specific network or all networks
    if (network) {
      const supportedNetworks = ['arbitrum', 'hyperliquid', 'ethereum'];
      if (!supportedNetworks.includes(network)) {
        return NextResponse.json(
          { error: 'Unsupported network' },
          { status: 400 }
        );
      }

      const balance = await balanceService.getUserBalance(
        targetAddress,
        network as 'arbitrum' | 'hyperliquid' | 'ethereum'
      );

      if (!balance) {
        return NextResponse.json(
          { error: 'Failed to fetch balance' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        wallet: targetAddress,
        network,
        balance,
        cached: true, // This will be determined by the service
      });
    } else {
      // Get balances for all networks
      const balances = await balanceService.getAllBalances(targetAddress);

      return NextResponse.json({
        success: true,
        wallet: targetAddress,
        balances,
        totalNetworks: balances.length,
      });
    }
  } catch (_error) {
    console.error('❌ Balance API error:', _error);
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
    const { action, walletAddress } = body;

    if (action === 'refresh') {
      // Clear cache for specific wallet
      const balanceService = BalanceService.getInstance();
      
      if (walletAddress) {
        // Verify wallet belongs to user
        const { data: userWallets, error } = await supabase
          .from('user_wallets')
          .select('wallet_address')
          .eq('user_id', user.id)
          .eq('wallet_address', walletAddress);

        if (error || !userWallets || userWallets.length === 0) {
          return NextResponse.json(
            { error: 'Unauthorized wallet address' },
            { status: 403 }
          );
        }

        balanceService.clearCache(walletAddress);
      } else {
        // Clear all cache for user's wallets
        const { data: userWallets } = await supabase
          .from('user_wallets')
          .select('wallet_address')
          .eq('user_id', user.id);

        if (userWallets) {
          userWallets.forEach(w => balanceService.clearCache(w.wallet_address));
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Cache cleared successfully',
      });
    }

    if (action === 'stats') {
      // Get cache statistics (admin only)
      const { data: userData } = await supabase
        .from('users')
        .select('email')
        .eq('id', user.id)
        .single();

      if (userData?.email !== 'admin@p2pfiat.com') {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        );
      }

      const balanceService = BalanceService.getInstance();
      const stats = balanceService.getCacheStats();

      return NextResponse.json({
        success: true,
        cacheStats: stats,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (_error) {
    console.error('❌ Balance API POST error:', _error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}