/**
 * Advanced MEV Protection System
 * 3-Layer MEV Defense: Commit-Reveal + Batch Auction + Price Impact Limit
 */

import { createHash, randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { ethers } from 'ethers';

interface MEVOrder {
  id: string;
  userId: string;
  pair: string;
  side: 'buy' | 'sell';
  amount: string;
  price: string;
  type: 'market' | 'limit';
  nonce: number;
  signature: string;
  timestamp: number;
}

interface CommitmentData {
  commitment: string;
  timestamp: number;
  userId: string;
  revealed: boolean;
  blockNumber?: number;
}

interface BatchAuction {
  id: string;
  startTime: number;
  endTime: number;
  orders: MEVOrder[];
  uniformPrice?: number;
  executed: boolean;
}

interface MEVAttackPattern {
  type: 'sandwich' | 'frontrun' | 'backrun' | 'arbitrage';
  confidence: number;
  userId: string;
  orders: MEVOrder[];
  description: string;
}

export class MEVProtectionSystem extends EventEmitter {
  private redis: Redis;
  private commitments = new Map<string, CommitmentData>();
  private batchAuctions = new Map<string, BatchAuction>();
  
  // Configuration
  private readonly COMMIT_REVEAL_DELAY = 3000; // 3초
  private readonly BATCH_AUCTION_DURATION = 5000; // 5초
  private readonly MAX_PRICE_IMPACT = 500; // 5% in basis points
  private readonly MIN_COMMITMENT_TIME = 100; // 최소 100ms 대기
  
  // MEV Detection
  private recentOrders = new Map<string, MEVOrder[]>(); // pair -> orders
  private userOrderHistory = new Map<string, MEVOrder[]>();
  private priceHistory = new Map<string, number[]>(); // pair -> prices
  
  // Statistics
  private stats = {
    totalCommitments: 0,
    totalReveals: 0,
    blockedMEVAttempts: 0,
    detectedPatterns: 0,
    avgCommitRevealTime: 0,
    batchAuctionsExecuted: 0
  };

  constructor() {
    super();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || 'hyperindex_secure_password',
      enableAutoPipelining: true,
      lazyConnect: true, // Enable lazy connect to prevent immediate failures
      enableOfflineQueue: true // Enable offline queue for better error handling
    });
    
    this.startBatchAuctionProcessor();
    this.startMEVDetection();
    this.startStatsCollection();
  }

  /**
   * Phase 1: Commit Order (Hide Intent)
   */
  async commitOrder(
    userId: string,
    orderData: MEVOrder,
    signature: string
  ): Promise<{ commitmentId: string; revealAfter: number }> {
    const commitment = this.generateCommitment(orderData, signature);
    const commitmentId = this.generateCommitmentId(userId, commitment);
    
    // Store commitment
    const commitmentData: CommitmentData = {
      commitment,
      timestamp: Date.now(),
      userId,
      revealed: false,
      blockNumber: await this.getCurrentBlockNumber()
    };
    
    this.commitments.set(commitmentId, commitmentData);
    
    // Store in Redis with TTL
    await this.redis.setex(
      `mev_commit:${commitmentId}`,
      60, // 1 minute TTL
      JSON.stringify(commitmentData)
    );
    
    this.stats.totalCommitments++;
    
    const revealAfter = Date.now() + this.COMMIT_REVEAL_DELAY;
    
    console.log(`🔐 Order committed: ${commitmentId} (reveal after ${this.COMMIT_REVEAL_DELAY}ms)`);
    
    return { commitmentId, revealAfter };
  }

  /**
   * Phase 2: Reveal Order (Execute in Batch)
   */
  async revealOrder(
    commitmentId: string,
    orderData: MEVOrder,
    signature: string
  ): Promise<{ batchId: string; estimatedExecution: number }> {
    // Get commitment
    let commitment = this.commitments.get(commitmentId);
    if (!commitment) {
      const redisData = await this.redis.get(`mev_commit:${commitmentId}`);
      if (redisData) {
        commitment = JSON.parse(redisData);
      } else {
        throw new Error('Invalid commitment ID');
      }
    }
    
    // Verify commitment hasn't been revealed
    if (commitment.revealed) {
      throw new Error('Commitment already revealed');
    }
    
    // Check timing
    const timeSinceCommit = Date.now() - commitment.timestamp;
    if (timeSinceCommit < this.MIN_COMMITMENT_TIME) {
      throw new Error(`Reveal too soon. Wait ${this.MIN_COMMITMENT_TIME - timeSinceCommit}ms`);
    }
    
    if (timeSinceCommit < this.COMMIT_REVEAL_DELAY) {
      throw new Error(`Reveal too early. Wait ${this.COMMIT_REVEAL_DELAY - timeSinceCommit}ms`);
    }
    
    // Verify commitment
    const calculatedCommitment = this.generateCommitment(orderData, signature);
    if (calculatedCommitment !== commitment.commitment) {
      await this.recordSuspiciousActivity(orderData.userId, 'invalid_reveal');
      throw new Error('Invalid reveal - commitment mismatch');
    }
    
    // Verify signature
    if (!await this.verifyOrderSignature(orderData, signature)) {
      await this.recordSuspiciousActivity(orderData.userId, 'invalid_signature');
      throw new Error('Invalid order signature');
    }
    
    // MEV Detection
    const mevPatterns = await this.detectMEVPatterns(orderData);
    if (mevPatterns.length > 0) {
      this.stats.blockedMEVAttempts++;
      await this.handleMEVAttempt(orderData.userId, mevPatterns);
      throw new Error(`MEV attack detected: ${mevPatterns[0].type}`);
    }
    
    // Mark as revealed
    commitment.revealed = true;
    
    // Add to current batch auction
    const batchId = this.getCurrentBatchId();
    const batch = this.getOrCreateBatch(batchId);
    batch.orders.push(orderData);
    
    // Update user order history
    if (!this.userOrderHistory.has(orderData.userId)) {
      this.userOrderHistory.set(orderData.userId, []);
    }
    this.userOrderHistory.get(orderData.userId)!.push(orderData);
    
    // Keep only recent orders (last 100)
    const userHistory = this.userOrderHistory.get(orderData.userId)!;
    if (userHistory.length > 100) {
      userHistory.splice(0, userHistory.length - 100);
    }
    
    this.stats.totalReveals++;
    this.stats.avgCommitRevealTime = (this.stats.avgCommitRevealTime + timeSinceCommit) / 2;
    
    console.log(`🔓 Order revealed: ${orderData.id} -> Batch ${batchId}`);
    
    const estimatedExecution = batch.endTime;
    return { batchId, estimatedExecution };
  }

  /**
   * MEV Pattern Detection
   */
  private async detectMEVPatterns(order: MEVOrder): Promise<MEVAttackPattern[]> {
    const patterns: MEVAttackPattern[] = [];
    
    // 1. Sandwich Attack Detection
    const sandwichPattern = this.detectSandwichAttack(order);
    if (sandwichPattern) patterns.push(sandwichPattern);
    
    // 2. Front-running Detection
    const frontrunPattern = this.detectFrontRunning(order);
    if (frontrunPattern) patterns.push(frontrunPattern);
    
    // 3. Back-running Detection
    const backrunPattern = this.detectBackRunning(order);
    if (backrunPattern) patterns.push(backrunPattern);
    
    // 4. High-frequency MEV Detection
    const hfPattern = this.detectHighFrequencyMEV(order);
    if (hfPattern) patterns.push(hfPattern);
    
    if (patterns.length > 0) {
      this.stats.detectedPatterns++;
      console.warn(`🚨 MEV patterns detected for user ${order.userId}:`, patterns.map(p => p.type));
    }
    
    return patterns;
  }

  /**
   * Sandwich Attack Detection
   */
  private detectSandwichAttack(order: MEVOrder): MEVAttackPattern | null {
    const userHistory = this.userOrderHistory.get(order.userId) || [];
    const recentOrders = userHistory.filter(o => 
      o.pair === order.pair && 
      Date.now() - o.timestamp < 10000 // 10초 내
    );
    
    if (recentOrders.length < 2) return null;
    
    // Look for buy -> (victim order) -> sell pattern
    const sortedOrders = recentOrders.sort((a, b) => a.timestamp - b.timestamp);
    
    for (let i = 0; i < sortedOrders.length - 2; i++) {
      const first = sortedOrders[i];
      const third = sortedOrders[i + 2];
      
      // Check for sandwich pattern: opposite sides with similar amounts
      if (first.side !== third.side && 
          Math.abs(parseFloat(first.amount) - parseFloat(third.amount)) / parseFloat(first.amount) < 0.1) {
        
        return {
          type: 'sandwich',
          confidence: 0.8,
          userId: order.userId,
          orders: [first, order, third],
          description: `Sandwich attack: ${first.side} -> target -> ${third.side}`
        };
      }
    }
    
    return null;
  }

  /**
   * Front-running Detection
   */
  private detectFrontRunning(order: MEVOrder): MEVAttackPattern | null {
    const pairOrders = this.recentOrders.get(order.pair) || [];
    const recentSimilarOrders = pairOrders.filter(o =>
      o.side === order.side &&
      o.userId !== order.userId &&
      Math.abs(parseFloat(o.price) - parseFloat(order.price)) / parseFloat(order.price) < 0.005 && // 0.5% price diff
      Date.now() - o.timestamp < 5000 // 5초 내
    );
    
    if (recentSimilarOrders.length > 0) {
      return {
        type: 'frontrun',
        confidence: 0.7,
        userId: order.userId,
        orders: [order, ...recentSimilarOrders],
        description: `Front-running: Similar order ahead with better price`
      };
    }
    
    return null;
  }

  /**
   * Back-running Detection
   */
  private detectBackRunning(order: MEVOrder): MEVAttackPattern | null {
    const userHistory = this.userOrderHistory.get(order.userId) || [];
    const veryRecentOrders = userHistory.filter(o =>
      Date.now() - o.timestamp < 1000 && // 1초 내
      o.pair === order.pair
    );
    
    if (veryRecentOrders.length > 3) {
      return {
        type: 'backrun',
        confidence: 0.6,
        userId: order.userId,
        orders: veryRecentOrders,
        description: `Back-running: Multiple orders in quick succession`
      };
    }
    
    return null;
  }

  /**
   * High-frequency MEV Detection
   */
  private detectHighFrequencyMEV(order: MEVOrder): MEVAttackPattern | null {
    const userHistory = this.userOrderHistory.get(order.userId) || [];
    const recentOrderCount = userHistory.filter(o => 
      Date.now() - o.timestamp < 60000 // 1분 내
    ).length;
    
    if (recentOrderCount > 50) { // 1분에 50개 이상
      return {
        type: 'arbitrage',
        confidence: 0.9,
        userId: order.userId,
        orders: [order],
        description: `High-frequency trading: ${recentOrderCount} orders in last minute`
      };
    }
    
    return null;
  }

  /**
   * Batch Auction Processing
   */
  private startBatchAuctionProcessor(): void {
    setInterval(() => {
      this.processExpiredBatches();
    }, 1000);
  }

  private processExpiredBatches(): void {
    const now = Date.now();
    
    for (const [batchId, batch] of this.batchAuctions) {
      if (!batch.executed && now >= batch.endTime) {
        this.executeBatchAuction(batchId);
      }
    }
  }

  private async executeBatchAuction(batchId: string): Promise<void> {
    const batch = this.batchAuctions.get(batchId);
    if (!batch || batch.executed) return;
    
    batch.executed = true;
    
    console.log(`⚡ Executing batch auction ${batchId} with ${batch.orders.length} orders`);
    
    if (batch.orders.length === 0) {
      this.cleanupBatch(batchId);
      return;
    }
    
    try {
      // 1. Sort orders by price-time priority
      const sortedOrders = this.sortOrdersForFairness(batch.orders);
      
      // 2. Calculate uniform clearing price
      const uniformPrice = this.calculateUniformPrice(sortedOrders);
      batch.uniformPrice = uniformPrice;
      
      // 3. Execute orders at uniform price
      const executedOrders = await this.executeOrdersAtUniformPrice(sortedOrders, uniformPrice);
      
      // 4. Update price history
      this.updatePriceHistory(batch.orders, uniformPrice);
      
      // 5. Emit batch execution event
      this.emit('batchExecuted', {
        batchId,
        executedOrders: executedOrders.length,
        totalOrders: batch.orders.length,
        uniformPrice,
        timestamp: Date.now()
      });
      
      this.stats.batchAuctionsExecuted++;
      
      console.log(`✅ Batch ${batchId} executed: ${executedOrders.length}/${batch.orders.length} orders at price ${uniformPrice}`);
      
    } catch (_error) {
      console.error(`❌ Batch ${batchId} execution failed:`, _error);
    } finally {
      // Cleanup batch after 1 minute
      setTimeout(() => this.cleanupBatch(batchId), 60000);
    }
  }

  /**
   * Fair Order Sorting (Price-Time Priority)
   */
  private sortOrdersForFairness(orders: MEVOrder[]): MEVOrder[] {
    return orders.sort((a, b) => {
      const priceA = parseFloat(a.price);
      const priceB = parseFloat(b.price);
      
      // Price priority
      if (a.side === 'buy') {
        if (priceA !== priceB) return priceB - priceA; // Higher price first
      } else {
        if (priceA !== priceB) return priceA - priceB; // Lower price first
      }
      
      // Time priority
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Uniform Price Calculation (Dutch Auction Style)
   */
  private calculateUniformPrice(orders: MEVOrder[]): number {
    if (orders.length === 0) return 0;
    
    const buyOrders = orders.filter(o => o.side === 'buy').sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    const sellOrders = orders.filter(o => o.side === 'sell').sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    
    if (buyOrders.length === 0 || sellOrders.length === 0) {
      // Return average price if only one side
      const allPrices = orders.map(o => parseFloat(o.price));
      return allPrices.reduce((a, b) => a + b) / allPrices.length;
    }
    
    // Find crossing point
    let buyVolume = 0;
    let sellVolume = 0;
    let crossingPrice = 0;
    
    const allPrices = [...new Set(orders.map(o => parseFloat(o.price)))].sort((a, b) => b - a);
    
    for (const price of allPrices) {
      buyVolume = buyOrders
        .filter(o => parseFloat(o.price) >= price)
        .reduce((sum, o) => sum + parseFloat(o.amount), 0);
      
      sellVolume = sellOrders
        .filter(o => parseFloat(o.price) <= price)
        .reduce((sum, o) => sum + parseFloat(o.amount), 0);
      
      if (buyVolume >= sellVolume) {
        crossingPrice = price;
        break;
      }
    }
    
    return crossingPrice || allPrices[Math.floor(allPrices.length / 2)];
  }

  /**
   * Execute Orders at Uniform Price
   */
  private async executeOrdersAtUniformPrice(orders: MEVOrder[], uniformPrice: number): Promise<MEVOrder[]> {
    const executedOrders: MEVOrder[] = [];
    
    for (const order of orders) {
      const orderPrice = parseFloat(order.price);
      
      // Check if order can be executed at uniform price
      const canExecute = (order.side === 'buy' && orderPrice >= uniformPrice) ||
                         (order.side === 'sell' && orderPrice <= uniformPrice);
      
      if (canExecute) {
        // Check price impact
        const priceImpact = this.calculatePriceImpact(order, uniformPrice);
        if (priceImpact <= this.MAX_PRICE_IMPACT) {
          executedOrders.push(order);
          
          // Record execution
          await this.recordExecution(order, uniformPrice);
        } else {
          console.warn(`❌ Order ${order.id} rejected: price impact ${priceImpact}bps > ${this.MAX_PRICE_IMPACT}bps`);
        }
      }
    }
    
    return executedOrders;
  }

  /**
   * Price Impact Calculation
   */
  private calculatePriceImpact(order: MEVOrder, executionPrice: number): number {
    const orderPrice = parseFloat(order.price);
    const impact = Math.abs(executionPrice - orderPrice) / orderPrice * 10000; // basis points
    return impact;
  }

  /**
   * Update Price History
   */
  private updatePriceHistory(orders: MEVOrder[], uniformPrice: number): void {
    const pairs = [...new Set(orders.map(o => o.pair))];
    
    for (const pair of pairs) {
      if (!this.priceHistory.has(pair)) {
        this.priceHistory.set(pair, []);
      }
      
      const history = this.priceHistory.get(pair)!;
      history.push(uniformPrice);
      
      // Keep only last 1000 prices
      if (history.length > 1000) {
        history.splice(0, history.length - 1000);
      }
    }
  }

  /**
   * Helper Methods
   */
  private getCurrentBatchId(): string {
    const batchStart = Math.floor(Date.now() / this.BATCH_AUCTION_DURATION);
    return `batch_${batchStart}`;
  }

  private getOrCreateBatch(batchId: string): BatchAuction {
    if (!this.batchAuctions.has(batchId)) {
      const now = Date.now();
      const batchStart = Math.floor(now / this.BATCH_AUCTION_DURATION) * this.BATCH_AUCTION_DURATION;
      
      const batch: BatchAuction = {
        id: batchId,
        startTime: batchStart,
        endTime: batchStart + this.BATCH_AUCTION_DURATION,
        orders: [],
        executed: false
      };
      
      this.batchAuctions.set(batchId, batch);
      console.log(`📦 Created new batch: ${batchId} (ends in ${this.BATCH_AUCTION_DURATION}ms)`);
    }
    
    return this.batchAuctions.get(batchId)!;
  }

  private cleanupBatch(batchId: string): void {
    this.batchAuctions.delete(batchId);
  }

  private generateCommitment(order: MEVOrder, signature: string): string {
    return createHash('sha256')
      .update(JSON.stringify({
        userId: order.userId,
        pair: order.pair,
        side: order.side,
        amount: order.amount,
        price: order.price,
        nonce: order.nonce,
        signature
      }))
      .digest('hex');
  }

  private generateCommitmentId(userId: string, commitment: string): string {
    return createHash('sha256')
      .update(userId + commitment + Date.now() + randomBytes(4).toString('hex'))
      .digest('hex');
  }

  private async getCurrentBlockNumber(): Promise<number> {
    // HyperEVM 블록 번호 조회 (간단화)
    return Math.floor(Date.now() / 1000);
  }

  private async verifyOrderSignature(order: MEVOrder, signature: string): Promise<boolean> {
    // EIP-712 서명 검증 (간단화)
    return signature.length > 0;
  }

  private async recordSuspiciousActivity(userId: string, type: string): Promise<void> {
    const record = {
      userId,
      type,
      timestamp: Date.now()
    };
    
    await this.redis.zadd('suspicious_activity', Date.now(), JSON.stringify(record));
    console.warn(`🚨 Suspicious activity: ${userId} - ${type}`);
  }

  private async handleMEVAttempt(userId: string, patterns: MEVAttackPattern[]): Promise<void> {
    const record = {
      userId,
      patterns: patterns.map(p => ({ type: p.type, confidence: p.confidence })),
      timestamp: Date.now()
    };
    
    await this.redis.zadd('mev_attempts', Date.now(), JSON.stringify(record));
    
    // Increase user's MEV score
    const currentScore = await this.redis.get(`mev_score:${userId}`);
    const newScore = (parseInt(currentScore || '0') + 1);
    await this.redis.setex(`mev_score:${userId}`, 3600, newScore.toString());
    
    console.warn(`🛡️ MEV attempt blocked: ${userId} (score: ${newScore})`);
  }

  private async recordExecution(order: MEVOrder, price: number): Promise<void> {
    const execution = {
      orderId: order.id,
      userId: order.userId,
      pair: order.pair,
      executedPrice: price,
      originalPrice: order.price,
      amount: order.amount,
      timestamp: Date.now()
    };
    
    await this.redis.zadd(`executions:${order.pair}`, Date.now(), JSON.stringify(execution));
  }

  private startMEVDetection(): void {
    // Update recent orders for MEV detection
    setInterval(() => {
      this.cleanupOldOrders();
    }, 10000); // Every 10 seconds
  }

  private cleanupOldOrders(): void {
    const cutoffTime = Date.now() - 60000; // 1 minute ago
    
    for (const [pair, orders] of this.recentOrders) {
      const recentOrders = orders.filter(o => o.timestamp > cutoffTime);
      this.recentOrders.set(pair, recentOrders);
    }
  }

  private startStatsCollection(): void {
    setInterval(() => {
      console.log('📊 MEV Protection Stats:', {
        commitments: this.stats.totalCommitments,
        reveals: this.stats.totalReveals,
        blockedMEV: this.stats.blockedMEVAttempts,
        avgRevealTime: `${this.stats.avgCommitRevealTime.toFixed(0)}ms`,
        batchesExecuted: this.stats.batchAuctionsExecuted
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Get MEV Protection Statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeBatches: this.batchAuctions.size,
      pendingCommitments: this.commitments.size,
      protectionEffectiveness: this.stats.totalReveals > 0 
        ? ((this.stats.blockedMEVAttempts / this.stats.totalReveals) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down MEV Protection System...');
    
    // Process remaining batches
    const activeBatches = Array.from(this.batchAuctions.keys());
    for (const batchId of activeBatches) {
      await this.executeBatchAuction(batchId);
    }
    
    await this.redis.quit();
    console.log('✅ MEV Protection System shutdown complete');
  }
}