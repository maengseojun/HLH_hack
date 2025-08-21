-- Migration: Create network_configs table
-- Date: 2025-01-17
-- Description: Network configuration management for multi-chain support

-- Create network_configs table
CREATE TABLE network_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_name TEXT UNIQUE NOT NULL,
  network_type TEXT NOT NULL CHECK (network_type IN ('mainnet', 'testnet')),
  chain_id INTEGER NOT NULL,
  rpc_url TEXT NOT NULL,
  websocket_url TEXT,
  
  -- Bridge configuration
  bridge_contract_address TEXT,
  bridge_abi JSONB,
  
  -- Token configuration
  native_token_symbol TEXT NOT NULL,
  native_token_decimals INTEGER NOT NULL DEFAULT 18,
  supported_tokens JSONB DEFAULT '[]',
  
  -- Deposit/Withdrawal limits
  min_deposit_amount DECIMAL(18, 6) DEFAULT 0,
  max_deposit_amount DECIMAL(18, 6),
  min_withdrawal_amount DECIMAL(18, 6) DEFAULT 0,
  max_withdrawal_amount DECIMAL(18, 6),
  
  -- Fees
  deposit_fee DECIMAL(18, 6) DEFAULT 0,
  withdrawal_fee DECIMAL(18, 6) DEFAULT 0,
  gas_fee_multiplier DECIMAL(5, 2) DEFAULT 1.0,
  
  -- Network status
  is_active BOOLEAN DEFAULT true,
  is_maintenance BOOLEAN DEFAULT false,
  
  -- Block confirmation requirements
  required_confirmations INTEGER DEFAULT 1,
  average_block_time INTEGER DEFAULT 12, -- in seconds
  
  -- Explorer configuration
  block_explorer_url TEXT,
  block_explorer_api_url TEXT,
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT network_configs_chain_id_unique UNIQUE (chain_id, network_type),
  CONSTRAINT network_configs_positive_amounts CHECK (
    min_deposit_amount >= 0 AND 
    min_withdrawal_amount >= 0 AND
    deposit_fee >= 0 AND 
    withdrawal_fee >= 0
  )
);

-- Create indexes
CREATE INDEX idx_network_configs_network_name ON network_configs(network_name);
CREATE INDEX idx_network_configs_chain_id ON network_configs(chain_id);
CREATE INDEX idx_network_configs_active ON network_configs(is_active);
CREATE INDEX idx_network_configs_type ON network_configs(network_type);

-- Create updated_at trigger
CREATE TRIGGER update_network_configs_updated_at
    BEFORE UPDATE ON network_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default network configurations
INSERT INTO network_configs (
  network_name, network_type, chain_id, rpc_url, native_token_symbol, native_token_decimals,
  bridge_contract_address, min_deposit_amount, withdrawal_fee, required_confirmations,
  block_explorer_url, supported_tokens
) VALUES 
-- Arbitrum One (Primary deposit network)
(
  'arbitrum', 'mainnet', 42161, 'https://arbitrum-one.public.blastapi.io',
  'ETH', 18, '0x2df1c51e09aecf9cacb7bc98cb1742757f163df7',
  5.0, 0.0, 1, 'https://arbiscan.io',
  '[{"symbol": "USDC", "decimals": 6, "address": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"}]'
),
-- Hyperliquid Mainnet
(
  'hyperliquid', 'mainnet', 999, 'https://rpc.hyperliquid.xyz/evm',
  'HYPE', 18, NULL,
  0.0, 1.0, 1, 'https://explorer.hyperliquid.xyz',
  '[{"symbol": "USDC", "decimals": 6, "address": "0x0000000000000000000000000000000000000000"}]'
),
-- Ethereum Mainnet (Secondary support)
(
  'ethereum', 'mainnet', 1, 'https://ethereum-rpc.publicnode.com',
  'ETH', 18, NULL,
  10.0, 0.0, 3, 'https://etherscan.io',
  '[{"symbol": "USDC", "decimals": 6, "address": "0xA0b86a33E6441c4CCfF4820d0d2a0c5BDE2c7E42"}]'
),
-- Hyperliquid Testnet
(
  'hyperliquid-testnet', 'testnet', 998, 'https://rpc.hyperliquid-testnet.xyz/evm',
  'HYPE', 18, NULL,
  0.0, 1.0, 1, 'https://explorer.hyperliquid-testnet.xyz',
  '[{"symbol": "USDC", "decimals": 6, "address": "0x0000000000000000000000000000000000000000"}]'
);

-- Row Level Security (RLS) policies
ALTER TABLE network_configs ENABLE ROW LEVEL SECURITY;

-- Read-only access for authenticated users
CREATE POLICY network_configs_read_policy ON network_configs
    FOR SELECT USING (true);

-- Admin-only write access
CREATE POLICY network_configs_admin_policy ON network_configs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND email = 'admin@p2pfiat.com'
        )
    );

-- Grant permissions
GRANT SELECT ON network_configs TO authenticated;
GRANT ALL ON network_configs TO service_role;