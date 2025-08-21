import { PrivyProvider, PrivyClientConfig } from '@privy-io/react-auth';

// Privy configuration
export const privyConfig: PrivyClientConfig = {
  // Your actual Privy App ID
  appId: 'cmcvc4ho5009rky0nfr3cgnms',
  
  // Configure supported login methods
  loginMethods: ['email', 'wallet'],
  
  // Configure supported wallets
  supportedChains: [
    // Add your supported chains here
  ],
  
  // Configure appearance
  appearance: {
    theme: 'light',
    accentColor: '#676FFF',
    logo: 'https://your-logo-url.com/logo.png',
  },
  
  // Configure embedded wallet
  embeddedWallets: {
    createOnLogin: 'users-without-wallets',
    noPromptOnSignature: false,
  },
  
  // Configure MFA
  mfa: {
    noPromptOnMfaRequired: false,
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

      setSupabase(supabaseClient);
    }
  }, [ready, authenticated, user]);

  const createOrUpdateUser = async () => {
    if (!supabase || !user) return null;

    try {
      const userData = {
        privy_user_id: user.id,
        auth_type: user.wallet?.address ? 'wallet' : 'email',
        email: user.email?.address || null,
        email_verified: user.email?.verified || false,
        wallet_address: user.wallet?.address || null,
        wallet_type: user.wallet?.walletClientType || null,
        last_login: new Date().toISOString(),
        is_active: true,
      };

      const { data, error } = await supabase
        .from('users')
        .upsert(userData, { onConflict: 'privy_user_id' })
        .select();

      if (error) {
        console.error('Error creating/updating user:', _error);
        return null;
      }

      return data[0];
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