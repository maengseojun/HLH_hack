// components/wallet/BalanceDisplay.tsx
'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Wallet, DollarSign, TrendingUp } from 'lucide-react';
import { NetworkBalance, TokenBalance } from '@/lib/supabase/types';

interface BalanceDisplayProps {
  walletAddress?: string;
  network?: string;
}

export default function BalanceDisplay({ walletAddress, network }: BalanceDisplayProps) {
  const { ready, authenticated, user } = usePrivy();
  const [balances, setBalances] = useState<NetworkBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = async () => {
    if (!authenticated || !user) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (walletAddress) params.append('address', walletAddress);
      if (network) params.append('network', network);

      const response = await fetch(`/api/balance?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch balances');
      }

      if (data.balance) {
        setBalances([data.balance]);
      } else if (data.balances) {
        setBalances(data.balances);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const refreshBalances = async () => {
    try {
      await fetch('/api/balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'refresh',
          walletAddress,
        }),
      });

      await fetchBalances();
    } catch (err) {
      console.error('Failed to refresh balances:', err);
    }
  };

  useEffect(() => {
    if (ready && authenticated) {
      fetchBalances();
    }
  }, [ready, authenticated, walletAddress, network]);

  if (!ready || !authenticated) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            Please connect your wallet to view balances
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatBalance = (balance: string, decimals: number = 18): string => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.001) return '< 0.001';
    return num.toFixed(4);
  };

  const getNetworkBadgeColor = (network: string): string => {
    switch (network) {
      case 'arbitrum':
        return 'bg-blue-500';
      case 'hyperliquid':
        return 'bg-purple-500';
      case 'ethereum':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Wallet Balances
        </h3>
        <Button 
          onClick={refreshBalances} 
          disabled={loading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="text-red-600 text-sm">{error}</div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              <div className="text-gray-500">Loading balances...</div>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && balances.length === 0 && !error && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-gray-500">
              No balances found
            </div>
          </CardContent>
        </Card>
      )}

      {balances.map((networkBalance) => (
        <Card key={networkBalance.network}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={getNetworkBadgeColor(networkBalance.network)}>
                  {networkBalance.network.charAt(0).toUpperCase() + networkBalance.network.slice(1)}
                </Badge>
                <span className="text-sm font-normal text-gray-600">
                  {networkBalance.network === 'arbitrum' ? 'Arbitrum One' : 
                   networkBalance.network === 'hyperliquid' ? 'Hyperliquid' :
                   networkBalance.network === 'ethereum' ? 'Ethereum' : 
                   networkBalance.network}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Native Token Balance */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{networkBalance.nativeSymbol}</span>
                  <span className="text-sm text-gray-500">(Native)</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    {formatBalance(networkBalance.nativeBalance)} {networkBalance.nativeSymbol}
                  </div>
                </div>
              </div>

              {/* Token Balances */}
              {networkBalance.tokenBalances.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    {networkBalance.tokenBalances.map((token) => (
                      <div key={token.token} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{token.symbol}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            {formatBalance(token.formatted, token.decimals)} {token.symbol}
                          </div>
                          <div className="text-xs text-gray-500">
                            {token.decimals} decimals
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {networkBalance.tokenBalances.length === 0 && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No token balances found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}