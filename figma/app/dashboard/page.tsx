'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// Import the enhanced App component with real API integration
import EnhancedApp from '../../src/App';

interface UserProfile {
  id: string;
  authType: string;
  email?: string;
  walletAddress?: string;
  privyUserId: string;
  createdAt: string;
  lastLogin: string;
  wallets?: any[];
}

export default function DashboardPage() {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/');
    } else if (ready && authenticated) {
      fetchProfile();
    }
  }, [ready, authenticated, router]);

  const fetchProfile = async () => {
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.user);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const token = await getAccessToken();
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      logout();
    }
  };

  if (!ready || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Redirecting...</div>
      </div>
    );
  }

  // Show the enhanced CoreIndex application with real API integration
  return <EnhancedApp />;
}