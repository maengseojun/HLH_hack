// lib/validation/withdrawal-limits.ts
import { createClient } from '@supabase/supabase-js';
import { TwoFactorService } from '@/lib/security/2fa-service';
import { WithdrawalFeeManager } from '@/lib/fees/withdrawal-fee-manager';

interface WithdrawalLimits {
  daily: {
    max: number;
    current: number;
    remaining: number;
    resetTime: Date;
  };
  weekly: {
    max: number;
    current: number;
    remaining: number;
    resetTime: Date;
  };
  monthly: {
    max: number;
    current: number;
    remaining: number;
    resetTime: Date;
  };
  single: {
    min: number;
    max: number;
  };
  total: {
    lifetime: number;
    current: number;
    remaining: number;
  };
}

interface UserTier {
  tier: 'basic' | 'verified' | 'premium' | 'vip';
  limits: WithdrawalLimits;
  requirements: string[];
  features: string[];
}

interface WithdrawalValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  limits: WithdrawalLimits;
  tier: UserTier;
}

export class WithdrawalLimitsService {
  private static instance: WithdrawalLimitsService;
  private supabase;
  private twoFactorService: TwoFactorService;
  private feeManager: WithdrawalFeeManager;

  // Default limits by tier
  private readonly DEFAULT_LIMITS = {
    basic: {
      daily: { max: 1000, min: 1.01 },
      weekly: { max: 5000 },
      monthly: { max: 20000 },
      single: { min: 1.01, max: 500 },
      lifetime: 100000
    },
    verified: {
      daily: { max: 5000, min: 1.01 },
      weekly: { max: 25000 },
      monthly: { max: 100000 },
      single: { min: 1.01, max: 2500 },
      lifetime: 500000
    },
    premium: {
      daily: { max: 25000, min: 1.01 },
      weekly: { max: 100000 },
      monthly: { max: 400000 },
      single: { min: 1.01, max: 10000 },
      lifetime: 2000000
    },
    vip: {
      daily: { max: 100000, min: 1.01 },
      weekly: { max: 500000 },
      monthly: { max: 2000000 },
      single: { min: 1.01, max: 50000 },
      lifetime: 10000000
    }
  };

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.twoFactorService = TwoFactorService.getInstance();
    this.feeManager = WithdrawalFeeManager.getInstance();
  }

  static getInstance(): WithdrawalLimitsService {
    if (!WithdrawalLimitsService.instance) {
      WithdrawalLimitsService.instance = new WithdrawalLimitsService();
    }
    return WithdrawalLimitsService.instance;
  }

  /**
   * Validate withdrawal request against all limits
   */
  async validateWithdrawal(
    userId: string,
    amount: number,
    destinationAddress: string,
    walletAddress: string
  ): Promise<WithdrawalValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Get user tier and limits
      const userTier = await this.getUserTier(userId);
      const limits = await this.getUserLimits(userId);

      // Validate amount format
      if (isNaN(amount) || amount <= 0) {
        errors.push('Invalid withdrawal amount');
      }

      // Validate minimum amount
      if (amount < limits.single.min) {
        errors.push(`Minimum withdrawal amount is ${limits.single.min} USDC`);
      }

      // Validate maximum single transaction
      if (amount > limits.single.max) {
        errors.push(`Maximum single withdrawal is ${limits.single.max} USDC for your tier`);
      }

      // Validate daily limits
      if (limits.daily.current + amount > limits.daily.max) {
        errors.push(`Daily withdrawal limit exceeded. Remaining: ${limits.daily.remaining} USDC`);
      }

      // Validate weekly limits
      if (limits.weekly.current + amount > limits.weekly.max) {
        errors.push(`Weekly withdrawal limit exceeded. Remaining: ${limits.weekly.remaining} USDC`);
      }

      // Validate monthly limits
      if (limits.monthly.current + amount > limits.monthly.max) {
        errors.push(`Monthly withdrawal limit exceeded. Remaining: ${limits.monthly.remaining} USDC`);
      }

      // Validate lifetime limits
      if (limits.total.current + amount > limits.total.lifetime) {
        errors.push(`Lifetime withdrawal limit exceeded. Remaining: ${limits.total.remaining} USDC`);
      }

      // Validate destination address
      if (!this.isValidAddress(destinationAddress)) {
        errors.push('Invalid destination address format');
      }

      // Check for suspicious patterns
      const suspiciousCheck = await this.checkSuspiciousActivity(userId, amount, destinationAddress);
      if (suspiciousCheck.isSuspicious) {
        warnings.push(...suspiciousCheck.warnings);
      }

      // Check balance availability
      const balanceCheck = await this.checkBalanceAvailability(walletAddress, amount);
      if (!balanceCheck.sufficient) {
        errors.push(`Insufficient balance. Available: ${balanceCheck.available} USDC`);
      }

      // Check for pending withdrawals
      const pendingCheck = await this.checkPendingWithdrawals(userId);
      if (pendingCheck.hasPending) {
        warnings.push(`You have ${pendingCheck.count} pending withdrawals`);
      }

      // Check tier-specific requirements
      const tierCheck = await this.checkTierRequirements(userId, userTier.tier);
      if (tierCheck.violations.length > 0) {
        errors.push(...tierCheck.violations);
      }

      // Add upgrade suggestions
      if (amount > limits.single.max || (limits.daily.current + amount) > limits.daily.max) {
        const nextTier = this.getNextTier(userTier.tier);
        if (nextTier) {
          warnings.push(`Consider upgrading to ${nextTier} tier for higher limits`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        limits,
        tier: userTier
      };
    } catch (_error) {
      console.error('❌ Withdrawal validation failed:', _error);
      return {
        isValid: false,
        errors: ['Validation failed. Please try again.'],
        warnings: [],
        limits: await this.getUserLimits(userId),
        tier: await this.getUserTier(userId)
      };
    }
  }

  /**
   * Get user's current tier
   */
  async getUserTier(userId: string): Promise<UserTier> {
    try {
      const { data: user, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !user) {
        throw new Error('User not found');
      }

      // Determine tier based on user attributes
      const has2FA = await this.twoFactorService.isTwoFactorEnabled(userId);
      const isEmailVerified = user.email_verified;
      const isPhoneVerified = user.phone_verified;
      const tradingVolume = await this.getUserTradingVolume(userId);

      let tier: 'basic' | 'verified' | 'premium' | 'vip' = 'basic';
      const requirements: string[] = [];
      const features: string[] = [];

      if (isEmailVerified && isPhoneVerified && has2FA) {
        if (tradingVolume >= 1000000) {
          tier = 'vip';
          features.push('Highest withdrawal limits', 'Priority support', 'Reduced fees');
        } else if (tradingVolume >= 100000) {
          tier = 'premium';
          features.push('High withdrawal limits', 'Priority support', 'Fee discounts');
        } else {
          tier = 'verified';
          features.push('Standard withdrawal limits', 'Basic support');
        }
      } else {
        tier = 'basic';
        if (!isEmailVerified) requirements.push('Email verification');
        if (!isPhoneVerified) requirements.push('Phone verification');
        if (!has2FA) requirements.push('2FA setup');
        features.push('Basic withdrawal limits');
      }

      const limits = await this.getUserLimits(userId);

      return {
        tier,
        limits,
        requirements,
        features
      };
    } catch (_error) {
      console.error('❌ Failed to get user tier:', _error);
      // Return basic tier as fallback
      return {
        tier: 'basic',
        limits: await this.getUserLimits(userId),
        requirements: ['Email verification', 'Phone verification', '2FA setup'],
        features: ['Basic withdrawal limits']
      };
    }
  }

  /**
   * Get user's current withdrawal limits
   */
  async getUserLimits(userId: string): Promise<WithdrawalLimits> {
    try {
      const userTier = await this.getUserTier(userId);
      const tierLimits = this.DEFAULT_LIMITS[userTier.tier];

      // Get current usage
      const [dailyUsage, weeklyUsage, monthlyUsage, lifetimeUsage] = await Promise.all([
        this.getDailyUsage(userId),
        this.getWeeklyUsage(userId),
        this.getMonthlyUsage(userId),
        this.getLifetimeUsage(userId)
      ]);

      // Calculate reset times
      const now = new Date();
      const dailyReset = new Date(now);
      dailyReset.setHours(24, 0, 0, 0);

      const weeklyReset = new Date(now);
      weeklyReset.setDate(now.getDate() + (7 - now.getDay()));
      weeklyReset.setHours(0, 0, 0, 0);

      const monthlyReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      return {
        daily: {
          max: tierLimits.daily.max,
          current: dailyUsage,
          remaining: Math.max(0, tierLimits.daily.max - dailyUsage),
          resetTime: dailyReset
        },
        weekly: {
          max: tierLimits.weekly.max,
          current: weeklyUsage,
          remaining: Math.max(0, tierLimits.weekly.max - weeklyUsage),
          resetTime: weeklyReset
        },
        monthly: {
          max: tierLimits.monthly.max,
          current: monthlyUsage,
          remaining: Math.max(0, tierLimits.monthly.max - monthlyUsage),
          resetTime: monthlyReset
        },
        single: {
          min: tierLimits.single.min,
          max: tierLimits.single.max
        },
        total: {
          lifetime: tierLimits.lifetime,
          current: lifetimeUsage,
          remaining: Math.max(0, tierLimits.lifetime - lifetimeUsage)
        }
      };
    } catch (_error) {
      console.error('❌ Failed to get user limits:', _error);
      // Return basic limits as fallback
      const basicLimits = this.DEFAULT_LIMITS.basic;
      return {
        daily: {
          max: basicLimits.daily.max,
          current: 0,
          remaining: basicLimits.daily.max,
          resetTime: new Date()
        },
        weekly: {
          max: basicLimits.weekly.max,
          current: 0,
          remaining: basicLimits.weekly.max,
          resetTime: new Date()
        },
        monthly: {
          max: basicLimits.monthly.max,
          current: 0,
          remaining: basicLimits.monthly.max,
          resetTime: new Date()
        },
        single: {
          min: basicLimits.single.min,
          max: basicLimits.single.max
        },
        total: {
          lifetime: basicLimits.lifetime,
          current: 0,
          remaining: basicLimits.lifetime
        }
      };
    }
  }

  /**
   * Get daily withdrawal usage
   */
  private async getDailyUsage(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: withdrawals, error } = await this.supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('transaction_type', 'withdrawal')
      .in('status', ['completed', 'processing'])
      .gte('created_at', today.toISOString());

    if (error) {
      console.error('❌ Failed to get daily usage:', _error);
      return 0;
    }

    return withdrawals?.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) || 0;
  }

  /**
   * Get weekly withdrawal usage
   */
  private async getWeeklyUsage(userId: string): Promise<number> {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const { data: withdrawals, error } = await this.supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('transaction_type', 'withdrawal')
      .in('status', ['completed', 'processing'])
      .gte('created_at', weekStart.toISOString());

    if (error) {
      console.error('❌ Failed to get weekly usage:', _error);
      return 0;
    }

    return withdrawals?.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) || 0;
  }

  /**
   * Get monthly withdrawal usage
   */
  private async getMonthlyUsage(userId: string): Promise<number> {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data: withdrawals, error } = await this.supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('transaction_type', 'withdrawal')
      .in('status', ['completed', 'processing'])
      .gte('created_at', monthStart.toISOString());

    if (error) {
      console.error('❌ Failed to get monthly usage:', _error);
      return 0;
    }

    return withdrawals?.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) || 0;
  }

  /**
   * Get lifetime withdrawal usage
   */
  private async getLifetimeUsage(userId: string): Promise<number> {
    const { data: withdrawals, error } = await this.supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('transaction_type', 'withdrawal')
      .eq('status', 'completed');

    if (error) {
      console.error('❌ Failed to get lifetime usage:', _error);
      return 0;
    }

    return withdrawals?.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) || 0;
  }

  /**
   * Get user's trading volume
   */
  private async getUserTradingVolume(userId: string): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: transactions, error } = await this.supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (error) {
      console.error('❌ Failed to get trading volume:', _error);
      return 0;
    }

    return transactions?.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) || 0;
  }

  /**
   * Check for suspicious activity
   */
  private async checkSuspiciousActivity(
    userId: string,
    amount: number,
    destinationAddress: string
  ): Promise<{ isSuspicious: boolean; warnings: string[] }> {
    const warnings: string[] = [];

    try {
      // Check for rapid consecutive withdrawals
      const { data: recentWithdrawals, error } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('transaction_type', 'withdrawal')
        .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Failed to check suspicious activity:', _error);
        return { isSuspicious: false, warnings: [] };
      }

      if (recentWithdrawals && recentWithdrawals.length >= 3) {
        warnings.push('Multiple withdrawals detected in the last hour');
      }

      // Check for unusual amount patterns
      const avgWithdrawal = await this.getAverageWithdrawalAmount(userId);
      if (amount > avgWithdrawal * 10) {
        warnings.push('Withdrawal amount significantly higher than usual');
      }

      // Check for new destination address
      const { data: previousWithdrawals } = await this.supabase
        .from('transactions')
        .select('metadata')
        .eq('user_id', userId)
        .eq('transaction_type', 'withdrawal')
        .eq('status', 'completed');

      const usedAddresses = previousWithdrawals?.map(tx => 
        tx.metadata?.destination_address
      ).filter(Boolean) || [];

      if (!usedAddresses.includes(destinationAddress)) {
        warnings.push('New destination address detected');
      }

      return {
        isSuspicious: warnings.length > 0,
        warnings
      };
    } catch (_error) {
      console.error('❌ Error checking suspicious activity:', _error);
      return { isSuspicious: false, warnings: [] };
    }
  }

  /**
   * Check balance availability
   */
  private async checkBalanceAvailability(
    walletAddress: string,
    amount: number
  ): Promise<{ sufficient: boolean; available: string }> {
    try {
      // This would integrate with the actual balance checking service
      // For now, we'll simulate the check
      const mockBalance = 1000; // Mock balance
      
      return {
        sufficient: mockBalance >= amount,
        available: mockBalance.toString()
      };
    } catch (_error) {
      console.error('❌ Failed to check balance availability:', _error);
      return {
        sufficient: false,
        available: '0'
      };
    }
  }

  /**
   * Check for pending withdrawals
   */
  private async checkPendingWithdrawals(userId: string): Promise<{
    hasPending: boolean;
    count: number;
  }> {
    try {
      const { data: pendingWithdrawals, error } = await this.supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('transaction_type', 'withdrawal')
        .eq('status', 'processing');

      if (error) {
        console.error('❌ Failed to check pending withdrawals:', _error);
        return { hasPending: false, count: 0 };
      }

      const count = pendingWithdrawals?.length || 0;
      return {
        hasPending: count > 0,
        count
      };
    } catch (_error) {
      console.error('❌ Error checking pending withdrawals:', _error);
      return { hasPending: false, count: 0 };
    }
  }

  /**
   * Check tier-specific requirements
   */
  private async checkTierRequirements(
    userId: string,
    tier: 'basic' | 'verified' | 'premium' | 'vip'
  ): Promise<{ violations: string[] }> {
    const violations: string[] = [];

    try {
      const { data: user, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !user) {
        violations.push('User verification required');
        return { violations };
      }

      const has2FA = await this.twoFactorService.isTwoFactorEnabled(userId);

      switch (tier) {
        case 'vip':
        case 'premium':
        case 'verified':
          if (!user.email_verified) {
            violations.push('Email verification required for this tier');
          }
          if (!user.phone_verified) {
            violations.push('Phone verification required for this tier');
          }
          if (!has2FA) {
            violations.push('2FA setup required for this tier');
          }
          break;
        case 'basic':
          // No additional requirements for basic tier
          break;
      }

      return { violations };
    } catch (_error) {
      console.error('❌ Error checking tier requirements:', _error);
      return { violations: ['Unable to verify tier requirements'] };
    }
  }

  /**
   * Get average withdrawal amount for user
   */
  private async getAverageWithdrawalAmount(userId: string): Promise<number> {
    try {
      const { data: withdrawals, error } = await this.supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('transaction_type', 'withdrawal')
        .eq('status', 'completed')
        .limit(50); // Last 50 withdrawals

      if (error || !withdrawals || withdrawals.length === 0) {
        return 100; // Default average
      }

      const total = withdrawals.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      return total / withdrawals.length;
    } catch (_error) {
      console.error('❌ Failed to get average withdrawal amount:', _error);
      return 100;
    }
  }

  /**
   * Validate address format
   */
  private isValidAddress(address: string): boolean {
    // Basic Ethereum address validation
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    return ethAddressRegex.test(address);
  }

  /**
   * Get next available tier
   */
  private getNextTier(currentTier: 'basic' | 'verified' | 'premium' | 'vip'): string | null {
    const tierOrder = ['basic', 'verified', 'premium', 'vip'];
    const currentIndex = tierOrder.indexOf(currentTier);
    
    if (currentIndex < tierOrder.length - 1) {
      return tierOrder[currentIndex + 1];
    }
    
    return null;
  }

  /**
   * Get withdrawal limits summary
   */
  async getWithdrawalLimitsSummary(userId: string): Promise<{
    tier: string;
    limits: WithdrawalLimits;
    upgradeOptions: {
      nextTier?: string;
      requirements: string[];
      benefits: string[];
    };
  }> {
    try {
      const userTier = await this.getUserTier(userId);
      const limits = await this.getUserLimits(userId);
      const nextTier = this.getNextTier(userTier.tier);

      let upgradeRequirements: string[] = [];
      let upgradeBenefits: string[] = [];

      if (nextTier) {
        const nextTierLimits = this.DEFAULT_LIMITS[nextTier as keyof typeof this.DEFAULT_LIMITS];
        
        upgradeRequirements = userTier.requirements;
        upgradeBenefits = [
          `Daily limit: ${nextTierLimits.daily.max} USDC`,
          `Single transaction: ${nextTierLimits.single.max} USDC`,
          `Monthly limit: ${nextTierLimits.monthly.max} USDC`
        ];
      }

      return {
        tier: userTier.tier,
        limits,
        upgradeOptions: {
          nextTier,
          requirements: upgradeRequirements,
          benefits: upgradeBenefits
        }
      };
    } catch (_error) {
      console.error('❌ Failed to get withdrawal limits summary:', _error);
      throw _error;
    }
  }
}

// Export utility functions
export const validateWithdrawal = async (
  userId: string,
  amount: number,
  destinationAddress: string,
  walletAddress: string
) => {
  const service = WithdrawalLimitsService.getInstance();
  return service.validateWithdrawal(userId, amount, destinationAddress, walletAddress);
};

export const getUserWithdrawalLimits = async (userId: string) => {
  const service = WithdrawalLimitsService.getInstance();
  return service.getUserLimits(userId);
};

export const getUserTier = async (userId: string) => {
  const service = WithdrawalLimitsService.getInstance();
  return service.getUserTier(userId);
};

export const getWithdrawalLimitsSummary = async (userId: string) => {
  const service = WithdrawalLimitsService.getInstance();
  return service.getWithdrawalLimitsSummary(userId);
};

// Constants
export const WITHDRAWAL_TIERS = {
  BASIC: 'basic',
  VERIFIED: 'verified',
  PREMIUM: 'premium',
  VIP: 'vip'
} as const;

export const MINIMUM_WITHDRAWAL = 1.01; // 1 USDC + fee
export const MAXIMUM_SINGLE_WITHDRAWAL = 50000; // VIP tier max