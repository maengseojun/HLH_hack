-- Migration: 20250119_create_users
-- Description: Create users table (must run before other tables)
-- Created: 2025-01-19

-- Users table (base authentication table)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_user_id TEXT UNIQUE NOT NULL,
  wallet_address TEXT UNIQUE NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_login_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_users_privy_user_id ON users(privy_user_id);
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (
    privy_user_id = current_setting('app.current_user_id', true)
  );

CREATE POLICY "Service role has full access to users" ON users
  FOR ALL USING (true);

-- Grant permissions
GRANT SELECT ON users TO authenticated;
GRANT ALL ON users TO service_role;

-- Comments
COMMENT ON TABLE users IS 'User authentication and profile information';
COMMENT ON COLUMN users.privy_user_id IS 'Privy authentication user ID';
COMMENT ON COLUMN users.wallet_address IS 'Primary wallet address';
COMMENT ON COLUMN users.email IS 'Optional email address';

-- Insert a test user for development
INSERT INTO users (privy_user_id, wallet_address, email)
VALUES (
  'test-user-123',
  '0x0000000000000000000000000000000000000001',
  'test@example.com'
) ON CONFLICT (privy_user_id) DO NOTHING;
