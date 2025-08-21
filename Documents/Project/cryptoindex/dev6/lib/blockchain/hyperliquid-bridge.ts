// lib/blockchain/hyperliquid-bridge.ts
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import { TransactionUpdate } from '@/lib/supabase/types';

// Hyperliquid Bridge Contract ABI (based on official documentation)
const HYPERLIQUID_BRIDGE_ABI = [
  'function deposit(address user, uint256 amount) external',
  'function withdrawal(address user, uint256 amount, bytes calldata signature) external',
  'function getBalance(address user) external view returns (uint256)',
  'event Deposited(address indexed user, uint256 amount)',
  'event WithdrawalRequested(address indexed user, uint256 amount, uint256 nonce)',
  'event WithdrawalCompleted(address indexed user, uint256 amount)'
];

export interface BridgeDepositRequest {
  walletAddress: string;
  amount: string;
  transactionId: string;
  arbitrumTxHash: string;
}

export interface BridgeStatus {
  isDeposited: boolean;
  balance: string;
  lastUpdate: string;
  blockNumber?: number;
}

export interface HyperliquidApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class HyperliquidBridgeService {
  private static instance: HyperliquidBridgeService;
  private supabase;
  private arbitrumProvider: ethers.JsonRpcProvider;
  private hyperliquidProvider: ethers.JsonRpcProvider;
  private bridgeContract: ethers.Contract;
  private readonly BRIDGE_ADDRESS = '0x2df1c51e09aecf9cacb7bc98cb1742757f163df7';
  private readonly HYPERLIQUID_API_URL = 'https://api.hyperliquid.xyz';

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Initialize providers
    this.arbitrumProvider = new ethers.JsonRpcProvider(
      process.env.ARBITRUM_RPC_URL || 'https://arbitrum-one.public.blastapi.io'
    );

    this.hyperliquidProvider = new ethers.JsonRpcProvider(
      'https://rpc.hyperliquid.xyz/evm'
    );

