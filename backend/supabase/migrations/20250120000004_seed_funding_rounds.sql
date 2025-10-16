-- Migration: 20250120000004_seed_funding_rounds
-- Description: Seed initial funding rounds data
-- Created: 2025-01-20

-- Insert default funding rounds (only if not exists)
INSERT INTO funding_rounds (
  name,
  price_per_token,
  discount_percent,
  min_investment,
  max_investment,
  target_raise,
  current_raise,
  start_time,
  end_time,
  vesting_months,
  cliff_months,
  status
) VALUES
  -- Seed Round (Active)
  (
    'seed',
    0.01,
    70,
    1000,
    50000,
    500000,
    0,
    NOW(), -- Start now
    NOW() + INTERVAL '30 days',
    12,
    3,
    'active'
  ),
  -- Strategic Round (Upcoming)
  (
    'strategic',
    0.02,
    40,
    10000,
    500000,
    2000000,
    0,
    NOW() + INTERVAL '30 days',
    NOW() + INTERVAL '60 days',
    18,
    6,
    'upcoming'
  ),
  -- Public Round (Upcoming)
  (
    'public',
    0.05,
    0,
    100,
    100000,
    5000000,
    0,
    NOW() + INTERVAL '60 days',
    NOW() + INTERVAL '90 days',
    6,
    0,
    'upcoming'
  )
ON CONFLICT (name) DO NOTHING; -- Idempotent

-- Verify seeded data
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM funding_rounds;
  RAISE NOTICE '💎 Seeded % funding rounds', v_count;
END $$;
