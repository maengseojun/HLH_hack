import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

export async function GET() {
  try {
    // Test database connection
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      return NextResponse.json(
        {
          status: 'error',
          database: 'disconnected',
          error: error.message
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV
    });

  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: 'Health check failed'
      },
      { status: 500 }
    );
  }
}