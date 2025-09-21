import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { verifyPrivyAuth } from '@/lib/middleware/privy-auth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyPrivyAuth(request);

    if (!authResult.isAuthenticated) {
      return authResult.response;
    }

    const userId = authResult.user!.id;

    // Get user profile with associated wallets
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        user_wallets (*)
      `)
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        authType: user.auth_type,
        email: user.email,
        emailVerified: user.email_verified,
        walletAddress: user.wallet_address,
        walletType: user.wallet_type,
        privyUserId: user.privy_user_id,
        createdAt: user.created_at,
        lastLogin: user.last_login,
        isActive: user.is_active,
        wallets: user.user_wallets
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyPrivyAuth(request);

    if (!authResult.isAuthenticated) {
      return authResult.response;
    }

    const userId = authResult.user!.id;
    const body = await request.json();

    // Only allow updating certain fields
    const allowedUpdates: { [key: string]: any } = {};

    if (body.email !== undefined) {
      allowedUpdates.email = body.email;
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data: updatedUser, error } = await supabaseAdmin
      .from('users')
      .update(allowedUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}