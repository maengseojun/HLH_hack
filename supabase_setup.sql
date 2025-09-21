-- HLH Project Database Schema Setup
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_type TEXT NOT NULL CHECK (auth_type IN ('email', 'wallet')),
  email TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  wallet_address TEXT,
  wallet_type TEXT,
  privy_user_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE
);

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,
  privy_access_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_reason TEXT,
  session_type TEXT DEFAULT 'web' CHECK (session_type IN ('web', 'mobile', 'api')),
  device_fingerprint TEXT,
  location_country TEXT,
  location_city TEXT,
  is_suspicious BOOLEAN DEFAULT FALSE,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_metadata JSONB
);

-- Create user_wallets table
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  encrypted_private_key TEXT,
  wallet_provider TEXT DEFAULT 'unknown',
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_privy_user_id ON users(privy_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_wallet_address ON user_wallets(wallet_address);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (privy_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (privy_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Create RLS policies for user_sessions table
CREATE POLICY "Users can view own sessions" ON user_sessions
  FOR SELECT USING (user_id IN (
    SELECT id FROM users WHERE privy_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

CREATE POLICY "Users can update own sessions" ON user_sessions
  FOR UPDATE USING (user_id IN (
    SELECT id FROM users WHERE privy_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

-- Create RLS policies for user_wallets table
CREATE POLICY "Users can view own wallets" ON user_wallets
  FOR SELECT USING (user_id IN (
    SELECT id FROM users WHERE privy_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

CREATE POLICY "Users can insert own wallets" ON user_wallets
  FOR INSERT WITH CHECK (user_id IN (
    SELECT id FROM users WHERE privy_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_wallets TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;