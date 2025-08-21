'use client';

import React, { useEffect } from 'react';
import { useLogin, useLogout, usePrivy, useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Mail, LogOut } from 'lucide-react';
import { useSupabaseWithPrivy } from '@/lib/privy/config';

export function PrivyAuth() {
  const { login } = useLogin();
  const { logout } = useLogout();
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { createOrUpdateUser } = useSupabaseWithPrivy();

  // Debug logging for wallet analysis
  useEffect(() => {
    if (authenticated && user) {
      console.log('=== PRIVY USER ANALYSIS ===');
      console.log('Full user object:', user);
      console.log('User ID:', user.id);
      console.log('User wallet (primary):', user.wallet);
      console.log('User linked accounts:', user.linkedAccounts || 'No linkedAccounts property');
      
      // 특별히 embedded wallet 상태 확인
      if (user.linkedAccounts) {
        const embeddedWallets = user.linkedAccounts.filter(acc => acc.connectorType === 'embedded');
        console.log(`🔍 Embedded wallets in linkedAccounts: ${embeddedWallets.length}`);
        embeddedWallets.forEach((wallet, index) => {
          console.log(`  Embedded ${index + 1}:`, {
            address: wallet.address,
            chainType: wallet.chainType,
            walletClientType: wallet.walletClientType,
            connectorType: wallet.connectorType,
            id: wallet.id,
            hasAddress: !!wallet.address,
            hasChainType: !!wallet.chainType,
            hasWalletClientType: !!wallet.walletClientType
          });
        });
      }
      
      console.log('=== WALLETS HOOK ANALYSIS ===');
      console.log('All wallets:', wallets);
      console.log('Number of wallets:', wallets.length);
      wallets.forEach((wallet, index) => {
        console.log(`Wallet ${index + 1}:`, {
          address: wallet.address,
          chainType: wallet.chainType,
          walletClientType: wallet.walletClientType,
          connectorType: wallet.connectorType,
          imported: wallet.imported,
          delegated: wallet.delegated
        });
      });
      console.log('=== END ANALYSIS ===');
    }
  }, [authenticated, user, wallets]);

  // Automatically create/update user in Supabase when authenticated
  useEffect(() => {
    if (authenticated && user) {
      console.log('🔄 Initial sync triggered by authentication');
      createOrUpdateUser();
      
      // 일단 여러 번 호출하는 것을 제거하고 하나씩 테스트
      // setTimeout(() => {
      //   console.log('🔄 Delayed sync triggered (2 seconds after authentication)');
      //   createOrUpdateUser();
      // }, 2000);
      
      // setTimeout(() => {
      //   console.log('🔄 Final delayed sync triggered (5 seconds after authentication)');
      //   createOrUpdateUser();
      // }, 5000);
    }
  }, [authenticated, user, createOrUpdateUser]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Privy...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-blue-600">CryptoIndex</CardTitle>
            <CardDescription>
              Connect your wallet or sign in with email to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => login()}
              className="w-full flex items-center justify-center gap-2"
              size="lg"
            >
              <Wallet className="w-5 h-5" />
              Connect Wallet
            </Button>
            
            <div className="text-center text-sm text-gray-500">
              or
            </div>
            
            <Button
              onClick={() => login()}
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              size="lg"
            >
              <Mail className="w-5 h-5" />
              Sign in with Email
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-blue-600">CryptoIndex</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                {user?.email?.address && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {user.email.address}
                  </span>
                )}
                {user?.wallet?.address && (
                  <span className="flex items-center gap-1">
                    <Wallet className="w-4 h-4" />
                    {user.wallet.address.slice(0, 6)}...{user.wallet.address.slice(-4)}
                  </span>
                )}
              </div>
              <Button
                onClick={logout}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Welcome to CryptoIndex</CardTitle>
            <CardDescription>
              You are successfully authenticated with Privy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900">User Information</h3>
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  <p><strong>User ID:</strong> {user?.id}</p>
                  {user?.email?.address && (
                    <p><strong>Email:</strong> {user.email.address} {user.email.verified ? '✓' : '(unverified)'}</p>
                  )}
                  {user?.wallet?.address && (
                    <p><strong>Wallet:</strong> {user.wallet.address}</p>
                  )}
                  <p><strong>Created:</strong> {new Date(user?.createdAt || '').toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <h3 className="font-semibold text-gray-900">Available Actions</h3>
                <div className="mt-2 space-y-2">
                  <Button className="w-full" onClick={() => window.location.href = '/dashboard'}>
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}