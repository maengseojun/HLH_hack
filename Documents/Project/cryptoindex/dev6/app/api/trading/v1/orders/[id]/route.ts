// app/api/trading/v1/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePrivyAuth } from '@/lib/middleware/privy-auth';
import { createClient } from '@supabase/supabase-js';
import { TradingOrderService } from '@/lib/trading/order-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/trading/v1/orders/[id] - Get specific order
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if ('status' in authResult) {
      return authResult;
    }

    const { user } = authResult;
    const orderId = params.id;

    // Get order with token information
    const { data: order, error } = await supabase
      .from('trading_orders')
      .select(`
        *,
        index_tokens!inner(symbol, name, nav_per_token)
      `)
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (error || !order) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Order not found'
        },
        { status: 404 }
      );
    }

    // Format response
    const formattedOrder = {
      id: order.id,
      tokenAddress: order.token_address,
      symbol: order.index_tokens?.symbol || 'UNKNOWN',
      tokenName: order.index_tokens?.name || 'Unknown Token',
      navPerToken: order.index_tokens?.nav_per_token || '0',
      type: order.order_type,
      side: order.side,
      amount: order.amount,
      price: order.price,
      status: order.status,
      filledAmount: order.filled_amount || '0',
      remainingAmount: order.remaining_amount || order.amount,
      averageFillPrice: order.average_fill_price,
      hypercoreOrderId: order.hypercore_order_id,
      transactionHash: order.transaction_hash,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      filledAt: order.filled_at,
      cancelledAt: order.cancelled_at,
      errorMessage: order.error_message
    };

    return NextResponse.json({
      success: true,
      order: formattedOrder
    });

  } catch (_error) {
    console.error('❌ Get order error:', _error);
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
 * DELETE /api/trading/v1/orders/[id] - Cancel order
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if ('status' in authResult) {
      return authResult;
    }

    const { user } = authResult;
    const orderId = params.id;

    // Check if order exists and belongs to user
    const { data: order, error: orderError } = await supabase
      .from('trading_orders')
      .select('id, status, hypercore_order_id, token_address')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Order not found'
        },
        { status: 404 }
      );
    }

    // Check if order can be cancelled
    if (order.status !== 'pending' && order.status !== 'partial') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Order cannot be cancelled'
        },
        { status: 400 }
      );
    }

    // Cancel order using trading service
    const orderService = TradingOrderService.getInstance();
    const cancelResult = await orderService.cancelOrder(orderId, user.id);

    if (!cancelResult.success) {
      return NextResponse.json(
        { 
          success: false,
          error: cancelResult.error
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
      orderId: orderId
    });

  } catch (_error) {
    console.error('❌ Cancel order error:', _error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}