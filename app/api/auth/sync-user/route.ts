import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { verifyPrivyToken } from '@/lib/auth/privy-jwt';
import type { User, UserWallet, UserUpdate, UserWalletInsert } from '@/lib/supabase/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { privyUser } = body;

    if (!privyUser) {
      return NextResponse.json(
        { error: 'Missing privyUser data' },
        { status: 400 }
      );
    }

    // Extract user information from Privy user object
    const privyUserId = privyUser.id;
    const email = privyUser.email?.address || null;
    const linkedAccounts = privyUser.linkedAccounts || [];

    // Determine auth type and wallet info
    let authType: 'email' | 'wallet' = 'email';
    let walletAddress: string | null = null;
    let walletType: string | null = null;

    // Check for external wallets
    const externalWallet = linkedAccounts.find((account: any) =>
      account.type === 'wallet' && account.walletClient !== 'privy'
    );

    // Check for embedded wallet
    const embeddedWallet = linkedAccounts.find((account: any) =>
      account.type === 'wallet' && account.walletClient === 'privy'
    );

    if (externalWallet) {
      authType = 'wallet';
      walletAddress = externalWallet.address;
      walletType = externalWallet.walletClientType || 'external';
    } else if (embeddedWallet) {
      walletAddress = embeddedWallet.address;
      walletType = 'embedded';
    }

    // Check if user already exists
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('privy_user_id', privyUserId)
      .single() as { data: User | null; error: any };

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching user:', fetchError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    let user;
    const now = new Date().toISOString();

    if (existingUser) {
      // Update existing user
      const updateData: UserUpdate = {
        email,
        email_verified: !!email,
        wallet_address: walletAddress,
        wallet_type: walletType,
        last_login: now,
        is_active: true
      };

      const { data: updatedUser, error: updateError } = await (supabaseAdmin as any)
        .from('users')
        .update(updateData)
        .eq('id', existingUser!.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user:', updateError);
        return NextResponse.json(
          { error: 'Failed to update user' },
          { status: 500 }
        );
      }

      user = updatedUser;
    } else {
      // Create new user
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          auth_type: authType,
          email,
          email_verified: !!email,
          wallet_address: walletAddress,
          wallet_type: walletType,
          privy_user_id: privyUserId,
          created_at: now,
          last_login: now,
          is_active: true
        } as any)
        .select()
        .single() as { data: User | null; error: any };

      if (insertError) {
        console.error('Error creating user:', insertError);
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        );
      }

      user = newUser;
    }

    // Sync wallet information to user_wallets table
    const syncedWallets = [];

    for (const account of linkedAccounts) {
      if (account.type === 'wallet' && account.address) {
        // Check if wallet already exists
        const { data: existingWallet } = await supabaseAdmin
          .from('user_wallets')
          .select('*')
          .eq('user_id', user!.id)
          .eq('wallet_address', account.address)
          .single();

        if (!existingWallet) {
          const walletData: UserWalletInsert = {
            user_id: user!.id,
            wallet_address: account.address,
            wallet_provider: account.walletClientType || 'unknown',
            is_primary: syncedWallets.length === 0, // First wallet is primary
            created_at: now
          };

          const { data: newWallet, error: walletError } = await (supabaseAdmin as any)
            .from('user_wallets')
            .insert(walletData)
            .select()
            .single();

          if (!walletError && newWallet) {
            syncedWallets.push(newWallet);
          }
        } else {
          syncedWallets.push(existingWallet);
        }
      }
    }

    return NextResponse.json({
      success: true,
      user,
      syncedWallets,
      message: existingUser ? 'User updated successfully' : 'User created successfully'
    });

  } catch (error) {
    console.error('Sync user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}