// lib/trading/partial-fill-manager.ts
import { createClient } from '@supabase/supabase-js';
import PrecisionUtils from './precision-utils';
import { AdvancedOrder, OrderStatus } from './advanced-order-service';

/**
 * Partial Fill Manager
 * Handles sophisticated partial order execution with precise calculations
 * Resolves token precision issues in partial fills
 */

export interface PartialFillExecution {
  fillId: string;
  orderId: string;
  executionPrice: string;
  fillAmount: string;
  remainingAmount: string;
  fillPercentage: number;
  fees: {
    maker: string;
    taker: string;
    total: string;
  };
  timestamp: Date;
  counterpartyOrderId?: string;
  isMarketMaker: boolean;
}

export interface PartialFillSummary {
  orderId: string;
  totalFilled: string;
  totalRemaining: string;
  averagePrice: string;
  fillPercentage: number;
  executionCount: number;
  totalFees: string;
  status: OrderStatus;
  lastFillTimestamp?: Date;
}

export class PartialFillManager {
  private static instance: PartialFillManager;
  private supabase;

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  static getInstance(): PartialFillManager {
    if (!PartialFillManager.instance) {
      PartialFillManager.instance = new PartialFillManager();
    }
    return PartialFillManager.instance;
  }

  /**
   * Execute partial fill with precise calculations
   */
  async executePartialFill(
    order: AdvancedOrder,
    fillAmount: string,
    executionPrice: string,
    counterpartyOrderId?: string,
    isMarketMaker: boolean = false
  ): Promise<{
    success: boolean;
    fill?: PartialFillExecution;
    updatedOrder?: Partial<AdvancedOrder>;
    error?: string;
  }> {
    try {
      console.log(`🔄 Executing partial fill: ${fillAmount} of ${order.amount} for order ${order.id}`);

      // Get token decimals for precise calculations
      const tokenDecimals = await this.getTokenDecimals(order.tokenAddress);

      // Validate fill amount
      const validation = this.validateFillAmount(
        fillAmount,
        order.remainingAmount,
        tokenDecimals
      );

      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Calculate new remaining amount with precision
      const newRemainingAmount = PrecisionUtils.calculateRemainingAmount(
        order.remainingAmount,
        fillAmount,
        tokenDecimals
      );

      // Calculate new total filled amount
      const newFilledAmount = PrecisionUtils.safeAdd(
        order.filledAmount,
        fillAmount,
        tokenDecimals
      );

      // Calculate fill percentage
      const fillPercentage = PrecisionUtils.calculateFillPercentage(
        fillAmount,
        order.amount,
        tokenDecimals
      );

      // Calculate fees
      const fees = this.calculateFillFees(
        fillAmount,
        executionPrice,
        isMarketMaker,
        tokenDecimals
      );

      // Generate fill ID
      const fillId = this.generateFillId();

      // Create fill execution record
      const fillExecution: PartialFillExecution = {
        fillId,
        orderId: order.id,
        executionPrice,
        fillAmount,
        remainingAmount: newRemainingAmount,
        fillPercentage,
        fees,
        timestamp: new Date(),
        counterpartyOrderId,
        isMarketMaker
      };

      // Save fill execution to database
      const { error: fillDbError } = await this.supabase
        .from('order_fills')
        .insert({
          fill_id: fillExecution.fillId,
          order_id: fillExecution.orderId,
          execution_price: fillExecution.executionPrice,
          fill_amount: fillExecution.fillAmount,
          remaining_amount: fillExecution.remainingAmount,
          fill_percentage: fillExecution.fillPercentage,
          maker_fee: fillExecution.fees.maker,
          taker_fee: fillExecution.fees.taker,
          total_fee: fillExecution.fees.total,
          timestamp: fillExecution.timestamp.toISOString(),
          counterparty_order_id: fillExecution.counterpartyOrderId,
          is_market_maker: fillExecution.isMarketMaker
        });

      if (fillDbError) {
        console.error('❌ Failed to save fill execution:', fillDbError);
        return {
          success: false,
          error: 'Failed to save fill execution'
        };
      }

      // Calculate updated average price
      const allFills = await this.getOrderFills(order.id);
      allFills.push(fillExecution);
      
      const newAveragePrice = PrecisionUtils.calculateAverageFillPrice(
        allFills.map(fill => ({
          amount: fill.fillAmount,
          price: fill.executionPrice
        })),
        tokenDecimals
      );

      // Calculate total fees
      const totalFees = allFills.reduce((total, fill) => 
        PrecisionUtils.safeAdd(total, fill.fees.total, tokenDecimals), '0'
      );

      // Determine order status
      const newStatus = PrecisionUtils.determineOrderStatus(
        newFilledAmount,
        order.amount,
        tokenDecimals
      );

      // Map precision utils status to order status
      const mappedStatus: OrderStatus = newStatus === 'filled' ? 'filled' : 
                                       newStatus === 'partial' ? 'partially_filled' : 
                                       order.status;

      // Prepare order updates
      const orderUpdates = {
        filledAmount: newFilledAmount,
        remainingAmount: newRemainingAmount,
        averagePrice: newAveragePrice,
        totalFees,
        status: mappedStatus,
        updatedAt: new Date(),
        executedAt: mappedStatus === 'filled' ? new Date() : order.executedAt
      };

      // Update order in database
      const { error: orderUpdateError } = await this.supabase
        .from('advanced_orders')
        .update({
          filled_amount: orderUpdates.filledAmount,
          remaining_amount: orderUpdates.remainingAmount,
          average_price: orderUpdates.averagePrice,
          total_fees: orderUpdates.totalFees,
          status: orderUpdates.status,
          updated_at: orderUpdates.updatedAt.toISOString(),
          executed_at: orderUpdates.executedAt?.toISOString()
        })
        .eq('id', order.id);

      if (orderUpdateError) {
        console.error('❌ Failed to update order:', orderUpdateError);
        return {
          success: false,
          error: 'Failed to update order'
        };
      }

      // Log success
      const completionStatus = mappedStatus === 'filled' ? 'COMPLETED' : 
                              mappedStatus === 'partially_filled' ? 'PARTIALLY FILLED' : 'UPDATED';
      
      console.log(`✅ Partial fill executed successfully for order ${order.id}:`);
      console.log(`   Fill Amount: ${fillAmount}`);
      console.log(`   Execution Price: ${executionPrice}`);
      console.log(`   Remaining: ${newRemainingAmount}`);
      console.log(`   Status: ${completionStatus}`);
      console.log(`   Average Price: ${newAveragePrice}`);
      console.log(`   Total Fees: ${totalFees}`);

      return {
        success: true,
        fill: fillExecution,
        updatedOrder: orderUpdates
      };

    } catch (_error) {
      console.error('❌ Partial fill execution failed:', _error);
      return {
        success: false,
        error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
      };
    }
  }

