import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { verifyPrivyAuth } from '@/lib/middleware/privy-auth';

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyPrivyAuth(request);

    if (!authResult.isAuthenticated) {
      return authResult.response;
    }

    const userId = authResult.user!.id;

    // Revoke all active sessions for the user
    const { error } = await supabaseAdmin
      .from('user_sessions')
      .update({
        is_revoked: true,
        revoked_at: new Date().toISOString(),
        revoked_reason: 'user_logout'
      })
      .eq('user_id', userId)
      .eq('is_revoked', false);

    if (error) {
      console.error('Error revoking sessions:', error);
      return NextResponse.json(
        { error: 'Failed to logout' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}