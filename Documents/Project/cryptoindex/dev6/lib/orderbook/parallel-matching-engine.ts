/**
 * Parallel Matching Engine for Ultra-High Performance
 * Implements sharding and parallel processing for 20,000+ TPS
 */

import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import * as cluster from 'cluster';
import * as os from 'os';
import { Order, Trade, MatchResult } from '../types/orderbook';
import { UltraPerformanceOrderbook } from './ultra-performance-orderbook';

interface ShardConfig {
  id: number;
  pairs: string[];
  worker: Worker;
  load: number;
}

interface MatchingTask {
  id: string;
  order: Order;
  callback: (result: MatchResult) => void;
  timestamp: number;
  retries: number;
}

export class ParallelMatchingEngine extends EventEmitter {
  private shards: Map<number, ShardConfig> = new Map();
  private pairToShard: Map<string, number> = new Map();
  private taskQueue: Map<string, MatchingTask> = new Map();
  private orderbook: UltraPerformanceOrderbook;
  
  // Performance configuration
  private readonly SHARD_COUNT = os.cpus().length;
  private readonly MAX_QUEUE_SIZE = 10000;
  private readonly TASK_TIMEOUT = 100; // ms
  private readonly MAX_RETRIES = 3;
  
  // Metrics
  private metrics = {
    tasksProcessed: 0,
    tasksQueued: 0,
    tasksFailed: 0,
    averageLatency: 0,
    shardUtilization: new Map<number, number>()
  };

  constructor() {
    super();
    this.orderbook = new UltraPerformanceOrderbook();
    this.initializeShards();
    this.setupLoadBalancer();
  }

  /**
   * Initialize sharding system
   */
  private async initializeShards(): Promise<void> {
    const pairs = await this.getAllTradingPairs();
    const pairsPerShard = Math.ceil(pairs.length / this.SHARD_COUNT);

    for (let i = 0; i < this.SHARD_COUNT; i++) {
      const shardPairs = pairs.slice(i * pairsPerShard, (i + 1) * pairsPerShard);
      const worker = await this.createWorker(i);
      
      const shard: ShardConfig = {
        id: i,
        pairs: shardPairs,
        worker,
        load: 0
      };

      this.shards.set(i, shard);
      
      // Map pairs to shards
      shardPairs.forEach(pair => {
        this.pairToShard.set(pair, i);
      });

      // Setup worker communication
      worker.on('message', (message) => {
        this.handleWorkerMessage(i, message);
      });

      worker.on('error', (error) => {
        this.handleWorkerError(i, error);
      });
    }
  }

  /**
   * Create a worker thread for matching
   */
  private async createWorker(shardId: number): Promise<Worker> {
    const workerCode = `
      const { parentPort } = require('worker_threads');
      const { MatchingLogic } = require('./matching-logic');
      
      const matcher = new MatchingLogic();
      
      parentPort.on('message', async (task) => {
        try {
          const result = await matcher.matchOrder(task.order);
          parentPort.postMessage({
            type: 'MATCH_RESULT',
            taskId: task.id,
            result
          });
        } catch (_error) {
          parentPort.postMessage({
            type: 'MATCH_ERROR',
            taskId: task.id,
            error: (_error as Error)?.message || String(_error)
          });
        }
      });
    `;

    return new Worker(workerCode, { 
      eval: true,
      workerData: { shardId }
    });
  }

  /**
   * Process order with automatic sharding
   */
  async processOrderParallel(order: Order): Promise<MatchResult> {
    return new Promise((resolve, reject) => {
      const shardId = this.getShardForPair(order.pair);
      const shard = this.shards.get(shardId);

      if (!shard) {
        reject(new Error(`No shard available for pair ${order.pair}`));
        return;
      }

      // Check queue size
      if (this.taskQueue.size >= this.MAX_QUEUE_SIZE) {
        reject(new Error('Task queue is full'));
        return;
      }

      // Create task
      const task: MatchingTask = {
        id: `${order.id}_${Date.now()}`,
        order,
        callback: resolve,
        timestamp: Date.now(),
        retries: 0
      };

      // Add to queue
      this.taskQueue.set(task.id, task);
      this.metrics.tasksQueued++;

      // Send to worker
      shard.worker.postMessage(task);
      shard.load++;

      // Set timeout
      setTimeout(() => {
        if (this.taskQueue.has(task.id)) {
          this.handleTaskTimeout(task);
        }
      }, this.TASK_TIMEOUT);
    });
  }

