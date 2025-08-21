// components/deposit/TransactionHistory.tsx
'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  History,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  DollarSign,
  ArrowUpRight,
  Filter,
  Download
} from 'lucide-react';
import { Transaction } from '@/lib/supabase/types';
import { useTransactionUpdates } from '@/lib/realtime/transaction-updates';

interface TransactionHistoryProps {
  walletAddress?: string;
  limit?: number;
  autoRefresh?: boolean;
}

export default function TransactionHistory({ 
  walletAddress, 
  limit = 20,
  autoRefresh = true 
}: TransactionHistoryProps) {
  const { ready, authenticated, user } = usePrivy();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    transactions,
    loading: realtimeLoading,
    error: realtimeError,
    lastUpdate,
    refreshAll
  } = useTransactionUpdates({
    walletAddress,
    enableRealtime: autoRefresh
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      case 'processing':
        return <Badge variant="default" className="bg-blue-500">Processing</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getNetworkBadge = (network: string) => {
    switch (network) {
      case 'arbitrum':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Arbitrum</Badge>;
      case 'hyperliquid':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700">Hyperliquid</Badge>;
      default:
        return <Badge variant="outline">{network}</Badge>;
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'all') return true;
    return tx.status === filter;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount: string, tokenSymbol: string) => {
    const num = parseFloat(amount);
    return `${num.toFixed(2)} ${tokenSymbol}`;
  };

  const getExplorerUrl = (txHash: string, network: string) => {
    switch (network) {
      case 'arbitrum':
        return `https://arbiscan.io/tx/${txHash}`;
      case 'hyperliquid':
        return `https://explorer.hyperliquid.xyz/tx/${txHash}`;
      default:
        return `https://etherscan.io/tx/${txHash}`;
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const csvData = filteredTransactions.map(tx => ({
      Date: formatDate(tx.created_at),
      Amount: tx.amount,
      Token: tx.token_symbol,
      Status: tx.status,
      Network: tx.network,
      TxHash: tx.tx_hash || '',
      CompletedAt: tx.completed_at ? formatDate(tx.completed_at) : ''
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transaction-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!ready || !authenticated) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            Please connect your wallet to view transaction history
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRefresh}
              disabled={loading || realtimeLoading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 ${loading || realtimeLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              onClick={handleExport}
              disabled={filteredTransactions.length === 0}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <div className="flex gap-1">
            {(['all', 'pending', 'processing', 'completed', 'failed'] as const).map(status => (
              <Button
                key={status}
                onClick={() => setFilter(status)}
                variant={filter === status ? "default" : "outline"}
                size="sm"
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {lastUpdate && (
          <div className="text-xs text-gray-500">
            Last updated: {formatDate(lastUpdate.toISOString())}
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {(error || realtimeError) && (
          <Alert className="mb-4 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-700">
              {error || realtimeError}
            </AlertDescription>
          </Alert>
        )}

        {filteredTransactions.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No transactions found</h3>
            <p className="text-gray-500">
              {filter === 'all' 
                ? "You haven't made any deposits yet." 
                : `No ${filter} transactions found.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{formatDate(tx.created_at)}</span>
                          {tx.completed_at && (
                            <span className="text-xs text-gray-500">
                              Completed: {formatDate(tx.completed_at)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-gray-400" />
                          <span className="font-semibold">
                            {formatAmount(tx.amount, tx.token_symbol)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getNetworkBadge(tx.network)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(tx.status)}
                          {getStatusBadge(tx.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {tx.tx_hash && (
                          <a
                            href={getExplorerUrl(tx.tx_hash, tx.network)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:underline text-sm"
                          >
                            View
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {tx.status === 'failed' && (
                            <Button variant="outline" size="sm">
                              Retry
                            </Button>
                          )}
                          {tx.status === 'pending' && (
                            <Button variant="outline" size="sm">
                              Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {filteredTransactions.map((tx) => (
                <Card key={tx.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(tx.status)}
                      {getStatusBadge(tx.status)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(tx.created_at)}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Amount:</span>
                      <span className="font-semibold">
                        {formatAmount(tx.amount, tx.token_symbol)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Network:</span>
                      {getNetworkBadge(tx.network)}
                    </div>
                    
                    {tx.tx_hash && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Transaction:</span>
                        <a
                          href={getExplorerUrl(tx.tx_hash, tx.network)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline text-sm"
                        >
                          View
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                    
                    {tx.error_message && (
                      <Alert className="mt-2 border-red-200 bg-red-50">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-red-700 text-sm">
                          {tx.error_message}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}