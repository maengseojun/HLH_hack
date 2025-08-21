-- Migration: Create withdrawal_verifications table
-- Date: 2025-01-17
-- Description: Add withdrawal verification system for enhanced security

-- Create withdrawal_verifications table
CREATE TABLE withdrawal_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  amount DECIMAL(18, 6) NOT NULL,
  destination_address TEXT NOT NULL,
  verification_code TEXT NOT NULL,
  verification_method TEXT NOT NULL CHECK (verification_method IN ('2fa', 'email', 'sms')),
  
  -- Verification status
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Attempt tracking
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  
  -- Expiry
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Additional security metadata
  ip_address INET,
  user_agent TEXT,
  security_flags JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT withdrawal_verifications_positive_amount CHECK (amount > 0),
  CONSTRAINT withdrawal_verifications_valid_attempts CHECK (attempt_count >= 0 AND attempt_count <= max_attempts)
);

-- Create indexes for better performance
CREATE INDEX idx_withdrawal_verifications_user_id ON withdrawal_verifications(user_id);
CREATE INDEX idx_withdrawal_verifications_wallet_address ON withdrawal_verifications(wallet_address);
CREATE INDEX idx_withdrawal_verifications_expires_at ON withdrawal_verifications(expires_at);
CREATE INDEX idx_withdrawal_verifications_is_verified ON withdrawal_verifications(is_verified);
CREATE INDEX idx_withdrawal_verifications_verification_method ON withdrawal_verifications(verification_method);
CREATE INDEX idx_withdrawal_verifications_created_at ON withdrawal_verifications(created_at);

-- Create updated_at trigger
CREATE TRIGGER update_withdrawal_verifications_updated_at
    BEFORE UPDATE ON withdrawal_verifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically expire old verifications
CREATE OR REPLACE FUNCTION expire_old_verifications()
RETURNS void AS $$
BEGIN
    UPDATE withdrawal_verifications 
    SET 
        is_verified = false,
        updated_at = NOW()
    WHERE 
        expires_at < NOW() 
        AND is_verified = false;
END;
$$ language 'plpgsql';

-- Create function to check verification attempts
CREATE OR REPLACE FUNCTION check_verification_attempts()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if max attempts exceeded
    IF NEW.attempt_count >= NEW.max_attempts AND NEW.is_verified = false THEN
        -- Log security event
        INSERT INTO session_security_events (
            session_id, user_id, event_type, severity, description, metadata
        ) VALUES (
            gen_random_uuid(),
            NEW.user_id,
            'suspicious_activity',
            'warning',
            'Maximum withdrawal verification attempts exceeded',
            jsonb_build_object(
                'verification_id', NEW.id,
                'wallet_address', NEW.wallet_address,
                'amount', NEW.amount,
                'destination_address', NEW.destination_address
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for attempt checking
CREATE TRIGGER check_withdrawal_verification_attempts
    AFTER UPDATE ON withdrawal_verifications
    FOR EACH ROW
    WHEN (OLD.attempt_count != NEW.attempt_count)
    EXECUTE FUNCTION check_verification_attempts();

-- Create function to track successful verifications
CREATE OR REPLACE FUNCTION track_successful_verification()
RETURNS TRIGGER AS $$
BEGIN
    -- Log successful verification
    IF NEW.is_verified = true AND OLD.is_verified = false THEN
        INSERT INTO session_security_events (
            session_id, user_id, event_type, severity, description, metadata
        ) VALUES (
            gen_random_uuid(),
            NEW.user_id,
            'withdrawal_verified',
            'info',
            'Withdrawal verification completed successfully',
            jsonb_build_object(
                'verification_id', NEW.id,
                'wallet_address', NEW.wallet_address,
                'amount', NEW.amount,
                'destination_address', NEW.destination_address,
                'verification_method', NEW.verification_method,
                'attempts_used', NEW.attempt_count
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for successful verification tracking
CREATE TRIGGER track_withdrawal_verification_success
    AFTER UPDATE ON withdrawal_verifications
    FOR EACH ROW
    WHEN (OLD.is_verified = false AND NEW.is_verified = true)
    EXECUTE FUNCTION track_successful_verification();

-- Row Level Security (RLS) policies
ALTER TABLE withdrawal_verifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own verification requests
CREATE POLICY withdrawal_verifications_user_policy ON withdrawal_verifications
    FOR ALL USING (user_id = auth.uid());

-- Admin policy for administrative access
CREATE POLICY withdrawal_verifications_admin_policy ON withdrawal_verifications
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND email = 'admin@p2pfiat.com'
        )
    );

-- Create view for withdrawal verification statistics
CREATE VIEW withdrawal_verification_stats AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    verification_method,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE is_verified = true) as successful_verifications,
    COUNT(*) FILTER (WHERE attempt_count >= max_attempts AND is_verified = false) as failed_verifications,
    AVG(EXTRACT(EPOCH FROM (verified_at - created_at))) FILTER (WHERE is_verified = true) as avg_verification_time_seconds
FROM withdrawal_verifications
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at), verification_method
ORDER BY date DESC;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON withdrawal_verifications TO authenticated;
GRANT SELECT ON withdrawal_verification_stats TO authenticated;
GRANT EXECUTE ON FUNCTION expire_old_verifications TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create index for cleanup operations
CREATE INDEX idx_withdrawal_verifications_cleanup ON withdrawal_verifications(expires_at, is_verified) 
WHERE is_verified = false;