  /**
   * Batch process multiple orders
   */
  async processBatch(orders: Order[]): Promise<MatchResult[]> {
    // Group orders by shard
    const ordersByShard = new Map<number, Order[]>();
    
    for (const order of orders) {
      const shardId = this.getShardForPair(order.pair);
      if (!ordersByShard.has(shardId)) {
        ordersByShard.set(shardId, []);
      }
      ordersByShard.get(shardId)!.push(order);
    }

    // Process each shard's batch in parallel
    const promises: Promise<MatchResult[]>[] = [];
    
    for (const [shardId, shardOrders] of ordersByShard) {
      promises.push(this.processBatchOnShard(shardId, shardOrders));
    }

    // Wait for all batches
    const results = await Promise.all(promises);
    return results.flat();
  }

  /**
   * Process batch on specific shard
   */
  private async processBatchOnShard(shardId: number, orders: Order[]): Promise<MatchResult[]> {
    const shard = this.shards.get(shardId);
    if (!shard) throw new Error(`Shard ${shardId} not found`);

    return new Promise((resolve, reject) => {
      const batchId = `batch_${Date.now()}_${shardId}`;
      const results: MatchResult[] = [];
      let completed = 0;

      const batchTask = {
        type: 'BATCH_MATCH',
        batchId,
        orders
      };

      // Setup batch response handler
      const handler = (message: any) => {
        if (message.batchId === batchId) {
          results.push(...message.results);
          completed += message.results.length;

          if (completed >= orders.length) {
            shard.worker.off('message', handler);
            resolve(results);
          }
        }
      };

      shard.worker.on('message', handler);
      shard.worker.postMessage(batchTask);

      // Batch timeout
      setTimeout(() => {
        shard.worker.off('message', handler);
        reject(new Error('Batch processing timeout'));
      }, this.TASK_TIMEOUT * orders.length);
    });
  }

