// lib/security/2fa-service.ts
import { authenticator } from 'otplib';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import QRCode from 'qrcode';

interface TwoFactorAuth {
  id: string;
  userId: string;
  secret: string;
  backupCodes: string[];
  isEnabled: boolean;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  setupToken: string;
}

interface TwoFactorVerification {
  isValid: boolean;
  error?: string;
  backupCodeUsed?: boolean;
}

export class TwoFactorService {
  private static instance: TwoFactorService;
  private supabase;
  private readonly APP_NAME = 'P2PFiat';
  private readonly BACKUP_CODES_COUNT = 10;
  private readonly SETUP_TOKEN_EXPIRY = 300000; // 5 minutes

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  static getInstance(): TwoFactorService {
    if (!TwoFactorService.instance) {
      TwoFactorService.instance = new TwoFactorService();
    }
    return TwoFactorService.instance;
  }

  /**
   * Generate 2FA setup for new user
   */
  async generateTwoFactorSetup(userId: string): Promise<TwoFactorSetup> {
    try {
      // Get user information
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new Error('User not found');
      }

      // Generate secret and backup codes
      const secret = authenticator.generateSecret();
      const backupCodes = this.generateBackupCodes();
      
      // Create QR code URL
      const otpAuthUrl = authenticator.keyuri(
        user.email,
        this.APP_NAME,
        secret
      );

      const qrCodeUrl = await QRCode.toDataURL(otpAuthUrl);

      // Generate setup token for verification
      const setupToken = crypto.randomBytes(32).toString('hex');

      // Store temporary setup data
      const { error: setupError } = await this.supabase
        .from('user_2fa_setup')
        .insert({
          user_id: userId,
          secret,
          backup_codes: backupCodes,
          setup_token: setupToken,
          expires_at: new Date(Date.now() + this.SETUP_TOKEN_EXPIRY).toISOString()
        });

      if (setupError) {
        throw new Error(`Failed to create 2FA setup: ${setupError.message}`);
      }

      console.log(`✅ 2FA setup generated for user: ${userId}`);

      return {
        secret,
        qrCodeUrl,
        backupCodes,
        setupToken
      };
    } catch (_error) {
      console.error('❌ Failed to generate 2FA setup:', _error);
      throw _error;
    }
  }

  /**
   * Verify 2FA setup with TOTP code
   */
  async verifyTwoFactorSetup(
    userId: string,
    setupToken: string,
    totpCode: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get setup data
      const { data: setup, error: setupError } = await this.supabase
        .from('user_2fa_setup')
        .select('*')
        .eq('user_id', userId)
        .eq('setup_token', setupToken)
        .single();

      if (setupError || !setup) {
        return { success: false, error: 'Invalid setup token' };
      }

      // Check if setup expired
      if (new Date() > new Date(setup.expires_at)) {
        return { success: false, error: 'Setup token expired' };
      }

      // Verify TOTP code
      const isValid = authenticator.verify({
        token: totpCode,
        secret: setup.secret
      });

      if (!isValid) {
        return { success: false, error: 'Invalid verification code' };
      }

      // Enable 2FA for user
      const { error: enableError } = await this.supabase
        .from('user_2fa')
        .insert({
          user_id: userId,
          secret: setup.secret,
          backup_codes: setup.backup_codes,
          is_enabled: true,
          verified_at: new Date().toISOString()
        });

      if (enableError) {
        throw new Error(`Failed to enable 2FA: ${enableError.message}`);
      }

      // Clean up setup data
      await this.supabase
        .from('user_2fa_setup')
        .delete()
        .eq('user_id', userId);

      // Update user metadata
      await this.supabase
        .from('users')
        .update({
          metadata: {
            '2fa_enabled': true,
            '2fa_enabled_at': new Date().toISOString()
          }
        })
        .eq('id', userId);

      console.log(`✅ 2FA enabled for user: ${userId}`);

      return { success: true };
    } catch (_error) {
      console.error('❌ Failed to verify 2FA setup:', _error);
      return { 
        success: false, 
        error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Setup verification failed' 
      };
    }
  }

  /**
   * Verify 2FA code for withdrawal
   */
  async verifyTwoFactorCode(
    userId: string,
    code: string,
    allowBackupCode: boolean = true
  ): Promise<TwoFactorVerification> {
    try {
      // Get user's 2FA configuration
      const { data: twoFa, error: twoFaError } = await this.supabase
        .from('user_2fa')
        .select('*')
        .eq('user_id', userId)
        .eq('is_enabled', true)
        .single();

      if (twoFaError || !twoFa) {
        return { isValid: false, error: '2FA not enabled for this user' };
      }

      // First try TOTP verification
      const isTotpValid = authenticator.verify({
        token: code,
        secret: twoFa.secret
      });

      if (isTotpValid) {
        return { isValid: true };
      }

      // If TOTP failed and backup codes are allowed, try backup code
      if (allowBackupCode && twoFa.backup_codes.includes(code)) {
        // Remove used backup code
        const updatedBackupCodes = twoFa.backup_codes.filter(bc => bc !== code);
        
        const { error: updateError } = await this.supabase
          .from('user_2fa')
          .update({
            backup_codes: updatedBackupCodes,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('❌ Failed to update backup codes:', updateError);
        }

        // Log backup code usage
        await this.logSecurityEvent(userId, 'backup_code_used', {
          remainingCodes: updatedBackupCodes.length
        });

        return { isValid: true, backupCodeUsed: true };
      }

      return { isValid: false, error: 'Invalid verification code' };
    } catch (_error) {
      console.error('❌ 2FA verification failed:', _error);
      return { 
        isValid: false, 
        error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Verification failed' 
      };
    }
  }

  /**
   * Generate new backup codes
   */
  async generateNewBackupCodes(userId: string): Promise<string[]> {
    try {
      const newBackupCodes = this.generateBackupCodes();

      const { error } = await this.supabase
        .from('user_2fa')
        .update({
          backup_codes: newBackupCodes,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to generate new backup codes: ${(_error as Error)?.message || String(_error)}`);
      }

      await this.logSecurityEvent(userId, 'backup_codes_regenerated', {
        newCodesCount: newBackupCodes.length
      });

      console.log(`✅ New backup codes generated for user: ${userId}`);

      return newBackupCodes;
    } catch (_error) {
      console.error('❌ Failed to generate new backup codes:', _error);
      throw _error;
    }
  }

  /**
   * Disable 2FA for user
   */
  async disableTwoFactor(userId: string, totpCode: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify current 2FA code before disabling
      const verification = await this.verifyTwoFactorCode(userId, totpCode, false);
      
      if (!verification.isValid) {
        return { success: false, error: 'Invalid verification code' };
      }

      // Disable 2FA
      const { error } = await this.supabase
        .from('user_2fa')
        .update({
          is_enabled: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to disable 2FA: ${(_error as Error)?.message || String(_error)}`);
      }

      // Update user metadata
      await this.supabase
        .from('users')
        .update({
          metadata: {
            '2fa_enabled': false,
            '2fa_disabled_at': new Date().toISOString()
          }
        })
        .eq('id', userId);

      await this.logSecurityEvent(userId, '2fa_disabled', {
        disabledAt: new Date().toISOString()
      });

      console.log(`✅ 2FA disabled for user: ${userId}`);

      return { success: true };
    } catch (_error) {
      console.error('❌ Failed to disable 2FA:', _error);
      return { 
        success: false, 
        error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Failed to disable 2FA' 
      };
    }
  }

  /**
   * Check if user has 2FA enabled
   */
  async isTwoFactorEnabled(userId: string): Promise<boolean> {
    try {
      const { data: twoFa, error } = await this.supabase
        .from('user_2fa')
        .select('is_enabled')
        .eq('user_id', userId)
        .single();

      if (error) {
        return false;
      }

      return twoFa?.is_enabled === true;
    } catch (_error) {
      console.error('❌ Failed to check 2FA status:', _error);
      return false;
    }
  }

  /**
   * Get user's 2FA status and backup codes info
   */
  async getTwoFactorStatus(userId: string): Promise<{
    enabled: boolean;
    verifiedAt?: Date;
    backupCodesRemaining: number;
    setupRequired: boolean;
  }> {
    try {
      const { data: twoFa, error } = await this.supabase
        .from('user_2fa')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !twoFa) {
        return {
          enabled: false,
          backupCodesRemaining: 0,
          setupRequired: true
        };
      }

      return {
        enabled: twoFa.is_enabled,
        verifiedAt: twoFa.verified_at ? new Date(twoFa.verified_at) : undefined,
        backupCodesRemaining: twoFa.backup_codes?.length || 0,
        setupRequired: false
      };
    } catch (_error) {
      console.error('❌ Failed to get 2FA status:', _error);
      return {
        enabled: false,
        backupCodesRemaining: 0,
        setupRequired: true
      };
    }
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < this.BACKUP_CODES_COUNT; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(
    userId: string,
    eventType: string,
    metadata: any
  ): Promise<void> {
    try {
      await this.supabase
        .from('session_security_events')
        .insert({
          session_id: crypto.randomUUID(),
          user_id: userId,
          event_type: eventType,
          severity: 'info',
          description: `2FA event: ${eventType}`,
          metadata,
          created_at: new Date().toISOString()
        });
    } catch (_error) {
      console.error('❌ Failed to log security event:', _error);
    }
  }

  /**
   * Clean up expired setup tokens
   */
  async cleanupExpiredSetups(): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_2fa_setup')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        console.error('❌ Failed to cleanup expired 2FA setups:', _error);
      } else {
        console.log('✅ Expired 2FA setups cleaned up');
      }
    } catch (_error) {
      console.error('❌ Error during 2FA setup cleanup:', _error);
    }
  }

  /**
   * Get 2FA statistics
   */
  async getTwoFactorStats(): Promise<{
    totalUsers: number;
    enabledUsers: number;
    enabledPercentage: number;
    backupCodesUsed: number;
    averageBackupCodesRemaining: number;
  }> {
    try {
      const [totalUsersResult, enabledUsersResult, backupCodeEvents] = await Promise.all([
        this.supabase.from('users').select('id', { count: 'exact' }),
        this.supabase.from('user_2fa').select('*').eq('is_enabled', true),
        this.supabase
          .from('session_security_events')
          .select('*')
          .eq('event_type', 'backup_code_used')
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      const totalUsers = totalUsersResult.count || 0;
      const enabledUsers = enabledUsersResult.data?.length || 0;
      const enabledPercentage = totalUsers > 0 ? (enabledUsers / totalUsers) * 100 : 0;

      const backupCodesUsed = backupCodeEvents.data?.length || 0;
      const averageBackupCodesRemaining = enabledUsers > 0 
        ? (enabledUsersResult.data?.reduce((sum, user) => sum + (user.backup_codes?.length || 0), 0) || 0) / enabledUsers
        : 0;

      return {
        totalUsers,
        enabledUsers,
        enabledPercentage: Math.round(enabledPercentage),
        backupCodesUsed,
        averageBackupCodesRemaining: Math.round(averageBackupCodesRemaining)
      };
    } catch (_error) {
      console.error('❌ Failed to get 2FA stats:', _error);
      return {
        totalUsers: 0,
        enabledUsers: 0,
        enabledPercentage: 0,
        backupCodesUsed: 0,
        averageBackupCodesRemaining: 0
      };
    }
  }
}

// Export utility functions
export const generateTwoFactorSetup = async (userId: string) => {
  const service = TwoFactorService.getInstance();
  return service.generateTwoFactorSetup(userId);
};

export const verifyTwoFactorSetup = async (userId: string, setupToken: string, totpCode: string) => {
  const service = TwoFactorService.getInstance();
  return service.verifyTwoFactorSetup(userId, setupToken, totpCode);
};

export const verifyTwoFactorCode = async (userId: string, code: string, allowBackupCode?: boolean) => {
  const service = TwoFactorService.getInstance();
  return service.verifyTwoFactorCode(userId, code, allowBackupCode);
};

export const isTwoFactorEnabled = async (userId: string) => {
  const service = TwoFactorService.getInstance();
  return service.isTwoFactorEnabled(userId);
};

export const getTwoFactorStatus = async (userId: string) => {
  const service = TwoFactorService.getInstance();
  return service.getTwoFactorStatus(userId);
};

// Constants
export const TOTP_WINDOW = 1; // Allow 1 step tolerance
export const BACKUP_CODE_LENGTH = 8;
export const SETUP_EXPIRY_MINUTES = 5;