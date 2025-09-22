'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useEffect } from 'react';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { ready, authenticated, user } = usePrivy();

  useEffect(() => {
    if (ready && authenticated && user) {
      // Sync user to database when authenticated
      syncUserToDatabase();
    }
  }, [ready, authenticated, user]);

  const syncUserToDatabase = async () => {
    try {
      const response = await fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          privyUser: user
        })
      });

      if (!response.ok) {
        console.error('Failed to sync user to database');
      }
    } catch (error) {
      console.error('Error syncing user:', error);
    }
  };

  // Show loading state while Privy is initializing
  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}