// app/api/trading/v1/orders/precision-fix/route.ts
import { NextRequest, NextResponse } from 'next/server';
import PartialFillManager from '@/lib/trading/partial-fill-manager';

/**
 * POST /api/trading/v1/orders/precision-fix
 * Fix precision issues in order calculations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_ORDER_ID',
          message: 'orderId is required'
        }
      }, { status: 400 });
    }

    const fillManager = PartialFillManager.getInstance();
    
    console.log(`🔧 API: Fixing precision issues for order ${orderId}`);

    const result = await fillManager.fixPrecisionIssues(orderId);

    if (result.success) {
      if (result.fixed) {
        console.log(`✅ API: Precision issues fixed for order ${orderId}`);
        console.log(`🔧 Details: ${result.details}`);
        
        return NextResponse.json({
          success: true,
          data: {
            orderId,
            fixed: true,
            details: result.details,
            message: 'Precision issues have been fixed'
          }
        });
      } else {
        console.log(`✅ API: No precision issues found for order ${orderId}`);
        
        return NextResponse.json({
          success: true,
          data: {
            orderId,
            fixed: false,
            details: result.details,
            message: 'No precision issues found'
          }
        });
      }
    } else {
      console.error(`❌ API: Failed to fix precision issues:`, result.details);
      
      return NextResponse.json({
        success: false,
        error: {
          code: 'PRECISION_FIX_FAILED',
          message: result.details || 'Failed to fix precision issues'
        }
      }, { status: 400 });
    }

  } catch (_error) {
    console.error('❌ API: Precision fix request failed:', _error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    }, { status: 500 });
  }
}