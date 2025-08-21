'use client';

import React from 'react';
import { useLogin, useLogout, usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Mail, LogOut } from 'lucide-react';

export function PrivyAuth() {
  const { login } = useLogin();
  const { logout } = useLogout();
  const { ready, authenticated, user } = usePrivy();

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