-- Migration: Create withdrawal_fees table
-- Date: 2025-01-17
-- Description: Track withdrawal fees and discount tiers

-- Create withdrawal_fees table
CREATE TABLE withdrawal_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  
  -- Fee amounts
  gross_amount DECIMAL(18, 6) NOT NULL,
  base_fee DECIMAL(18, 6) NOT NULL DEFAULT 1.0,
  applicable_fee DECIMAL(18, 6) NOT NULL,
  net_amount DECIMAL(18, 6) NOT NULL,
  
  -- Discount information
  discount_tier TEXT,
  discount_percentage INTEGER DEFAULT 0,
  fee_waived BOOLEAN DEFAULT false,
  waiver_reason TEXT,
  
  -- Volume tracking
  user_volume_30d DECIMAL(18, 6) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT withdrawal_fees_positive_amounts CHECK (
    gross_amount > 0 AND 
    base_fee >= 0 AND 
    applicable_fee >= 0 AND 
    net_amount >= 0
  ),
  CONSTRAINT withdrawal_fees_valid_discount CHECK (
    discount_percentage >= 0 AND discount_percentage <= 100
  ),
  CONSTRAINT withdrawal_fees_fee_logic CHECK (
    applicable_fee <= base_fee
  )
);

-- Create indexes for better performance
CREATE INDEX idx_withdrawal_fees_user_id ON withdrawal_fees(user_id);
CREATE INDEX idx_withdrawal_fees_transaction_id ON withdrawal_fees(transaction_id);
CREATE INDEX idx_withdrawal_fees_created_at ON withdrawal_fees(created_at);
CREATE INDEX idx_withdrawal_fees_discount_tier ON withdrawal_fees(discount_tier);
CREATE INDEX idx_withdrawal_fees_fee_waived ON withdrawal_fees(fee_waived);

-- Create updated_at trigger
CREATE TRIGGER update_withdrawal_fees_updated_at
    BEFORE UPDATE ON withdrawal_fees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate net amount automatically
CREATE OR REPLACE FUNCTION calculate_net_amount()
RETURNS TRIGGER AS $$
BEGIN
    NEW.net_amount = NEW.gross_amount - NEW.applicable_fee;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-calculate net amount
CREATE TRIGGER calculate_withdrawal_net_amount
    BEFORE INSERT OR UPDATE ON withdrawal_fees
    FOR EACH ROW
    EXECUTE FUNCTION calculate_net_amount();

-- Create function to track fee statistics
CREATE OR REPLACE FUNCTION update_fee_statistics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user's fee tier based on volume
    IF NEW.user_volume_30d IS NOT NULL THEN
        UPDATE users 
        SET metadata = COALESCE(metadata, '{}'::jsonb) || 
            jsonb_build_object(
                'fee_tier', 
                CASE 
                    WHEN NEW.user_volume_30d >= 500000 THEN 'platinum'
                    WHEN NEW.user_volume_30d >= 100000 THEN 'gold'
                    WHEN NEW.user_volume_30d >= 50000 THEN 'silver'
                    WHEN NEW.user_volume_30d >= 10000 THEN 'bronze'
                    ELSE 'standard'
                END,
                'last_volume_update', NOW()
            )
        WHERE id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for fee statistics
CREATE TRIGGER update_withdrawal_fee_statistics
    AFTER INSERT OR UPDATE ON withdrawal_fees
    FOR EACH ROW
    EXECUTE FUNCTION update_fee_statistics();

-- Create view for fee analytics
CREATE VIEW withdrawal_fee_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_withdrawals,
    SUM(gross_amount) as total_gross_amount,
    SUM(base_fee) as total_base_fees,
    SUM(applicable_fee) as total_applicable_fees,
    SUM(net_amount) as total_net_amount,
    AVG(applicable_fee) as avg_fee_per_withdrawal,
    COUNT(*) FILTER (WHERE fee_waived = true) as fee_waivers,
    COUNT(*) FILTER (WHERE discount_tier IS NOT NULL) as discount_usage,
    SUM(base_fee - applicable_fee) as total_fee_discounts
FROM withdrawal_fees
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Create view for user fee tiers
CREATE VIEW user_fee_tiers AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(wf.id) as total_withdrawals,
    SUM(wf.gross_amount) as total_withdrawal_amount,
    AVG(wf.applicable_fee) as avg_fee_paid,
    SUM(wf.base_fee - wf.applicable_fee) as total_fee_savings,
    wf.discount_tier as current_tier,
    wf.user_volume_30d as current_volume,
    CASE 
        WHEN wf.user_volume_30d >= 500000 THEN 'platinum'
        WHEN wf.user_volume_30d >= 100000 THEN 'gold'
        WHEN wf.user_volume_30d >= 50000 THEN 'silver'
        WHEN wf.user_volume_30d >= 10000 THEN 'bronze'
        ELSE 'standard'
    END as calculated_tier
