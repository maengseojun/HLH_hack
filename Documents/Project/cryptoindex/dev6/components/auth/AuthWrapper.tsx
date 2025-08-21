// components/auth/AuthWrapper.tsx
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// Privy 관련 컴포넌트들을 동적 import (SSR 방지)
const PrivyProvider = dynamic(
  () => import('@privy-io/react-auth').then(mod => mod.PrivyProvider),
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center p-4">Loading auth...</div>
  }
);

interface AuthWrapperProps {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Initializing...</span>
      </div>
    );
  }
  
  // Privy 설정
  const privyConfig = {
    loginMethods: ['email', 'wallet'],
    appearance: {
      theme: 'dark',
      accentColor: '#3B82F6',
    },
    embeddedWallets: {
      createOnLogin: 'users-without-wallets',
    },
  };
  
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    console.error('NEXT_PUBLIC_PRIVY_APP_ID not configured');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">Authentication not configured</div>
      </div>
    );
  }
  
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID}
      config={privyConfig}
    >
      {children}
    </PrivyProvider>
  );
}