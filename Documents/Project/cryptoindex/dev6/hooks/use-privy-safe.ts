// hooks/use-privy-safe.ts
'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';

export interface PrivySafeData {
  ready: boolean;
  authenticated: boolean;
  user: any;
  login: () => void;
  logout: () => void;
  connectWallet: () => void;
  linkWallet: () => void;
  isLoading: boolean;
  isClient: boolean;
}

/**
 * SSR-safe Privy hook wrapper
 * Only executes Privy hooks on the client side
 */
export const usePrivySafe = (): PrivySafeData => {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // 클라이언트에서만 Privy hooks 사용
  const privyData = isClient ? usePrivy() : null;
  
  return {
    ready: privyData?.ready || false,
    authenticated: privyData?.authenticated || false,
    user: privyData?.user || null,
    login: privyData?.login || (() => console.warn('Privy not ready')),
    logout: privyData?.logout || (() => console.warn('Privy not ready')),
    connectWallet: privyData?.connectWallet || (() => console.warn('Privy not ready')),
    linkWallet: privyData?.linkWallet || (() => console.warn('Privy not ready')),
    isLoading: !isClient || privyData?.ready === false,
    isClient,
  };
};

/**
 * Hook to check if component is mounted on client
 */
export const useIsClient = () => {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  return isClient;
};

/**
 * Conditionally render content only on client
 */
export const useClientOnly = (clientComponent: React.ReactNode, fallback: React.ReactNode = null) => {
  const isClient = useIsClient();
  return isClient ? clientComponent : fallback;
};