-- Migration: 002_remove_privy_handled_tables
-- Description: Remove tables that Privy handles (email verification and 2FA)
-- Created: 2024-07-10

-- Remove tables that Privy handles for us
DROP TABLE IF EXISTS email_verification_codes CASCADE;
DROP TABLE IF EXISTS user_2fa CASCADE;

-- Note: Keep user_sessions table as it might be used for session management
-- Only remove the tables that are specifically handled by Privy:
-- - email_verification_codes: Privy handles email verification with OTP
-- - user_2fa: Privy provides comprehensive MFA (SMS, TOTP, Passkeys)