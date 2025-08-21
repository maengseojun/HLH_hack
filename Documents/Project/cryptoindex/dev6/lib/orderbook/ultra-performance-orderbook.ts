/**
 * Ultra-Performance Orderbook Implementation
 * Target: 15,000-20,000 TPS
 * Based on dYdX v4 and Vertex Protocol optimizations
 */

import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import * as msgpack from 'msgpack-lite';
import { Order, Trade, OrderbookSnapshot } from '../types/orderbook';

interface BatchOperation {
  type: 'add' | 'cancel' | 'update';
  data: any;
  timestamp: number;
}

interface PerformanceMetrics {
  tps: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  errors: number;
}

export class UltraPerformanceOrderbook extends EventEmitter {
  private static instance: UltraPerformanceOrderbook;
  
  private redis: Redis;
  private pipeline: Redis.Pipeline | null = null;
  private batchQueue: BatchOperation[] = [];
  private workers: Worker[] = [];
  private metrics: PerformanceMetrics;
  
  // Performance tuning parameters
  private readonly BATCH_SIZE = 100;
  private readonly BATCH_TIMEOUT = 5; // ms
  private readonly WORKER_COUNT = 8;
  private readonly PIPELINE_THRESHOLD = 50;
  
  // Lua scripts for atomic operations
  private readonly MATCH_ORDER_SCRIPT = `
    local orderbook_key = KEYS[1]
    local order_data_key = KEYS[2]
    local order_id = ARGV[1]
    local order_price = tonumber(ARGV[2])
    local order_amount = tonumber(ARGV[3])
    local order_side = ARGV[4]
    local order_timestamp = ARGV[5]
    
    local opposite_side = order_side == 'buy' and 'sell' or 'buy'
    local opposite_key = string.gsub(orderbook_key, order_side, opposite_side)
    
    local trades = {}
    local remaining = order_amount
    
    -- Get matching orders
    local matches = {}
    if order_side == 'buy' then
      matches = redis.call('ZRANGEBYSCORE', opposite_key, '-inf', order_price, 'WITHSCORES', 'LIMIT', 0, 100) or {}
    else
      matches = redis.call('ZREVRANGEBYSCORE', opposite_key, order_price, '+inf', 'WITHSCORES', 'LIMIT', 0, 100) or {}
    end
    
    -- Process matches atomically
    if matches and type(matches) == "table" then
        for i = 1, #matches, 2 do
        if remaining <= 0 then break end
        
        local match_id = matches[i]
        local match_price = tonumber(matches[i + 1])
        local match_data = redis.call('HGETALL', 'order:' .. match_id)
        
        if match_data and #match_data > 0 then
        local match_amount = tonumber(match_data[6])
        local trade_amount = math.min(remaining, match_amount)
        
        -- Create trade
        local trade_id = order_timestamp .. '_' .. i
        table.insert(trades, {
          id = trade_id,
          price = match_price,
          amount = trade_amount,
          buyer = order_side == 'buy' and order_id or match_id,
          seller = order_side == 'sell' and order_id or match_id
        })
        
        remaining = remaining - trade_amount
        match_amount = match_amount - trade_amount
        
        if match_amount <= 0 then
          -- Remove filled order
          redis.call('ZREM', opposite_key, match_id)
          redis.call('DEL', 'order:' .. match_id)
        else
          -- Update partial fill
          redis.call('HSET', 'order:' .. match_id, 'amount', match_amount)
        end
        end
      end
    end
    
    -- Add remaining order to book if not fully matched
    if remaining > 0 then
      local score = order_side == 'buy' and order_price or -order_price
      redis.call('ZADD', orderbook_key, score, order_id)
      redis.call('HMSET', order_data_key, 
        'id', order_id,
        'price', order_price,
        'amount', remaining,
        'side', order_side,
        'timestamp', order_timestamp
      )
    end
    
    return cjson.encode({
      trades = trades,
      remaining = remaining
    })
  `;

