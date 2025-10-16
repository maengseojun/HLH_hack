-- Migration: 20250120_create_funding_tables
-- Description: Create funding rounds and investments tables
-- Created: 2025-01-20

-- Funding Rounds table
CREATE TABLE IF NOT EXISTS funding_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (name IN ('seed', 'strategic', 'public')),
  price_per_token NUMERIC(10, 6) NOT NULL CHECK (price_per_token > 0),
  discount_percent NUMERIC(5, 2) NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  min_investment NUMERIC(15, 2) NOT NULL CHECK (min_investment > 0),
  max_investment NUMERIC(15, 2) NOT NULL CHECK (max_investment >= min_investment),
  target_raise NUMERIC(15, 2) NOT NULL CHECK (target_raise > 0),
  current_raise NUMERIC(15, 2) DEFAULT 0 NOT NULL CHECK (current_raise >= 0),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL CHECK (end_time > start_time),
  vesting_months INTEGER NOT NULL CHECK (vesting_months >= 0),
  cliff_months INTEGER NOT NULL CHECK (cliff_months >= 0),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure unique round names
  UNIQUE(name)
);

-- Investments table
CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES funding_rounds(id) ON DELETE CASCADE,
  round_name TEXT NOT NULL CHECK (round_name IN ('seed', 'strategic', 'public')),
  investment_amount NUMERIC(15, 2) NOT NULL CHECK (investment_amount > 0),
  token_amount NUMERIC(20, 6) NOT NULL CHECK (token_amount > 0),
  price_per_token NUMERIC(10, 6) NOT NULL CHECK (price_per_token > 0),
  
  -- Vesting details
  vesting_total NUMERIC(20, 6) NOT NULL CHECK (vesting_total > 0),
  vesting_start_time TIMESTAMPTZ NOT NULL,
  vesting_cliff_end_time TIMESTAMPTZ NOT NULL,
  vesting_end_time TIMESTAMPTZ NOT NULL CHECK (vesting_end_time > vesting_start_time),
  claimed_amount NUMERIC(20, 6) DEFAULT 0 NOT NULL CHECK (claimed_amount >= 0),
  remaining_amount NUMERIC(20, 6) NOT NULL CHECK (remaining_amount >= 0),
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_funding_rounds_name ON funding_rounds(name);
CREATE INDEX idx_funding_rounds_status ON funding_rounds(status);
CREATE INDEX idx_funding_rounds_start_time ON funding_rounds(start_time);
CREATE INDEX idx_funding_rounds_end_time ON funding_rounds(end_time);

CREATE INDEX idx_investments_user_id ON investments(user_id);
CREATE INDEX idx_investments_round_id ON investments(round_id);
CREATE INDEX idx_investments_round_name ON investments(round_name);
CREATE INDEX idx_investments_created_at ON investments(created_at DESC);
CREATE INDEX idx_investments_vesting_cliff_end_time ON investments(vesting_cliff_end_time);
CREATE INDEX idx_investments_vesting_end_time ON investments(vesting_end_time);

-- Enable RLS
ALTER TABLE funding_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for funding_rounds (public read)
CREATE POLICY "Anyone can view funding rounds" ON funding_rounds
  FOR SELECT USING (true);

CREATE POLICY "Service role has full access to funding_rounds" ON funding_rounds
  FOR ALL USING (true);

-- RLS Policies for investments
CREATE POLICY "Users can view their own investments" ON investments
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM users WHERE privy_user_id = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "Service role has full access to investments" ON investments
  FOR ALL USING (true);

-- Grant permissions
GRANT SELECT ON funding_rounds TO authenticated;
GRANT ALL ON funding_rounds TO service_role;
GRANT ALL ON investments TO authenticated;
GRANT ALL ON investments TO service_role;

-- Comments
COMMENT ON TABLE funding_rounds IS 'Token funding rounds (Seed, Strategic, Public)';
COMMENT ON TABLE investments IS 'User investments in funding rounds with vesting schedules';
COMMENT ON COLUMN funding_rounds.current_raise IS 'Amount raised so far in USD';
COMMENT ON COLUMN investments.vesting_total IS 'Total tokens to be vested';
COMMENT ON COLUMN investments.claimed_amount IS 'Tokens already claimed';
COMMENT ON COLUMN investments.remaining_amount IS 'Tokens remaining to be claimed';
