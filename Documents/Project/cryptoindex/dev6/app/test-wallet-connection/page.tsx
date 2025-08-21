'use client';

import React, { useState } from 'react';
import { NetworkDisplay, WalletConnectButton } from '@/components/wallet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// Dynamic import workaround for Privy hooks
const { usePrivy, useWallets } = require('@privy-io/react-auth');
import { Wallet, Network, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { SupportedChain } from '@/components/wallet/types';

export default function TestWalletConnectionPage() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedChain | null>(null);

  const handleNetworkChange = (chain: SupportedChain) => {
    setSelectedNetwork(chain);
    console.log('Network selected:', chain);
  };

  const getConnectionStatus = () => {
    if (!ready) return { status: 'loading', message: 'Initializing...', color: 'bg-blue-500' };
    if (!authenticated) return { status: 'disconnected', message: 'Not connected', color: 'bg-red-500' };
    if (wallets.length === 0) return { status: 'no-wallets', message: 'No wallets found', color: 'bg-yellow-500' };
    return { status: 'connected', message: 'Connected', color: 'bg-green-500' };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">
              Wallet Connection Test
            </h1>
          </div>
          <p className="text-gray-300">
            Testing wallet connection states and network switching behavior
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Connection Status Panel */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                Connection Status
              </CardTitle>
              <CardDescription className="text-gray-300">
                Current wallet connection state
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Indicator */}
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${connectionStatus.color} animate-pulse`} />
                <span className="text-white font-medium">{connectionStatus.message}</span>
              </div>

              {/* Detailed Status */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                  <span className="text-gray-300">Privy Ready:</span>
                  <Badge variant={ready ? "default" : "secondary"}>
                    {ready ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                  <span className="text-gray-300">Authenticated:</span>
                  <Badge variant={authenticated ? "default" : "secondary"}>
                    {authenticated ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                  <span className="text-gray-300">Wallets Count:</span>
                  <Badge variant={wallets.length > 0 ? "default" : "secondary"}>
                    {wallets.length}
                  </Badge>
                </div>
              </div>

              {/* User Info */}
              {user && (
                <div className="pt-4 border-t border-white/10">
                  <h4 className="text-white font-medium mb-2">User Info:</h4>
                  <div className="text-sm space-y-1">
                    <div className="text-gray-300">ID: {user.id}</div>
                    {user.email && (
                      <div className="text-gray-300">Email: {user.email.address}</div>
                    )}
                    {user.wallet && (
                      <div className="text-gray-300">Wallet: {user.wallet.address}</div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Network Testing Panel */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Network className="w-5 h-5 text-blue-400" />
                Network Testing
              </CardTitle>
              <CardDescription className="text-gray-300">
                Test network display and switching functionality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Wallet Connect Button */}
              <div className="space-y-2">
                <h4 className="text-white font-medium">Wallet Connection:</h4>
                <WalletConnectButton className="w-full" />
              </div>

              {/* Network Display */}
              <div className="space-y-2">
                <h4 className="text-white font-medium">Network Display:</h4>
                <NetworkDisplay
                  showStatusIndicator={true}
                  size="default"
                  onNetworkChange={handleNetworkChange}
                  className="w-full"
                />
              </div>

              {/* Selected Network Info */}
              {selectedNetwork && (
                <div className="space-y-2">
                  <h4 className="text-white font-medium">Last Selected Network:</h4>
                  <div className="p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                        <Network className="w-3 h-3 text-white" />
                      </div>
                      <div>
                        <span className="text-white font-medium">{selectedNetwork.name}</span>
                        <span className="text-gray-400 text-sm ml-2">({selectedNetwork.shortName})</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-400" />
              Test Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-white font-medium">Test Cases:</h4>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-1.5 flex-shrink-0" />
                    <span><strong>Disconnected State:</strong> Try clicking the NetworkDisplay - should show "Connect Wallet" option</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full mt-1.5 flex-shrink-0" />
                    <span><strong>Connected State:</strong> After connecting, NetworkDisplay should show network options</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full mt-1.5 flex-shrink-0" />
                    <span><strong>Network Switching:</strong> Select different networks to test switching functionality</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full mt-1.5 flex-shrink-0" />
                    <span><strong>Error Handling:</strong> Watch for toast notifications and error messages</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-white font-medium">Expected Behavior:</h4>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>When wallet is not connected, clicking network options should trigger wallet connection</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>After wallet connection, network switching should work normally</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>Toast notifications should provide feedback for all actions</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}