-- Migration: Create 2FA tables
-- Date: 2025-01-17
-- Description: Add Two-Factor Authentication support for enhanced security

-- Create user_2fa table for permanent 2FA configuration
CREATE TABLE user_2fa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  backup_codes TEXT[] DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT user_2fa_user_unique UNIQUE(user_id),
  CONSTRAINT user_2fa_secret_not_empty CHECK (secret != ''),
  CONSTRAINT user_2fa_backup_codes_count CHECK (array_length(backup_codes, 1) <= 20)
);

-- Create user_2fa_setup table for temporary setup process
CREATE TABLE user_2fa_setup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  backup_codes TEXT[] DEFAULT '{}',
  setup_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT user_2fa_setup_user_unique UNIQUE(user_id),
  CONSTRAINT user_2fa_setup_token_unique UNIQUE(setup_token),
  CONSTRAINT user_2fa_setup_secret_not_empty CHECK (secret != '')
);

-- Create indexes for better performance
CREATE INDEX idx_user_2fa_user_id ON user_2fa(user_id);
CREATE INDEX idx_user_2fa_is_enabled ON user_2fa(is_enabled);
CREATE INDEX idx_user_2fa_verified_at ON user_2fa(verified_at);

CREATE INDEX idx_user_2fa_setup_user_id ON user_2fa_setup(user_id);
CREATE INDEX idx_user_2fa_setup_token ON user_2fa_setup(setup_token);
CREATE INDEX idx_user_2fa_setup_expires_at ON user_2fa_setup(expires_at);

-- Create updated_at trigger for user_2fa
CREATE TRIGGER update_user_2fa_updated_at
    BEFORE UPDATE ON user_2fa
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to track 2FA events
CREATE OR REPLACE FUNCTION track_2fa_events()
RETURNS TRIGGER AS $$
BEGIN
    -- Track when 2FA is enabled
    IF NEW.is_enabled = true AND OLD.is_enabled = false THEN
        INSERT INTO session_security_events (
            session_id, user_id, event_type, severity, description, metadata
        ) VALUES (
            gen_random_uuid(),
            NEW.user_id,
            '2fa_enabled',
            'info',
            'Two-factor authentication enabled',
            jsonb_build_object(
                'enabled_at', NOW(),
                'backup_codes_generated', array_length(NEW.backup_codes, 1)
            )
        );
    END IF;
    
    -- Track when 2FA is disabled
    IF NEW.is_enabled = false AND OLD.is_enabled = true THEN
        INSERT INTO session_security_events (
            session_id, user_id, event_type, severity, description, metadata
        ) VALUES (
            gen_random_uuid(),
            NEW.user_id,
            '2fa_disabled',
            'warning',
            'Two-factor authentication disabled',
            jsonb_build_object(
                'disabled_at', NOW(),
                'backup_codes_remaining', array_length(OLD.backup_codes, 1)
            )
        );
    END IF;
    
    -- Track backup code regeneration
    IF NEW.backup_codes != OLD.backup_codes AND NEW.is_enabled = true THEN
        INSERT INTO session_security_events (
            session_id, user_id, event_type, severity, description, metadata
        ) VALUES (
            gen_random_uuid(),
            NEW.user_id,
            'backup_codes_regenerated',
            'info',
            'Backup codes regenerated',
            jsonb_build_object(
                'previous_codes_count', array_length(OLD.backup_codes, 1),
                'new_codes_count', array_length(NEW.backup_codes, 1),
                'regenerated_at', NOW()
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for 2FA event tracking
CREATE TRIGGER track_user_2fa_events
    AFTER UPDATE ON user_2fa
    FOR EACH ROW
    EXECUTE FUNCTION track_2fa_events();

-- Create function to clean up expired setups
CREATE OR REPLACE FUNCTION cleanup_expired_2fa_setups()
RETURNS void AS $$
BEGIN
    DELETE FROM user_2fa_setup 
    WHERE expires_at < NOW();
END;
$$ language 'plpgsql';

-- Create function to get user's 2FA status
CREATE OR REPLACE FUNCTION get_user_2fa_status(p_user_id UUID)
RETURNS TABLE (
    enabled BOOLEAN,
    verified_at TIMESTAMP WITH TIME ZONE,
    backup_codes_remaining INTEGER,
    setup_required BOOLEAN
) AS $$
DECLARE
    user_2fa_record RECORD;
BEGIN
    SELECT * INTO user_2fa_record
    FROM user_2fa
    WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::TIMESTAMP WITH TIME ZONE, 0, true;
    ELSE
        RETURN QUERY SELECT 
            user_2fa_record.is_enabled,
            user_2fa_record.verified_at,
            array_length(user_2fa_record.backup_codes, 1),
            false;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create view for 2FA statistics
CREATE VIEW user_2fa_stats AS
SELECT 
    DATE_TRUNC('day', u.created_at) as registration_date,
    COUNT(u.id) as total_users,
    COUNT(t.id) FILTER (WHERE t.is_enabled = true) as enabled_users,
    COUNT(t.id) FILTER (WHERE t.is_enabled = false) as disabled_users,
    ROUND(
        (COUNT(t.id) FILTER (WHERE t.is_enabled = true)::DECIMAL / 
         NULLIF(COUNT(u.id), 0)) * 100, 2
    ) as enabled_percentage,
    AVG(array_length(t.backup_codes, 1)) FILTER (WHERE t.is_enabled = true) as avg_backup_codes
FROM users u
LEFT JOIN user_2fa t ON u.id = t.user_id
WHERE u.created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', u.created_at)
ORDER BY registration_date DESC;

-- Create view for 2FA security events
CREATE VIEW user_2fa_security_events AS
SELECT 
    DATE_TRUNC('day', created_at) as event_date,
    event_type,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_id) as unique_users
FROM session_security_events
WHERE event_type IN ('2fa_enabled', '2fa_disabled', 'backup_codes_regenerated', 'backup_code_used')
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at), event_type
ORDER BY event_date DESC, event_type;

