-- Migration: 20250120_create_token_tables
-- Description: Create token holders and transactions tables
-- Created: 2025-01-20

-- Token Holders table
CREATE TABLE IF NOT EXISTS token_holders (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance NUMERIC(20, 6) DEFAULT 0 NOT NULL CHECK (balance >= 0),
  locked NUMERIC(20, 6) DEFAULT 0 NOT NULL CHECK (locked >= 0),
  staked NUMERIC(20, 6) DEFAULT 0 NOT NULL CHECK (staked >= 0),
  rewards NUMERIC(20, 6) DEFAULT 0 NOT NULL CHECK (rewards >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Token Transactions table
CREATE TABLE IF NOT EXISTS token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mint', 'burn', 'transfer', 'claim', 'stake', 'unstake', 'reward')),
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  from_user UUID REFERENCES users(id) ON DELETE SET NULL,
  to_user UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_token_holders_user_id ON token_holders(user_id);
CREATE INDEX idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX idx_token_transactions_type ON token_transactions(type);
CREATE INDEX idx_token_transactions_created_at ON token_transactions(created_at DESC);
CREATE INDEX idx_token_transactions_from_user ON token_transactions(from_user);
CREATE INDEX idx_token_transactions_to_user ON token_transactions(to_user);

-- Updated at trigger for token_holders
DROP TRIGGER IF EXISTS update_token_holders_updated_at ON token_holders;
CREATE TRIGGER update_token_holders_updated_at
  BEFORE UPDATE ON token_holders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE token_holders ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for token_holders
CREATE POLICY "Users can view their own token balance" ON token_holders
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM users WHERE privy_user_id = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "Service role has full access to token_holders" ON token_holders
  FOR ALL USING (true);

-- RLS Policies for token_transactions
CREATE POLICY "Users can view their own transactions" ON token_transactions
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM users WHERE privy_user_id = current_setting('app.current_user_id', true)
    ) OR
    from_user IN (
      SELECT id FROM users WHERE privy_user_id = current_setting('app.current_user_id', true)
    ) OR
    to_user IN (
      SELECT id FROM users WHERE privy_user_id = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "Service role has full access to token_transactions" ON token_transactions
  FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON token_holders TO authenticated;
GRANT ALL ON token_transactions TO authenticated;
GRANT ALL ON token_holders TO service_role;
GRANT ALL ON token_transactions TO service_role;

-- Comments
COMMENT ON TABLE token_holders IS 'Native token (HI) balances for users';
COMMENT ON TABLE token_transactions IS 'All token transactions (mint, burn, transfer, claim, etc.)';
COMMENT ON COLUMN token_holders.balance IS 'Available token balance';
COMMENT ON COLUMN token_holders.locked IS 'Locked tokens (vesting)';
COMMENT ON COLUMN token_holders.staked IS 'Staked tokens';
COMMENT ON COLUMN token_holders.rewards IS 'Unclaimed reward tokens';
