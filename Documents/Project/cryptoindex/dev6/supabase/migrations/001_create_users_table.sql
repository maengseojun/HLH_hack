-- Migration: 001_create_users_table
-- Description: Create users and user_wallets tables with proper schema
-- Created: 2025-07-18

-- Enable RLS
ALTER TABLE IF EXISTS auth.users ENABLE ROW LEVEL SECURITY;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_user_id TEXT UNIQUE NOT NULL,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('email', 'wallet')),
  email TEXT,
  last_login TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT users_email_check CHECK (
    (auth_type = 'email' AND email IS NOT NULL) OR 
    (auth_type = 'wallet' AND email IS NULL)
  )
);

-- Create user_wallets table
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  wallet_provider TEXT NOT NULL DEFAULT 'unknown',
  network TEXT NOT NULL DEFAULT 'ethereum',
  wallet_type TEXT NOT NULL DEFAULT 'external' CHECK (wallet_type IN ('embedded', 'external')),
  privy_wallet_id TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique wallet addresses per user
  UNIQUE(user_id, wallet_address),
  -- Ensure only one primary wallet per user
  EXCLUDE (user_id WITH =) WHERE (is_primary = true)
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_wallets_updated_at ON user_wallets;
CREATE TRIGGER update_user_wallets_updated_at
    BEFORE UPDATE ON user_wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_privy_user_id ON users(privy_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_address ON user_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_wallets_primary ON user_wallets(user_id, is_primary);

-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (privy_user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (privy_user_id = current_setting('app.current_user_id', true));

-- RLS Policies for user_wallets table  
CREATE POLICY "Users can view their own wallets" ON user_wallets
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM users WHERE privy_user_id = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "Users can manage their own wallets" ON user_wallets
  FOR ALL USING (
    user_id IN (
      SELECT id FROM users WHERE privy_user_id = current_setting('app.current_user_id', true)
    )
  );

-- Grant necessary permissions
GRANT ALL ON users TO authenticated;
GRANT ALL ON user_wallets TO authenticated;
GRANT ALL ON users TO service_role;
GRANT ALL ON user_wallets TO service_role;

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts synchronized from Privy authentication';
COMMENT ON TABLE user_wallets IS 'EVM wallets associated with user accounts';
COMMENT ON COLUMN users.privy_user_id IS 'Unique identifier from Privy (did:privy:xxx format)';
COMMENT ON COLUMN users.auth_type IS 'Authentication method: email (embedded wallet) or wallet (external)';
COMMENT ON COLUMN user_wallets.wallet_type IS 'embedded (Privy managed) or external (user managed)';
COMMENT ON COLUMN user_wallets.is_primary IS 'Primary wallet for the user (only one per user)';