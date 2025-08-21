import { NextRequest, NextResponse } from 'next/server';
import { ParallelMatchingEngine } from '@/lib/orderbook/parallel-matching-engine';

// GET /api/trading/v1/orderbook - 오더북 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pair = searchParams.get('pair');
    const depth = parseInt(searchParams.get('depth') || '20');

    if (!pair) {
      return NextResponse.json(
        { success: false, error: 'Pair parameter is required' },
        { status: 400 }
      );
    }

    // 오더북 조회
    const matchingEngine = ParallelMatchingEngine.getInstance();
    const orderbook = await matchingEngine.getOrderbook(pair, depth);

    // Calculate spread
    let spread = null;
    if (orderbook.bids.length > 0 && orderbook.asks.length > 0) {
      const bestBid = parseFloat(orderbook.bids[0].price);
      const bestAsk = parseFloat(orderbook.asks[0].price);
      const spreadValue = bestAsk - bestBid;
      const spreadPercent = (spreadValue / bestBid) * 100;
      
      spread = {
        absolute: spreadValue.toFixed(9),
        percent: spreadPercent.toFixed(4)
      };
    }

    return NextResponse.json({
      success: true,
      orderbook: {
        pair,
        bids: orderbook.bids,
        asks: orderbook.asks,
        spread,
        lastUpdate: Date.now()
      }
    });

  } catch (_error) {
    console.error('Orderbook fetch error:', _error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}