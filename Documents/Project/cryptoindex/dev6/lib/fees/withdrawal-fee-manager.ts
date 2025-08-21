// lib/fees/withdrawal-fee-manager.ts
import { createClient } from '@supabase/supabase-js';

export interface WithdrawalFeeConfig {
  baseWithdrawalFee: number; // 1 USDC as per Hyperliquid
  minimumWithdrawal: number; // Minimum withdrawal amount
  maximumWithdrawal: number; // Maximum withdrawal amount
  feeWaiverThreshold?: number; // Amount above which fee is waived (optional)
  discountTiers?: FeeDiscountTier[];
}

export interface FeeDiscountTier {
  name: string;
  minimumVolume: number; // 30-day trading volume
  discountPercentage: number; // 0-100
  description: string;
}

export interface WithdrawalFeeCalculation {
  grossAmount: number;
  baseWithdrawalFee: number;
  applicableFee: number;
  netAmount: number;
  discount?: {
    tierName: string;
    originalFee: number;
    discountPercentage: number;
    savings: number;
  };
  feeWaived?: boolean;
  reason?: string;
}

export class WithdrawalFeeManager {
  private static instance: WithdrawalFeeManager;
  private supabase;
  private config: WithdrawalFeeConfig;

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Default fee configuration matching Hyperliquid
    this.config = {
      baseWithdrawalFee: 1.0, // 1 USDC fixed fee
      minimumWithdrawal: 1.01, // Must be more than fee
      maximumWithdrawal: 100000.0,
      feeWaiverThreshold: 10000.0, // Fee waived for withdrawals above 10k USDC
      discountTiers: [
        {
          name: 'Bronze',
          minimumVolume: 10000,
          discountPercentage: 10,
          description: '10% fee discount for $10k+ monthly volume'
        },
        {
          name: 'Silver',
          minimumVolume: 50000,
          discountPercentage: 25,
          description: '25% fee discount for $50k+ monthly volume'
        },
        {
          name: 'Gold',
          minimumVolume: 100000,
          discountPercentage: 50,
          description: '50% fee discount for $100k+ monthly volume'
        },
        {
          name: 'Platinum',
          minimumVolume: 500000,
          discountPercentage: 100,
          description: 'No withdrawal fees for $500k+ monthly volume'
        }
      ]
    };
  }

  static getInstance(): WithdrawalFeeManager {
    if (!WithdrawalFeeManager.instance) {
      WithdrawalFeeManager.instance = new WithdrawalFeeManager();
    }
    return WithdrawalFeeManager.instance;
  }

  /**
   * Calculate withdrawal fee for a specific user and amount
   */
  async calculateWithdrawalFee(
    userId: string,
    grossAmount: number,
    walletAddress?: string
  ): Promise<WithdrawalFeeCalculation> {
    try {
      // Base calculation
      const baseCalculation: WithdrawalFeeCalculation = {
        grossAmount,
        baseWithdrawalFee: this.config.baseWithdrawalFee,
        applicableFee: this.config.baseWithdrawalFee,
        netAmount: grossAmount - this.config.baseWithdrawalFee
      };

      // Check for fee waiver based on amount
      if (this.config.feeWaiverThreshold && grossAmount >= this.config.feeWaiverThreshold) {
        return {
          ...baseCalculation,
          applicableFee: 0,
          netAmount: grossAmount,
          feeWaived: true,
          reason: `Fee waived for withdrawals above ${this.config.feeWaiverThreshold} USDC`
        };
      }

      // Get user's trading volume for fee discount calculation
      const userVolume = await this.getUserTradingVolume(userId);
      const applicableTier = this.getApplicableFeeDiscount(userVolume);

      if (applicableTier) {
        const discountAmount = (this.config.baseWithdrawalFee * applicableTier.discountPercentage) / 100;
        const discountedFee = this.config.baseWithdrawalFee - discountAmount;

        return {
          ...baseCalculation,
          applicableFee: discountedFee,
          netAmount: grossAmount - discountedFee,
          discount: {
            tierName: applicableTier.name,
            originalFee: this.config.baseWithdrawalFee,
            discountPercentage: applicableTier.discountPercentage,
            savings: discountAmount
          }
        };
      }

      return baseCalculation;
    } catch (_error) {
      console.error('❌ Failed to calculate withdrawal fee:', _error);
      // Return base calculation on error
      return {
        grossAmount,
        baseWithdrawalFee: this.config.baseWithdrawalFee,
        applicableFee: this.config.baseWithdrawalFee,
        netAmount: grossAmount - this.config.baseWithdrawalFee
      };
    }
  }

  /**
   * Get user's 30-day trading volume
   */
  private async getUserTradingVolume(userId: string): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: transactions, error } = await this.supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (error) {
        console.error('❌ Failed to get user trading volume:', _error);
        return 0;
      }

      return transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    } catch (_error) {
      console.error('❌ Error getting user trading volume:', _error);
      return 0;
    }
  }

  /**
   * Get applicable fee discount tier for user volume
   */
  private getApplicableFeeDiscount(userVolume: number): FeeDiscountTier | null {
    if (!this.config.discountTiers) return null;

    // Sort tiers by volume in descending order and find the highest applicable tier
    const sortedTiers = [...this.config.discountTiers].sort((a, b) => b.minimumVolume - a.minimumVolume);
    
    for (const tier of sortedTiers) {
      if (userVolume >= tier.minimumVolume) {
        return tier;
      }
    }

    return null;
  }

  /**
   * Validate withdrawal amount against fee requirements
   */
  validateWithdrawalAmount(amount: number): { valid: boolean; error?: string } {
    if (amount < this.config.minimumWithdrawal) {
      return {
        valid: false,
        error: `Minimum withdrawal is ${this.config.minimumWithdrawal} USDC (including ${this.config.baseWithdrawalFee} USDC fee)`
      };
    }

    if (amount > this.config.maximumWithdrawal) {
      return {
        valid: false,
        error: `Maximum withdrawal is ${this.config.maximumWithdrawal} USDC`
      };
    }

    return { valid: true };
  }

  /**
   * Record withdrawal fee transaction
   */
  async recordWithdrawalFee(
    userId: string,
    transactionId: string,
    feeCalculation: WithdrawalFeeCalculation
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('withdrawal_fees')
        .insert({
          user_id: userId,
          transaction_id: transactionId,
          gross_amount: feeCalculation.grossAmount,
          base_fee: feeCalculation.baseWithdrawalFee,
          applicable_fee: feeCalculation.applicableFee,
          net_amount: feeCalculation.netAmount,
          discount_tier: feeCalculation.discount?.tierName,
          discount_percentage: feeCalculation.discount?.discountPercentage,
          fee_waived: feeCalculation.feeWaived || false,
          waiver_reason: feeCalculation.reason,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ Failed to record withdrawal fee:', _error);
      }
    } catch (_error) {
      console.error('❌ Error recording withdrawal fee:', _error);
    }
  }

  /**
   * Get fee structure information
   */
  getFeeStructure(): WithdrawalFeeConfig {
    return { ...this.config };
  }

  /**
   * Get user's fee discount tier
   */
  async getUserFeeDiscount(userId: string): Promise<{
    currentTier?: FeeDiscountTier;
    nextTier?: FeeDiscountTier;
    currentVolume: number;
    volumeToNextTier?: number;
  }> {
    try {
      const currentVolume = await this.getUserTradingVolume(userId);
      const currentTier = this.getApplicableFeeDiscount(currentVolume);
      
      let nextTier: FeeDiscountTier | undefined;
      let volumeToNextTier: number | undefined;

      if (this.config.discountTiers) {
        const sortedTiers = [...this.config.discountTiers].sort((a, b) => a.minimumVolume - b.minimumVolume);
        
        for (const tier of sortedTiers) {
          if (currentVolume < tier.minimumVolume) {
            nextTier = tier;
            volumeToNextTier = tier.minimumVolume - currentVolume;
            break;
          }
        }
      }

      return {
        currentTier: currentTier || undefined,
        nextTier,
        currentVolume,
        volumeToNextTier
      };
    } catch (_error) {
      console.error('❌ Error getting user fee discount:', _error);
      return {
        currentVolume: 0
      };
    }
  }

  /**
   * Get withdrawal fee statistics
   */
  async getWithdrawalFeeStats(): Promise<{
    totalFeesCollected: number;
    totalFeesWaived: number;
    averageFeePerWithdrawal: number;
    feeDiscountUsage: { [tierName: string]: number };
  }> {
    try {
      const { data: feeRecords, error } = await this.supabase
        .from('withdrawal_fees')
        .select('*')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

      if (error) {
        console.error('❌ Failed to get fee statistics:', _error);
        return {
          totalFeesCollected: 0,
          totalFeesWaived: 0,
          averageFeePerWithdrawal: 0,
          feeDiscountUsage: {}
        };
      }

      const totalFeesCollected = feeRecords.reduce((sum, record) => sum + record.applicable_fee, 0);
      const totalFeesWaived = feeRecords.reduce((sum, record) => sum + (record.base_fee - record.applicable_fee), 0);
      const averageFeePerWithdrawal = feeRecords.length > 0 ? totalFeesCollected / feeRecords.length : 0;

      const feeDiscountUsage: { [tierName: string]: number } = {};
      feeRecords.forEach(record => {
        if (record.discount_tier) {
          feeDiscountUsage[record.discount_tier] = (feeDiscountUsage[record.discount_tier] || 0) + 1;
        }
      });

      return {
        totalFeesCollected,
        totalFeesWaived,
        averageFeePerWithdrawal,
        feeDiscountUsage
      };
    } catch (_error) {
      console.error('❌ Error getting withdrawal fee stats:', _error);
      return {
        totalFeesCollected: 0,
        totalFeesWaived: 0,
        averageFeePerWithdrawal: 0,
        feeDiscountUsage: {}
      };
    }
  }

  /**
   * Update fee configuration (admin only)
   */
  updateFeeConfiguration(newConfig: Partial<WithdrawalFeeConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
  }
}

// Export utility functions
export const calculateWithdrawalFee = async (userId: string, grossAmount: number, walletAddress?: string) => {
  const feeManager = WithdrawalFeeManager.getInstance();
  return feeManager.calculateWithdrawalFee(userId, grossAmount, walletAddress);
};

export const validateWithdrawalAmount = (amount: number) => {
  const feeManager = WithdrawalFeeManager.getInstance();
  return feeManager.validateWithdrawalAmount(amount);
};

export const getUserFeeDiscount = async (userId: string) => {
  const feeManager = WithdrawalFeeManager.getInstance();
  return feeManager.getUserFeeDiscount(userId);
};

// Constants
export const WITHDRAWAL_FEE = 1.0; // 1 USDC fixed fee
export const MINIMUM_WITHDRAWAL = 1.01; // Must be more than fee
export const MAXIMUM_WITHDRAWAL = 100000.0;