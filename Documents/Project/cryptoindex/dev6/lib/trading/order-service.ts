// lib/trading/order-service.ts
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { PortfolioService } from './portfolio-service';
import { HybridSmartRouterV2 } from '@/lib/trading/smart-router-v2';
import { UltraPerformanceOrderbook } from '@/lib/orderbook/ultra-performance-orderbook';
import type { Order } from '@/lib/types/trading';

interface CreateOrderRequest {
  userId: string;
  tokenAddress: string;
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: string;
  price?: string;
}

interface CreateOrderResult {
  success: boolean;
  order?: any;
  error?: string;
}

interface CancelOrderResult {
  success: boolean;
  error?: string;
}

export class TradingOrderService {
  private static instance: TradingOrderService;
  private supabase;
  private smartRouter: HybridSmartRouterV2;
  private matchingEngine: UltraPerformanceOrderbook;
  private portfolioService;

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.smartRouter = HybridSmartRouterV2.getInstance();
    this.matchingEngine = UltraPerformanceOrderbook.getInstance();
    this.portfolioService = PortfolioService.getInstance();
  }

  static getInstance(): TradingOrderService {
    if (!TradingOrderService.instance) {
      TradingOrderService.instance = new TradingOrderService();
    }
    return TradingOrderService.instance;
  }

  /**
   * Create a new trading order
   */
  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResult> {
    try {
      console.log(`🔄 Creating ${request.side} order for ${request.amount} ${request.tokenAddress}`);

      // Validate amount
      const amountNum = parseFloat(request.amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return {
          success: false,
          error: 'Invalid order amount'
        };
      }

      // Validate price for limit orders
      if (request.type === 'limit') {
        if (!request.price) {
          return {
            success: false,
            error: 'Price is required for limit orders'
          };
        }
        
        const priceNum = parseFloat(request.price);
        if (isNaN(priceNum) || priceNum <= 0) {
          return {
            success: false,
            error: 'Invalid order price'
          };
        }
      }

      // Check user balances for buy orders
      if (request.side === 'buy') {
        const hasBalance = await this.validateBuyOrderBalance(
          request.userId,
          request.tokenAddress,
          request.amount,
          request.price,
          request.type
        );
        
        if (!hasBalance.valid) {
          return {
            success: false,
            error: hasBalance.error
          };
        }
      }

      // Check user position for sell orders
      if (request.side === 'sell') {
        const hasPosition = await this.validateSellOrderPosition(
          request.userId,
          request.tokenAddress,
          request.amount
        );
        
        if (!hasPosition.valid) {
          return {
            success: false,
            error: hasPosition.error
          };
        }
      }

      // Create order record in database
      const { data: orderData, error: dbError } = await this.supabase
        .from('trading_orders')
        .insert({
          user_id: request.userId,
          token_address: request.tokenAddress,
          order_type: request.type,
          side: request.side,
          amount: request.amount,
          price: request.price,
          status: 'pending',
          remaining_amount: request.amount
        })
        .select()
        .single();

      if (dbError || !orderData) {
        console.error('❌ Failed to create order in database:', dbError);
        return {
          success: false,
          error: 'Failed to create order record'
        };
      }

      // Submit order to off-chain matching engine
      const matchingOrder: Order = {
        id: orderData.id,
        pair: `${request.tokenAddress}-USDC`, // Assuming USDC pairs
        side: request.side,
        type: request.type,
        price: request.price || '0',
        amount: request.amount,
        userId: request.userId,
        status: 'pending',
        filled: '0',
        timestamp: Date.now()
      };

      const matchResult = await this.matchingEngine.placeOrder(matchingOrder);

      if (!matchResult.success) {
        // Update order status as failed
        await this.supabase
          .from('trading_orders')
          .update({
            status: 'cancelled',
            error_message: 'Failed to place order in matching engine',
            cancelled_at: new Date().toISOString()
          })
          .eq('id', orderData.id);

        return {
          success: false,
          error: 'Failed to place order in matching engine'
        };
      }

      // Get updated order data
      const { data: updatedOrder, error: updateError } = await this.supabase
        .from('trading_orders')
        .select(`
          *,
          index_tokens!inner(symbol, name)
        `)
        .eq('id', orderData.id)
        .single();

      if (updateError) {
        console.error('❌ Failed to get updated order:', updateError);
      }

      console.log(`✅ Order created successfully: ${orderData.id}`);

      return {
        success: true,
        order: {
          id: updatedOrder?.id || orderData.id,
          tokenAddress: request.tokenAddress,
          symbol: updatedOrder?.index_tokens?.symbol || 'UNKNOWN',
          type: request.type,
          side: request.side,
          amount: request.amount,
          price: request.price,
          status: matchResult.status || 'pending',
          filled: matchResult.filledAmount || '0',
          createdAt: orderData.created_at
        }
      };

    } catch (_error) {
      console.error('❌ Order creation failed:', _error);
      return {
        success: false,
        error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
      };
    }
  }

  /**
   * Cancel an existing order
   */
  async cancelOrder(orderId: string, userId: string): Promise<CancelOrderResult> {
    try {
      console.log(`🔄 Cancelling order: ${orderId}`);

      // Get order details
      const { data: order, error: orderError } = await this.supabase
        .from('trading_orders')
        .select('id, hypercore_order_id, status, user_id')
        .eq('id', orderId)
        .eq('user_id', userId)
        .single();

      if (orderError || !order) {
        return {
          success: false,
          error: 'Order not found'
        };
      }

      if (order.status !== 'pending' && order.status !== 'partial') {
        return {
          success: false,
          error: 'Order cannot be cancelled'
        };
      }

      // Cancel order in off-chain matching engine
      const cancelResult = await this.matchingEngine.cancelOrder(orderId);
      
      if (!cancelResult) {
        return {
          success: false,
          error: 'Failed to cancel order in matching engine'
        };
      }

      // Update order status in database
      const { error: updateError } = await this.supabase
        .from('trading_orders')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('❌ Failed to update cancelled order:', updateError);
        return {
          success: false,
          error: 'Failed to update order status'
        };
      }

      // Update user balances
      await this.portfolioService.updateUserBalances(userId);

      console.log(`✅ Order cancelled successfully: ${orderId}`);

      return {
        success: true
      };

    } catch (_error) {
      console.error('❌ Order cancellation failed:', _error);
      return {
        success: false,
        error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
      };
    }
  }

  /**
   * Get user's wallet address from Privy session
   */
  private async getUserWalletAddress(userId: string): Promise<string | null> {
    try {
      // Get user wallet from Privy integration
      const { data: user } = await this.supabase
        .from('users')
        .select('wallet_address, privy_user_id')
        .eq('privy_user_id', userId)
        .single();

      return user?.wallet_address || null;
    } catch (_error) {
      console.error('Failed to get user wallet:', _error);
      return null;
    }
  }

  /**
   * Validate balance for buy orders
   */
  private async validateBuyOrderBalance(
    userId: string,
    tokenAddress: string,
    amount: string,
    price: string | undefined,
    type: 'market' | 'limit'
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // For buy orders, we need USDC balance
      const usdcAddress = '0xA0b86991c431C924b3c27dF22c2F7aD5e8b6d8E67'; // Example USDC address

      // Get current USDC balance
      const { data: balance } = await this.supabase
        .from('user_balances')
        .select('available_balance')
        .eq('user_id', userId)
        .eq('token_address', usdcAddress)
        .single();

      const availableBalance = parseFloat(balance?.available_balance || '0');
      
      // Calculate required amount
      let requiredAmount: number;
      
      if (type === 'market') {
        // For market orders, get best available price from orderbook
        const orderbook = await this.matchingEngine.getOrderbook(`${tokenAddress}-USDC`, 1);
        const bestPrice = side === 'buy' 
          ? orderbook.asks[0]?.price || '0'
          : orderbook.bids[0]?.price || '0';
        requiredAmount = parseFloat(amount) * parseFloat(bestPrice);
      } else {
        // For limit orders, use specified price
        requiredAmount = parseFloat(amount) * parseFloat(price!);
      }

      if (availableBalance < requiredAmount) {
        return {
          valid: false,
          error: `Insufficient USDC balance. Required: ${requiredAmount.toFixed(4)}, Available: ${availableBalance.toFixed(4)}`
        };
      }

      return { valid: true };

    } catch (_error) {
      console.error('❌ Balance validation failed:', _error);
      return {
        valid: false,
        error: 'Failed to validate balance'
      };
    }
  }

  /**
   * Validate position for sell orders
   */
  private async validateSellOrderPosition(
    userId: string,
    tokenAddress: string,
    amount: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Get current position
      const { data: position } = await this.supabase
        .from('trading_positions')
        .select('amount')
        .eq('user_id', userId)
        .eq('token_address', tokenAddress)
        .single();

      const availableAmount = parseFloat(position?.amount || '0');
      const requiredAmount = parseFloat(amount);

      if (availableAmount < requiredAmount) {
        return {
          valid: false,
          error: `Insufficient token balance. Required: ${requiredAmount}, Available: ${availableAmount}`
        };
      }

      return { valid: true };

    } catch (_error) {
      console.error('❌ Position validation failed:', _error);
      return {
        valid: false,
        error: 'Failed to validate position'
      };
    }
  }

  /**
   * Get order status from matching engine
   */
  async getOrderStatus(orderId: string): Promise<string> {
    try {
      const order = await this.matchingEngine.getOrder(orderId);
      return order?.status || 'unknown';
    } catch (_error) {
      console.error('Failed to get order status:', _error);
      return 'unknown';
    }
  }

}

export default TradingOrderService;