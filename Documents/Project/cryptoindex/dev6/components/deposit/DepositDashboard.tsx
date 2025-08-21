// components/deposit/DepositDashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Wallet,
  ArrowUpRight,
  Activity
} from 'lucide-react';

import DepositFlow from './DepositFlow';
import TransactionHistory from './TransactionHistory';
import BalanceDisplay from '../wallet/BalanceDisplay';
import NetworkOnboarding from '../hyperliquid/NetworkOnboarding';

interface DepositDashboardProps {
  defaultWalletAddress?: string;
}

interface DashboardStats {
  totalDeposited: string;
  activeTransactions: number;
  completedTransactions: number;
  failedTransactions: number;
  averageProcessingTime: number;
  lastDepositTime?: string;
}

export default function DepositDashboard({ defaultWalletAddress }: DepositDashboardProps) {
  const { ready, authenticated, user } = usePrivy();
  const [activeTab, setActiveTab] = useState('deposit');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [userWallets, setUserWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get user's wallets
  useEffect(() => {
    if (ready && authenticated && user) {
      const wallets = user.linkedAccounts?.filter(account => 
        account.type === 'wallet' && account.address?.startsWith('0x')
      ) || [];
      
      setUserWallets(wallets);
      
      if (defaultWalletAddress) {
        setSelectedWallet(defaultWalletAddress);
      } else if (wallets.length > 0) {
        setSelectedWallet(wallets[0].address);
      }
    }
  }, [ready, authenticated, user, defaultWalletAddress]);

  // Fetch dashboard stats
  useEffect(() => {
    if (selectedWallet) {
      fetchDashboardStats();
    }
  }, [selectedWallet]);

  const fetchDashboardStats = async () => {
    if (!selectedWallet) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/deposit/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'history',
          walletAddress: selectedWallet
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch stats');
      }

      const transactions = data.transactions || [];
      
      // Calculate stats
      const totalDeposited = transactions
        .filter((tx: any) => tx.status === 'completed')
        .reduce((sum: number, tx: any) => sum + parseFloat(tx.amount), 0);

      const activeTransactions = transactions.filter((tx: any) => 
        tx.status === 'pending' || tx.status === 'processing'
      ).length;

      const completedTransactions = transactions.filter((tx: any) => 
        tx.status === 'completed'
      ).length;

      const failedTransactions = transactions.filter((tx: any) => 
        tx.status === 'failed'
      ).length;

      // Calculate average processing time
      const completedTxs = transactions.filter((tx: any) => 
        tx.status === 'completed' && tx.created_at && tx.completed_at
      );

      const averageProcessingTime = completedTxs.length > 0
        ? completedTxs.reduce((sum: number, tx: any) => {
            const created = new Date(tx.created_at).getTime();
            const completed = new Date(tx.completed_at).getTime();
            return sum + (completed - created);
          }, 0) / completedTxs.length / 1000 // Convert to seconds
        : 0;

      const lastDepositTime = transactions.length > 0 
        ? transactions[0].created_at 
        : undefined;

      setStats({
        totalDeposited: totalDeposited.toFixed(2),
        activeTransactions,
        completedTransactions,
        failedTransactions,
        averageProcessingTime: Math.round(averageProcessingTime),
        lastDepositTime
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  };

  const handleDepositComplete = (transactionId: string) => {
    setActiveTab('history');
    fetchDashboardStats();
  };

  if (!ready || !authenticated) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            Please connect your wallet to access the deposit dashboard
          </div>
        </CardContent>
      </Card>
    );
  }

  if (userWallets.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Setup Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No EVM wallets found. Please complete the network onboarding first.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
        
        <NetworkOnboarding />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wallet Selection */}
      {userWallets.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Select Wallet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userWallets.map((wallet) => (
                <button
                  key={wallet.address}
                  onClick={() => setSelectedWallet(wallet.address)}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    selectedWallet === wallet.address
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {wallet.walletClient || 'Connected Wallet'}
                      </div>
                    </div>
                    {selectedWallet === wallet.address && (
                      <CheckCircle className="h-5 w-5 text-blue-500" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Deposited</p>
                  <p className="text-2xl font-semibold">{stats.totalDeposited} USDC</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Transactions</p>
                  <p className="text-2xl font-semibold">{stats.activeTransactions}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-2xl font-semibold">{stats.completedTransactions}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg. Processing</p>
                  <p className="text-2xl font-semibold">{stats.averageProcessingTime}s</p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-red-700">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="deposit">Deposit</TabsTrigger>
          <TabsTrigger value="balance">Balance</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="deposit" className="space-y-4">
          {selectedWallet && (
            <DepositFlow
              walletAddress={selectedWallet}
              onDepositComplete={handleDepositComplete}
            />
          )}
        </TabsContent>

        <TabsContent value="balance" className="space-y-4">
          {selectedWallet && (
            <BalanceDisplay walletAddress={selectedWallet} />
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {selectedWallet && (
            <TransactionHistory
              walletAddress={selectedWallet}
              autoRefresh={true}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setActiveTab('deposit')}
              className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <ArrowUpRight className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="font-medium">New Deposit</div>
                  <div className="text-sm text-gray-500">
                    Deposit USDC from Arbitrum
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('balance')}
              className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-green-500" />
                <div>
                  <div className="font-medium">Check Balance</div>
                  <div className="text-sm text-gray-500">
                    View current balances
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-purple-500" />
                <div>
                  <div className="font-medium">View History</div>
                  <div className="text-sm text-gray-500">
                    Transaction history
                  </div>
                </div>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}