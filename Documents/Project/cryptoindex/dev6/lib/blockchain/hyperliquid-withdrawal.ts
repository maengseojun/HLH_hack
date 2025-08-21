// lib/blockchain/hyperliquid-withdrawal.ts
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import { TransactionInsert, TransactionUpdate } from '@/lib/supabase/types';

// Hyperliquid API types
interface HyperliquidWithdrawalPayload {
  destination: string;
  amount: string;
  time: number;
}

interface HyperliquidSignature {
  r: string;
  s: string;
  v: number;
}

interface WithdrawalRequest {
  walletAddress: string;
  amount: string;
  destinationAddress: string;
  userId: string;
  twoFactorCode?: string;
}

interface WithdrawalResult {
  success: boolean;
  transactionId?: string;
  message?: string;
  error?: string;
  estimatedTime?: string;
}

export class HyperliquidWithdrawalService {
  private static instance: HyperliquidWithdrawalService;
  private supabase;
  private readonly HYPERLIQUID_API_URL = 'https://api.hyperliquid.xyz';
  private readonly WITHDRAWAL_FEE = 1.0; // 1 USDC fixed fee
  private readonly MIN_WITHDRAWAL = 1.01; // Minimum withdrawal (fee + 0.01 USDC)
  private readonly MAX_WITHDRAWAL = 100000.0; // Maximum withdrawal amount

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  static getInstance(): HyperliquidWithdrawalService {
    if (!HyperliquidWithdrawalService.instance) {
      HyperliquidWithdrawalService.instance = new HyperliquidWithdrawalService();
    }
    return HyperliquidWithdrawalService.instance;
  }

  /**
   * Validate withdrawal request
   */
  validateWithdrawal(request: WithdrawalRequest): { valid: boolean; error?: string } {
    const amount = parseFloat(request.amount);

    if (isNaN(amount) || amount <= 0) {
      return { valid: false, error: 'Invalid withdrawal amount' };
    }

    if (amount < this.MIN_WITHDRAWAL) {
      return { valid: false, error: `Minimum withdrawal is ${this.MIN_WITHDRAWAL} USDC (including ${this.WITHDRAWAL_FEE} USDC fee)` };
    }

    if (amount > this.MAX_WITHDRAWAL) {
      return { valid: false, error: `Maximum withdrawal is ${this.MAX_WITHDRAWAL} USDC` };
    }

    if (!ethers.isAddress(request.walletAddress)) {
      return { valid: false, error: 'Invalid wallet address' };
    }

    if (!ethers.isAddress(request.destinationAddress)) {
      return { valid: false, error: 'Invalid destination address' };
    }

    // Check if destination is not the same as source
    if (request.walletAddress.toLowerCase() === request.destinationAddress.toLowerCase()) {
      return { valid: false, error: 'Source and destination addresses cannot be the same' };
    }

    return { valid: true };
  }

  /**
   * Get user's Hyperliquid balance
   */
  async getHyperliquidBalance(walletAddress: string): Promise<{ balance: string; formatted: string }> {
    try {
      const response = await this.queryHyperliquidAPI('info', {
        type: 'clearinghouseState',
        user: walletAddress
      });

      if (response.success && response.data) {
        const balance = response.data.marginSummary?.accountValue || '0';
        const balanceNum = parseFloat(balance);
        
        return {
          balance: balance,
          formatted: balanceNum.toFixed(6)
        };
      }

      return { balance: '0', formatted: '0.000000' };
    } catch (_error) {
      console.error('❌ Failed to get Hyperliquid balance:', _error);
      throw new Error('Failed to get Hyperliquid balance');
    }
  }

  /**
   * Create withdrawal signature payload
   */
  private createWithdrawalPayload(
    destinationAddress: string,
    amount: string,
    timestamp: number
  ): HyperliquidWithdrawalPayload {
    return {
      destination: destinationAddress,
      amount: amount,
      time: timestamp
    };
  }

