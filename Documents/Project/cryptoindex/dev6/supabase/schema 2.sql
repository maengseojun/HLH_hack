-- Cryptoindex Database Schema
-- 문서 기반으로 한 완전한 스키마

-- 1. Users 테이블 (이메일 및 지갑 사용자)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_type VARCHAR(10) NOT NULL CHECK (auth_type IN ('email', 'wallet')),
  
  -- 이메일 사용자용 필드
  email VARCHAR(255) UNIQUE,
  email_verified BOOLEAN DEFAULT FALSE,
  
  -- 지갑 사용자용 필드  
  wallet_address VARCHAR(42) UNIQUE,
  wallet_type VARCHAR(20), -- metamask, phantom, keplr, coinbase, okx
  
  -- 공통 필드
  privy_user_id VARCHAR(255) UNIQUE, -- Privy에서 관리하는 사용자 ID
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- 제약 조건
  CONSTRAINT email_required_for_email_auth 
    CHECK ((auth_type = 'email' AND email IS NOT NULL) OR auth_type != 'email'),
  CONSTRAINT wallet_required_for_wallet_auth 
    CHECK ((auth_type = 'wallet' AND wallet_address IS NOT NULL) OR auth_type != 'wallet')
);

-- 2. 이메일 인증 코드 테이블 (Privy 사용으로 제거됨)
-- CREATE TABLE IF NOT EXISTS email_verification_codes (...)

-- 3. 사용자 세션 테이블 (Privy 사용으로 제거됨)
-- CREATE TABLE IF NOT EXISTS user_sessions (...)

-- 3. 이메일 사용자용 생성된 지갑 테이블
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_address VARCHAR(42) NOT NULL,
  encrypted_private_key TEXT, -- Privy에서 암호화된 개인키
  wallet_provider VARCHAR(20) DEFAULT 'privy',
  is_primary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- 인덱스
  INDEX idx_user_wallets_user_id (user_id),
  INDEX idx_user_wallets_address (wallet_address)
);

-- 4. 2FA 테이블 (Privy 사용으로 제거됨)
-- CREATE TABLE IF NOT EXISTS user_2fa (...)

-- RLS (Row Level Security) 정책 설정
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;

-- Function to extract Privy user ID from JWT token
CREATE OR REPLACE FUNCTION get_privy_user_id()
RETURNS TEXT AS $$
BEGIN
  -- Extract privy_user_id from JWT token's custom claims
  RETURN auth.jwt() ->> 'privy_user_id';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS 정책: 사용자는 자신의 데이터만 볼 수 있음 (Privy 기반)
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (get_privy_user_id() = privy_user_id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (get_privy_user_id() = privy_user_id);

CREATE POLICY "Users can view own wallets" ON user_wallets
  FOR SELECT USING (get_privy_user_id() = (SELECT privy_user_id FROM users WHERE id = user_id));

CREATE POLICY "Users can insert own wallets" ON user_wallets
  FOR INSERT WITH CHECK (get_privy_user_id() = (SELECT privy_user_id FROM users WHERE id = user_id));

CREATE POLICY "Users can update own wallets" ON user_wallets
  FOR UPDATE USING (get_privy_user_id() = (SELECT privy_user_id FROM users WHERE id = user_id));

CREATE POLICY "Users can delete own wallets" ON user_wallets
  FOR DELETE USING (get_privy_user_id() = (SELECT privy_user_id FROM users WHERE id = user_id));

-- 참고: Privy JWT 토큰에는 다음과 같은 클레임이 포함되어야 함:
-- {
--   "privy_user_id": "user_privy_id_here",
--   "sub": "user_id",
--   "aud": "your_app_id",
--   "iss": "privy.io",
--   "exp": timestamp
-- }

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_privy_user_id ON users(privy_user_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_type ON users(auth_type);