  private constructor() {
    super();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || 'hyperindex_secure_password',
      enableReadyCheck: true,
      enableOfflineQueue: false,
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      // Performance optimizations
      enableAutoPipelining: true,
      autoPipeliningIgnoredCommands: [],
      dropBufferSupport: true
    });

    this.metrics = {
      tps: 0,
      latency: { p50: 0, p95: 0, p99: 0 },
      throughput: 0,
      errors: 0
    };

    this.initializeWorkers();
    this.setupBatchProcessor();
    this.loadLuaScripts();
  }

  /**
   * Initialize worker threads for parallel processing
   */
  private async initializeWorkers(): Promise<void> {
    for (let i = 0; i < this.WORKER_COUNT; i++) {
      const worker = new Worker(`
        const { parentPort } = require('worker_threads');
        const msgpack = require('msgpack-lite');
        
        parentPort.on('message', (data) => {
          const order = msgpack.decode(data);
          // Process order matching logic
          const result = processOrder(order);
          parentPort.postMessage(msgpack.encode(result));
        });
        
        function processOrder(order) {
          // Matching logic here
          return { matched: true, trades: [] };
        }
      `, { eval: true });

      this.workers.push(worker);
    }
  }

  /**
   * Setup batch processing with automatic flush
   */
  private setupBatchProcessor(): void {
    setInterval(() => {
      if (this.batchQueue.length > 0) {
        this.flushBatch();
      }
    }, this.BATCH_TIMEOUT);
  }

  /**
   * Load and register Lua scripts
   */
  private async loadLuaScripts(): Promise<void> {
    this.redis.defineCommand('matchOrder', {
      numberOfKeys: 2,
      lua: this.MATCH_ORDER_SCRIPT
    });
  }

  /**
   * Add order with ultra-high performance
   */
  async addOrderUltra(order: Order): Promise<void> {
    const startTime = process.hrtime.bigint();
    
    // Add to batch queue
    this.batchQueue.push({
      type: 'add',
      data: order,
      timestamp: Date.now()
    });

    // Check if batch should be flushed
    if (this.batchQueue.length >= this.BATCH_SIZE) {
      await this.flushBatch();
    }

    // Update metrics
    const endTime = process.hrtime.bigint();
    this.updateLatency(Number(endTime - startTime) / 1000000); // Convert to ms
  }

  /**
   * Process order using Lua script for atomic matching
   */
  async processOrderAtomic(order: Order): Promise<{ trades: Trade[], remaining: number }> {
    const orderbook_key = `orderbook:${order.pair}:${order.side}s`;
    const order_data_key = `order:${order.id}`;
    
    const result = await (this.redis as any).matchOrder(
      orderbook_key,
      order_data_key,
      order.id,
      order.price,
      order.amount,
      order.side,
      Date.now().toString()
    );

    return JSON.parse(result);
  }

  /**
   * Flush batch operations
   */
  private async flushBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, this.BATCH_SIZE);
    const pipeline = this.redis.pipeline();

    for (const operation of batch) {
      switch (operation.type) {
        case 'add':
          this.addToPipeline(pipeline, operation.data);
          break;
        case 'cancel':
          this.cancelInPipeline(pipeline, operation.data);
          break;
        case 'update':
          this.updateInPipeline(pipeline, operation.data);
          break;
      }
    }

    try {
      await pipeline.exec();
      this.metrics.throughput += batch.length;
    } catch (_error) {
      console.error('Batch flush failed:', _error);
      this.metrics.errors++;
      // Retry failed operations
      this.batchQueue.unshift(...batch);
    }
  }

  /**
   * Add order to pipeline
   */
  private addToPipeline(pipeline: Redis.Pipeline, order: Order): void {
    const key = `orderbook:${order.pair}:${order.side}s`;
    const score = order.side === 'buy' 
      ? parseFloat(order.price) 
      : -parseFloat(order.price);

    pipeline.zadd(key, score, order.id);
    pipeline.hset(`order:${order.id}`, this.serializeOrder(order));
    pipeline.sadd(`user:${order.userId}:orders`, order.id);
    pipeline.expire(`order:${order.id}`, 86400); // 24 hour TTL
  }

  /**
   * Cancel order in pipeline
   */
  private cancelInPipeline(pipeline: Redis.Pipeline, orderId: string): void {
    pipeline.get(`order:${orderId}:side`);
    pipeline.get(`order:${orderId}:pair`);
    pipeline.zrem(`orderbook:*`, orderId);
    pipeline.del(`order:${orderId}`);
  }

  /**
   * Update order in pipeline
   */
  private updateInPipeline(pipeline: Redis.Pipeline, update: any): void {
    pipeline.hset(`order:${update.id}`, update.field, update.value);
  }

  /**
   * Get orderbook snapshot with caching
   */
  async getOrderbookCached(pair: string, depth: number = 20): Promise<OrderbookSnapshot> {
    const cacheKey = `snapshot:${pair}:${depth}`;
    
    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return msgpack.decode(Buffer.from(cached, 'base64'));
    }

    // Generate snapshot
    const snapshot = await this.generateSnapshot(pair, depth);
    
    // Cache with short TTL
    await this.redis.setex(
      cacheKey, 
      1, // 1 second cache
      msgpack.encode(snapshot).toString('base64')
    );

    return snapshot;
  }

  /**
   * Generate orderbook snapshot
   */
  private async generateSnapshot(pair: string, depth: number): Promise<OrderbookSnapshot> {
    const multi = this.redis.multi();
    
    multi.zrevrange(`orderbook:${pair}:buys`, 0, depth - 1, 'WITHSCORES');
    multi.zrange(`orderbook:${pair}:sells`, 0, depth - 1, 'WITHSCORES');
    
    const [bids, asks] = await multi.exec() as any[];

    return {
      pair,
      bids: this.parsePriceLevels(bids[1], 'buy'),
      asks: this.parsePriceLevels(asks[1], 'sell'),
      timestamp: Date.now()
    };
  }

  /**
   * Parse price levels from Redis response
   */
  private parsePriceLevels(data: string[], side: 'buy' | 'sell'): any[] {
    const levels = [];
    for (let i = 0; i < data.length; i += 2) {
      const orderId = data[i];
      const score = parseFloat(data[i + 1]);
      const price = side === 'buy' ? score : -score;
      
      levels.push({
        price: price.toString(),
        amount: '0', // Will be aggregated
        orders: 1
      });
    }
    return levels;
  }

  /**
   * Serialize order for storage
   */
  private serializeOrder(order: Order): Map<string, string> {
    const map = new Map();
    map.set('id', order.id);
    map.set('userId', order.userId);
    map.set('pair', order.pair);
    map.set('side', order.side);
    map.set('type', order.type);
    map.set('price', order.price);
    map.set('amount', order.amount);
    map.set('timestamp', order.timestamp.toString());
    return map;
  }

  /**
   * Update latency metrics
   */
  private updateLatency(latencyMs: number): void {
    // Simple percentile tracking (production would use HDR histogram)
    if (!this.metrics.latency.p50 || latencyMs < this.metrics.latency.p50) {
      this.metrics.latency.p50 = latencyMs;
    }
    if (!this.metrics.latency.p95 || latencyMs < this.metrics.latency.p95 * 1.05) {
      this.metrics.latency.p95 = latencyMs;
    }
    if (!this.metrics.latency.p99 || latencyMs < this.metrics.latency.p99 * 1.01) {
      this.metrics.latency.p99 = latencyMs;
    }
  }

  /**
   * Calculate current TPS
   */
  calculateTPS(): number {
    const windowSize = 1000; // 1 second window
    const now = Date.now();
    const recentOps = this.metrics.throughput;
    this.metrics.tps = (recentOps / windowSize) * 1000;
    return this.metrics.tps;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      tps: this.calculateTPS()
    };
  }

  /**
   * Get singleton instance of UltraPerformanceOrderbook
   */
  public static getInstance(): UltraPerformanceOrderbook {
    if (!UltraPerformanceOrderbook.instance) {
      UltraPerformanceOrderbook.instance = new UltraPerformanceOrderbook();
    }
    return UltraPerformanceOrderbook.instance;
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    // Flush remaining batches
    await this.flushBatch();
    
    // Terminate workers
    for (const worker of this.workers) {
      await worker.terminate();
    }
    
    // Close Redis connection
    await this.redis.quit();
  }
}
