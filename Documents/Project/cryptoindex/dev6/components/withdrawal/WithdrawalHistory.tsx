// components/withdrawal/WithdrawalHistory.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  History, 
  ExternalLink, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Filter,
  Search,
  Download,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';

interface WithdrawalTransaction {
  id: string;
  amount: string;
  netAmount: string;
  destinationAddress: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  txHash?: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
  feeInfo?: {
    baseFee: number;
    applicableFee: number;
    discountTier?: string;
    feeWaived: boolean;
  };
  timeline?: Array<{
    step: string;
    status: string;
    timestamp: string;
    description: string;
  }>;
}

interface WithdrawalHistoryProps {
  walletAddress: string;
}

export default function WithdrawalHistory({ walletAddress }: WithdrawalHistoryProps) {
  const [transactions, setTransactions] = useState<WithdrawalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<WithdrawalTransaction | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  });

  useEffect(() => {
    loadTransactions();
  }, [walletAddress]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/withdrawal/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'history',
          walletAddress
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setTransactions(data.withdrawals || []);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshTransaction = async (transactionId: string) => {
    try {
      const response = await fetch('/api/withdrawal/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'refresh',
          transactionId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Update the transaction in the list
        setTransactions(prev => 
          prev.map(tx => 
            tx.id === transactionId 
              ? { ...tx, ...data.transaction }
              : tx
          )
        );
      }
    } catch (error) {
      console.error('Failed to refresh transaction:', error);
    }
  };

  const cancelTransaction = async (transactionId: string) => {
    try {
      const response = await fetch('/api/withdrawal/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cancel',
          transactionId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Update the transaction status
        setTransactions(prev => 
          prev.map(tx => 
            tx.id === transactionId 
              ? { ...tx, status: 'cancelled' }
              : tx
          )
        );
      }
    } catch (error) {
      console.error('Failed to cancel transaction:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(num);
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filters.status && tx.status !== filters.status) return false;
    if (filters.search && !tx.id.toLowerCase().includes(filters.search.toLowerCase()) && 
        !tx.destinationAddress.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.dateFrom && new Date(tx.createdAt) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && new Date(tx.createdAt) > new Date(filters.dateTo)) return false;
    return true;
  });

  const calculateProcessingTime = (createdAt: string, completedAt?: string) => {
    if (!completedAt) return null;
    const diff = new Date(completedAt).getTime() - new Date(createdAt).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const exportTransactions = () => {
    const csv = [
      ['ID', 'Amount', 'Net Amount', 'Destination', 'Status', 'Created', 'Completed', 'Fee', 'Tx Hash'].join(','),
      ...filteredTransactions.map(tx => [
        tx.id,
        tx.amount,
        tx.netAmount,
        tx.destinationAddress,
        tx.status,
        format(new Date(tx.createdAt), 'yyyy-MM-dd HH:mm:ss'),
        tx.completedAt ? format(new Date(tx.completedAt), 'yyyy-MM-dd HH:mm:ss') : '',
        tx.feeInfo?.applicableFee || '',
        tx.txHash || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `withdrawals-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Withdrawal History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                className="w-full p-2 border rounded-md"
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="ID or address..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFrom">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mb-4">
            <Button variant="outline" onClick={loadTransactions} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={exportTransactions}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          {/* Transactions Table */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading transactions...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="text-muted-foreground">
                        {transactions.length === 0 ? 'No withdrawals yet' : 'No transactions match your filters'}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-sm">
                        {tx.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-semibold">{formatCurrency(tx.amount)}</div>
                          <div className="text-sm text-muted-foreground">
                            Net: {formatCurrency(tx.netAmount)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatAddress(tx.destinationAddress)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(tx.status)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(tx.status)}
                            {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(tx.createdAt), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        {tx.feeInfo ? (
                          <div className="space-y-1">
                            <div className="text-sm font-semibold">
                              {formatCurrency(tx.feeInfo.applicableFee)}
                            </div>
                            {tx.feeInfo.discountTier && (
                              <Badge variant="secondary" className="text-xs">
                                {tx.feeInfo.discountTier}
                              </Badge>
                            )}
                            {tx.feeInfo.feeWaived && (
                              <Badge variant="secondary" className="text-xs">
                                Fee Waived
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedTransaction(tx)}
                              >
                                Details
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Transaction Details</DialogTitle>
                              </DialogHeader>
                              <TransactionDetails transaction={tx} />
                            </DialogContent>
                          </Dialog>
                          
                          {tx.status === 'processing' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => refreshTransaction(tx.id)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {tx.status === 'pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => cancelTransaction(tx.id)}
                            >
                              Cancel
                            </Button>
                          )}
                          
                          {tx.txHash && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`https://explorer.hyperliquid.xyz/tx/${tx.txHash}`, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionDetails({ transaction }: { transaction: WithdrawalTransaction }) {
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(num);
  };

  const calculateProcessingTime = (createdAt: string, completedAt?: string) => {
    if (!completedAt) return null;
    const diff = new Date(completedAt).getTime() - new Date(createdAt).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="space-y-6">
      {/* Transaction Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Transaction ID</Label>
          <div className="font-mono text-sm bg-muted p-2 rounded">
            {transaction.id}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Badge className={`${transaction.status === 'completed' ? 'bg-green-100 text-green-800' : 
                            transaction.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                            transaction.status === 'pending' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'}`}>
            {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
          </Badge>
        </div>
        <div className="space-y-2">
          <Label>Amount</Label>
          <div className="font-semibold">{formatCurrency(transaction.amount)}</div>
        </div>
        <div className="space-y-2">
          <Label>Net Amount</Label>
          <div className="font-semibold">{formatCurrency(transaction.netAmount)}</div>
        </div>
        <div className="space-y-2">
          <Label>Destination Address</Label>
          <div className="font-mono text-sm bg-muted p-2 rounded break-all">
            {transaction.destinationAddress}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Created</Label>
          <div>{format(new Date(transaction.createdAt), 'MMM dd, yyyy HH:mm:ss')}</div>
        </div>
      </div>

      {/* Fee Information */}
      {transaction.feeInfo && (
        <div className="space-y-4">
          <h3 className="font-semibold">Fee Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Base Fee</Label>
              <div>{formatCurrency(transaction.feeInfo.baseFee)}</div>
            </div>
            <div className="space-y-2">
              <Label>Applicable Fee</Label>
              <div>{formatCurrency(transaction.feeInfo.applicableFee)}</div>
            </div>
            {transaction.feeInfo.discountTier && (
              <div className="space-y-2">
                <Label>Discount Tier</Label>
                <Badge variant="secondary">{transaction.feeInfo.discountTier}</Badge>
              </div>
            )}
            {transaction.feeInfo.feeWaived && (
              <div className="space-y-2">
                <Label>Fee Status</Label>
                <Badge variant="secondary">Fee Waived</Badge>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      {transaction.timeline && transaction.timeline.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold">Timeline</h3>
          <div className="space-y-3">
            {transaction.timeline.map((step, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  step.status === 'completed' ? 'bg-green-500' :
                  step.status === 'in_progress' ? 'bg-yellow-500' :
                  'bg-gray-300'
                }`} />
                <div className="flex-1">
                  <div className="font-medium">{step.description}</div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(step.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {transaction.errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{transaction.errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Processing Time */}
      {transaction.completedAt && (
        <div className="space-y-2">
          <Label>Processing Time</Label>
          <div>{calculateProcessingTime(transaction.createdAt, transaction.completedAt)}</div>
        </div>
      )}

      {/* Transaction Hash */}
      {transaction.txHash && (
        <div className="space-y-2">
          <Label>Transaction Hash</Label>
          <div className="flex items-center gap-2">
            <div className="font-mono text-sm bg-muted p-2 rounded flex-1">
              {transaction.txHash}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`https://explorer.hyperliquid.xyz/tx/${transaction.txHash}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}