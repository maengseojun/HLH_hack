// app/api/trading/v1/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePrivyAuth } from '@/lib/middleware/privy-auth';
import { createClient } from '@supabase/supabase-js';
import { TradingOrderService } from '@/lib/trading/order-service';
import { TradingRateLimiter } from '@/lib/middleware/rate-limiter';
import { getRedisClient } from '@/lib/redis/client';
import { z } from 'zod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize rate limiter
const redis = getRedisClient();
const tradingRateLimiter = new TradingRateLimiter(redis);

// Validation schemas
const CreateOrderSchema = z.object({
  pair: z.string().min(1, 'Pair is required'), // Accept pair instead of tokenAddress
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address').optional(),
  type: z.enum(['market', 'limit']),
  side: z.enum(['buy', 'sell']),
  amount: z.string().regex(/^\d+\.?\d*$/, 'Invalid amount format'),
  price: z.string().regex(/^\d+\.?\d*$/, 'Invalid price format').optional(),
});

const QuerySchema = z.object({
  status: z.enum(['pending', 'filled', 'cancelled', 'partial']).optional(),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  limit: z.string().transform(val => parseInt(val)).default('50'),
  offset: z.string().transform(val => parseInt(val)).default('0')
});

/**
 * POST /api/trading/v1/orders - Create new order
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult; // Return 401 error response
    }

    const { user } = authResult;
    
    // Check rate limit for order creation
    const rateLimitResult = await tradingRateLimiter.checkOrderCreateLimit(user.id);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          message: `Order creation limit reached. Try again at ${rateLimitResult.resetAt.toISOString()}`,
          rateLimit: {
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            resetAt: rateLimitResult.resetAt
          }
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetAt.getTime().toString(),
            'Retry-After': Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000).toString()
          }
        }
      );
    }
    
    const body = await request.json();

    // Validate input
    const validationResult = CreateOrderSchema.safeParse(body);
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

    const { pair, tokenAddress, type, side, amount, price } = validationResult.data;

    // Validate that price is provided for limit orders
    if (type === 'limit' && !price) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Price is required for limit orders'
        },
        { status: 400 }
      );
    }

    // TESTING MODE: Skip token validation and use matching engine directly
    console.log('🚀 OFF-CHAIN ORDERBOOK TEST - Creating order:', { 
      pair: pair || 'HYPERINDEX-USDC', 
      type, 
      side, 
      amount, 
      price 
    });

    // Import hybrid smart router V2 (V1 deprecated)
    const { HybridSmartRouterV2 } = await import('@/lib/trading/smart-router-v2');
    const smartRouter = HybridSmartRouterV2.getInstance();
    
    // Create test order
    const testOrder = {
      id: `order-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      userId: user.id,
      pair: pair || 'HYPERINDEX-USDC',
      side,
      type,
      price: price || '0',
      amount,
      remaining: amount,
      status: 'active' as const,
      timestamp: Date.now()
    };
    
    try {
      // Process order through hybrid smart router
      const routingResult = await smartRouter.processHybridOrder(testOrder);
      
      // Get routing recommendations for debugging
      const optimalRoute = await smartRouter.getOptimalRoute(testOrder.pair, testOrder.side, testOrder.amount);
      
      console.log('✅ Hybrid order processed:', {
        orderId: testOrder.id,
        fills: routingResult.fills.length,
        totalFilled: routingResult.totalFilled,
        averagePrice: routingResult.averagePrice,
        routing: routingResult.routing,
        recommendation: optimalRoute
      });
      
      // Save to DB for history (optional for testing)
      const filledAmount = parseFloat(routingResult.totalFilled);
      const status = filledAmount >= parseFloat(testOrder.amount) * 0.99 ? 'filled' : 'partial';
      
      await supabase
        .from('order_history')
        .insert({
          id: testOrder.id,
          user_id: user.id,
          pair: testOrder.pair,
          side: testOrder.side,
          order_type: testOrder.type,
          price: testOrder.type === 'limit' ? testOrder.price : routingResult.averagePrice,
          amount: testOrder.amount,
          filled_amount: routingResult.totalFilled,
          status: status,
          redis_order_id: testOrder.id
        });
      
      const orderResult = {
        success: true,
        order: {
          ...testOrder,
          fills: routingResult.fills,
          routing: routingResult.routing,
          totalFilled: routingResult.totalFilled,
          averagePrice: routingResult.averagePrice,
          status: status
        }
      };
      
      if (!orderResult.success) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Order creation failed'
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        order: orderResult.order
      }, {
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': (rateLimitResult.remaining - 1).toString(),
          'X-RateLimit-Reset': rateLimitResult.resetAt.getTime().toString()
        }
      });
      
    } catch (matchError) {
      console.error('❌ Order matching error:', matchError);
      return NextResponse.json(
        { 
          success: false,
          error: matchError instanceof Error ? matchError.message : 'Order processing failed'
        },
        { status: 500 }
      );
    }

  } catch (_error) {
    console.error('❌ Create order error:', _error);
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
 * GET /api/trading/v1/orders - Get user orders
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult; // Return 401 error response
    }

    const { user } = authResult;
    
    // Check general trading rate limit
    const rateLimitResult = await tradingRateLimiter.checkGeneralTradingLimit(user.id);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          message: `Try again at ${rateLimitResult.resetAt.toISOString()}`,
          rateLimit: {
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            resetAt: rateLimitResult.resetAt
          }
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetAt.getTime().toString(),
            'Retry-After': Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000).toString()
          }
        }
      );
    }
    
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
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

    const { status, tokenAddress, limit, offset } = validationResult.data;

    // Build query (use order_history table)
    let query = supabase
      .from('order_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (tokenAddress) {
      // For now, use tokenAddress to filter by pair (can be enhanced later)
      query = query.like('pair', `%${tokenAddress}%`);
    }

    const { data: orders, error } = await query;

    if (error) {
      throw _error;
    }

    // Format response (mapped to order_history schema)
    const formattedOrders = orders.map(order => ({
      id: order.id,
      pair: order.pair,
      tokenAddress: order.pair?.split('-')[0] || 'UNKNOWN', // Extract from pair
      symbol: order.pair?.split('-')[0] || 'UNKNOWN',
      tokenName: 'Trading Token',
      type: order.order_type,
      side: order.side,
      amount: order.amount,
      price: order.price,
      status: order.status,
      filledAmount: order.filled_amount || '0',
      remainingAmount: (parseFloat(order.amount) - parseFloat(order.filled_amount || '0')).toString(),
      averageFillPrice: null, // Not in current schema
      transactionHash: null, // Not in current schema
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      filledAt: null, // Not in current schema
      cancelledAt: null, // Not in current schema
      errorMessage: null, // Not in current schema
      redisOrderId: order.redis_order_id
    }));

    return NextResponse.json({
      success: true,
      orders: formattedOrders,
      pagination: {
        limit,
        offset,
        total: formattedOrders.length // In production, get actual count
      }
    }, {
      headers: {
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': (rateLimitResult.remaining - 1).toString(),
        'X-RateLimit-Reset': rateLimitResult.resetAt.getTime().toString()
      }
    });

  } catch (_error) {
    console.error('❌ Get orders error:', _error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}