  /**
   * Get comprehensive fill summary for an order
   */
  async getOrderFillSummary(orderId: string): Promise<PartialFillSummary | null> {
    try {
      const fills = await this.getOrderFills(orderId);
      
      if (fills.length === 0) {
        return null;
      }

      // Get order details
      const { data: orderData } = await this.supabase
        .from('advanced_orders')
        .select('amount, filled_amount, remaining_amount, average_price, total_fees, status')
        .eq('id', orderId)
        .single();

      if (!orderData) {
        return null;
      }

      // Calculate fill percentage
      const fillPercentage = PrecisionUtils.calculateFillPercentage(
        orderData.filled_amount,
        orderData.amount,
        18 // Default decimals
      );

      // Get last fill timestamp
      const lastFill = fills.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];

      return {
        orderId,
        totalFilled: orderData.filled_amount,
        totalRemaining: orderData.remaining_amount,
        averagePrice: orderData.average_price,
        fillPercentage,
        executionCount: fills.length,
        totalFees: orderData.total_fees,
        status: orderData.status,
        lastFillTimestamp: lastFill?.timestamp
      };

    } catch (_error) {
      console.error('❌ Failed to get order fill summary:', _error);
      return null;
    }
  }

  /**
   * Get all fills for an order
   */
  async getOrderFills(orderId: string): Promise<PartialFillExecution[]> {
    try {
      const { data, error } = await this.supabase
        .from('order_fills')
        .select('*')
        .eq('order_id', orderId)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('❌ Failed to get order fills:', _error);
        return [];
      }

      return (data || []).map(row => ({
        fillId: row.fill_id,
        orderId: row.order_id,
        executionPrice: row.execution_price,
        fillAmount: row.fill_amount,
        remainingAmount: row.remaining_amount,
        fillPercentage: row.fill_percentage,
        fees: {
          maker: row.maker_fee,
          taker: row.taker_fee,
          total: row.total_fee
        },
        timestamp: new Date(row.timestamp),
        counterpartyOrderId: row.counterparty_order_id,
        isMarketMaker: row.is_market_maker
      }));

    } catch (_error) {
      console.error('❌ Failed to get order fills:', _error);
      return [];
    }
  }

  /**
   * Validate fill amount against remaining amount
   */
  private validateFillAmount(
    fillAmount: string, 
    remainingAmount: string, 
    decimals: number
  ): { isValid: boolean; error?: string } {
    try {
      // Validate format
      const fillValidation = PrecisionUtils.validateAndFormatAmount(fillAmount, decimals);
      if (!fillValidation.isValid) {
        return {
          isValid: false,
          error: `Invalid fill amount: ${fillValidation.error}`
        };
      }

      // Check if fill amount exceeds remaining
      const fillBigInt = BigInt(fillAmount.replace('.', '').padEnd(decimals, '0'));
      const remainingBigInt = BigInt(remainingAmount.replace('.', '').padEnd(decimals, '0'));

      if (fillBigInt > remainingBigInt) {
        return {
          isValid: false,
          error: 'Fill amount exceeds remaining amount'
        };
      }

      if (fillBigInt <= 0n) {
        return {
          isValid: false,
          error: 'Fill amount must be positive'
        };
      }

      return { isValid: true };

    } catch (_error) {
      return {
        isValid: false,
        error: 'Fill amount validation failed'
      };
    }
  }

  /**
   * Calculate fees for a fill
   */
  private calculateFillFees(
    fillAmount: string,
    executionPrice: string,
    isMarketMaker: boolean,
    decimals: number
  ): { maker: string; taker: string; total: string } {
    try {
      // Calculate fill value
      const fillValue = PrecisionUtils.safeMultiply(fillAmount, executionPrice, decimals);
      
      // Fee rates (in basis points)
      const makerFeeRate = 0.001; // 0.1%
      const takerFeeRate = 0.002; // 0.2%
      
      const feeRate = isMarketMaker ? makerFeeRate : takerFeeRate;
      const feeAmount = PrecisionUtils.safeMultiply(
        fillValue,
        feeRate.toString(),
        decimals
      );

      return {
        maker: isMarketMaker ? feeAmount : '0',
        taker: isMarketMaker ? '0' : feeAmount,
        total: feeAmount
      };

    } catch (_error) {
      console.error('❌ Fee calculation failed:', _error);
      return {
        maker: '0',
        taker: '0',
        total: '0'
      };
    }
  }

  /**
   * Get token decimals
   */
  private async getTokenDecimals(tokenAddress: string): Promise<number> {
    try {
      const { data } = await this.supabase
        .from('index_tokens')
        .select('decimals')
        .eq('token_address', tokenAddress)
        .single();

      return data?.decimals || 18; // Default to 18 decimals

    } catch (_error) {
      console.error('❌ Failed to get token decimals:', _error);
      return 18;
    }
  }

  /**
   * Generate unique fill ID
   */
  private generateFillId(): string {
    return `fill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Handle precision rounding issues
   */
  async fixPrecisionIssues(orderId: string): Promise<{
    success: boolean;
    fixed: boolean;
    details?: string;
  }> {
    try {
      console.log(`🔧 Checking precision issues for order ${orderId}`);

      const { data: orderData } = await this.supabase
        .from('advanced_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (!orderData) {
        return {
          success: false,
          fixed: false,
          details: 'Order not found'
        };
      }

      const tokenDecimals = await this.getTokenDecimals(orderData.token_address);
      
      // Check if filled + remaining equals original amount
      const calculatedRemaining = PrecisionUtils.calculateRemainingAmount(
        orderData.amount,
        orderData.filled_amount,
        tokenDecimals
      );

      const isEqual = PrecisionUtils.isAmountEqual(
        calculatedRemaining,
        orderData.remaining_amount,
        tokenDecimals
      );

      if (!isEqual) {
        console.log(`🔧 Precision issue detected, fixing...`);
        console.log(`   Original: ${orderData.amount}`);
        console.log(`   Filled: ${orderData.filled_amount}`);
        console.log(`   Remaining (stored): ${orderData.remaining_amount}`);
        console.log(`   Remaining (calculated): ${calculatedRemaining}`);

        // Fix the remaining amount
        await this.supabase
          .from('advanced_orders')
          .update({
            remaining_amount: calculatedRemaining,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);

        console.log(`✅ Precision issue fixed for order ${orderId}`);

        return {
          success: true,
          fixed: true,
          details: `Fixed remaining amount: ${orderData.remaining_amount} → ${calculatedRemaining}`
        };
      }

      return {
        success: true,
        fixed: false,
        details: 'No precision issues found'
      };

    } catch (_error) {
      console.error('❌ Failed to fix precision issues:', _error);
      return {
        success: false,
        fixed: false,
        details: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
      };
    }
  }
}

export default PartialFillManager;