FROM users u
LEFT JOIN withdrawal_fees wf ON u.id = wf.user_id
WHERE wf.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.email, wf.discount_tier, wf.user_volume_30d;

-- Create table for fee configuration
CREATE TABLE withdrawal_fee_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_name TEXT UNIQUE NOT NULL,
    base_withdrawal_fee DECIMAL(18, 6) NOT NULL DEFAULT 1.0,
    minimum_withdrawal DECIMAL(18, 6) NOT NULL DEFAULT 1.01,
    maximum_withdrawal DECIMAL(18, 6) NOT NULL DEFAULT 100000.0,
    fee_waiver_threshold DECIMAL(18, 6),
    discount_tiers JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO withdrawal_fee_config (
    config_name, 
    base_withdrawal_fee, 
    minimum_withdrawal, 
    maximum_withdrawal,
    fee_waiver_threshold,
    discount_tiers
) VALUES (
    'default',
    1.0,
    1.01,
    100000.0,
    10000.0,
    '[
        {"name": "Bronze", "minimumVolume": 10000, "discountPercentage": 10, "description": "10% fee discount for $10k+ monthly volume"},
        {"name": "Silver", "minimumVolume": 50000, "discountPercentage": 25, "description": "25% fee discount for $50k+ monthly volume"},
        {"name": "Gold", "minimumVolume": 100000, "discountPercentage": 50, "description": "50% fee discount for $100k+ monthly volume"},
        {"name": "Platinum", "minimumVolume": 500000, "discountPercentage": 100, "description": "No withdrawal fees for $500k+ monthly volume"}
    ]'::jsonb
);

-- Row Level Security (RLS) policies
ALTER TABLE withdrawal_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_fee_config ENABLE ROW LEVEL SECURITY;

-- Users can only see their own fee records
CREATE POLICY withdrawal_fees_user_policy ON withdrawal_fees
    FOR SELECT USING (user_id = auth.uid());

-- Admin can see all fee records
CREATE POLICY withdrawal_fees_admin_policy ON withdrawal_fees
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND email = 'admin@p2pfiat.com'
        )
    );

-- Fee config is read-only for authenticated users
CREATE POLICY withdrawal_fee_config_read_policy ON withdrawal_fee_config
    FOR SELECT USING (is_active = true);

-- Only admin can modify fee config
CREATE POLICY withdrawal_fee_config_admin_policy ON withdrawal_fee_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND email = 'admin@p2pfiat.com'
        )
    );

-- Grant necessary permissions
GRANT SELECT, INSERT ON withdrawal_fees TO authenticated;
GRANT SELECT ON withdrawal_fee_config TO authenticated;
GRANT SELECT ON withdrawal_fee_analytics TO authenticated;
GRANT SELECT ON user_fee_tiers TO authenticated;
GRANT ALL ON withdrawal_fees TO service_role;
GRANT ALL ON withdrawal_fee_config TO service_role;

-- Create function to get user's current fee tier
CREATE OR REPLACE FUNCTION get_user_fee_tier(p_user_id UUID)
RETURNS TABLE (
    tier_name TEXT,
    discount_percentage INTEGER,
    current_volume DECIMAL(18, 6),
    volume_to_next_tier DECIMAL(18, 6)
) AS $$
DECLARE
    user_volume DECIMAL(18, 6);
    tier_info RECORD;
BEGIN
    -- Get user's 30-day volume
    SELECT COALESCE(SUM(amount), 0) INTO user_volume
    FROM transactions
    WHERE user_id = p_user_id 
      AND status = 'completed'
      AND created_at >= NOW() - INTERVAL '30 days';
    
    -- Determine current tier
    SELECT 
        CASE 
            WHEN user_volume >= 500000 THEN 'Platinum'
            WHEN user_volume >= 100000 THEN 'Gold'
            WHEN user_volume >= 50000 THEN 'Silver'
            WHEN user_volume >= 10000 THEN 'Bronze'
            ELSE 'Standard'
        END as tier_name,
        CASE 
            WHEN user_volume >= 500000 THEN 100
            WHEN user_volume >= 100000 THEN 50
            WHEN user_volume >= 50000 THEN 25
            WHEN user_volume >= 10000 THEN 10
            ELSE 0
        END as discount_percentage,
        user_volume as current_volume,
        CASE 
            WHEN user_volume >= 500000 THEN 0
            WHEN user_volume >= 100000 THEN 500000 - user_volume
            WHEN user_volume >= 50000 THEN 100000 - user_volume
            WHEN user_volume >= 10000 THEN 50000 - user_volume
            ELSE 10000 - user_volume
        END as volume_to_next_tier
    INTO tier_info;
    
    RETURN QUERY SELECT 
        tier_info.tier_name,
        tier_info.discount_percentage,
        tier_info.current_volume,
        tier_info.volume_to_next_tier;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_fee_tier TO authenticated;