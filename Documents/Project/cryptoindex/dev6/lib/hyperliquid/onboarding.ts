// lib/hyperliquid/onboarding.ts
// WARNING: This file contains React hooks and should only be used in client components
import { usePrivy } from '@privy-io/react-auth';
import { addHyperliquidNetwork, switchToHyperliquidNetwork, isOnHyperliquidNetwork } from './network';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  action?: () => Promise<boolean>;
}

/**
 * Custom hook for Hyperliquid onboarding process
 */
export const useHyperliquidOnboarding = () => {
  const { ready, authenticated, user, connectWallet, linkWallet } = usePrivy();

  const checkExistingHyperliquidUsage = async (): Promise<void> => {
    try {
      const provider = (window as any).ethereum;
      if (!provider || !user) return;

      // Get wallet address
      const accounts = await provider.request({ method: 'eth_accounts' });
      if (!accounts || accounts.length === 0) return;

      const walletAddress = accounts[0];
      
      // Check for existing positions/balances on Hyperliquid
      // This would typically involve querying the Hyperliquid API
      console.log(`🔍 Checking for existing Hyperliquid usage for wallet: ${walletAddress}`);
      
      // TODO: Implement actual API call to check existing positions
      // For now, we'll just log the check
      
      // Store this information for risk monitoring
      localStorage.setItem('hyperliquid_wallet_checked', JSON.stringify({
        walletAddress,
        checkedAt: new Date().toISOString(),
        hasExistingUsage: false // Will be determined by actual API call
      }));
      
    } catch (_error) {
      console.error('Failed to check existing Hyperliquid usage:', _error);
    }
  };

  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'wallet_connection',
      title: 'Connect EVM Wallet',
      description: 'Connect your EVM-compatible wallet or create an embedded wallet',
      status: authenticated && user ? 'completed' : 'pending',
      action: async () => {
        try {
          if (!authenticated) {
            await connectWallet();
          }
          return true;
        } catch (_error) {
          console.error('Failed to connect wallet:', _error);
          return false;
        }
      }
    },
    {
      id: 'check_hyperliquid_network',
      title: 'Check Hyperliquid Network',
      description: 'Detect if Hyperliquid network is available and check for existing usage',
      status: 'pending',
      action: async () => {
        try {
          const provider = (window as any).ethereum;
          if (!provider) {
            throw new Error('No Ethereum provider found');
          }

          // Check current network
          const chainId = await provider.request({ method: 'eth_chainId' });
          const isTestnet = process.env.NODE_ENV === 'development';
          const targetChainId = isTestnet ? '0x3E6' : '0x3E7';
          
          if (chainId === targetChainId) {
            console.log('✅ Already on Hyperliquid network');
            // Check for existing usage on this network
            await checkExistingHyperliquidUsage();
            return true;
          }

          // Try to switch to Hyperliquid network (if already added)
          try {
            await provider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: targetChainId }],
            });
            console.log('✅ Switched to existing Hyperliquid network');
            // Check for existing usage on this network
            await checkExistingHyperliquidUsage();
            return true;
          } catch (switchError: any) {
            if (switchError.code === 4902) {
              // Network not added yet - that's fine, user can continue with other networks
              console.log('ℹ️ Hyperliquid network not found in wallet - you can add it later');
              return true; // Still successful - optional network
            }
            throw switchError;
          }
        } catch (_error) {
          console.error('Failed to check Hyperliquid network:', _error);
          return false;
        }
      }
    },
    {
      id: 'network_guidance',
      title: 'Multi-Platform Usage Warning',
      description: 'Important: Margin is shared across all Hyperliquid platforms using the same wallet',
      status: 'pending',
      action: async () => {
        // Display important warnings about shared margin
        console.log('⚠️ Multi-Platform Usage Warning:');
        console.log('• Margin is shared across ALL Hyperliquid platforms using this wallet');
        console.log('• Monitor your total exposure across different platforms');
        console.log('• Consider using separate wallets for different platforms');
        console.log('• Our risk monitor will help track your total usage');
        return true;
      }
    }
  ];

  const executeStep = async (stepId: string): Promise<boolean> => {
    const step = onboardingSteps.find(s => s.id === stepId);
    if (!step || !step.action) {
      return false;
    }

    step.status = 'in_progress';
    try {
      const success = await step.action();
      step.status = success ? 'completed' : 'failed';
      return success;
    } catch (_error) {
      step.status = 'failed';
      return false;
    }
  };

  const runFullOnboarding = async (): Promise<boolean> => {
    for (const step of onboardingSteps) {
      if (step.status === 'completed') {
        continue;
      }

      const success = await executeStep(step.id);
      if (!success) {
        console.error(`❌ Onboarding failed at step: ${step.title}`);
        return false;
      }
    }

    console.log('✅ Hyperliquid onboarding completed successfully');
    return true;
  };

  const getOnboardingProgress = (): number => {
    const completedSteps = onboardingSteps.filter(step => step.status === 'completed').length;
    return Math.round((completedSteps / onboardingSteps.length) * 100);
  };

  return {
    ready,
    authenticated,
    user,
    onboardingSteps,
    executeStep,
    runFullOnboarding,
    getOnboardingProgress,
  };
};

/**
 * Utility function to check if user needs onboarding
 */
export const needsOnboarding = (user: any): boolean => {
  if (!user) return true;
  
  // Check if user has an EVM wallet connected
  const hasEVMWallet = user.linkedAccounts?.some((account: any) => 
    account.type === 'wallet' && account.address?.startsWith('0x')
  );
  
  return !hasEVMWallet;
};