  /**
   * Sign withdrawal request using EIP-712
   */
  async signWithdrawal(
    walletAddress: string,
    destinationAddress: string,
    amount: string,
    privateKey?: string
  ): Promise<{ signature: HyperliquidSignature; payload: HyperliquidWithdrawalPayload }> {
    try {
      const timestamp = Date.now();
      const payload = this.createWithdrawalPayload(destinationAddress, amount, timestamp);

      // EIP-712 domain
      const domain = {
        name: 'Exchange',
        version: '1',
        chainId: 999, // Hyperliquid chain ID
        verifyingContract: '0x0000000000000000000000000000000000000000'
      };

      // EIP-712 types
      const types = {
        Agent: [
          { name: 'source', type: 'string' },
          { name: 'connectionId', type: 'bytes32' }
        ],
        Withdraw: [
          { name: 'destination', type: 'string' },
          { name: 'amount', type: 'string' },
          { name: 'time', type: 'uint64' }
        ]
      };

      const value = {
        destination: destinationAddress,
        amount: amount,
        time: timestamp
      };

      if (privateKey) {
        // Server-side signing (for testing)
        const wallet = new ethers.Wallet(privateKey);
        const signature = await wallet.signTypedData(domain, types, value);
        const sig = ethers.Signature.from(signature);
        
        return {
          signature: {
            r: sig.r,
            s: sig.s,
            v: sig.v
          },
          payload
        };
      } else {
        // Client-side signing
        const provider = (window as any).ethereum;
        if (!provider) {
          throw new Error('No Ethereum provider found');
        }

        const signature = await provider.request({
          method: 'eth_signTypedData_v4',
          params: [walletAddress, JSON.stringify({
            domain,
            types,
            primaryType: 'Withdraw',
            message: value
          })]
        });

        const sig = ethers.Signature.from(signature);
        
        return {
          signature: {
            r: sig.r,
            s: sig.s,
            v: sig.v
          },
          payload
        };
      }
    } catch (_error) {
      console.error('❌ Failed to sign withdrawal:', _error);
      throw new Error('Failed to sign withdrawal request');
    }
  }

