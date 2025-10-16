-- Insert test data for development
-- Run with: psql -h localhost -p 54322 -U postgres -d postgres -f supabase/seed.sql

-- System accounts (treasury, etc.)
INSERT INTO users (id, privy_user_id, wallet_address) VALUES
  ('00000000-0000-0000-0000-000000000001', 'system-treasury', 'system-treasury'),
  ('00000000-0000-0000-0000-000000000002', 'system-buyback-pool', 'system-buyback-pool'),
  ('00000000-0000-0000-0000-000000000003', 'system-staking-rewards', 'system-staking-rewards')
ON CONFLICT (id) DO NOTHING;

-- Test Index: L3 Index with bonding curve
INSERT INTO indices (
  id,
  layer,
  symbol,
  name,
  description,
  management_fee,
  performance_fee,
  status,
  total_value_locked,
  holders,
  volume_24h,
  created_by
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'L3',
  'TEST-INDEX',
  'Test DeFi Index',
  'A test index for development',
  0.02,
  0.2,
  'active',
  10000.00,
  5,
  500.00,
  (SELECT id FROM users WHERE privy_user_id = 'system-treasury')
) ON CONFLICT (id) DO NOTHING;

-- Test components for the index
INSERT INTO index_components (index_id, symbol, address, weight) VALUES
  ('11111111-1111-1111-1111-111111111111', 'TOKEN1', '0x1111111111111111111111111111111111111111', 0.5),
  ('11111111-1111-1111-1111-111111111111', 'TOKEN2', '0x2222222222222222222222222222222222222222', 0.5)
ON CONFLICT (index_id, symbol) DO NOTHING;

-- Test bonding curve params
INSERT INTO bonding_curve_params (
  index_id,
  curve_type,
  base_price,
  linear_slope,
  max_price,
  sigmoid_slope,
  midpoint,
  transition_point,
  target_market_cap,
  current_price,
  current_market_cap,
  total_raised,
  progress
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'hybrid',
  0.01,
  0.00001,
  10.0,
  0.0002,
  7500.0,
  5000.0,
  1000000.0,
  0.05,
  5000.0,
  2500.0,
  0.5
) ON CONFLICT (index_id) DO NOTHING;

-- Test L1 Index (no bonding curve)
INSERT INTO indices (
  id,
  layer,
  symbol,
  name,
  description,
  management_fee,
  status,
  total_value_locked,
  holders,
  volume_24h
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  'L1',
  'HI-MAJOR',
  'HyperCore Major Index',
  'Major market index tracking top tokens',
  0.007,
  'active',
  5000000.00,
  250,
  100000.00
) ON CONFLICT (id) DO NOTHING;

-- Components for L1 Index (simplified - just 3 tokens for testing)
INSERT INTO index_components (index_id, symbol, address, weight) VALUES
  ('22222222-2222-2222-2222-222222222222', 'ETH', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 0.4),
  ('22222222-2222-2222-2222-222222222222', 'USDC', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 0.3),
  ('22222222-2222-2222-2222-222222222222', 'HYPE', '0x3333333333333333333333333333333333333333', 0.3)
ON CONFLICT (index_id, symbol) DO NOTHING;

SELECT 'Test data inserted successfully!' as result;
