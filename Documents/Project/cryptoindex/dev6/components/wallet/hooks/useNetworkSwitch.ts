/**
 * Custom hook for network switching functionality
 * 
 * This hook provides network switching capabilities using Privy's wallet functionality
 * and includes proper error handling and loading states.
 */

import { useState, useCallback } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { toast } from 'react-hot-toast';
import { SupportedChain } from '../types';
import { SUPPORTED_CHAINS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants';

export interface UseNetworkSwitchReturn {
  switchNetwork: (chain: SupportedChain) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useNetworkSwitch(): UseNetworkSwitchReturn {
  const { wallets } = useWallets();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const switchNetwork = useCallback(async (chain: SupportedChain) => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Check if we have a connected wallet
      if (!wallets || wallets.length === 0) {
        throw new Error('Please connect your wallet to switch networks');
      }

      const wallet = wallets[0];
      
      // Check if wallet has switchChain method
      if (!wallet.switchChain) {
        throw new Error('Wallet does not support chain switching');
      }

      // Get current chain ID
      const currentChainId = wallet.chainId ? parseInt(wallet.chainId.split(':')[1] || wallet.chainId) : null;
      
      // Check if already on the target chain
      if (currentChainId === chain.id) {
        toast.success(`Already connected to ${chain.name}`);
        return;
      }

      // Show loading toast
      const loadingToast = toast.loading(`Switching to ${chain.name}...`);

      try {
        // Convert chain ID to hex format for the wallet
        const chainIdHex = `0x${chain.id.toString(16)}`;
        
        // Attempt to switch chain
        await wallet.switchChain(chainIdHex);
        
        // Success feedback
        toast.success(SUCCESS_MESSAGES.NETWORK_SWITCHED, {
          id: loadingToast,
        });
        
      } catch (switchError: any) {
        // Dismiss loading toast
        toast.dismiss(loadingToast);
        
        // Handle different types of errors
        if (switchError.code === 4902) {
          // Chain not added to wallet - attempt to add it
          try {
            await addChainToWallet(wallet, chain);
            
            // Try switching again after adding
            await wallet.switchChain(`0x${chain.id.toString(16)}`);
            
            toast.success(`Added and switched to ${chain.name}`);
          } catch (addError: any) {
            throw new Error(`Failed to add ${chain.name} to wallet: ${addError.message}`);
          }
        } else if (switchError.code === 4001) {
          // User rejected the request
          throw new Error('Network switch was cancelled by user');
        } else {
          // Other errors
          throw new Error(`Failed to switch to ${chain.name}: ${switchError.message || 'Unknown error'}`);
        }
      }
      
    } catch (err: any) {
      const errorMessage = err.message || ERROR_MESSAGES.NETWORK_SWITCH_FAILED;
      setError(errorMessage);
      
      // Show error toast
      toast.error(errorMessage);
      
      console.error('Network switch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [wallets, isLoading]);

  return {
    switchNetwork,
    isLoading,
    error,
    clearError,
  };
}

/**
 * Helper function to add a chain to the wallet
 */
async function addChainToWallet(wallet: any, chain: SupportedChain): Promise<void> {
  if (!wallet.request) {
    throw new Error('Wallet does not support adding networks');
  }

  const params = {
    chainId: `0x${chain.id.toString(16)}`,
    chainName: chain.name,
    nativeCurrency: {
      name: chain.symbol,
      symbol: chain.symbol,
      decimals: 18,
    },
    rpcUrls: [chain.rpcUrl],
    blockExplorerUrls: [chain.blockExplorerUrl],
  };

  await wallet.request({
    method: 'wallet_addEthereumChain',
    params: [params],
  });
}