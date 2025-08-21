// lib/trading/precision-utils.ts
import { ethers } from 'ethers';

/**
 * Precision utilities for trading calculations
 * Based on back_dev1's PrecisionMath library concept
 */
export class PrecisionUtils {
  private static readonly PRECISION_DECIMALS = 18;
  private static readonly BASIS_POINTS = 10000;

  /**
   * Calculate precise remaining amount after partial fill
   */
  static calculateRemainingAmount(
    originalAmount: string,
    filledAmount: string,
    decimals: number = 18
  ): string {
    try {
      const original = ethers.parseUnits(originalAmount, decimals);
      const filled = ethers.parseUnits(filledAmount, decimals);
      
      if (filled > original) {
        throw new Error('Filled amount cannot exceed original amount');
      }
      
      const remaining = original - filled;
      return ethers.formatUnits(remaining, decimals);
    } catch (_error) {
      console.error('❌ Error calculating remaining amount:', _error);
      throw new Error('Precision calculation failed');
    }
  }

  /**
   * Calculate average fill price with precision
   */
  static calculateAverageFillPrice(
    fills: Array<{ amount: string; price: string }>,
    decimals: number = 18
  ): string {
    try {
      if (fills.length === 0) return '0';

      let totalValue = 0n;
      let totalAmount = 0n;

      for (const fill of fills) {
        const amount = ethers.parseUnits(fill.amount, decimals);
        const price = ethers.parseUnits(fill.price, decimals);
        
        totalAmount += amount;
        totalValue += (amount * price) / BigInt(10 ** decimals);
      }

      if (totalAmount === 0n) return '0';

      const avgPrice = (totalValue * BigInt(10 ** decimals)) / totalAmount;
      return ethers.formatUnits(avgPrice, decimals);
    } catch (_error) {
      console.error('❌ Error calculating average fill price:', _error);
      throw new Error('Average price calculation failed');
    }
  }

  /**
   * Check if amounts are equal within precision tolerance
   */
  static isAmountEqual(
    amount1: string,
    amount2: string,
    decimals: number = 18,
    toleranceBps: number = 1 // 0.01% tolerance
  ): boolean {
    try {
      const amt1 = ethers.parseUnits(amount1, decimals);
      const amt2 = ethers.parseUnits(amount2, decimals);
      
      if (amt1 === amt2) return true;
      
      const larger = amt1 > amt2 ? amt1 : amt2;
      const smaller = amt1 < amt2 ? amt1 : amt2;
      
      const tolerance = (larger * BigInt(toleranceBps)) / BigInt(this.BASIS_POINTS);
      
      return (larger - smaller) <= tolerance;
    } catch (_error) {
      console.error('❌ Error comparing amounts:', _error);
      return false;
    }
  }

  /**
   * Validate amount precision and format
   */
  static validateAndFormatAmount(
    amount: string,
    decimals: number = 18,
    minAmount: string = '0.000001'
  ): { isValid: boolean; formatted?: string; error?: string } {
    try {
      const parsed = parseFloat(amount);
      
      if (isNaN(parsed) || parsed <= 0) {
        return { isValid: false, error: 'Invalid amount' };
      }

      const minParsed = parseFloat(minAmount);
      if (parsed < minParsed) {
        return { isValid: false, error: `Amount below minimum: ${minAmount}` };
      }

      // Check decimal places
      const decimalPart = amount.split('.')[1];
      if (decimalPart && decimalPart.length > decimals) {
        return { isValid: false, error: `Too many decimal places (max: ${decimals})` };
      }

      // Format with proper precision
      const bigIntAmount = ethers.parseUnits(amount, decimals);
      const formatted = ethers.formatUnits(bigIntAmount, decimals);

      return { isValid: true, formatted };
    } catch (_error) {
      return { isValid: false, error: 'Amount formatting failed' };
    }
  }

  /**
   * Calculate partial fill percentage
   */
  static calculateFillPercentage(
    filledAmount: string,
    totalAmount: string,
    decimals: number = 18
  ): number {
    try {
      const filled = ethers.parseUnits(filledAmount, decimals);
      const total = ethers.parseUnits(totalAmount, decimals);
      
      if (total === 0n) return 0;
      
      const percentage = (filled * BigInt(this.BASIS_POINTS)) / total;
      return Number(percentage) / this.BASIS_POINTS * 100;
    } catch (_error) {
      console.error('❌ Error calculating fill percentage:', _error);
      return 0;
    }
  }

  /**
   * Determine order status based on fill amount
   */
  static determineOrderStatus(
    filledAmount: string,
    totalAmount: string,
    decimals: number = 18
  ): 'pending' | 'partial' | 'filled' | 'cancelled' {
    try {
      const filled = ethers.parseUnits(filledAmount, decimals);
      const total = ethers.parseUnits(totalAmount, decimals);
      
      if (filled === 0n) return 'pending';
      if (this.isAmountEqual(filledAmount, totalAmount, decimals)) return 'filled';
      if (filled > 0n && filled < total) return 'partial';
      
      return 'pending';
    } catch (_error) {
      console.error('❌ Error determining order status:', _error);
      return 'pending';
    }
  }

  /**
   * Safe division with precision handling
   */
  static safeDivide(
    numerator: string,
    denominator: string,
    decimals: number = 18
  ): string {
    try {
      const num = ethers.parseUnits(numerator, decimals);
      const den = ethers.parseUnits(denominator, decimals);
      
      if (den === 0n) throw new Error('Division by zero');
      
      const result = (num * BigInt(10 ** decimals)) / den;
      return ethers.formatUnits(result, decimals);
    } catch (_error) {
      console.error('❌ Error in safe division:', _error);
      throw new Error('Division calculation failed');
    }
  }

  /**
   * Safe multiplication with precision handling
   */
  static safeMultiply(
    value1: string,
    value2: string,
    decimals: number = 18
  ): string {
    try {
      const val1 = ethers.parseUnits(value1, decimals);
      const val2 = ethers.parseUnits(value2, decimals);
      
      const result = (val1 * val2) / BigInt(10 ** decimals);
      return ethers.formatUnits(result, decimals);
    } catch (_error) {
      console.error('❌ Error in safe multiplication:', _error);
      throw new Error('Multiplication calculation failed');
    }
  }

  /**
   * Safe addition with precision handling
   */
  static safeAdd(
    value1: string,
    value2: string,
    decimals: number = 18
  ): string {
    try {
      const val1 = ethers.parseUnits(value1, decimals);
      const val2 = ethers.parseUnits(value2, decimals);
      
      const result = val1 + val2;
      return ethers.formatUnits(result, decimals);
    } catch (_error) {
      console.error('❌ Error in safe addition:', _error);
      throw new Error('Addition calculation failed');
    }
  }

  /**
   * Safe subtraction with precision handling
   */
  static safeSubtract(
    value1: string,
    value2: string,
    decimals: number = 18
  ): string {
    try {
      const val1 = ethers.parseUnits(value1, decimals);
      const val2 = ethers.parseUnits(value2, decimals);
      
      if (val2 > val1) {
        throw new Error('Subtraction would result in negative value');
      }
      
      const result = val1 - val2;
      return ethers.formatUnits(result, decimals);
    } catch (_error) {
      console.error('❌ Error in safe subtraction:', _error);
      throw new Error('Subtraction calculation failed');
    }
  }
}

export default PrecisionUtils;