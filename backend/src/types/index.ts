// Index and Layer Types for MVP

/**
 * Layer definitions
 * L1: Major market indices (50+ tokens)
 * L2: Themed indices (smaller scope)
 * L3: User-launched indices (bonding curve)
 */
export type Layer = 'L1' | 'L2' | 'L3';

/**
 * Index status
 */
export type IndexStatus = 'active' | 'paused' | 'graduated' | 'deprecated';

/**
 * Token component in an index
 */
export interface IndexComponent {
  symbol: string;
  address: string;
  weight: number; // Percentage (0-1), sum should be 1.0
  chainId?: number; // For future multi-chain support
}

/**
 * Index metadata
 */
export interface Index {
  id: string;
  layer: Layer;
  symbol: string; // e.g., "HI-MAJOR", "HI-DEFI"
  name: string; // e.g., "HyperCore Major Index"
  description: string;
  components: IndexComponent[];
  
  // Fees
  managementFee: number; // Annual % (e.g., 0.007 = 0.7%)
  performanceFee?: number; // % of profits (for L3)
  
  // Status
  status: IndexStatus;
  
  // Metadata
  createdAt: number;
  updatedAt: number;
  createdBy?: string; // User ID (for L3)
  
  // Layer-specific
  totalValueLocked?: string; // TVL in USD
  holders?: number;
  volume24h?: string;
}

/**
 * Layer configuration
 */
export interface LayerConfig {
  layer: Layer;
  minComponents: number;
  maxComponents: number;
  tradingMechanism: 'amm' | 'bonding-curve';
  managementFee: number; // Default fee
  rebalancingFrequency?: 'monthly' | 'weekly' | 'user-controlled';
  permissionless: boolean; // Can users create?
}

/**
 * Layer 1 Configuration
 * Major market indices with 50+ tokens
 */
export const L1_CONFIG: LayerConfig = {
  layer: 'L1',
  minComponents: 50,
  maxComponents: 100,
  tradingMechanism: 'amm',
  managementFee: 0.007, // 0.7% annually
  rebalancingFrequency: 'monthly',
  permissionless: false, // Admin only
};

/**
 * Layer 2 Configuration
 * Themed indices
 */
export const L2_CONFIG: LayerConfig = {
  layer: 'L2',
  minComponents: 5,
  maxComponents: 50,
  tradingMechanism: 'amm',
  managementFee: 0.01, // 1% annually
  rebalancingFrequency: 'weekly',
  permissionless: false, // Admin or graduated L3
};

/**
 * Layer 3 Configuration
 * User-launched indices with bonding curve
 */
export const L3_CONFIG: LayerConfig = {
  layer: 'L3',
  minComponents: 2,
  maxComponents: 20,
  tradingMechanism: 'bonding-curve',
  managementFee: 0.02, // 2% annually
  rebalancingFrequency: 'user-controlled',
  permissionless: true, // Anyone can create
};

/**
 * Bonding Curve parameters (Layer 3 only)
 */
export interface BondingCurveParams {
  initialPrice: number; // Starting price
  targetMarketCap: number; // Graduation target in USD
  k: number; // Bonding curve constant
  reserveRatio?: number; // For Bancor-style curves
}

/**
 * Layer 3 specific: Bonding Curve Index
 */
export interface L3Index extends Index {
  layer: 'L3';
  bondingCurve: {
    params: BondingCurveParams;
    currentPrice: number;
    currentMarketCap: number;
    totalRaised: number;
    progress: number; // % to graduation (0-100)
  };
  fundingRound?: {
    active: boolean;
    startTime: number;
    endTime: number;
    targetAmount: number;
    raisedAmount: number;
  };
}

/**
 * Graduation criteria for L3 → L2
 */
export interface GraduationCriteria {
  minMarketCap: number; // e.g., $1M
  minHolders: number; // e.g., 100
  minVolume24h: number; // e.g., $50k
  minAge: number; // seconds, e.g., 30 days
}

export const DEFAULT_GRADUATION_CRITERIA: GraduationCriteria = {
  minMarketCap: 1_000_000, // $1M
  minHolders: 100,
  minVolume24h: 50_000, // $50k
  minAge: 30 * 24 * 60 * 60, // 30 days
};

/**
 * Request to create a new index
 */
export interface CreateIndexRequest {
  layer: Layer;
  symbol: string;
  name: string;
  description: string;
  components: IndexComponent[];
  
  // Layer 3 specific
  bondingCurveParams?: BondingCurveParams;
}

/**
 * Portfolio position in an index
 */
export interface IndexPosition {
  indexId: string;
  userId: string;
  shares: string; // Amount of index tokens owned
  entryPrice: string; // Average entry price
  currentValue: string; // Current value in USD
  pnl: string; // Profit/Loss
  pnlPercent: number; // PnL %
  entryTime: number;
}

/**
 * Index trade (buy/sell index tokens)
 */
export interface IndexTrade {
  id: string;
  indexId: string;
  userId: string;
  side: 'buy' | 'sell';
  amount: string; // Amount of index tokens
  price: string; // Execution price
  totalValue: string; // Total trade value
  fee: string;
  txHash?: string;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
}

/**
 * Rebalancing event
 */
export interface RebalanceEvent {
  id: string;
  indexId: string;
  oldComponents: IndexComponent[];
  newComponents: IndexComponent[];
  executedAt: number;
  executedBy?: string; // User ID or 'system'
  txHash?: string;
}
