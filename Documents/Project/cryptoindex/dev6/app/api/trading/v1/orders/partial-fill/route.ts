// app/api/trading/v1/orders/partial-fill/route.ts
import { NextRequest, NextResponse } from 'next/server';
import PartialFillManager from '@/lib/trading/partial-fill-manager';

/**
 * POST /api/trading/v1/orders/partial-fill
 * Execute partial fill for an order (for testing and manual execution)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      orderId, 
      fillAmount, 
      executionPrice, 
      counterpartyOrderId, 
      isMarketMaker 
    } = body;

    // Validate required fields
    if (!orderId || !fillAmount || !executionPrice) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'orderId, fillAmount, and executionPrice are required'
        }
      }, { status: 400 });
    }

    const fillManager = PartialFillManager.getInstance();
    
    console.log(`🔄 API: Executing partial fill for order ${orderId}`);
    console.log(`💰 Fill details: ${fillAmount} @ ${executionPrice}`);

    // For testing, we need to create a mock order object
    // In real implementation, this would fetch the actual order
    const mockOrder = {
      id: orderId,
      userId: 'test_user',
      tokenAddress: '0x1234567890123456789012345678901234567890',
      symbol: 'MEME_INDEX',
      type: 'limit' as const,
      side: 'buy' as const,
      amount: '1000.0',
      filledAmount: '0',
      remainingAmount: '1000.0',
      price: executionPrice,
      status: 'open' as const,
      timeInForce: 'GTC' as const,
      reduceOnly: false,
      postOnly: false,
      averagePrice: '0',
      totalFees: '0',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await fillManager.executePartialFill(
      mockOrder,
      fillAmount,
      executionPrice,
      counterpartyOrderId,
      isMarketMaker || false
    );

    if (result.success && result.fill) {
      console.log(`✅ API: Partial fill executed successfully`);
      console.log(`📊 Fill ID: ${result.fill.fillId}`);
      console.log(`📈 Fill Percentage: ${result.fill.fillPercentage.toFixed(2)}%`);
      console.log(`💸 Total Fees: ${result.fill.fees.total}`);

      return NextResponse.json({
        success: true,
        data: {
          fillExecution: {
            fillId: result.fill.fillId,
            orderId: result.fill.orderId,
            fillAmount: result.fill.fillAmount,
            executionPrice: result.fill.executionPrice,
            remainingAmount: result.fill.remainingAmount,
            fillPercentage: result.fill.fillPercentage,
            fees: result.fill.fees,
            timestamp: result.fill.timestamp,
            isMarketMaker: result.fill.isMarketMaker
          },
          updatedOrder: result.updatedOrder,
          message: `Partial fill executed: ${fillAmount} @ ${executionPrice}`
        }
      });
    } else {
      console.error(`❌ API: Partial fill execution failed:`, result.error);
      
      return NextResponse.json({
        success: false,
        error: {
          code: 'PARTIAL_FILL_FAILED',
          message: result.error || 'Failed to execute partial fill'
        }
      }, { status: 400 });
    }

  } catch (_error) {
    console.error('❌ API: Partial fill request failed:', _error);
    
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
 * GET /api/trading/v1/orders/partial-fill?orderId=xxx
 * Get partial fill summary for an order
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_ORDER_ID',
          message: 'orderId parameter is required'
        }
      }, { status: 400 });
    }

    const fillManager = PartialFillManager.getInstance();
    
    console.log(`📊 API: Getting fill summary for order ${orderId}`);

    // Get fill summary
    const summary = await fillManager.getOrderFillSummary(orderId);
    
    if (!summary) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found or no fills exist'
        }
      }, { status: 404 });
    }

    // Get detailed fills
    const fills = await fillManager.getOrderFills(orderId);

    console.log(`✅ API: Retrieved ${fills.length} fills for order ${orderId}`);
    console.log(`📈 Fill percentage: ${summary.fillPercentage.toFixed(2)}%`);
    console.log(`💰 Average price: ${summary.averagePrice}`);

    return NextResponse.json({
      success: true,
      data: {
        summary,
        fills,
        analytics: {
          totalExecutions: fills.length,
          averageFillSize: fills.length > 0 ? 
            (parseFloat(summary.totalFilled) / fills.length).toFixed(6) : '0',
          priceRange: fills.length > 0 ? {
            lowest: Math.min(...fills.map(f => parseFloat(f.executionPrice))).toFixed(6),
            highest: Math.max(...fills.map(f => parseFloat(f.executionPrice))).toFixed(6)
          } : null,
          feeBreakdown: {
            makerFees: fills.reduce((sum, f) => sum + parseFloat(f.fees.maker), 0).toFixed(6),
            takerFees: fills.reduce((sum, f) => sum + parseFloat(f.fees.taker), 0).toFixed(6),
            totalFees: summary.totalFees
          }
        }
      }
    });

  } catch (_error) {
    console.error('❌ API: Failed to get partial fill summary:', _error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve fill summary'
      }
    }, { status: 500 });
  }
}