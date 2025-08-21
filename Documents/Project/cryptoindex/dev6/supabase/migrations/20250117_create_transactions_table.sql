-- Migration: Create transactions table for deposit/withdrawal tracking
-- Date: 2025-01-17
-- Description: Add transaction tracking for Arbitrum-Hyperliquid bridge operations

-- Create transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  network TEXT NOT NULL CHECK (network IN ('arbitrum', 'hyperliquid', 'ethereum')),
  amount DECIMAL(18, 6) NOT NULL CHECK (amount > 0),
  token_symbol TEXT NOT NULL DEFAULT 'USDC',
  
  -- Transaction hashes for tracking
  tx_hash TEXT, -- Original transaction hash
  bridge_tx_hash TEXT, -- Bridge transaction hash
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}',
  
  -- Indexing
  CONSTRAINT transactions_unique_tx_hash UNIQUE (tx_hash),
  CONSTRAINT transactions_amount_positive CHECK (amount > 0)
);

-- Create indexes for better query performance
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_network ON transactions(network);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_wallet_address ON transactions(wallet_address);
CREATE INDEX idx_transactions_tx_hash ON transactions(tx_hash) WHERE tx_hash IS NOT NULL;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own transactions
CREATE POLICY transactions_user_policy ON transactions
    FOR ALL USING (user_id = auth.uid());

-- Admin policy (if needed)
CREATE POLICY transactions_admin_policy ON transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND email = 'admin@p2pfiat.com'
        )
    );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON transactions TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;