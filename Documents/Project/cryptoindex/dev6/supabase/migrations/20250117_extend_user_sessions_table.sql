-- Migration: Extend user_sessions table with security fields
-- Date: 2025-01-17
-- Description: Add security fields to user_sessions for enhanced session management

-- Add security columns to user_sessions table
ALTER TABLE user_sessions 
ADD COLUMN IF NOT EXISTS ip_address INET,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS revoked_reason TEXT,
ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'web' CHECK (session_type IN ('web', 'mobile', 'api')),
ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS location_country TEXT,
ADD COLUMN IF NOT EXISTS location_city TEXT,
ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS session_metadata JSONB DEFAULT '{}';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_ip_address ON user_sessions(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_revoked ON user_sessions(is_revoked);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_type ON user_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_suspicious ON user_sessions(is_suspicious);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, expires_at) WHERE is_revoked = false;

-- Create function to update last_activity_at automatically
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update last_activity_at on any update
CREATE TRIGGER update_user_sessions_activity
    BEFORE UPDATE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_activity();

-- Create function to automatically revoke expired sessions
CREATE OR REPLACE FUNCTION revoke_expired_sessions()
RETURNS void AS $$
BEGIN
    UPDATE user_sessions 
    SET 
        is_revoked = true,
        revoked_at = NOW(),
        revoked_reason = 'expired'
    WHERE 
        expires_at < NOW() 
        AND is_revoked = false;
END;
$$ language 'plpgsql';

-- Create table for session security events
CREATE TABLE IF NOT EXISTS session_security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'login', 'logout', 'token_refresh', 'suspicious_activity', 
        'location_change', 'device_change', 'concurrent_session'
    )),
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    location_country TEXT,
    location_city TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for security events
CREATE INDEX idx_session_security_events_session_id ON session_security_events(session_id);
CREATE INDEX idx_session_security_events_user_id ON session_security_events(user_id);
CREATE INDEX idx_session_security_events_type ON session_security_events(event_type);
CREATE INDEX idx_session_security_events_severity ON session_security_events(severity);
CREATE INDEX idx_session_security_events_created_at ON session_security_events(created_at);

-- Row Level Security for security events
ALTER TABLE session_security_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own security events
CREATE POLICY session_security_events_user_policy ON session_security_events
    FOR SELECT USING (user_id = auth.uid());

-- Admin can see all security events
CREATE POLICY session_security_events_admin_policy ON session_security_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND email = 'admin@p2pfiat.com'
        )
    );

-- Create function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    p_session_id UUID,
    p_user_id UUID,
    p_event_type TEXT,
    p_severity TEXT DEFAULT 'info',
    p_description TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
    INSERT INTO session_security_events (
        session_id, user_id, event_type, severity, description,
        ip_address, user_agent, metadata
    ) VALUES (
        p_session_id, p_user_id, p_event_type, p_severity, p_description,
        p_ip_address, p_user_agent, p_metadata
    );
END;
$$ language 'plpgsql';

-- Create function to detect suspicious activity
CREATE OR REPLACE FUNCTION detect_suspicious_activity(p_user_id UUID)
RETURNS boolean AS $$
DECLARE
    concurrent_sessions INTEGER;
    different_locations INTEGER;
    recent_failures INTEGER;
BEGIN
    -- Check for too many concurrent sessions
    SELECT COUNT(*) INTO concurrent_sessions
    FROM user_sessions
    WHERE user_id = p_user_id 
      AND is_revoked = false 
      AND expires_at > NOW();
    
    -- Check for multiple locations in last hour
    SELECT COUNT(DISTINCT location_country) INTO different_locations
    FROM user_sessions
    WHERE user_id = p_user_id 
      AND last_activity_at > NOW() - INTERVAL '1 hour'
      AND location_country IS NOT NULL;
    
    -- Check for recent security events
    SELECT COUNT(*) INTO recent_failures
    FROM session_security_events
    WHERE user_id = p_user_id
      AND event_type = 'suspicious_activity'
      AND created_at > NOW() - INTERVAL '1 hour';
    
    -- Return true if suspicious activity detected
    RETURN (concurrent_sessions > 3 OR different_locations > 2 OR recent_failures > 5);
END;
$$ language 'plpgsql';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON session_security_events TO authenticated;
GRANT EXECUTE ON FUNCTION log_security_event TO authenticated;
GRANT EXECUTE ON FUNCTION detect_suspicious_activity TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_expired_sessions TO authenticated;