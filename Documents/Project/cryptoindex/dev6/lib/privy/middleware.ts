import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Middleware to validate Privy JWT and create Supabase session
export async function privyMiddleware(request: NextRequest) {
  const privyToken = request.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!privyToken) {
    return NextResponse.json({ error: 'No token provided' }, { status: 401 });
  }

  try {
    // Verify Privy JWT (you'll need to add your Privy app secret)
    const secret = new TextEncoder().encode(process.env.PRIVY_APP_SECRET);
    const { payload } = await jwtVerify(privyToken, secret);
    
    // Extract Privy user ID
    const privyUserId = payload.sub as string;
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Create a JWT token for Supabase with Privy user ID
    const supabaseJWT = {
      iss: 'privy.io',
      sub: privyUserId,
      privy_user_id: privyUserId,
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      role: 'authenticated',
    };
    
    // Set the custom JWT in the response headers
    const response = NextResponse.next();
    response.headers.set('x-supabase-jwt', JSON.stringify(supabaseJWT));
    
    return response;
    
  } catch (_error) {
    console.error('Privy middleware error:', _error);
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

// Helper function to create Supabase client with Privy context
export function createSupabaseWithPrivy(privyUserId: string) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        'x-privy-user-id': privyUserId,
      },
    },
  });
  
  return supabase;
}