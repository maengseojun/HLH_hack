// lib/hyperliquid/utils.ts
import { HYPERLIQUID_NETWORK_CONFIG, HYPERLIQUID_TESTNET_CONFIG } from './network';

/**
 * Check if user is currently on Hyperliquid network
 */
export const isUserOnHyperliquidNetwork = async (): Promise<boolean> => {
  try {
    const provider = (window as any).ethereum;
    if (!provider) return false;

    const chainId = await provider.request({ method: 'eth_chainId' });
    return chainId === HYPERLIQUID_NETWORK_CONFIG.chainId || 
           chainId === HYPERLIQUID_TESTNET_CONFIG.chainId;
  } catch (_error) {
    console.error('Failed to check network:', _error);
    return false;
  }
};

/**
 * Get user's wallet address if connected
 */
export const getUserWalletAddress = async (): Promise<string | null> => {
  try {
    const provider = (window as any).ethereum;
    if (!provider) return null;

    const accounts = await provider.request({ method: 'eth_accounts' });
    return accounts && accounts.length > 0 ? accounts[0] : null;
  } catch (_error) {
    console.error('Failed to get wallet address:', _error);
    return null;
  }
};

/**
 * Check if wallet has existing Hyperliquid usage
 */
export const checkWalletHyperliquidUsage = async (walletAddress: string): Promise<{
  hasExistingUsage: boolean;
  estimatedMargin: number;
  platforms: string[];
}> => {
  try {
    // TODO: Implement actual Hyperliquid API call
    // This would check the user's positions/balances across the network
    
    // For now, return mock data
    const mockUsage = {
      hasExistingUsage: Math.random() > 0.7, // 30% chance of existing usage
      estimatedMargin: Math.floor(Math.random() * 1000),
      platforms: ['HyperDEX', 'LiquidTrade'].filter(() => Math.random() > 0.5)
    };

    // Store in localStorage for the RiskMonitor component
    localStorage.setItem(`hyperliquid_usage_${walletAddress}`, JSON.stringify({
      ...mockUsage,
      lastChecked: new Date().toISOString()
    }));

    return mockUsage;
  } catch (_error) {
    console.error('Failed to check Hyperliquid usage:', _error);
    return {
      hasExistingUsage: false,
      estimatedMargin: 0,
      platforms: []
    };
  }
};

/**
 * Get cached Hyperliquid usage data from localStorage
 */
export const getCachedHyperliquidUsage = (walletAddress: string): {
  hasExistingUsage: boolean;
  estimatedMargin: number;
  platforms: string[];
  lastChecked?: string;
} | null => {
  try {
    const cached = localStorage.getItem(`hyperliquid_usage_${walletAddress}`);
    return cached ? JSON.parse(cached) : null;
  } catch (_error) {
    console.error('Failed to get cached usage:', _error);
    return null;
  }
};

/**
 * Warn user about shared margin risks
 */
export const showMarginWarning = (totalMarginUsed: number, availableMargin: number): string[] => {
  const warnings: string[] = [];

  if (availableMargin < 100) {
    warnings.push('⚠️ Very low available margin remaining');
  }

  if (totalMarginUsed > 500) {
    warnings.push('⚠️ High margin usage detected across platforms');
  }

  const utilizationRatio = totalMarginUsed / (totalMarginUsed + availableMargin);
  if (utilizationRatio > 0.8) {
    warnings.push('⚠️ High margin utilization ratio - consider reducing exposure');
  }

  return warnings;
};