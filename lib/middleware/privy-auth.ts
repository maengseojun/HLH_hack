import { NextRequest, NextResponse } from 'next/server';
import { verifyPrivyToken, extractPrivyUserId } from '@/lib/auth/privy-jwt';
import { supabaseAdmin } from '@/lib/supabase/client';

export interface AuthResult {
  isAuthenticated: boolean;
  user?: {
    id: string;
    privyUserId: string;
    email?: string;
    walletAddress?: string;
    authType: 'email' | 'wallet';
  };
  response?: NextResponse;
}

export async function verifyPrivyAuth(request: NextRequest): Promise<AuthResult> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        isAuthenticated: false,
        response: NextResponse.json(
          { error: 'Missing or invalid authorization header' },
          { status: 401 }
        ),
      };
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Development bypass
    if (process.env.NODE_ENV === 'development' && token === 'dev-token') {
      return {
        isAuthenticated: true,
        user: {
          id: 'dev-user',
          privyUserId: 'dev-privy-user',
          email: 'dev@example.com',
          authType: 'email',
        },
      };
    }

    // Verify JWT token
    const verificationResult = await verifyPrivyToken(token);
    if (!verificationResult.isValid || !verificationResult.payload) {
      return {
        isAuthenticated: false,
        response: NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        ),
      };
    }

    const privyUserId = verificationResult.payload.sub;

    // Get user from database
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('privy_user_id', privyUserId)
      .single();

    if (error || !user) {
      return {
        isAuthenticated: false,
        response: NextResponse.json(
          { error: 'User not found in database' },
          { status: 404 }
        ),
      };
    }

    if (!user.is_active) {
      return {
        isAuthenticated: false,
        response: NextResponse.json(
          { error: 'User account is inactive' },
          { status: 403 }
        ),
      };
    }

    return {
      isAuthenticated: true,
      user: {
        id: user.id,
        privyUserId: user.privy_user_id!,
        email: user.email || undefined,
        walletAddress: user.wallet_address || undefined,
        authType: user.auth_type,
      },
    };
  } catch (error) {
    console.error('Auth verification error:', error);
    return {
      isAuthenticated: false,
      response: NextResponse.json(
        { error: 'Internal authentication error' },
        { status: 500 }
      ),
    };
  }
}