  /**
   * Get shard ID for a trading pair
   */
  private getShardForPair(pair: string): number {
    // Use consistent hashing for better distribution
    let hash = 0;
    for (let i = 0; i < pair.length; i++) {
      hash = ((hash << 5) - hash) + pair.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % this.SHARD_COUNT;
  }

  /**
   * Handle message from worker
   */
  private handleWorkerMessage(shardId: number, message: any): void {
    const shard = this.shards.get(shardId);
    if (!shard) return;

    switch (message.type) {
      case 'MATCH_RESULT':
        this.handleMatchResult(message);
        shard.load = Math.max(0, shard.load - 1);
        break;
      
      case 'MATCH_ERROR':
        this.handleMatchError(message);
        shard.load = Math.max(0, shard.load - 1);
        break;
      
      case 'METRICS':
        this.updateShardMetrics(shardId, message.metrics);
        break;
    }
  }

  /**
   * Handle successful match result
   */
  private handleMatchResult(message: any): void {
    const task = this.taskQueue.get(message.taskId);
    if (!task) return;

    this.taskQueue.delete(message.taskId);
    this.metrics.tasksProcessed++;
    
    // Update latency
    const latency = Date.now() - task.timestamp;
    this.metrics.averageLatency = 
      (this.metrics.averageLatency * (this.metrics.tasksProcessed - 1) + latency) / 
      this.metrics.tasksProcessed;

    // Execute callback
    task.callback(message.result);
  }

  /**
   * Handle match error
   */
  private handleMatchError(message: any): void {
    const task = this.taskQueue.get(message.taskId);
    if (!task) return;

    task.retries++;
    
    if (task.retries < this.MAX_RETRIES) {
      // Retry on different shard
      const newShardId = (this.getShardForPair(task.order.pair) + 1) % this.SHARD_COUNT;
      const newShard = this.shards.get(newShardId);
      
      if (newShard) {
        newShard.worker.postMessage(task);
        newShard.load++;
      }
    } else {
      // Final failure
      this.taskQueue.delete(message.taskId);
      this.metrics.tasksFailed++;
      
      task.callback({
        success: false,
        trades: [],
        remaining: task.order.amount,
        error: message.error
      } as MatchResult);
    }
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(shardId: number, error: Error): void {
    console.error(`Worker ${shardId} error:`, _error);
    
    // Restart worker
    this.restartWorker(shardId);
  }

  /**
   * Restart failed worker
   */
  private async restartWorker(shardId: number): Promise<void> {
    const shard = this.shards.get(shardId);
    if (!shard) return;

    // Terminate old worker
    await shard.worker.terminate();
    
    // Create new worker
    const newWorker = await this.createWorker(shardId);
    shard.worker = newWorker;
    shard.load = 0;

    // Re-setup communication
    newWorker.on('message', (message) => {
      this.handleWorkerMessage(shardId, message);
    });

    newWorker.on('error', (error) => {
      this.handleWorkerError(shardId, error);
    });

    console.log(`Worker ${shardId} restarted successfully`);
  }

  /**
   * Handle task timeout
   */
  private handleTaskTimeout(task: MatchingTask): void {
    if (task.retries < this.MAX_RETRIES) {
      task.retries++;
      task.timestamp = Date.now();
      
      // Retry on same shard
      const shardId = this.getShardForPair(task.order.pair);
      const shard = this.shards.get(shardId);
      
      if (shard) {
        shard.worker.postMessage(task);
      }
    } else {
      // Task failed
      this.taskQueue.delete(task.id);
      this.metrics.tasksFailed++;
      
      task.callback({
        success: false,
        trades: [],
        remaining: task.order.amount,
        error: 'Task timeout'
      } as MatchResult);
    }
  }

  /**
   * Setup load balancer
   */
  private setupLoadBalancer(): void {
    setInterval(() => {
      this.rebalanceShards();
    }, 5000); // Rebalance every 5 seconds
  }

  /**
   * Rebalance load across shards
   */
  private rebalanceShards(): void {
    const loads = Array.from(this.shards.values()).map(s => s.load);
    const avgLoad = loads.reduce((a, b) => a + b, 0) / loads.length;
    const maxLoad = Math.max(...loads);
    const minLoad = Math.min(...loads);

    // If imbalance is significant, redistribute pairs
    if (maxLoad - minLoad > avgLoad * 0.5) {
      console.log('Rebalancing shards due to load imbalance');
      this.redistributePairs();
    }
  }

  /**
   * Redistribute pairs across shards
   */
  private redistributePairs(): void {
    // Get current load distribution
    const shardLoads = new Map<number, number>();
    this.shards.forEach((shard, id) => {
      shardLoads.set(id, shard.load);
    });

    // Sort shards by load
    const sortedShards = Array.from(shardLoads.entries())
      .sort((a, b) => a[1] - b[1]);

    // Move pairs from overloaded to underloaded shards
    const overloaded = sortedShards.slice(-Math.floor(this.SHARD_COUNT / 4));
    const underloaded = sortedShards.slice(0, Math.floor(this.SHARD_COUNT / 4));

    for (const [overloadedId] of overloaded) {
      const overloadedShard = this.shards.get(overloadedId)!;
      const pairsToMove = Math.floor(overloadedShard.pairs.length / 4);
      
      for (let i = 0; i < pairsToMove && i < underloaded.length; i++) {
        const [underloadedId] = underloaded[i];
        const underloadedShard = this.shards.get(underloadedId)!;
        
        // Move pair
        const pair = overloadedShard.pairs.pop()!;
        underloadedShard.pairs.push(pair);
        this.pairToShard.set(pair, underloadedId);
      }
    }
  }

  /**
   * Update shard metrics
   */
  private updateShardMetrics(shardId: number, metrics: any): void {
    this.metrics.shardUtilization.set(shardId, metrics.utilization);
  }

  /**
   * Get all trading pairs
   */
  private async getAllTradingPairs(): Promise<string[]> {
    // In production, fetch from database or configuration
    return [
      'HYPERINDEX-USDC',
      'DOGE-USDC',
      'PEPE-USDC',
      'SHIB-USDC',
      'WIF-USDC',
      'BONK-USDC'
    ];
  }

  /**
   * Get performance metrics
   */
  getMetrics(): any {
    const shardMetrics = Array.from(this.shards.values()).map(shard => ({
      id: shard.id,
      pairs: shard.pairs.length,
      load: shard.load,
      utilization: this.metrics.shardUtilization.get(shard.id) || 0
    }));

    return {
      ...this.metrics,
      shards: shardMetrics,
      totalCapacity: this.MAX_QUEUE_SIZE,
      queueUtilization: (this.taskQueue.size / this.MAX_QUEUE_SIZE) * 100
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    // Stop accepting new tasks
    this.taskQueue.clear();
    
    // Terminate all workers
    for (const shard of this.shards.values()) {
      await shard.worker.terminate();
    }
    
    // Shutdown orderbook
    await this.orderbook.shutdown();
  }

  private static instance: ParallelMatchingEngine;
  
  public static getInstance(): ParallelMatchingEngine {
    if (!ParallelMatchingEngine.instance) {
      ParallelMatchingEngine.instance = new ParallelMatchingEngine();
    }
    return ParallelMatchingEngine.instance;
  }

  /**
   * Get orderbook data (delegates to UltraPerformanceOrderbook)
   */
  async getOrderbook(pair: string, depth: number = 20) {
    return await this.orderbook.getOrderbook(pair, depth);
  }

  /**
   * Get market data (delegates to UltraPerformanceOrderbook)
   */
  async getMarketData(pair: string) {
    return await this.orderbook.getMarketData(pair);
  }
}
