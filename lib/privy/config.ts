import { PrivyClientConfig } from '@privy-io/react-auth';
import { mainnet, arbitrum, polygon, base, optimism, arbitrumSepolia } from 'viem/chains';

// Define Hyperliquid chain configuration for Privy (Mainnet)
const hyperliquid = {
  id: 999,
  name: 'Hyperliquid',
  network: 'hyperliquid',
  nativeCurrency: {
    decimals: 18,
    name: 'HYPE',
    symbol: 'HYPE',
  },
  rpcUrls: {
    public: { http: ['https://rpc.hyperliquid.xyz/evm'] },
    default: { http: ['https://rpc.hyperliquid.xyz/evm'] },
  },
  blockExplorers: {
    default: { name: 'Hypurrscan', url: 'https://api.hypurrscan.io/ui/' },
  },
} as const;

// Define Hyperliquid Testnet chain configuration for Privy
const hyperliquidTestnet = {
  id: 998,
  name: 'Hyperliquid Testnet',
  network: 'hyperliquid-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'HYPE',
    symbol: 'HYPE',
  },
  rpcUrls: {
    public: { http: ['https://rpc.hyperliquid-testnet.xyz/evm'] },
    default: { http: ['https://rpc.hyperliquid-testnet.xyz/evm'] },
  },
  blockExplorers: {
    default: { name: 'Hypurrscan Testnet', url: 'https://api.hypurrscan.io/ui/' },
  },
} as const;

// Privy configuration
export const privyConfig = {
  // Your actual Privy App ID - fallback for development
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'cmft7is1h00b0la0cjse4m84t',

  // Configure supported login methods - ONLY EMAIL AND EVM WALLETS
  loginMethods: ['email', 'wallet'],

  // Email configuration
  emailConfig: {
    enableEmailLogin: true,
    // Allow any email domain (remove if you want specific domains)
    allowedDomains: undefined,
  },

  // Configure supported chains (EVM networks only for memecoin index platform)
  supportedChains: [
    arbitrum, // Arbitrum One - Primary deposit network
    mainnet, // Ethereum Mainnet
    hyperliquid, // Hyperliquid - Primary trading network
    // Testnet support for development
    ...(process.env.NODE_ENV === 'development' ? [
      arbitrumSepolia, // Arbitrum Sepolia Testnet
      hyperliquidTestnet, // Hyperliquid Testnet
    ] : []),
    // EXPLICITLY NO SOLANA OR OTHER NON-EVM CHAINS
  ],

  // STRICT EVM-ONLY WALLET CONFIGURATION
  externalWallets: {
    coinbaseWallet: {
      // Only allow EVM networks
      connectionOptions: 'eoaOnly'
    },
    walletConnect: {
      enabled: true
    }
  },

  // Configure appearance
  appearance: {
    theme: 'light',
    accentColor: '#676FFF',
    logo: 'https://your-logo-url.com/logo.png',
  },

  // Configure embedded wallet (EVM format enforced for Hyperliquid compatibility)
  embeddedWallets: {
    createOnLogin: 'users-without-wallets',
    noPromptOnSignature: false,
    requireUserPasswordOnCreate: true, // Enhanced security
    // NO SOLANA SUPPORT - EVM ONLY
    showWalletUIs: false, // Disable wallet UI that might show non-EVM options
    // Force EVM format for embedded wallets
    priceDisplay: {
      primary: 'fiat-currency',
      secondary: 'native-token'
    },
  },

  // Configure MFA (Enhanced security for trading platform)
  mfa: {
    noPromptOnMfaRequired: false
  },
};

// Custom hook for Supabase integration
import { usePrivy } from '@privy-io/react-auth';
import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

export function useSupabaseWithPrivy() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    if (ready && authenticated && user) {
      const supabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            persistSession: false,
          },
          global: {
            headers: {
              'x-privy-user-id': user.id,
            },
          },
        }
      );
      setSupabase(supabaseClient as any);
    }
  }, [ready, authenticated, user]);

  const createOrUpdateUser = async () => {
    if (!user) return null;

    try {
      // Call the server-side API to sync user data
      const response = await fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          privyUser: user // Send the full Privy user object with linkedAccounts
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error syncing user:', errorData);
        return null;
      }

      const result = await response.json();
      console.log('User sync successful:', result);
      console.log('Database entries:', {
        user: result.user,
        wallets: result.syncedWallets,
        totalWallets: result.syncedWallets?.length || 0
      });

      return result.user;
    } catch (_error) {
      console.error('Error in createOrUpdateUser:', _error);
      return null;
    }
  };

  return {
    supabase,
    user,
    authenticated,
    ready,
    createOrUpdateUser,
    getAccessToken,
  };
}