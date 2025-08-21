// app/api/trading/v1/orders/advanced/route.ts
import { NextRequest, NextResponse } from 'next/server';
import AdvancedOrderService, { CreateAdvancedOrderRequest } from '@/lib/trading/advanced-order-service';

/**
 * POST /api/trading/v1/orders/advanced
 * Create advanced trading order with full feature support
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract and validate order data
    const orderRequest: CreateAdvancedOrderRequest = {
      userId: body.userId,
      tokenAddress: body.tokenAddress,
      type: body.type,
      side: body.side,
      amount: body.amount,
      price: body.price,
      triggerPrice: body.triggerPrice,
      triggerCondition: body.triggerCondition,
      trailAmount: body.trailAmount,
      trailPercent: body.trailPercent,
      timeInForce: body.timeInForce || 'GTC',
      expireTime: body.expireTime ? new Date(body.expireTime) : undefined,
      reduceOnly: body.reduceOnly || false,
      postOnly: body.postOnly || false,
      clientOrderId: body.clientOrderId,
      ocoGroup: body.ocoGroup,
      linkedOrderId: body.linkedOrderId,
      visibleSize: body.visibleSize,
      leverage: body.leverage,
      marginType: body.marginType,
    };

    // Validate required fields
    if (!orderRequest.userId || !orderRequest.tokenAddress || !orderRequest.type || 
        !orderRequest.side || !orderRequest.amount) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'userId, tokenAddress, type, side, and amount are required'
        }
      }, { status: 400 });
    }

    const orderService = AdvancedOrderService.getInstance();
    
    console.log(`🔄 API: Creating advanced ${orderRequest.type} order for ${orderRequest.userId}`);
    console.log(`📊 Order details: ${orderRequest.side} ${orderRequest.amount} ${orderRequest.tokenAddress}`);
    
    if (orderRequest.triggerPrice) {
      console.log(`🎯 Trigger price: ${orderRequest.triggerPrice}`);
    }
    
    if (orderRequest.price) {
      console.log(`💰 Limit price: ${orderRequest.price}`);
    }

    const result = await orderService.createAdvancedOrder(orderRequest);

    if (result.success && result.order) {
      console.log(`✅ API: Advanced order created successfully - ${result.order.id}`);
      
      return NextResponse.json({
        success: true,
        data: {
          orderId: result.order.id,
          clientOrderId: result.order.clientOrderId,
          type: result.order.type,
          side: result.order.side,
          amount: result.order.amount,
          price: result.order.price,
          triggerPrice: result.order.triggerPrice,
          status: result.order.status,
          timeInForce: result.order.timeInForce,
          createdAt: result.order.createdAt,
          message: `${result.order.type} order created successfully`
        }
      });
    } else {
      console.error(`❌ API: Advanced order creation failed:`, result.error);
      
      return NextResponse.json({
        success: false,
        error: {
          code: 'ORDER_CREATION_FAILED',
          message: result.error || 'Failed to create order'
        }
      }, { status: 400 });
    }

  } catch (_error) {
    console.error('❌ API: Advanced order request failed:', _error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    }, { status: 500 });
  }
}

/**
 * GET /api/trading/v1/orders/advanced
 * Get user's advanced orders with filtering options
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const status = url.searchParams.get('status');
    const orderType = url.searchParams.get('type');
    const tokenAddress = url.searchParams.get('tokenAddress');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'userId parameter is required'
        }
      }, { status: 400 });
    }

    // Build query
    let query = `
      SELECT *
      FROM advanced_orders
      WHERE user_id = $1
    `;
    const params: any[] = [userId];
    let paramIndex = 2;

    // Add filters
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (orderType) {
      query += ` AND order_type = $${paramIndex}`;
      params.push(orderType);
      paramIndex++;
    }

    if (tokenAddress) {
      query += ` AND token_address = $${paramIndex}`;
      params.push(tokenAddress);
      paramIndex++;
    }

    // Add ordering and pagination
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    // For now, we'll return mock data since we're not connecting to a real database
    // In real implementation, this would query the database
    const mockOrders = [
      {
        id: 'ord_1234567890',
        userId,
        tokenAddress: tokenAddress || '0x1234567890123456789012345678901234567890',
        symbol: 'MEME_INDEX',
        type: orderType || 'stop_loss',
        side: 'sell',
        amount: '100.0',
        filledAmount: '0',
        remainingAmount: '100.0',
        price: null,
        triggerPrice: '2.50',
        triggerCondition: 'below',
        status: status || 'open',
        timeInForce: 'GTC',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    return NextResponse.json({
      success: true,
      data: {
        orders: mockOrders,
        pagination: {
          limit,
          offset,
          total: mockOrders.length,
          hasMore: false
        }
      }
    });

  } catch (_error) {
    console.error('❌ API: Failed to get advanced orders:', _error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve orders'
      }
    }, { status: 500 });
  }
}