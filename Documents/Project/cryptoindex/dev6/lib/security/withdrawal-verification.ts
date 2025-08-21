// lib/security/withdrawal-verification.ts
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { TwoFactorService } from './2fa-service';

interface WithdrawalVerification {
  id: string;
  userId: string;
  walletAddress: string;
  amount: string;
  destinationAddress: string;
  verificationCode: string;
  expiresAt: Date;
  isVerified: boolean;
  verificationMethod: '2fa' | 'email' | 'sms';
  createdAt: Date;
}

interface SignatureVerificationResult {
  isValid: boolean;
  recoveredAddress?: string;
  error?: string;
}

interface WithdrawalAuthRequest {
  userId: string;
  walletAddress: string;
  amount: string;
  destinationAddress: string;
  signature: string;
  verificationCode?: string;
  method: '2fa' | 'email' | 'sms';
}

export class WithdrawalVerificationService {
  private static instance: WithdrawalVerificationService;
  private supabase;
  private twoFactorService: TwoFactorService;
  private readonly VERIFICATION_EXPIRY = 300000; // 5 minutes
  private readonly MAX_VERIFICATION_ATTEMPTS = 3;

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.twoFactorService = TwoFactorService.getInstance();
  }

  static getInstance(): WithdrawalVerificationService {
    if (!WithdrawalVerificationService.instance) {
      WithdrawalVerificationService.instance = new WithdrawalVerificationService();
    }
    return WithdrawalVerificationService.instance;
  }

  /**
   * Verify EIP-712 signature for withdrawal
   */
  async verifyWithdrawalSignature(
    signature: string,
    walletAddress: string,
    destinationAddress: string,
    amount: string,
    timestamp: number
  ): Promise<SignatureVerificationResult> {
    try {
      // EIP-712 domain for Hyperliquid
      const domain = {
        name: 'Exchange',
        version: '1',
        chainId: 999, // Hyperliquid chain ID
        verifyingContract: '0x0000000000000000000000000000000000000000'
      };

      // EIP-712 types
      const types = {
        Withdraw: [
          { name: 'destination', type: 'string' },
          { name: 'amount', type: 'string' },
          { name: 'time', type: 'uint64' }
        ]
      };

      const value = {
        destination: destinationAddress,
        amount: amount,
        time: timestamp
      };

      // Recover the address from the signature
      const recoveredAddress = ethers.verifyTypedData(domain, types, value, signature);

      // Verify the recovered address matches the expected wallet address
      const isValid = recoveredAddress.toLowerCase() === walletAddress.toLowerCase();

      return {
        isValid,
        recoveredAddress
      };
    } catch (_error) {
      console.error('❌ Signature verification failed:', _error);
      return {
        isValid: false,
        error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Signature verification failed'
      };
    }
  }

  /**
   * Generate verification code
   */
  private generateVerificationCode(): string {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  /**
   * Create withdrawal verification request
   */
  async createVerificationRequest(
    userId: string,
    walletAddress: string,
    amount: string,
    destinationAddress: string,
    method: '2fa' | 'email' | 'sms'
  ): Promise<{ verificationId: string; code?: string }> {
    try {
      const verificationCode = this.generateVerificationCode();
      const expiresAt = new Date(Date.now() + this.VERIFICATION_EXPIRY);

      // Store verification request in database
      const { data, error } = await this.supabase
        .from('withdrawal_verifications')
        .insert({
          user_id: userId,
          wallet_address: walletAddress,
          amount: amount,
          destination_address: destinationAddress,
          verification_code: verificationCode,
          expires_at: expiresAt.toISOString(),
          verification_method: method,
          is_verified: false,
          attempt_count: 0
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create verification request: ${(_error as Error)?.message || String(_error)}`);
      }

      console.log(`✅ Verification request created: ${data.id}`);

      // Send verification code based on method
      await this.sendVerificationCode(userId, verificationCode, method);

      return {
        verificationId: data.id,
        code: method === '2fa' ? undefined : verificationCode // Don't return 2FA codes
      };
    } catch (_error) {
      console.error('❌ Failed to create verification request:', _error);
      throw _error;
    }
  }

  /**
   * Verify withdrawal verification code
   */
  async verifyWithdrawalCode(
    verificationId: string,
    code: string
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      // Get verification request
      const { data: verification, error } = await this.supabase
        .from('withdrawal_verifications')
        .select('*')
        .eq('id', verificationId)
        .single();

      if (error || !verification) {
        return { isValid: false, error: 'Verification request not found' };
      }

      // Check if already verified
      if (verification.is_verified) {
        return { isValid: false, error: 'Verification already completed' };
      }

      // Check if expired
      if (new Date() > new Date(verification.expires_at)) {
        return { isValid: false, error: 'Verification code expired' };
      }

      // Check attempt count
      if (verification.attempt_count >= this.MAX_VERIFICATION_ATTEMPTS) {
        return { isValid: false, error: 'Maximum verification attempts exceeded' };
      }

      let isCodeValid = false;

      // Handle different verification methods
      switch (verification.verification_method) {
        case '2fa':
          // For 2FA, verify using TwoFactorService
          const twoFaResult = await this.twoFactorService.verifyTwoFactorCode(
            verification.user_id,
            code,
            true // Allow backup codes
          );
          isCodeValid = twoFaResult.isValid;
          break;

        case 'email':
        case 'sms':
          // For email/SMS, verify against stored code
          isCodeValid = verification.verification_code === code.toUpperCase();
          break;

        default:
          return { isValid: false, error: 'Invalid verification method' };
      }

      // Update verification record
      const updateData = {
        attempt_count: verification.attempt_count + 1,
        is_verified: isCodeValid,
        verified_at: isCodeValid ? new Date().toISOString() : null
      };

      const { error: updateError } = await this.supabase
        .from('withdrawal_verifications')
        .update(updateData)
        .eq('id', verificationId);

      if (updateError) {
        console.error('❌ Failed to update verification:', updateError);
      }

      if (!isCodeValid) {
        return { isValid: false, error: 'Invalid verification code' };
      }

      console.log(`✅ Withdrawal verification completed: ${verificationId}`);
      return { isValid: true };
    } catch (_error) {
      console.error('❌ Verification failed:', _error);
      return { 
        isValid: false, 
        error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Verification failed'
      };
    }
  }

  /**
   * Send verification code
   */
  private async sendVerificationCode(
    userId: string,
    code: string,
    method: '2fa' | 'email' | 'sms'
  ): Promise<void> {
    try {
      // Get user information
      const { data: user, error } = await this.supabase
        .from('users')
        .select('email, phone')
        .eq('id', userId)
        .single();

      if (error || !user) {
        throw new Error('User not found');
      }

      switch (method) {
        case 'email':
          await this.sendEmailVerification(user.email, code);
          break;
        
        case 'sms':
          if (user.phone) {
            await this.sendSMSVerification(user.phone, code);
          } else {
            throw new Error('Phone number not found');
          }
          break;
        
        case '2fa':
          // For 2FA, the code is generated by the user's authenticator app
          // We don't send anything, just log the request
          console.log(`📱 2FA verification requested for user: ${userId}`);
          break;
      }
    } catch (_error) {
      console.error('❌ Failed to send verification code:', _error);
      throw _error;
    }
  }

  /**
   * Send email verification
   */
  private async sendEmailVerification(email: string, code: string): Promise<void> {
    try {
      // In a real implementation, you would use an email service like Resend, SendGrid, etc.
      console.log(`📧 Email verification code sent to ${email}: ${code}`);
      
      // Example implementation with Resend (if configured)
      if (process.env.RESEND_API_KEY) {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        await resend.emails.send({
          from: 'noreply@p2pfiat.com',
          to: email,
          subject: 'Withdrawal Verification Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Withdrawal Verification</h2>
              <p>You have requested to withdraw funds from your account.</p>
              <p>Your verification code is: <strong style="font-size: 24px; color: #007bff;">${code}</strong></p>
              <p>This code will expire in 5 minutes.</p>
              <p>If you did not request this withdrawal, please contact support immediately.</p>
            </div>
          `
        });
      }
    } catch (_error) {
      console.error('❌ Failed to send email verification:', _error);
      throw new Error('Failed to send email verification');
    }
  }

  /**
   * Send SMS verification
   */
  private async sendSMSVerification(phone: string, code: string): Promise<void> {
    try {
      // In a real implementation, you would use an SMS service like Twilio
      console.log(`📱 SMS verification code sent to ${phone}: ${code}`);
      
      // Example implementation with Twilio (if configured)
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        let client;
        try {
          const twilio = require('twilio');
          client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        } catch (_error) {
          console.warn('Twilio not available - SMS verification disabled');
          throw new Error('SMS verification not available - please install twilio package');
        }
        
        await client.messages.create({
          body: `Your P2PFiat withdrawal verification code is: ${code}. This code expires in 5 minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone
        });
      }
    } catch (_error) {
      console.error('❌ Failed to send SMS verification:', _error);
      throw new Error('Failed to send SMS verification');
    }
  }

  /**
   * Check if withdrawal requires additional verification
   */
  async requiresAdditionalVerification(
    userId: string,
    amount: string,
    destinationAddress: string
  ): Promise<{ required: boolean; reasons: string[]; preferredMethod: '2fa' | 'email' | 'sms' }> {
    const reasons: string[] = [];
    const amountNum = parseFloat(amount);

    // Check if user has 2FA enabled
    const has2FA = await this.twoFactorService.isTwoFactorEnabled(userId);
    let preferredMethod: '2fa' | 'email' | 'sms' = has2FA ? '2fa' : 'email';

    // Always require 2FA for users who have it enabled
    if (has2FA) {
      reasons.push('2FA enabled for enhanced security');
    }

    // Check withdrawal amount threshold
    if (amountNum > 1000) {
      reasons.push('Large withdrawal amount');
      // For large amounts, prefer 2FA if available
      if (has2FA) {
        preferredMethod = '2fa';
      }
    }

    // Check if destination address is new
    const { data: previousWithdrawals } = await this.supabase
      .from('transactions')
      .select('metadata')
      .eq('user_id', userId)
      .eq('transaction_type', 'withdrawal')
      .eq('status', 'completed');

    const usedAddresses = (previousWithdrawals || []).map(tx => 
      tx.metadata?.destination_address
    ).filter(Boolean);

    if (!usedAddresses.includes(destinationAddress)) {
      reasons.push('New destination address');
      // For new addresses, prefer 2FA if available
      if (has2FA) {
        preferredMethod = '2fa';
      }
    }

    // Check user's security settings
    const { data: user } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (user && !user.email_verified) {
      reasons.push('Email not verified');
    }

    // Check recent failed login attempts
    const { data: securityEvents } = await this.supabase
      .from('session_security_events')
      .select('*')
      .eq('user_id', userId)
      .eq('event_type', 'suspicious_activity')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (securityEvents && securityEvents.length > 0) {
      reasons.push('Recent suspicious activity');
      // For suspicious activity, strongly prefer 2FA
      if (has2FA) {
        preferredMethod = '2fa';
      }
    }

    // Check if user has phone number for SMS option
    if (user?.phone && !has2FA) {
      // Only offer SMS if 2FA is not available
      preferredMethod = 'sms';
    }

    return {
      required: reasons.length > 0,
      reasons,
      preferredMethod
    };
  }

  /**
   * Clean up expired verification requests
   */
  async cleanupExpiredVerifications(): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('withdrawal_verifications')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        console.error('❌ Failed to cleanup expired verifications:', _error);
      } else {
        console.log('✅ Expired verification requests cleaned up');
      }
    } catch (_error) {
      console.error('❌ Error during cleanup:', _error);
    }
  }

  /**
   * Get verification statistics
   */
  async getVerificationStats(): Promise<{
    totalRequests: number;
    successfulVerifications: number;
    failedVerifications: number;
    averageVerificationTime: number;
  }> {
    try {
      const { data: verifications, error } = await this.supabase
        .from('withdrawal_verifications')
        .select('*')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

      if (error) {
        throw new Error(`Failed to get verification stats: ${(_error as Error)?.message || String(_error)}`);
      }

      const totalRequests = verifications.length;
      const successfulVerifications = verifications.filter(v => v.is_verified).length;
      const failedVerifications = verifications.filter(v => 
        !v.is_verified && v.attempt_count >= this.MAX_VERIFICATION_ATTEMPTS
      ).length;

      // Calculate average verification time
      const verifiedRequests = verifications.filter(v => v.is_verified && v.verified_at);
      const averageVerificationTime = verifiedRequests.length > 0
        ? verifiedRequests.reduce((sum, v) => {
            const created = new Date(v.created_at).getTime();
            const verified = new Date(v.verified_at).getTime();
            return sum + (verified - created);
          }, 0) / verifiedRequests.length / 1000 // Convert to seconds
        : 0;

      return {
        totalRequests,
        successfulVerifications,
        failedVerifications,
        averageVerificationTime: Math.round(averageVerificationTime)
      };
    } catch (_error) {
      console.error('❌ Failed to get verification stats:', _error);
      return {
        totalRequests: 0,
        successfulVerifications: 0,
        failedVerifications: 0,
        averageVerificationTime: 0
      };
    }
  }
}

// Export utility functions
export const verifyWithdrawalSignature = async (
  signature: string,
  walletAddress: string,
  destinationAddress: string,
  amount: string,
  timestamp: number
) => {
  const service = WithdrawalVerificationService.getInstance();
  return service.verifyWithdrawalSignature(signature, walletAddress, destinationAddress, amount, timestamp);
};

export const createWithdrawalVerification = async (
  userId: string,
  walletAddress: string,
  amount: string,
  destinationAddress: string,
  method: '2fa' | 'email' | 'sms'
) => {
  const service = WithdrawalVerificationService.getInstance();
  return service.createVerificationRequest(userId, walletAddress, amount, destinationAddress, method);
};

export const verifyWithdrawalCode = async (verificationId: string, code: string) => {
  const service = WithdrawalVerificationService.getInstance();
  return service.verifyWithdrawalCode(verificationId, code);
};