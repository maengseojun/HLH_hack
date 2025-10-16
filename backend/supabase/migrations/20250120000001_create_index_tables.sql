-- Migration: 20250120_create_index_tables
-- Description: Create indices, components, and bonding curve tables
-- Created: 2025-01-20

-- Indices table
CREATE TABLE IF NOT EXISTS indices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer TEXT NOT NULL CHECK (layer IN ('L1', 'L2', 'L3')),
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  management_fee NUMERIC(5, 4) NOT NULL CHECK (management_fee >= 0 AND management_fee <= 1),
  performance_fee NUMERIC(5, 4) CHECK (performance_fee IS NULL OR (performance_fee >= 0 AND performance_fee <= 1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'graduated', 'deprecated')),
  total_value_locked NUMERIC(20, 2) DEFAULT 0 NOT NULL CHECK (total_value_locked >= 0),
  holders INTEGER DEFAULT 0 NOT NULL CHECK (holders >= 0),
  volume_24h NUMERIC(20, 2) DEFAULT 0 NOT NULL CHECK (volume_24h >= 0),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index Components table
CREATE TABLE IF NOT EXISTS index_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_id UUID NOT NULL REFERENCES indices(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  address TEXT NOT NULL,
  weight NUMERIC(5, 4) NOT NULL CHECK (weight > 0 AND weight <= 1),
  chain_id INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure unique components per index
  UNIQUE(index_id, symbol)
);

-- Bonding Curve Parameters table (for L3 indices)
CREATE TABLE IF NOT EXISTS bonding_curve_params (
  index_id UUID PRIMARY KEY REFERENCES indices(id) ON DELETE CASCADE,
  curve_type TEXT NOT NULL CHECK (curve_type IN ('linear', 'exponential', 'sigmoid', 'hybrid')),
  base_price NUMERIC(10, 6) NOT NULL CHECK (base_price > 0),
  linear_slope NUMERIC(10, 8),
  max_price NUMERIC(10, 6),
  sigmoid_slope NUMERIC(10, 8),
  midpoint NUMERIC(15, 2),
  transition_point NUMERIC(15, 2),
  target_market_cap NUMERIC(20, 2) NOT NULL CHECK (target_market_cap > 0),
  current_price NUMERIC(10, 6) DEFAULT 0 NOT NULL CHECK (current_price >= 0),
  current_market_cap NUMERIC(20, 2) DEFAULT 0 NOT NULL CHECK (current_market_cap >= 0),
  total_raised NUMERIC(20, 2) DEFAULT 0 NOT NULL CHECK (total_raised >= 0),
  progress NUMERIC(5, 2) DEFAULT 0 NOT NULL CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_indices_layer ON indices(layer);
CREATE INDEX idx_indices_symbol ON indices(symbol);
CREATE INDEX idx_indices_status ON indices(status);
CREATE INDEX idx_indices_created_by ON indices(created_by);
CREATE INDEX idx_indices_created_at ON indices(created_at DESC);

CREATE INDEX idx_index_components_index_id ON index_components(index_id);
CREATE INDEX idx_index_components_symbol ON index_components(symbol);

CREATE INDEX idx_bonding_curve_params_index_id ON bonding_curve_params(index_id);

-- Updated at triggers
DROP TRIGGER IF EXISTS update_indices_updated_at ON indices;
CREATE TRIGGER update_indices_updated_at
  BEFORE UPDATE ON indices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bonding_curve_params_updated_at ON bonding_curve_params;
CREATE TRIGGER update_bonding_curve_params_updated_at
  BEFORE UPDATE ON bonding_curve_params
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE indices ENABLE ROW LEVEL SECURITY;
ALTER TABLE index_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonding_curve_params ENABLE ROW LEVEL SECURITY;

-- RLS Policies for indices (public read)
CREATE POLICY "Anyone can view indices" ON indices
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own L3 indices" ON indices
  FOR ALL USING (
    layer = 'L3' AND created_by IN (
      SELECT id FROM users WHERE privy_user_id = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "Service role has full access to indices" ON indices
  FOR ALL USING (true);

-- RLS Policies for index_components (public read)
CREATE POLICY "Anyone can view index components" ON index_components
  FOR SELECT USING (true);

CREATE POLICY "Users can manage components of their L3 indices" ON index_components
  FOR ALL USING (
    index_id IN (
      SELECT id FROM indices 
      WHERE layer = 'L3' 
      AND created_by IN (
        SELECT id FROM users WHERE privy_user_id = current_setting('app.current_user_id', true)
      )
    )
  );

CREATE POLICY "Service role has full access to index_components" ON index_components
  FOR ALL USING (true);

-- RLS Policies for bonding_curve_params (public read)
CREATE POLICY "Anyone can view bonding curve params" ON bonding_curve_params
  FOR SELECT USING (true);

CREATE POLICY "Service role has full access to bonding_curve_params" ON bonding_curve_params
  FOR ALL USING (true);

-- Grant permissions
GRANT SELECT ON indices TO authenticated;
GRANT ALL ON indices TO service_role;
GRANT SELECT ON index_components TO authenticated;
GRANT ALL ON index_components TO service_role;
GRANT SELECT ON bonding_curve_params TO authenticated;
GRANT ALL ON bonding_curve_params TO service_role;

-- Comments
COMMENT ON TABLE indices IS 'Index funds (L1, L2, L3) with layer-specific configurations';
COMMENT ON TABLE index_components IS 'Token components that make up each index';
COMMENT ON TABLE bonding_curve_params IS 'Bonding curve parameters for L3 indices';
COMMENT ON COLUMN indices.layer IS 'L1 (major), L2 (themed), L3 (user-launched)';
COMMENT ON COLUMN indices.management_fee IS 'Annual management fee (0-1, e.g., 0.007 = 0.7%)';
COMMENT ON COLUMN indices.performance_fee IS 'Performance fee for L3 (0-1, e.g., 0.2 = 20%)';
COMMENT ON COLUMN index_components.weight IS 'Component weight (0-1, sum should be 1.0 per index)';
COMMENT ON COLUMN bonding_curve_params.progress IS 'Progress to graduation target (0-100%)';
