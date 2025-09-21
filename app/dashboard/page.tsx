'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>

        <div className="mb-6">
          <a
            href="/api-test"
            className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            🔧 Test API v1 Endpoints
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Info Card */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">User Information</h2>
            {profile ? (
              <div className="space-y-2">
                <p><strong>ID:</strong> {profile.id}</p>
                <p><strong>Auth Type:</strong> {profile.authType}</p>
                {profile.email && <p><strong>Email:</strong> {profile.email}</p>}
                {profile.walletAddress && (
                  <p><strong>Wallet:</strong> {profile.walletAddress}</p>
                )}
                <p><strong>Privy ID:</strong> {profile.privyUserId}</p>
                <p><strong>Created:</strong> {new Date(profile.createdAt).toLocaleDateString()}</p>
                <p><strong>Last Login:</strong> {new Date(profile.lastLogin).toLocaleDateString()}</p>
              </div>
            ) : (
              <p>Loading profile...</p>
            )}
          </div>

          {/* Privy User Info Card */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Privy Information</h2>
            <div className="space-y-2">
              <p><strong>Privy ID:</strong> {user?.id}</p>
              <p><strong>Email:</strong> {user?.email?.address || 'Not set'}</p>
              <p><strong>Email Verified:</strong> {user?.email?.verified ? 'Yes' : 'No'}</p>
              <p><strong>Linked Accounts:</strong> {user?.linkedAccounts?.length || 0}</p>
            </div>
          </div>

          {/* Wallets Card */}
          {profile?.wallets && profile.wallets.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow md:col-span-2">
              <h2 className="text-xl font-semibold mb-4">Connected Wallets</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profile.wallets.map((wallet, index) => (
                  <div key={index} className="border p-4 rounded">
                    <p><strong>Address:</strong> {wallet.wallet_address}</p>
                    <p><strong>Provider:</strong> {wallet.wallet_provider}</p>
                    <p><strong>Primary:</strong> {wallet.is_primary ? 'Yes' : 'No'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}