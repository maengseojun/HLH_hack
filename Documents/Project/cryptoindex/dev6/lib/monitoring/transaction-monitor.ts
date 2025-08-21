// lib/monitoring/transaction-monitor.ts
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import { ArbitrumDepositService } from '@/lib/blockchain/arbitrum-service';
import { HyperliquidBridgeService } from '@/lib/blockchain/hyperliquid-bridge';

export interface MonitoringJob {
  id: string;
  transactionId: string;
  type: 'arbitrum_deposit' | 'bridge_deposit';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: number;
  lastCheck: number;
  retryCount: number;
  maxRetries: number;
  data: any;
}

export class TransactionMonitoringService {
  private static instance: TransactionMonitoringService;
  private supabase;
  private jobs: Map<string, MonitoringJob> = new Map();
  private isRunning = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 10000; // 10 seconds
  private readonly MAX_RETRIES = 10;
  private readonly TIMEOUT_DURATION = 300000; // 5 minutes

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  static getInstance(): TransactionMonitoringService {
    if (!TransactionMonitoringService.instance) {
      TransactionMonitoringService.instance = new TransactionMonitoringService();
    }
    return TransactionMonitoringService.instance;
  }

  /**
   * Start the monitoring service
   */
  start(): void {
    if (this.isRunning) {
      console.log('📊 Transaction monitoring service already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting transaction monitoring service');

    // Load existing pending transactions
    this.loadPendingTransactions();

    // Start monitoring loop
    this.monitoringInterval = setInterval(() => {
      this.processMonitoringJobs();
    }, this.CHECK_INTERVAL);

    console.log('✅ Transaction monitoring service started');
  }

  /**
   * Stop the monitoring service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('🛑 Transaction monitoring service stopped');
  }

  /**
   * Add a transaction to monitoring
   */
  addTransaction(
    transactionId: string,
    type: 'arbitrum_deposit' | 'bridge_deposit',
    data: any
  ): void {
    const job: MonitoringJob = {
      id: `${type}_${transactionId}`,
      transactionId,
      type,
      status: 'pending',
      startTime: Date.now(),
      lastCheck: Date.now(),
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
      data
    };

    this.jobs.set(job.id, job);
    console.log(`📝 Added monitoring job: ${job.id}`);
  }

  /**
   * Remove a transaction from monitoring
   */
  removeTransaction(jobId: string): void {
    if (this.jobs.has(jobId)) {
      this.jobs.delete(jobId);
      console.log(`🗑️ Removed monitoring job: ${jobId}`);
    }
  }

  /**
   * Get monitoring statistics
   */
  getStats(): {
    totalJobs: number;
    pendingJobs: number;
    runningJobs: number;
    completedJobs: number;
    failedJobs: number;
    isRunning: boolean;
  } {
    const stats = {
      totalJobs: this.jobs.size,
      pendingJobs: 0,
      runningJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      isRunning: this.isRunning
    };

    this.jobs.forEach(job => {
      switch (job.status) {
        case 'pending':
          stats.pendingJobs++;
          break;
        case 'running':
          stats.runningJobs++;
          break;
        case 'completed':
          stats.completedJobs++;
          break;
        case 'failed':
          stats.failedJobs++;
          break;
      }
    });

    return stats;
  }

  /**
   * Load pending transactions from database
   */
  private async loadPendingTransactions(): Promise<void> {
    try {
      const { data: pendingTransactions, error } = await this.supabase
        .from('transactions')
        .select('*')
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('❌ Failed to load pending transactions:', _error);
        return;
      }

      if (pendingTransactions && pendingTransactions.length > 0) {
        console.log(`📋 Loading ${pendingTransactions.length} pending transactions`);

        for (const tx of pendingTransactions) {
          if (tx.tx_hash) {
            this.addTransaction(tx.id, 'arbitrum_deposit', {
              txHash: tx.tx_hash,
              walletAddress: tx.wallet_address,
              amount: tx.amount
            });
          }

          if (tx.status === 'processing') {
            this.addTransaction(tx.id, 'bridge_deposit', {
              walletAddress: tx.wallet_address,
              amount: tx.amount,
              arbitrumTxHash: tx.tx_hash
            });
          }
        }
      }
    } catch (_error) {
      console.error('❌ Error loading pending transactions:', _error);
    }
  }

  /**
   * Process all monitoring jobs
   */
  private async processMonitoringJobs(): Promise<void> {
    const now = Date.now();
    const jobsToProcess = Array.from(this.jobs.values()).filter(
      job => job.status === 'pending' || job.status === 'running'
    );

    if (jobsToProcess.length === 0) {
      return;
    }

    console.log(`🔄 Processing ${jobsToProcess.length} monitoring jobs`);

    for (const job of jobsToProcess) {
      try {
        // Check for timeout
        if (now - job.startTime > this.TIMEOUT_DURATION) {
          console.log(`⏰ Job ${job.id} timed out`);
          await this.handleJobTimeout(job);
          continue;
        }

        // Check if it's time to process this job
        if (now - job.lastCheck < this.CHECK_INTERVAL) {
          continue;
        }

        job.status = 'running';
        job.lastCheck = now;

        await this.processJob(job);
      } catch (_error) {
        console.error(`❌ Error processing job ${job.id}:`, _error);
        await this.handleJobError(job, error);
      }
    }
  }

