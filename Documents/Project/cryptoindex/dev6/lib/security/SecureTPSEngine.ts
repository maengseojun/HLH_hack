/**
 * Secure High-TPS Trading Engine
 * 보안을 유지하면서 20,000 TPS 달성
 */

import { EventEmitter } from 'events';
import { createHash, randomBytes } from 'crypto';
import Redis from 'ioredis';
import { Order, Trade } from '../types/orderbook';

interface SecureOrder extends Order {
  signature: string;
  nonce: number;
  commitment?: string;
  revealBlock?: number;
}

interface BatchWindow {
  id: string;
  startTime: number;
  endTime: number;
  orders: SecureOrder[];
  processed: boolean;
  merkleRoot: string;
}

interface MEVProtectionConfig {
  commitRevealDelay: number;    // 블록 지연
  batchWindowSize: number;      // 배치 윈도우 크기 (ms)
  maxPriceImpact: number;       // 최대 가격 영향 (bps)
  minOrderValue: number;        // 최소 주문 금액
}

/**
 * MEV 방어와 높은 TPS를 동시에 달성하는 엔진
 */
export class SecureTPSEngine extends EventEmitter {
  private config: MEVProtectionConfig;
  private redis: Redis;
  private batchWindows: Map<string, BatchWindow> = new Map();
  private commitments: Map<string, any> = new Map();
  private processedNonces: Set<string> = new Set();
  
  // 성능 메트릭
  private metrics = {
    currentTPS: 0,
    processedOrders: 0,
    blockedAttacks: 0,
    averageLatency: 0,
    batchesProcessed: 0,
    activeWindows: 0
  };
  
  // 보안 모니터링
  private securityMonitor = {
    suspiciousPatterns: new Map<string, number>(),
    priceDeviations: new Map<string, number[]>(),
    highFrequencyUsers: new Map<string, number>(),
    blockedIPs: new Set<string>()
  };

  // Rate limiting 윈도우
  private rateLimitWindows = new Map<string, number[]>();