    // Initialize bridge contract
    this.bridgeContract = new ethers.Contract(
      this.BRIDGE_ADDRESS,
      HYPERLIQUID_BRIDGE_ABI,
      this.arbitrumProvider
    );
  }

  static getInstance(): HyperliquidBridgeService {
    if (!HyperliquidBridgeService.instance) {
      HyperliquidBridgeService.instance = new HyperliquidBridgeService();
    }
    return HyperliquidBridgeService.instance;
  }

  /**
   * Monitor bridge deposit process
   */
  async monitorBridgeDeposit(request: BridgeDepositRequest): Promise<void> {
    try {
      console.log(`🌉 Monitoring bridge deposit for transaction: ${request.transactionId}`);
      
      // Update transaction to processing
      await this.updateTransactionStatus(request.transactionId, 'processing', {
        bridge_tx_hash: request.arbitrumTxHash,
        metadata: {
          bridge_monitoring_started: new Date().toISOString(),
          bridge_address: this.BRIDGE_ADDRESS
        }
      });

      // Wait for Arbitrum transaction confirmation
      const arbitrumReceipt = await this.arbitrumProvider.waitForTransaction(
        request.arbitrumTxHash,
        1
      );

      if (!arbitrumReceipt || arbitrumReceipt.status !== 1) {
        throw new Error('Arbitrum transaction failed');
      }

      console.log(`✅ Arbitrum transaction confirmed: ${request.arbitrumTxHash}`);

      // Check if deposit was processed by bridge
      const bridgeStatus = await this.waitForBridgeProcessing(
        request.walletAddress,
        request.amount,
        60000 // 60 seconds timeout
      );

      if (bridgeStatus.isDeposited) {
        console.log(`✅ Bridge deposit completed for ${request.walletAddress}`);
        
        await this.updateTransactionStatus(request.transactionId, 'completed', {
          metadata: {
            bridge_confirmed: true,
            bridge_balance: bridgeStatus.balance,
            bridge_block_number: bridgeStatus.blockNumber,
            completion_time: new Date().toISOString()
          }
        });
      } else {
        throw new Error('Bridge deposit not confirmed within timeout');
      }
    } catch (_error) {
      console.error('❌ Bridge monitoring failed:', _error);
      
      await this.updateTransactionStatus(request.transactionId, 'failed', {
        error_message: `Bridge monitoring failed: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`
      });
    }
  }

  /**
   * Wait for bridge to process deposit
   */
  private async waitForBridgeProcessing(
    walletAddress: string,
    expectedAmount: string,
    timeoutMs: number = 60000
  ): Promise<BridgeStatus> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < timeoutMs) {
      try {
        const status = await this.checkBridgeStatus(walletAddress);
        
        // Check if balance increased by expected amount
        const balanceIncrease = parseFloat(status.balance);
        const expectedIncrease = parseFloat(expectedAmount);
        
        if (balanceIncrease >= expectedIncrease) {
          return {
            ...status,
            isDeposited: true
          };
        }

        console.log(`⏳ Waiting for bridge processing... Balance: ${status.balance} USDC`);
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (_error) {
        console.error('❌ Error checking bridge status:', _error);
        // Continue polling even on errors
      }
    }

    return {
      isDeposited: false,
      balance: '0',
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * Check bridge status using Hyperliquid API
   */
  async checkBridgeStatus(walletAddress: string): Promise<BridgeStatus> {
    try {
      // Use Hyperliquid API to check balance
      const response = await this.queryHyperliquidApi('info', {
        type: 'clearinghouseState',
        user: walletAddress
      });

      if (response.success && response.data) {
        const balance = response.data.marginSummary?.accountValue || '0';
        
        return {
          isDeposited: parseFloat(balance) > 0,
          balance,
          lastUpdate: new Date().toISOString()
        };
      }

      return {
        isDeposited: false,
        balance: '0',
        lastUpdate: new Date().toISOString()
      };
    } catch (_error) {
      console.error('❌ Failed to check bridge status:', _error);
      throw _error;
    }
  }

  /**
   * Query Hyperliquid API
   */
  private async queryHyperliquidApi(
    endpoint: string,
    payload: any
  ): Promise<HyperliquidApiResponse> {
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
   * Get user's Hyperliquid balance
   */
  async getHyperliquidBalance(walletAddress: string): Promise<string> {
    try {
      const status = await this.checkBridgeStatus(walletAddress);
      return status.balance;
    } catch (_error) {
      console.error('❌ Failed to get Hyperliquid balance:', _error);
      return '0';
    }
  }

  /**
   * Estimate bridge processing time
   */
  getBridgeProcessingTime(): { min: number; max: number; average: number } {
    return {
      min: 30, // 30 seconds
      max: 180, // 3 minutes
      average: 60 // 1 minute
    };
  }

  /**
   * Update transaction status
   */
  private async updateTransactionStatus(
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
        throw new Error(`Failed to update transaction: ${(_error as Error)?.message || String(_error)}`);
      }

      console.log(`✅ Transaction ${transactionId} updated to ${status}`);
    } catch (_error) {
      console.error('❌ Failed to update transaction status:', _error);
      throw _error;
    }
  }

  /**
   * Get bridge contract events
   */
  async getBridgeEvents(
    walletAddress: string,
    fromBlock: number = 0
  ): Promise<any[]> {
    try {
      const filter = this.bridgeContract.filters.Deposited(walletAddress);
      const events = await this.bridgeContract.queryFilter(filter, fromBlock);
      
      return events.map(event => ({
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        args: event.args,
        timestamp: new Date().toISOString()
      }));
    } catch (_error) {
      console.error('❌ Failed to get bridge events:', _error);
      return [];
    }
  }

  /**
   * Validate bridge deposit
   */
  validateBridgeDeposit(request: BridgeDepositRequest): { valid: boolean; error?: string } {
    if (!ethers.isAddress(request.walletAddress)) {
      return { valid: false, error: 'Invalid wallet address' };
    }

    const amount = parseFloat(request.amount);
    if (isNaN(amount) || amount <= 0) {
      return { valid: false, error: 'Invalid amount' };
    }

    if (amount < 5) {
      return { valid: false, error: 'Minimum deposit is 5 USDC' };
    }

    if (!request.arbitrumTxHash || !ethers.isHexString(request.arbitrumTxHash, 32)) {
      return { valid: false, error: 'Invalid Arbitrum transaction hash' };
    }

    return { valid: true };
  }

  /**
   * Get bridge statistics
   */
  async getBridgeStatistics(): Promise<{
    totalDeposits: number;
    totalVolume: string;
    averageProcessingTime: number;
    successRate: number;
  }> {
    try {
      const { data: transactions, error } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('transaction_type', 'deposit')
        .eq('network', 'arbitrum');

      if (error) {
        throw new Error(`Failed to get bridge statistics: ${(_error as Error)?.message || String(_error)}`);
      }

      const totalDeposits = transactions.length;
      const totalVolume = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      const completedTransactions = transactions.filter(tx => tx.status === 'completed');
      const successRate = totalDeposits > 0 ? (completedTransactions.length / totalDeposits) * 100 : 0;

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
        totalDeposits,
        totalVolume: totalVolume.toFixed(2),
        averageProcessingTime: Math.round(averageProcessingTime),
        successRate: Math.round(successRate * 100) / 100
      };
    } catch (_error) {
      console.error('❌ Failed to get bridge statistics:', _error);
      return {
        totalDeposits: 0,
        totalVolume: '0',
        averageProcessingTime: 0,
        successRate: 0
      };
    }
  }
}