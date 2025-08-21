'use client';

import React, { useState } from 'react';
// Dynamic import workaround for Privy hooks
const { usePrivy, useWallets } = require('@privy-io/react-auth');
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Mail, RefreshCw, Database } from 'lucide-react';

export default function TestWalletsPage() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [syncResult, setSyncResult] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);

  const testSyncWallets = async () => {
    if (!authenticated || !user) return;
    
    setSyncLoading(true);
    try {
      const response = await fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          privyUser: user // linkedAccounts 포함된 user 객체만 전송
        })
      });

      const result = await response.json();
      setSyncResult(result);
    } catch (error) {
      console.error('Sync error:', error);
      setSyncResult({ error: 'Sync failed' });
    } finally {
      setSyncLoading(false);
    }
  };

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
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Wallet Test Page</CardTitle>
            <CardDescription>Please authenticate to test wallet functionality</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600">
              Please go to <a href="/privy-login" className="text-blue-600 hover:underline">/privy-login</a> to authenticate first.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Wallet Analysis Test Page</h1>
          <p className="text-gray-600">Testing useWallets hook and multi-wallet functionality</p>
        </div>

        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              User Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">User ID</p>
                <p className="text-sm font-mono">{user?.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Email</p>
                <p className="text-sm">{user?.email?.address || 'No email'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Primary Wallet</p>
                <p className="text-sm font-mono">{user?.wallet?.address || 'No wallet'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Primary Chain</p>
                <p className="text-sm">{user?.wallet?.chainType || 'Unknown'}</p>
              </div>
            </div>
            
            {/* 경고 메시지 */}
            {wallets.length > 1 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800">
                  <span className="text-sm font-medium">⚠️ Security Warning</span>
                </div>
                <p className="text-sm text-yellow-700 mt-1">
                  Multiple wallets detected in single session. Each wallet should be separate user.
                </p>
                <p className="text-sm text-yellow-600 mt-1">
                  useWallets: {wallets.length} wallets | Expected: 1 external wallet per user
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  ✅ Using linkedAccounts instead of useWallets for safer sync
                </p>
              </div>
            )}
            
            {/* linkedAccounts 기반 정보 */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800">
                <span className="text-sm font-medium">📊 LinkedAccounts Info</span>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                linkedAccounts: {user?.linkedAccounts?.filter(acc => acc.type === 'wallet').length || 0} wallets
              </p>
              <p className="text-sm text-blue-600 mt-1">
                This data is used for secure wallet sync (user-specific)
              </p>
            </div>
            
            {/* User Type Analysis */}
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <span className="text-sm font-medium">🔍 User Type Analysis</span>
              </div>
              <p className="text-sm text-green-700 mt-1">
                <strong>Authentication Type:</strong> {user?.email?.address ? 'Email User' : 'External Wallet User'}
              </p>
              {user?.email?.address && (
                <p className="text-sm text-green-600 mt-1">
                  <strong>Email:</strong> {user.email.address} ({user.email.verified ? 'Verified' : 'Unverified'})
                </p>
              )}
              <p className="text-sm text-green-600 mt-1">
                <strong>Expected Wallets:</strong> {user?.email?.address ? 'All Embedded (Ethereum + Solana)' : '1 External + 1 Embedded'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Wallet Analysis by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Wallet Analysis by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* External Wallets */}
              <div>
                <p className="text-sm font-medium text-gray-500">External Wallets</p>
                {user?.linkedAccounts?.filter(acc => acc.connectorType === 'injected').map((wallet, idx) => (
                  <div key={idx} className="border rounded p-2 mt-2 bg-blue-50">
                    <p className="text-xs"><strong>Address:</strong> {wallet.address}</p>
                    <p className="text-xs"><strong>Chain:</strong> {wallet.chainType}</p>
                    <p className="text-xs"><strong>Client:</strong> {wallet.walletClientType}</p>
                    <p className="text-xs"><strong>Type:</strong> External ({wallet.connectorType})</p>
                  </div>
                )) || <p className="text-gray-500">No external wallets found</p>}
              </div>
              
              {/* Embedded Wallets */}
              <div>
                <p className="text-sm font-medium text-gray-500">Embedded Wallets</p>
                {user?.linkedAccounts?.filter(acc => acc.connectorType === 'embedded').map((wallet, idx) => (
                  <div key={idx} className="border rounded p-2 mt-2 bg-green-50">
                    <p className="text-xs"><strong>Address:</strong> {wallet.address}</p>
                    <p className="text-xs"><strong>Chain:</strong> {wallet.chainType}</p>
                    <p className="text-xs"><strong>Client:</strong> {wallet.walletClientType}</p>
                    <p className="text-xs"><strong>Type:</strong> Embedded ({wallet.connectorType})</p>
                    <p className="text-xs"><strong>Status:</strong> {wallet.imported ? 'Imported' : 'Generated'}</p>
                    {wallet.id && <p className="text-xs"><strong>Privy ID:</strong> {wallet.id}</p>}
                  </div>
                )) || <p className="text-gray-500">No embedded wallets found</p>}
              </div>
              
              {/* Raw Data */}
              <div>
                <p className="text-sm font-medium text-gray-500">All LinkedAccounts (Raw)</p>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                  {JSON.stringify(user?.linkedAccounts, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wallets Hook Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              useWallets Hook Analysis
              <Badge variant="secondary">{wallets.length} wallets</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {wallets.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No wallets found</p>
            ) : (
              <div className="space-y-4">
                {wallets.map((wallet, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">Wallet {index + 1}</h3>
                      <div className="flex gap-2">
                        <Badge variant={wallet.imported ? "default" : "secondary"}>
                          {wallet.imported ? "External" : "Embedded"}
                        </Badge>
                        <Badge variant="outline">{wallet.chainType}</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="font-medium text-gray-500">Address</p>
                        <p className="font-mono break-all">{wallet.address}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-500">Chain Type</p>
                        <p>{wallet.chainType}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-500">Wallet Client</p>
                        <p>{wallet.walletClientType}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-500">Connector</p>
                        <p>{wallet.connectorType}</p>
                      </div>
                    </div>
                    {wallet.delegated && (
                      <div className="mt-2">
                        <Badge variant="destructive">Delegated</Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Security & Session Management
            </CardTitle>
            <CardDescription>Manage wallet sessions and security</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button 
                onClick={() => {
                  console.log('=== SECURITY ANALYSIS ===');
                  console.log('Current Privy User ID:', user?.id);
                  console.log('Primary wallet:', user?.wallet);
                  console.log('All wallets in session:', wallets);
                  
                  // Check if multiple external wallets exist
                  const externalWallets = wallets.filter(w => w.linked === true);
                  const embeddedWallets = wallets.filter(w => w.linked === false);
                  
                  console.log('External wallets:', externalWallets);
                  console.log('Embedded wallets:', embeddedWallets);
                  
                  if (externalWallets.length > 1) {
                    alert(`🚨 SECURITY ISSUE: ${externalWallets.length} external wallets in single session!\n\nEach wallet should be separate user.\n\nExternal wallets:\n${externalWallets.map(w => `- ${w.walletClientType}: ${w.address.slice(0,6)}...`).join('\n')}`);
                  } else {
                    alert(`✅ Session OK: ${externalWallets.length} external wallet(s)`);
                  }
                }}
                variant="destructive"
                className="w-full"
              >
                🔍 Check Session Security
              </Button>
              
              <Button 
                onClick={() => {
                  if (confirm('This will clear all wallet sessions and redirect to login. Continue?')) {
                    // Clear all possible wallet sessions
                    localStorage.clear();
                    sessionStorage.clear();
                    // Redirect to login
                    window.location.href = '/privy-login';
                  }
                }}
                variant="outline"
                className="w-full"
              >
                🧹 Clear All Sessions & Re-login
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Embedded Wallet Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Embedded Wallet Actions
            </CardTitle>
            <CardDescription>Try to activate or access embedded wallets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button 
                onClick={() => {
                  console.log('=== EMAIL USER WALLET ANALYSIS ===');
                  const isEmailUser = !!user?.email?.address;
                  const embeddedWallets = user?.linkedAccounts?.filter(acc => acc.connectorType === 'embedded');
                  const externalWallets = user?.linkedAccounts?.filter(acc => acc.connectorType === 'injected');
                  
                  console.log('Is Email User:', isEmailUser);
                  console.log('External wallets:', externalWallets);
                  console.log('Embedded wallets:', embeddedWallets);
                  
                  if (isEmailUser) {
                    console.log('=== EMAIL USER ANALYSIS ===');
                    console.log('Expected: 0 external wallets, 2+ embedded wallets');
                    console.log('Actual: ', externalWallets.length, 'external,', embeddedWallets.length, 'embedded');
                    
                    const ethWallet = embeddedWallets?.find(w => w.chainType === 'ethereum');
                    const solWallet = embeddedWallets?.find(w => w.chainType === 'solana');
                    
                    alert(`Email User Analysis:\n\nExternal: ${externalWallets.length} wallets\nEmbedded: ${embeddedWallets.length} wallets\n\nEthereum: ${ethWallet ? 'Yes' : 'No'}\nSolana: ${solWallet ? 'Yes' : 'No'}`);
                  } else {
                    console.log('=== EXTERNAL WALLET USER ANALYSIS ===');
                    console.log('Expected: 1 external wallet, 1+ embedded wallets');
                    console.log('Actual: ', externalWallets.length, 'external,', embeddedWallets.length, 'embedded');
                    
                    alert(`External Wallet User Analysis:\n\nExternal: ${externalWallets.length} wallets\nEmbedded: ${embeddedWallets.length} wallets`);
                  }
                }}
                variant="outline"
                className="w-full"
              >
                🔍 Analyze User Wallet Structure
              </Button>
              
              <Button 
                onClick={() => {
                  console.log('=== WALLET COMPARISON ===');
                  console.log('useWallets result:', wallets);
                  console.log('linkedAccounts wallets:', user?.linkedAccounts?.filter(acc => acc.type === 'wallet'));
                  
                  const useWalletsAddresses = wallets.map(w => ({
                    address: w.address,
                    type: w.type,
                    client: w.walletClientType,
                    linked: w.linked
                  }));
                  const linkedAccountsAddresses = user?.linkedAccounts?.filter(acc => acc.type === 'wallet').map(acc => ({
                    address: acc.address,
                    chainType: acc.chainType,
                    client: acc.walletClientType,
                    connector: acc.connectorType
                  })) || [];
                  
                  console.log('useWallets details:', useWalletsAddresses);
                  console.log('linkedAccounts details:', linkedAccountsAddresses);
                  
                  const missingInUseWallets = linkedAccountsAddresses.filter(
                    linked => !useWalletsAddresses.find(uw => uw.address === linked.address)
                  );
                  console.log('Missing in useWallets:', missingInUseWallets);
                  
                  alert(`useWallets: ${useWalletsAddresses.length}, linkedAccounts: ${linkedAccountsAddresses.length}, Missing: ${missingInUseWallets.length}\n\nMissing wallets: ${missingInUseWallets.map(w => `${w.chainType} ${w.client}`).join(', ')}`);
                }}
                variant="outline"
                className="w-full"
              >
                Compare Wallet Sources
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Database Verification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Database Verification
            </CardTitle>
            <CardDescription>Verify signup flow and database entries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="font-medium text-sm mb-2">✅ Automatic Sync Status</h4>
                <p className="text-xs text-gray-600">
                  The sync process is integrated into the signup flow.<br/>
                  Check browser console for detailed sync logs.
                </p>
              </div>
              
              <Button 
                onClick={testSyncWallets}
                disabled={syncLoading}
                className="w-full"
                variant="outline"
              >
                {syncLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  '🔄 Manual Sync Test'
                )}
              </Button>
              
              <Button 
                onClick={() => {
                  console.log('=== DATABASE VERIFICATION ===');
                  console.log('Current User ID:', user?.id);
                  console.log('Expected in users table (cleaned up):', {
                    privy_user_id: user?.id,
                    auth_type: user?.email?.address ? 'email' : 'wallet',
                    email: user?.email?.address || null,
                    // Removed fields: email_verified, wallet_address, wallet_type
                    last_login: 'timestamp',
                    is_active: true
                  });
                  
                  const walletCount = user?.linkedAccounts?.filter(acc => acc.type === 'wallet').length || 0;
                  console.log('Expected in user_wallets table:', walletCount, 'wallet entries with improved structure:');
                  user?.linkedAccounts?.filter(acc => acc.type === 'wallet').forEach((wallet, index) => {
                    console.log(`  ${index + 1}. Address: ${wallet.address?.slice(0,6)}...${wallet.address?.slice(-4)}`);
                    console.log(`     - Network: ${wallet.chainType}`);
                    console.log(`     - Type: ${wallet.connectorType === 'embedded' ? 'embedded' : 'external'}`);
                    console.log(`     - Provider: ${wallet.walletClientType}`);
                    console.log(`     - Privy ID: ${wallet.id || 'N/A'}`);
                  });
                  
                  alert(`Database Verification:\n\nUser ID: ${user?.id}\nAuth Type: ${user?.email?.address ? 'Email' : 'Wallet'}\nExpected Wallets: ${walletCount}\n\nCheck browser console for detailed info.`);
                }}
                variant="secondary"
                className="w-full"
              >
                🔍 Check Expected Database Entries
              </Button>
              
              {syncResult && (
                <div className="bg-gray-100 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Sync Result:</h4>
                  <pre className="text-sm overflow-auto">
                    {JSON.stringify(syncResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Signup Flow Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Signup Flow Test
            </CardTitle>
            <CardDescription>Test the integrated signup process</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <h4 className="font-medium text-sm mb-2">🔄 How to Test Signup Flow</h4>
                <ol className="text-xs text-gray-700 space-y-1">
                  <li>1. Clear all sessions ("🧹 Clear All Sessions & Re-login")</li>
                  <li>2. Go to /privy-login</li>
                  <li>3. Sign up with new wallet or email</li>
                  <li>4. Check browser console for sync logs</li>
                  <li>5. Come back to this page to verify database entries</li>
                </ol>
              </div>
              
              <div className="bg-green-50 p-3 rounded-lg">
                <h4 className="font-medium text-sm mb-2">✅ Expected Results</h4>
                <ul className="text-xs text-gray-700 space-y-1">
                  <li>• Console log: "✅ User sync successful"</li>
                  <li>• Users table: 1 new entry</li>
                  <li>• User_wallets table: 1-2 new entries</li>
                  <li>• No manual sync needed</li>
                </ul>
              </div>
              
              <Button 
                onClick={() => {
                  if (confirm('This will clear all sessions and redirect to login. Test signup flow?')) {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = '/privy-login';
                  }
                }}
                variant="outline"
                className="w-full"
              >
                🚀 Test New User Signup Flow
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Raw Data */}
        <Card>
          <CardHeader>
            <CardTitle>Raw Data (for debugging)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">User Object:</h4>
                <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-64">
                  {JSON.stringify(user, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="font-medium mb-2">Wallets Array:</h4>
                <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-64">
                  {JSON.stringify(wallets, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}