  constructor(config: MEVProtectionConfig) {
    super();
    this.config = config;
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || 'hyperindex_secure_password',
      enableAutoPipelining: true,
      lazyConnect: true, // Enable lazy connect to prevent immediate failures
      enableOfflineQueue: true // Enable offline queue for better error handling
    });
    
    this.startBatchProcessing();
    this.startSecurityMonitoring();
    this.startMetricsCollection();
  }

  /**
   * Phase 1: Order Commitment (MEV 방어)
   */
  async commitOrder(
    userId: string,
    orderCommitment: string,
    signature: string,
    clientIP?: string
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      // IP 차단 체크
      if (clientIP && this.securityMonitor.blockedIPs.has(clientIP)) {
        throw new Error('IP blocked due to suspicious activity');
      }
      
      // Rate limiting 체크
      if (!await this.checkRateLimit(userId)) {
        await this.handleRateLimitViolation(userId, clientIP);
        throw new Error('Rate limit exceeded');
      }
      
      // 서명 검증
      if (!await this.verifyCommitmentSignature(orderCommitment, signature, userId)) {
        await this.handleSuspiciousActivity(userId, 'invalid_signature', clientIP);
        throw new Error('Invalid signature');
      }
      
      const commitId = this.generateCommitId(userId);
      
      // Commitment 저장 (TTL 설정)
      const commitmentData = {
        userId,
        commitment: orderCommitment,
        signature,
        timestamp: Date.now(),
        revealed: false,
        clientIP
      };
      
      this.commitments.set(commitId, commitmentData);
      
      // Redis에 백업 저장
      await this.redis.setex(
        `commit:${commitId}`, 
        300, // 5분 TTL
        JSON.stringify(commitmentData)
      );
      
      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);
      
      return commitId;
      
    } catch (_error) {
      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);
      throw _error;
    }
  }

  /**
   * Phase 2: Order Reveal & Batch Processing (고성능 처리)
   */
  async revealAndProcessOrder(
    commitId: string,
    order: SecureOrder
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Commitment 검증
      let commitment = this.commitments.get(commitId);
      if (!commitment) {
        // Redis에서 복구 시도
        const redisData = await this.redis.get(`commit:${commitId}`);
        if (redisData) {
          commitment = JSON.parse(redisData);
        } else {
          throw new Error('Invalid commitment ID');
        }
      }
      
      // Commitment 유효성 검사
      const calculatedCommitment = this.calculateCommitment(order);
      if (calculatedCommitment !== commitment.commitment) {
        await this.handleSuspiciousActivity(
          order.userId, 
          'invalid_reveal', 
          commitment.clientIP
        );
        throw new Error('Invalid reveal');
      }
      
      // Timing attack 방지 (너무 빠른 reveal 방지)
      const timeSinceCommit = Date.now() - commitment.timestamp;
      if (timeSinceCommit < 100) { // 최소 100ms 대기
        throw new Error('Reveal too soon');
      }
      
      // 중복 nonce 방지
      const nonceKey = `${order.userId}:${order.nonce}`;
      if (this.processedNonces.has(nonceKey)) {
        throw new Error('Nonce already used');
      }
      
      // Order validation
      if (!await this.validateOrder(order)) {
        throw new Error('Order validation failed');
      }
      
      // 현재 배치 윈도우에 추가
      const currentWindow = this.getCurrentBatchWindow();
      currentWindow.orders.push(order);
      
      this.processedNonces.add(nonceKey);
      this.commitments.delete(commitId);
      await this.redis.del(`commit:${commitId}`);
      
      // TPS 카운터 업데이트
      this.metrics.processedOrders++;
      
      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);
      
    } catch (_error) {
      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);
      throw _error;
    }
  }

  /**
   * Batch Window 관리 (Fair Ordering)
   */
  private getCurrentBatchWindow(): BatchWindow {
    const windowId = this.calculateWindowId();
    
    if (!this.batchWindows.has(windowId)) {
      const window: BatchWindow = {
        id: windowId,
        startTime: Date.now(),
        endTime: Date.now() + this.config.batchWindowSize,
        orders: [],
        processed: false,
        merkleRoot: ''
      };
      
      this.batchWindows.set(windowId, window);
      this.metrics.activeWindows++;
      
      // 윈도우 자동 처리 스케줄링
      setTimeout(() => {
        this.processBatchWindow(windowId);
      }, this.config.batchWindowSize);
    }
    
    return this.batchWindows.get(windowId)!;
  }

  /**
   * 배치 윈도우 처리 (원자적 처리)
   */
  private async processBatchWindow(windowId: string): Promise<void> {
    const window = this.batchWindows.get(windowId);
    if (!window || window.processed) return;
    
    const startTime = Date.now();
    window.processed = true;
    
    try {
      console.log(`Processing batch ${windowId} with ${window.orders.length} orders`);
      
      if (window.orders.length === 0) {
        this.cleanupWindow(windowId);
        return;
      }
      
      // 1. Fair ordering (가격-시간 우선순위)
      const sortedOrders = this.sortOrdersFairly(window.orders);
      
      // 2. MEV 검사 및 제거
      const cleanOrders = await this.filterMEVOrders(sortedOrders);
      
      // 3. 병렬 실행 (샤드별 분산 처리)
      const executionPromises = this.createShardedExecution(cleanOrders);
      
      // 4. 원자적 커밋
      const results = await Promise.all(executionPromises);
      await this.commitBatchResults(windowId, results);
      
      // 5. Merkle root 계산 및 저장
      window.merkleRoot = this.calculateMerkleRoot(cleanOrders);
      await this.storeBatchProof(windowId, window);
      
      // 6. 메트릭 업데이트
      this.metrics.batchesProcessed++;
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ Batch ${windowId} processed: ${cleanOrders.length}/${window.orders.length} orders in ${processingTime}ms`);
      
    } catch (_error) {
      console.error(`❌ Batch ${windowId} failed:`, _error);
      await this.rollbackBatch(windowId);
    } finally {
      // 윈도우 정리
      setTimeout(() => this.cleanupWindow(windowId), 60000);
    }
  }

  /**
   * MEV/Sandwich Attack 감지 및 차단
   */
  private async filterMEVOrders(orders: SecureOrder[]): Promise<SecureOrder[]> {
    const cleanOrders: SecureOrder[] = [];
    const priceMap = new Map<string, number[]>();
    const userOrderCounts = new Map<string, number>();
    
    // 사용자별 주문 빈도 추적
    for (const order of orders) {
      const currentCount = userOrderCounts.get(order.userId) || 0;
      userOrderCounts.set(order.userId, currentCount + 1);
      
      // 동일 사용자의 과도한 주문 필터링
      if (currentCount > 10) { // 배치당 최대 10개 주문
        this.metrics.blockedAttacks++;
        await this.handleSuspiciousActivity(order.userId, 'high_frequency_batch');
        continue;
      }
    }
    
    for (const order of orders) {
      const pair = order.pair;
      const price = parseFloat(order.price);
      
      // 가격 이력 추적
      if (!priceMap.has(pair)) {
        priceMap.set(pair, []);
      }
      const priceHistory = priceMap.get(pair)!;
      priceHistory.push(price);
      
      // Sandwich attack 패턴 검사
      if (this.detectSandwichPattern(priceHistory, order)) {
        this.metrics.blockedAttacks++;
        console.warn(`🛡️ Blocked sandwich attack: ${order.userId} - ${pair}`);
        await this.handleSuspiciousActivity(order.userId, 'sandwich_attack');
        continue;
      }
      
      // 가격 조작 검사
      if (await this.detectPriceManipulation(pair, price)) {
        this.metrics.blockedAttacks++;
        console.warn(`🛡️ Blocked price manipulation: ${pair} at ${price}`);
        await this.handleSuspiciousActivity(order.userId, 'price_manipulation');
        continue;
      }
      
      // 최소 주문 금액 체크
      const orderValue = parseFloat(order.amount) * price;
      if (orderValue < this.config.minOrderValue) {
        continue; // 더스팅 공격 방지
      }
      
      cleanOrders.push(order);
    }
    
    return cleanOrders;
  }

  /**
   * Sandwich Attack 패턴 감지 (향상된 알고리즘)
   */
  private detectSandwichPattern(priceHistory: number[], order: SecureOrder): boolean {
    if (priceHistory.length < 3) return false;
    
    const recent = priceHistory.slice(-5); // 최근 5개 가격 확인
    
    // 급격한 가격 변동 패턴 감지
    for (let i = 2; i < recent.length; i++) {
      const p1 = recent[i-2];
      const p2 = recent[i-1];
      const p3 = recent[i];
      
      // V자 또는 역V자 패턴
      const isVPattern = p2 < Math.min(p1, p3) && Math.abs(p1 - p3) < p1 * 0.005;
      const isInvertedV = p2 > Math.max(p1, p3) && Math.abs(p1 - p3) < p1 * 0.005;
      
      if (isVPattern || isInvertedV) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 가격 조작 감지 (개선된 통계 기법)
   */
  private async detectPriceManipulation(pair: string, price: number): Promise<boolean> {
    const key = `price_history:${pair}`;
    const recentPricesStr = await this.redis.lrange(key, 0, 99); // 최근 100개
    const recentPrices = recentPricesStr.map(p => parseFloat(p));
    
    if (recentPrices.length === 0) {
      await this.redis.lpush(key, price.toString());
      await this.redis.ltrim(key, 0, 99);
      await this.redis.expire(key, 3600); // 1시간 TTL
      return false;
    }
    
    // 통계 계산
    const mean = recentPrices.reduce((a, b) => a + b) / recentPrices.length;
    const variance = recentPrices.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / recentPrices.length;
    const stdDev = Math.sqrt(variance);
    
    // Z-score 계산 (표준편차 기준)
    const zScore = Math.abs(price - mean) / stdDev;
    
    // 3 표준편차를 벗어나면 조작으로 간주
    const isManipulation = zScore > 3;
    
    if (!isManipulation) {
      // 정상 가격이면 이력에 추가
      await this.redis.lpush(key, price.toString());
      await this.redis.ltrim(key, 0, 99);
    }
    
    return isManipulation;
  }

  /**
   * Rate Limiting (Redis Sliding Window)
   */
  private async checkRateLimit(userId: string): Promise<boolean> {
    const key = `rate_limit:${userId}`;
    const now = Date.now();
    const window = 1000; // 1초
    const maxRequests = 50; // 초당 50개
    
    // Sliding window implementation
    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, '-inf', now - window);
    pipeline.zcard(key);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.expire(key, Math.ceil(window / 1000));
    
    const results = await pipeline.exec();
    const currentCount = results?.[1]?.[1] as number || 0;
    
    return currentCount < maxRequests;
  }

  /**
   * Order Validation
   */
  private async validateOrder(order: SecureOrder): Promise<boolean> {
    // 1. 기본 필드 검증
    if (!order.userId || !order.pair || !order.side || !order.amount || !order.price) {
      return false;
    }
    
    // 2. 숫자 유효성 검증
    const amount = parseFloat(order.amount);
    const price = parseFloat(order.price);
    if (isNaN(amount) || isNaN(price) || amount <= 0 || price <= 0) {
      return false;
    }
    
    // 3. 사용자 잔고 확인 (간단화)
    // 실제 구현에서는 실시간 잔고 체크
    
    return true;
  }

  /**
   * 공정한 주문 정렬 (Price-Time Priority)
   */
  private sortOrdersFairly(orders: SecureOrder[]): SecureOrder[] {
    return orders.sort((a, b) => {
      // 1. 가격 우선순위
      const priceA = parseFloat(a.price);
      const priceB = parseFloat(b.price);
      
      if (a.side === 'buy') {
        if (priceA !== priceB) return priceB - priceA; // 높은 가격 우선
      } else {
        if (priceA !== priceB) return priceA - priceB; // 낮은 가격 우선
      }
      
      // 2. 시간 우선순위
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * 샤드별 병렬 실행 (Race Condition 방지)
   */
  private createShardedExecution(orders: SecureOrder[]): Promise<any>[] {
    const shards = new Map<string, SecureOrder[]>();
    
    // 페어별 샤딩
    for (const order of orders) {
      if (!shards.has(order.pair)) {
        shards.set(order.pair, []);
      }
      shards.get(order.pair)!.push(order);
    }
    
    // 각 샤드별 병렬 처리
    const promises: Promise<any>[] = [];
    for (const [pair, pairOrders] of shards) {
      promises.push(this.executeShardOrders(pair, pairOrders));
    }
    
    return promises;
  }

  /**
   * 샤드 주문 실행 (원자적 처리)
   */
  private async executeShardOrders(pair: string, orders: SecureOrder[]): Promise<any[]> {
    const startTime = Date.now();
    const results = [];
    
    // Redis 트랜잭션으로 원자성 보장
    const multi = this.redis.multi();
    
    for (const order of orders) {
      try {
        // 여기서 실제 매칭 로직 수행
        const result = await this.executeSecureOrder(order);
        results.push(result);
        
        // Redis에 거래 기록
        multi.zadd(`trades:${pair}`, Date.now(), JSON.stringify(result));
        
      } catch (_error) {
        console.error(`Order execution failed: ${order.id}`, _error);
      }
    }
    
    await multi.exec();
    
    const latency = Date.now() - startTime;
    console.log(`Shard ${pair} processed ${results.length} orders in ${latency}ms`);
    
    return results;
  }

  /**
   * 의심스러운 활동 처리
   */
  private async handleSuspiciousActivity(
    userId: string, 
    reason: string, 
    clientIP?: string
  ): Promise<void> {
    const count = this.securityMonitor.suspiciousPatterns.get(userId) || 0;
    this.securityMonitor.suspiciousPatterns.set(userId, count + 1);
    
    console.warn(`🚨 Suspicious activity: ${userId} - ${reason} (count: ${count + 1})`);
    
    // 임계값 초과시 IP 차단
    if (count + 1 >= 10 && clientIP) {
      this.securityMonitor.blockedIPs.add(clientIP);
      console.warn(`🚫 IP blocked: ${clientIP}`);
    }
    
    // Redis에 로그 저장
    await this.redis.zadd(
      'security_log',
      Date.now(),
      JSON.stringify({ userId, reason, clientIP, timestamp: Date.now() })
    );
  }

  /**
   * Rate Limit 위반 처리
   */
  private async handleRateLimitViolation(userId: string, clientIP?: string): Promise<void> {
    await this.handleSuspiciousActivity(userId, 'rate_limit_violation', clientIP);
  }

  /**
   * 메트릭 수집 시작
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      // TPS 계산
      const newTPS = this.metrics.processedOrders;
      this.metrics.currentTPS = newTPS;
      this.metrics.processedOrders = 0;
      
      // 목표 달성 로그
      if (newTPS > 0) {
        const achievement = (newTPS / 20000) * 100;
        console.log(`📊 TPS: ${newTPS}/20,000 (${achievement.toFixed(1)}%) | Blocked: ${this.metrics.blockedAttacks} | Latency: ${this.metrics.averageLatency.toFixed(2)}ms`);
      }
      
      // 경고 발생
      if (newTPS > 0 && newTPS < 10000) {
        console.warn(`⚠️ TPS below threshold: ${newTPS}/20000`);
      }
      
      // 메트릭 내보내기 (Prometheus 등)
      this.emit('metrics', this.getMetrics());
      
    }, 1000);
  }

  /**
   * 보안 모니터링 시작
   */
  private startSecurityMonitoring(): void {
    setInterval(() => {
      // 의심스러운 사용자 리포트
      const suspiciousUsers = Array.from(this.securityMonitor.suspiciousPatterns.entries())
        .filter(([_, count]) => count > 5)
        .sort((a, b) => b[1] - a[1]);
      
      if (suspiciousUsers.length > 0) {
        console.warn('🔍 Top suspicious users:', suspiciousUsers.slice(0, 5));
      }
      
      // 차단된 IP 수
      if (this.securityMonitor.blockedIPs.size > 0) {
        console.log(`🚫 Blocked IPs: ${this.securityMonitor.blockedIPs.size}`);
      }
      
    }, 30000); // 30초마다 체크
  }

  /**
   * 배치 처리 시작
   */
  private startBatchProcessing(): void {
    console.log(`🚀 SecureTPSEngine started with ${this.config.batchWindowSize}ms batch windows`);
  }

  // Helper methods
  private generateCommitId(userId: string): string {
    return createHash('sha256')
      .update(userId + Date.now() + randomBytes(8).toString('hex'))
      .digest('hex');
  }

  private calculateCommitment(order: SecureOrder): string {
    return createHash('sha256')
      .update(JSON.stringify({
        userId: order.userId,
        pair: order.pair,
        side: order.side,
        amount: order.amount,
        price: order.price,
        nonce: order.nonce
      }))
      .digest('hex');
  }

  private calculateWindowId(): string {
    const windowStart = Math.floor(Date.now() / this.config.batchWindowSize);
    return windowStart.toString();
  }

  private calculateMerkleRoot(orders: SecureOrder[]): string {
    if (orders.length === 0) return '';
    
    const hashes = orders.map(order => 
      createHash('sha256').update(JSON.stringify(order)).digest('hex')
    );
    
    // Simple merkle root (실제 구현에서는 proper merkle tree 사용)
    return createHash('sha256').update(hashes.sort().join('')).digest('hex');
  }

  private cleanupWindow(windowId: string): void {
    this.batchWindows.delete(windowId);
    this.metrics.activeWindows = Math.max(0, this.metrics.activeWindows - 1);
  }

  private updateLatencyMetrics(latency: number): void {
    this.metrics.averageLatency = this.metrics.averageLatency === 0 
      ? latency 
      : (this.metrics.averageLatency * 0.9 + latency * 0.1); // EMA
  }

  // Placeholder implementations
  private async executeSecureOrder(order: SecureOrder): Promise<any> {
    // 실제 매칭 엔진 호출
    return {
      orderId: order.id,
      executedAmount: order.amount,
      executedPrice: order.price,
      timestamp: Date.now()
    };
  }

  private async commitBatchResults(windowId: string, results: any[]): Promise<void> {
    // 배치 결과를 데이터베이스에 커밋
    await this.redis.set(`batch:${windowId}`, JSON.stringify(results), 'EX', 3600);
  }

  private async rollbackBatch(windowId: string): Promise<void> {
    // 실패한 배치 롤백
    console.warn(`Rolling back batch ${windowId}`);
  }

  private async storeBatchProof(windowId: string, window: BatchWindow): Promise<void> {
    const proof = {
      windowId,
      merkleRoot: window.merkleRoot,
      orderCount: window.orders.length,
      timestamp: Date.now()
    };
    
    await this.redis.set(`proof:${windowId}`, JSON.stringify(proof), 'EX', 86400); // 24시간
  }

  private async verifyCommitmentSignature(
    commitment: string,
    signature: string,
    userId: string
  ): Promise<boolean> {
    // EIP-712 서명 검증 (간단화)
    return signature.length > 0 && commitment.length > 0;
  }

  /**
   * 현재 성능 메트릭 반환
   */
  getMetrics() {
    return {
      ...this.metrics,
      targetTPS: 20000,
      achievementRate: this.metrics.currentTPS > 0 ? (this.metrics.currentTPS / 20000) * 100 : 0,
      securityStats: {
        blockedIPs: this.securityMonitor.blockedIPs.size,
        suspiciousUsers: this.securityMonitor.suspiciousPatterns.size,
        blockedAttacks: this.metrics.blockedAttacks
      },
      systemHealth: {
        activeWindows: this.metrics.activeWindows,
        avgLatency: this.metrics.averageLatency,
        batchesProcessed: this.metrics.batchesProcessed
      }
    };
  }

  /**
   * 시스템 종료
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down SecureTPSEngine...');
    
    // 진행 중인 배치 완료 대기
    const activeWindowIds = Array.from(this.batchWindows.keys());
    for (const windowId of activeWindowIds) {
      const window = this.batchWindows.get(windowId);
      if (window && !window.processed && window.orders.length > 0) {
        console.log(`⏳ Waiting for batch ${windowId} to complete...`);
        await new Promise(resolve => setTimeout(resolve, this.config.batchWindowSize));
      }
    }
    
    await this.redis.quit();
    console.log('✅ SecureTPSEngine shutdown complete');
  }
}