-- Row Level Security (RLS) policies
ALTER TABLE user_2fa ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_2fa_setup ENABLE ROW LEVEL SECURITY;

-- Users can only access their own 2FA data
CREATE POLICY user_2fa_user_policy ON user_2fa
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY user_2fa_setup_user_policy ON user_2fa_setup
    FOR ALL USING (user_id = auth.uid());

-- Admin can access all 2FA data
CREATE POLICY user_2fa_admin_policy ON user_2fa
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND email = 'admin@p2pfiat.com'
        )
    );

CREATE POLICY user_2fa_setup_admin_policy ON user_2fa_setup
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND email = 'admin@p2pfiat.com'
        )
    );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_2fa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_2fa_setup TO authenticated;
GRANT SELECT ON user_2fa_stats TO authenticated;
GRANT SELECT ON user_2fa_security_events TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_2fa_setups TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_2fa_status TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create function to require 2FA for withdrawal operations
CREATE OR REPLACE FUNCTION require_2fa_for_withdrawal(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_2fa_enabled BOOLEAN;
BEGIN
    SELECT is_enabled INTO user_2fa_enabled
    FROM user_2fa
    WHERE user_id = p_user_id;
    
    -- If 2FA is not found or not enabled, return false
    IF NOT FOUND OR user_2fa_enabled = false THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION require_2fa_for_withdrawal TO authenticated;

-- Create index for cleanup operations
CREATE INDEX idx_user_2fa_setup_cleanup ON user_2fa_setup(expires_at)
WHERE expires_at < NOW();

-- Insert sample configuration for 2FA settings
INSERT INTO withdrawal_fee_config (
    config_name, 
    base_withdrawal_fee, 
    minimum_withdrawal, 
    maximum_withdrawal,
    fee_waiver_threshold,
    discount_tiers
) VALUES (
    '2fa_enhanced',
    0.5,  -- Reduced fee for 2FA users
    1.01,
    100000.0,
    5000.0,  -- Lower waiver threshold for 2FA users
    '[
        {"name": "2FA Bronze", "minimumVolume": 5000, "discountPercentage": 15, "description": "15% fee discount for 2FA users with $5k+ monthly volume"},
        {"name": "2FA Silver", "minimumVolume": 25000, "discountPercentage": 35, "description": "35% fee discount for 2FA users with $25k+ monthly volume"},
        {"name": "2FA Gold", "minimumVolume": 75000, "discountPercentage": 60, "description": "60% fee discount for 2FA users with $75k+ monthly volume"},
        {"name": "2FA Platinum", "minimumVolume": 250000, "discountPercentage": 100, "description": "No withdrawal fees for 2FA users with $250k+ monthly volume"}
    ]'::jsonb
) ON CONFLICT (config_name) DO NOTHING;