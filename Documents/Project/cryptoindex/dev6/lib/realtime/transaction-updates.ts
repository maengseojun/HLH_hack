// lib/realtime/transaction-updates.ts
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
// WARNING: This file contains React hooks and should only be used in client components
import { usePrivy } from '@privy-io/react-auth';
import { Transaction } from '@/lib/supabase/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface TransactionUpdate {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  txHash?: string;
  bridgeTxHash?: string;
  errorMessage?: string;
  completedAt?: string;
  metadata?: any;
}

export interface UseTransactionUpdatesOptions {
  transactionId?: string;
  walletAddress?: string;
  pollInterval?: number;
  enableRealtime?: boolean;
}

export interface TransactionUpdateState {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  subscribe: (transactionId: string) => void;
  unsubscribe: (transactionId: string) => void;
  refreshTransaction: (transactionId: string) => Promise<void>;
  refreshAll: () => Promise<void>;
}

/**
 * Custom hook for real-time transaction updates
 */
export function useTransactionUpdates(
  options: UseTransactionUpdatesOptions = {}
): TransactionUpdateState {
  const { ready, authenticated, user } = usePrivy();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [subscriptions, setSubscriptions] = useState<Set<string>>(new Set());

  const {
    transactionId,
    walletAddress,
    pollInterval = 10000, // 10 seconds
    enableRealtime = true
  } = options;

  /**
   * Fetch transaction data from API
   */
  const fetchTransactions = useCallback(async () => {
    if (!authenticated || !user) return;

    try {
      setLoading(true);
      setError(null);

      let url = '/api/deposit/status';
      const params = new URLSearchParams();

      if (transactionId) {
        params.append('id', transactionId);
      }
      if (walletAddress) {
        params.append('wallet', walletAddress);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transactions');
      }

      if (data.transaction) {
        setTransactions([data.transaction]);
      } else if (data.transactions) {
        setTransactions(data.transactions);
      }

      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [authenticated, user, transactionId, walletAddress]);

  /**
   * Fetch user's transaction history
   */
  const fetchTransactionHistory = useCallback(async () => {
    if (!authenticated || !user) return;

    try {
      const response = await fetch('/api/deposit/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'history',
          walletAddress
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transaction history');
      }

      setTransactions(data.transactions || []);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, [authenticated, user, walletAddress]);

  /**
   * Subscribe to real-time updates for a specific transaction
   */
  const subscribe = useCallback((txId: string) => {
    if (!enableRealtime || subscriptions.has(txId)) return;

    console.log(`📡 Subscribing to transaction updates: ${txId}`);

    const channel = supabase
      .channel(`transaction-${txId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
          filter: `id=eq.${txId}`
        },
        (payload) => {
          console.log('📨 Transaction update received:', payload);
          
          setTransactions(prev => {
            const updated = prev.map(tx => 
              tx.id === txId ? { ...tx, ...payload.new } : tx
            );
            return updated;
          });
          
          setLastUpdate(new Date());
        }
      )
      .subscribe();

    setSubscriptions(prev => new Set([...prev, txId]));

    return () => {
      console.log(`📡 Unsubscribing from transaction updates: ${txId}`);
      supabase.removeChannel(channel);
      setSubscriptions(prev => {
        const updated = new Set(prev);
        updated.delete(txId);
        return updated;
      });
    };
  }, [enableRealtime, subscriptions]);

  /**
   * Unsubscribe from updates for a specific transaction
   */
  const unsubscribe = useCallback((txId: string) => {
    const channel = supabase.getChannels().find(ch => ch.topic === `transaction-${txId}`);
    if (channel) {
      supabase.removeChannel(channel);
    }
    
    setSubscriptions(prev => {
      const updated = new Set(prev);
      updated.delete(txId);
      return updated;
    });
  }, []);

  /**
   * Refresh a specific transaction
   */
  const refreshTransaction = useCallback(async (txId: string) => {
    if (!authenticated || !user) return;

    try {
      const response = await fetch(`/api/deposit/status?id=${txId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh transaction');
      }

      setTransactions(prev => {
        const updated = prev.map(tx => 
          tx.id === txId ? data.transaction : tx
        );
        return updated;
      });

      setLastUpdate(new Date());
    } catch (err) {
      console.error('❌ Failed to refresh transaction:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh transaction');
    }
  }, [authenticated, user]);

  /**
   * Refresh all transactions
   */
  const refreshAll = useCallback(async () => {
    if (transactionId) {
      await fetchTransactions();
    } else {
      await fetchTransactionHistory();
    }
  }, [transactionId, fetchTransactions, fetchTransactionHistory]);

  // Initial data fetch
  useEffect(() => {
    if (ready && authenticated) {
      if (transactionId) {
        fetchTransactions();
      } else {
        fetchTransactionHistory();
      }
    }
  }, [ready, authenticated, transactionId, fetchTransactions, fetchTransactionHistory]);

  // Set up polling for active transactions
  useEffect(() => {
    if (!enableRealtime || !authenticated || transactions.length === 0) return;

    const activeTransactions = transactions.filter(tx => 
      tx.status === 'pending' || tx.status === 'processing'
    );

    if (activeTransactions.length === 0) return;

    const interval = setInterval(() => {
      activeTransactions.forEach(tx => {
        refreshTransaction(tx.id);
      });
    }, pollInterval);

    return () => clearInterval(interval);
  }, [enableRealtime, authenticated, transactions, pollInterval, refreshTransaction]);

  // Auto-subscribe to active transactions
  useEffect(() => {
    if (!enableRealtime || !authenticated) return;

    const activeTransactions = transactions.filter(tx => 
      tx.status === 'pending' || tx.status === 'processing'
    );

    // Subscribe to new active transactions
    activeTransactions.forEach(tx => {
      if (!subscriptions.has(tx.id)) {
        subscribe(tx.id);
      }
    });

    // Unsubscribe from completed transactions
    const completedTransactions = transactions.filter(tx => 
      tx.status === 'completed' || tx.status === 'failed' || tx.status === 'cancelled'
    );

    completedTransactions.forEach(tx => {
      if (subscriptions.has(tx.id)) {
        unsubscribe(tx.id);
      }
    });
  }, [enableRealtime, authenticated, transactions, subscriptions, subscribe, unsubscribe]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      subscriptions.forEach(txId => {
        unsubscribe(txId);
      });
    };
  }, [subscriptions, unsubscribe]);

  return {
    transactions,
    loading,
    error,
    lastUpdate,
    subscribe,
    unsubscribe,
    refreshTransaction,
    refreshAll
  };
}

/**
 * Transaction status notification system
 */
export class TransactionNotificationService {
  private static instance: TransactionNotificationService;
  private notifications: Map<string, Notification> = new Map();

  private constructor() {}

  static getInstance(): TransactionNotificationService {
    if (!TransactionNotificationService.instance) {
      TransactionNotificationService.instance = new TransactionNotificationService();
    }
    return TransactionNotificationService.instance;
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  /**
   * Show notification for transaction update
   */
  async showTransactionNotification(
    transaction: Transaction,
    previousStatus?: string
  ): Promise<void> {
    const hasPermission = await this.requestPermission();
    if (!hasPermission) return;

    // Don't show notification if status didn't change
    if (previousStatus === transaction.status) return;

    let title = '';
    let body = '';
    let icon = '';

    switch (transaction.status) {
      case 'processing':
        title = 'Deposit Processing';
        body = `Your ${transaction.amount} USDC deposit is being processed`;
        icon = '🔄';
        break;
      
      case 'completed':
        title = 'Deposit Completed';
        body = `Your ${transaction.amount} USDC deposit has been completed successfully`;
        icon = '✅';
        break;
      
      case 'failed':
        title = 'Deposit Failed';
        body = `Your ${transaction.amount} USDC deposit has failed`;
        icon = '❌';
        break;
      
      default:
        return;
    }

    const notification = new Notification(title, {
      body,
      icon,
      badge: icon,
      tag: `transaction-${transaction.id}`,
      requireInteraction: transaction.status === 'completed' || transaction.status === 'failed'
    });

    this.notifications.set(transaction.id, notification);

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
      this.notifications.delete(transaction.id);
    }, 5000);
  }

  /**
   * Close notification for a specific transaction
   */
  closeNotification(transactionId: string): void {
    const notification = this.notifications.get(transactionId);
    if (notification) {
      notification.close();
      this.notifications.delete(transactionId);
    }
  }

  /**
   * Close all notifications
   */
  closeAllNotifications(): void {
    this.notifications.forEach((notification, transactionId) => {
      notification.close();
    });
    this.notifications.clear();
  }
}