  /**
   * Submit withdrawal request to Hyperliquid
   */
  async submitWithdrawal(
    signature: HyperliquidSignature,
    payload: HyperliquidWithdrawalPayload
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await this.queryHyperliquidAPI('exchange', {
        action: {
          type: 'withdraw',
          ...payload
        },
        signature
      });

      return response;
    } catch (_error) {
      console.error('❌ Failed to submit withdrawal:', _error);
      return {
        success: false,
        error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
      };
    }
  }

  /**
   * Create withdrawal transaction record
   */
  async createWithdrawalTransaction(request: WithdrawalRequest): Promise<string> {
    try {
      const netAmount = parseFloat(request.amount) - this.WITHDRAWAL_FEE;
      
      const transactionData: TransactionInsert = {
        user_id: request.userId,
        wallet_address: request.walletAddress,
        transaction_type: 'withdrawal',
        status: 'pending',
        network: 'hyperliquid',
        amount: netAmount.toString(),
        token_symbol: 'USDC',
        metadata: {
          destination_address: request.destinationAddress,
          gross_amount: request.amount,
          withdrawal_fee: this.WITHDRAWAL_FEE.toString(),
          net_amount: netAmount.toString(),
          created_via: 'hyperliquid_withdrawal_service'
        }
      };

      const { data, error } = await this.supabase
        .from('transactions')
        .insert(transactionData)
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create withdrawal transaction: ${(_error as Error)?.message || String(_error)}`);
      }

      return data.id;
    } catch (_error) {
      console.error('❌ Failed to create withdrawal transaction:', _error);
      throw _error;
    }
  }

  /**
   * Update withdrawal transaction status
   */
  async updateWithdrawalStatus(
    transactionId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',
    updates: Partial<TransactionUpdate> = {}
  ): Promise<void> {
    try {
      const updateData: TransactionUpdate = {
        status,
        updated_at: new Date().toISOString(),
        ...updates
      };

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await this.supabase
        .from('transactions')
        .update(updateData)
        .eq('id', transactionId);

      if (error) {
        throw new Error(`Failed to update withdrawal transaction: ${(_error as Error)?.message || String(_error)}`);
      }

      console.log(`✅ Withdrawal transaction ${transactionId} updated to ${status}`);
    } catch (_error) {
      console.error('❌ Failed to update withdrawal status:', _error);
      throw _error;
    }
  }

  /**
   * Monitor withdrawal progress
   */
  async monitorWithdrawal(
    transactionId: string,
    walletAddress: string,
    expectedAmount: string
  ): Promise<void> {
    try {
      console.log(`🔄 Monitoring withdrawal: ${transactionId}`);
      
      // Update to processing status
      await this.updateWithdrawalStatus(transactionId, 'processing');

      // Monitor for completion (simplified version)
      const maxWaitTime = 300000; // 5 minutes
      const pollInterval = 10000; // 10 seconds
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        try {
          // Check if withdrawal is completed by monitoring balance change
          const initialBalance = await this.getHyperliquidBalance(walletAddress);
          
          // Wait for polling interval
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          
          const currentBalance = await this.getHyperliquidBalance(walletAddress);
          const balanceChange = parseFloat(initialBalance.balance) - parseFloat(currentBalance.balance);
          
          // If balance decreased by expected amount (+ fee), withdrawal is likely completed
          if (balanceChange >= parseFloat(expectedAmount)) {
            console.log(`✅ Withdrawal completed: ${transactionId}`);
            
            await this.updateWithdrawalStatus(transactionId, 'completed', {
              metadata: {
                completion_time: new Date().toISOString(),
                balance_change: balanceChange.toString()
              }
            });
            
            return;
          }
        } catch (_error) {
          console.error('❌ Error during withdrawal monitoring:', _error);
        }
      }

      // Timeout reached
      console.log(`⏰ Withdrawal monitoring timeout: ${transactionId}`);
      await this.updateWithdrawalStatus(transactionId, 'failed', {
        error_message: 'Withdrawal monitoring timeout'
      });
    } catch (_error) {
      console.error('❌ Withdrawal monitoring failed:', _error);
      await this.updateWithdrawalStatus(transactionId, 'failed', {
        error_message: `Monitoring failed: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`
      });
    }
  }

  /**
   * Query Hyperliquid API
   */
  private async queryHyperliquidAPI(
    endpoint: string,
    payload: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await fetch(`${this.HYPERLIQUID_API_URL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        data
      };
    } catch (_error) {
      console.error('❌ Hyperliquid API query failed:', _error);
      return {
        success: false,
        error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
      };
    }
  }

  /**
   * Get withdrawal fee
   */
  getWithdrawalFee(): number {
    return this.WITHDRAWAL_FEE;
  }

  /**
   * Get withdrawal limits
   */
  getWithdrawalLimits(): { min: number; max: number; fee: number } {
    return {
      min: this.MIN_WITHDRAWAL,
      max: this.MAX_WITHDRAWAL,
      fee: this.WITHDRAWAL_FEE
    };
  }

  /**
   * Calculate net withdrawal amount
   */
  calculateNetAmount(grossAmount: string): string {
    const gross = parseFloat(grossAmount);
    const net = gross - this.WITHDRAWAL_FEE;
    return Math.max(0, net).toFixed(6);
  }

  /**
   * Get withdrawal statistics
   */
  async getWithdrawalStatistics(): Promise<{
    totalWithdrawals: number;
    totalVolume: string;
    averageProcessingTime: number;
    successRate: number;
  }> {
    try {
      const { data: transactions, error } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('transaction_type', 'withdrawal')
        .eq('network', 'hyperliquid');

      if (error) {
        throw new Error(`Failed to get withdrawal statistics: ${(_error as Error)?.message || String(_error)}`);
      }

      const totalWithdrawals = transactions.length;
      const totalVolume = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      const completedTransactions = transactions.filter(tx => tx.status === 'completed');
      const successRate = totalWithdrawals > 0 ? (completedTransactions.length / totalWithdrawals) * 100 : 0;

      // Calculate average processing time
      const processingTimes = completedTransactions
        .filter(tx => tx.created_at && tx.completed_at)
        .map(tx => {
          const created = new Date(tx.created_at).getTime();
          const completed = new Date(tx.completed_at!).getTime();
          return (completed - created) / 1000; // seconds
        });

      const averageProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
        : 0;

      return {
        totalWithdrawals,
        totalVolume: totalVolume.toFixed(2),
        averageProcessingTime: Math.round(averageProcessingTime),
        successRate: Math.round(successRate * 100) / 100
      };
    } catch (_error) {
      console.error('❌ Failed to get withdrawal statistics:', _error);
      return {
        totalWithdrawals: 0,
        totalVolume: '0',
        averageProcessingTime: 0,
        successRate: 0
      };
    }
  }
}