  /**
   * Process a single monitoring job
   */
  private async processJob(job: MonitoringJob): Promise<void> {
    switch (job.type) {
      case 'arbitrum_deposit':
        await this.processArbitrumDeposit(job);
        break;
      
      case 'bridge_deposit':
        await this.processBridgeDeposit(job);
        break;
      
      default:
        console.error(`❌ Unknown job type: ${job.type}`);
        job.status = 'failed';
    }
  }

  /**
   * Process Arbitrum deposit monitoring
   */
  private async processArbitrumDeposit(job: MonitoringJob): Promise<void> {
    const arbitrumService = ArbitrumDepositService.getInstance();
    const { txHash } = job.data;

    try {
      const provider = new ethers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || 'https://arbitrum-one.public.blastapi.io'
      );

      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (receipt) {
        if (receipt.status === 1) {
          console.log(`✅ Arbitrum transaction confirmed: ${txHash}`);
          
          await arbitrumService.updateTransactionStatus(
            job.transactionId,
            'processing',
            {
              tx_hash: txHash,
              metadata: {
                block_number: receipt.blockNumber,
                gas_used: receipt.gasUsed.toString(),
                confirmation_time: new Date().toISOString()
              }
            }
          );

          job.status = 'completed';
          
          // Start bridge monitoring
          this.addTransaction(job.transactionId, 'bridge_deposit', {
            walletAddress: job.data.walletAddress,
            amount: job.data.amount,
            arbitrumTxHash: txHash
          });
        } else {
          console.log(`❌ Arbitrum transaction failed: ${txHash}`);
          
          await arbitrumService.updateTransactionStatus(
            job.transactionId,
            'failed',
            {
              tx_hash: txHash,
              error_message: 'Transaction failed on Arbitrum'
            }
          );

          job.status = 'failed';
        }
      } else {
        // Transaction not yet mined
        job.status = 'pending';
        console.log(`⏳ Arbitrum transaction pending: ${txHash}`);
      }
    } catch (_error) {
      console.error(`❌ Error checking Arbitrum transaction ${txHash}:`, _error);
      throw _error;
    }
  }

  /**
   * Process bridge deposit monitoring
   */
  private async processBridgeDeposit(job: MonitoringJob): Promise<void> {
    const bridgeService = HyperliquidBridgeService.getInstance();
    const { walletAddress, amount, arbitrumTxHash } = job.data;

    try {
      const bridgeStatus = await bridgeService.checkBridgeStatus(walletAddress);
      
      if (bridgeStatus.isDeposited) {
        console.log(`✅ Bridge deposit completed for ${walletAddress}`);
        
        const arbitrumService = ArbitrumDepositService.getInstance();
        await arbitrumService.updateTransactionStatus(
          job.transactionId,
          'completed',
          {
            metadata: {
              bridge_confirmed: true,
              bridge_balance: bridgeStatus.balance,
              completion_time: new Date().toISOString()
            }
          }
        );

        job.status = 'completed';
      } else {
        console.log(`⏳ Bridge deposit pending for ${walletAddress}`);
        job.status = 'pending';
      }
    } catch (_error) {
      console.error(`❌ Error checking bridge status for ${walletAddress}:`, _error);
      throw _error;
    }
  }

  /**
   * Handle job timeout
   */
  private async handleJobTimeout(job: MonitoringJob): Promise<void> {
    console.log(`⏰ Handling timeout for job ${job.id}`);
    
    const arbitrumService = ArbitrumDepositService.getInstance();
    await arbitrumService.updateTransactionStatus(
      job.transactionId,
      'failed',
      {
        error_message: 'Transaction monitoring timed out'
      }
    );

    job.status = 'failed';
  }

  /**
   * Handle job error
   */
  private async handleJobError(job: MonitoringJob, error: any): Promise<void> {
    job.retryCount++;
    
    if (job.retryCount >= job.maxRetries) {
      console.log(`❌ Job ${job.id} failed after ${job.maxRetries} retries`);
      
      const arbitrumService = ArbitrumDepositService.getInstance();
      await arbitrumService.updateTransactionStatus(
        job.transactionId,
        'failed',
        {
          error_message: `Monitoring failed after ${job.maxRetries} retries: ${(_error as Error)?.message || String(_error)}`
        }
      );

      job.status = 'failed';
    } else {
      console.log(`⚠️ Job ${job.id} failed, retry ${job.retryCount}/${job.maxRetries}`);
      job.status = 'pending';
    }
  }

  /**
   * Clean up completed and failed jobs
   */
  cleanupJobs(): void {
    const jobsToRemove: string[] = [];
    
    this.jobs.forEach((job, jobId) => {
      if (job.status === 'completed' || job.status === 'failed') {
        const age = Date.now() - job.startTime;
        // Remove jobs older than 10 minutes
        if (age > 600000) {
          jobsToRemove.push(jobId);
        }
      }
    });

    jobsToRemove.forEach(jobId => {
      this.jobs.delete(jobId);
    });

    if (jobsToRemove.length > 0) {
      console.log(`🧹 Cleaned up ${jobsToRemove.length} old monitoring jobs`);
    }
  }
}

// Initialize and start monitoring service
if (typeof window === 'undefined') {
  // Only run on server side
  const monitoringService = TransactionMonitoringService.getInstance();
  
  // Start monitoring service
  monitoringService.start();
  
  // Clean up jobs every 5 minutes
  setInterval(() => {
    monitoringService.cleanupJobs();
  }, 300000);
}

export default TransactionMonitoringService;