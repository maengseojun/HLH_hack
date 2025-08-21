/**
 * 로드 밸런싱과 장애 복구 시스템
 * Parallel Matching Engine의 고급 기능들
 */

interface ShardHealth {
  id: number;
  load: number;           // 현재 처리 중인 작업 수
  avgLatency: number;     // 평균 처리 시간
  errorRate: number;      // 오류 발생률
  lastHeartbeat: number;  // 마지막 응답 시간
  status: 'healthy' | 'overloaded' | 'failed' | 'recovering';
}

class LoadBalancer {
  private shardHealth = new Map<number, ShardHealth>();
  private readonly MAX_LOAD_PER_SHARD = 1000;
  private readonly MAX_LATENCY = 100; // ms
  private readonly MAX_ERROR_RATE = 0.05; // 5%
  
  /**
   * 🎯 최적의 샤드 선택 (라운드 로빈 + 로드 기반)
   */
  selectOptimalShard(pair: string): number {
    const preferredShard = this.getShardForPair(pair);
    const health = this.shardHealth.get(preferredShard);
    
    // 선호 샤드가 건강하면 사용
    if (health && this.isShardHealthy(health)) {
      return preferredShard;
    }
    
    // 아니면 가장 여유로운 샤드 선택
    return this.selectLeastLoadedShard();
  }
  
  private isShardHealthy(health: ShardHealth): boolean {
    return health.status === 'healthy' &&
           health.load < this.MAX_LOAD_PER_SHARD &&
           health.avgLatency < this.MAX_LATENCY &&
           health.errorRate < this.MAX_ERROR_RATE &&
           (Date.now() - health.lastHeartbeat) < 5000; // 5초 이내 응답
  }
  
  private selectLeastLoadedShard(): number {
    let bestShard = 0;
    let minLoad = Infinity;
    
    for (const [shardId, health] of this.shardHealth) {
      if (this.isShardHealthy(health) && health.load < minLoad) {
        minLoad = health.load;
        bestShard = shardId;
      }
    }
    
    return bestShard;
  }
  
  /**
   * 🔄 동적 재샤딩 (핫 샤드 분산)
   */
  async rebalanceShards(): Promise<void> {
    console.log('⚖️ 샤드 리밸런싱 시작...');
    
    // 과부하 샤드 찾기
    const overloadedShards = Array.from(this.shardHealth.values())
      .filter(health => health.status === 'overloaded');
    
    if (overloadedShards.length === 0) {
      console.log('✅ 모든 샤드가 정상 부하');
      return;
    }
    
    // 여유 샤드 찾기
    const underloadedShards = Array.from(this.shardHealth.values())
      .filter(health => health.status === 'healthy' && health.load < 500)
      .sort((a, b) => a.load - b.load);
    
    // 작업 재분배
    for (const overloaded of overloadedShards) {
      const target = underloadedShards[0];
      if (!target) break;
      
      console.log(`📦 Shard ${overloaded.id} → Shard ${target.id}로 작업 이동`);
      
      // 실제로는 일부 페어를 다른 샤드로 이동
      await this.migratePairs(overloaded.id, target.id, 10); // 10개 페어 이동
      
      // 로드 업데이트
      overloaded.load -= 200;
      target.load += 200;
    }
  }
  
  private async migratePairs(fromShard: number, toShard: number, count: number): Promise<void> {
    // 실제 구현에서는 Redis 데이터를 이동하고 라우팅 테이블을 업데이트
    console.log(`🔄 ${count}개 페어를 Shard ${fromShard}에서 Shard ${toShard}로 이동`);
  }
  
  private getShardForPair(pair: string): number {
    let hash = 0;
    for (let i = 0; i < pair.length; i++) {
      hash = ((hash << 5) - hash) + pair.charCodeAt(i);
    }
    return Math.abs(hash) % 8; // 8개 샤드 가정
  }
}

/**
 * 🚨 장애 복구 시스템
 */
class FailureRecovery {
  private circuitBreakers = new Map<number, CircuitBreaker>();
  private backupShards = new Map<number, number>(); // 메인 → 백업 매핑
  
  constructor() {
    // 각 샤드마다 서킷 브레이커 초기화
    for (let i = 0; i < 8; i++) {
      this.circuitBreakers.set(i, new CircuitBreaker({
        failureThreshold: 5,    // 5회 실패 시 차단
        recoveryTimeout: 30000, // 30초 후 복구 시도
        monitoringPeriod: 60000 // 1분 모니터링 윈도우
      }));
      
      // 백업 샤드 설정 (원형 방식)
      this.backupShards.set(i, (i + 1) % 8);
    }
  }
  
  /**
   * 장애가 발생한 샤드 처리
   */
  async handleShardFailure(failedShardId: number): Promise<void> {
    console.log(`🚨 Shard ${failedShardId} 장애 감지`);
    
    // 1. 서킷 브레이커 활성화
    const circuitBreaker = this.circuitBreakers.get(failedShardId);
    if (circuitBreaker) {
      circuitBreaker.trip(); // 회로 차단
    }
    
    // 2. 백업 샤드로 트래픽 라우팅
    const backupShardId = this.backupShards.get(failedShardId);
    if (backupShardId !== undefined) {
      console.log(`🔄 트래픽을 Shard ${backupShardId}(백업)로 라우팅`);
      await this.routeTrafficToBackup(failedShardId, backupShardId);
    }
    
    // 3. 새로운 워커 스레드 시작
    console.log(`🆕 Shard ${failedShardId} 새 워커 시작`);
    await this.restartWorker(failedShardId);
    
    // 4. 복구 상태 모니터링
    this.startRecoveryMonitoring(failedShardId);
  }
  
  private async routeTrafficToBackup(mainShard: number, backupShard: number): Promise<void> {
    // 라우팅 테이블 업데이트
    console.log(`📋 라우팅 테이블 업데이트: ${mainShard} → ${backupShard}`);
  }
  
  private async restartWorker(shardId: number): Promise<void> {
    // 새 워커 스레드 생성 및 초기화
    console.log(`⚡ Shard ${shardId} 워커 재시작`);
  }
  
  private startRecoveryMonitoring(shardId: number): void {
    const checkInterval = setInterval(async () => {
      const isHealthy = await this.checkShardHealth(shardId);
      
      if (isHealthy) {
        console.log(`✅ Shard ${shardId} 복구 완료`);
        
        // 서킷 브레이커 복구
        const circuitBreaker = this.circuitBreakers.get(shardId);
        if (circuitBreaker) {
          circuitBreaker.reset();
        }
        
        // 트래픽 다시 라우팅
        await this.restoreOriginalRouting(shardId);
        
        clearInterval(checkInterval);
      }
    }, 5000); // 5초마다 체크
  }
  
  private async checkShardHealth(shardId: number): Promise<boolean> {
    // 실제로는 워커에게 핑을 보내고 응답을 확인
    return Math.random() > 0.3; // 70% 확률로 복구됨
  }
  
  private async restoreOriginalRouting(shardId: number): Promise<void> {
    console.log(`🔙 Shard ${shardId}로 트래픽 복구`);
  }
}

/**
 * 🔌 서킷 브레이커 패턴
 */
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private config: {
    failureThreshold: number;
    recoveryTimeout: number;
    monitoringPeriod: number;
  };
  
  constructor(config: any) {
    this.config = config;
  }
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // 복구 시간이 지났는지 확인
      if (Date.now() - this.lastFailureTime > this.config.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        console.log('🔓 서킷 브레이커 반개방 (시험 중)');
      } else {
        throw new Error('서킷 브레이커 개방 - 요청 차단됨');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (_error) {
      this.onFailure();
      throw _error;
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      console.log('✅ 서킷 브레이커 복구 완료');
    }
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
      console.log('🚨 서킷 브레이커 개방 - 장애 임계값 초과');
    }
  }
  
  trip(): void {
    this.state = 'OPEN';
    this.lastFailureTime = Date.now();
  }
  
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
  }
}

/**
 * 📊 실시간 모니터링 시스템
 */
class RealTimeMonitoring {
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
    currentTPS: 0,
    shardUtilization: new Map<number, number>()
  };
  
  startMonitoring(): void {
    console.log('📊 실시간 모니터링 시작');
    
    // 1초마다 메트릭 수집 및 출력
    setInterval(() => {
      this.collectMetrics();
      this.displayMetrics();
      this.checkAlerts();
    }, 1000);
  }
  
  private collectMetrics(): void {
    // 실제로는 각 샤드에서 메트릭을 수집
    this.metrics.currentTPS = Math.floor(Math.random() * 25000); // 0-25K TPS
    this.metrics.averageLatency = Math.random() * 10; // 0-10ms
    
    // 샤드별 활용률
    for (let i = 0; i < 8; i++) {
      this.metrics.shardUtilization.set(i, Math.random() * 100);
    }
  }
  
  private displayMetrics(): void {
    console.clear();
    console.log('🚀 HyperIndex Parallel Matching Engine 대시보드');
    console.log('='.repeat(60));
    console.log(`📈 현재 TPS: ${this.metrics.currentTPS.toLocaleString()}`);
    console.log(`⚡ 평균 지연시간: ${this.metrics.averageLatency.toFixed(2)}ms`);
    console.log('');
    
    console.log('🏗️ 샤드별 활용률:');
    for (const [shardId, utilization] of this.metrics.shardUtilization) {
      const bar = '█'.repeat(Math.floor(utilization / 5));
      const status = utilization > 80 ? '🔥' : utilization > 60 ? '⚠️' : '✅';
      console.log(`   Shard ${shardId}: ${bar.padEnd(20)} ${utilization.toFixed(1)}% ${status}`);
    }
    
    console.log('');
    console.log(`🕐 ${new Date().toLocaleTimeString()}`);
  }
  
  private checkAlerts(): void {
    // 알레르트 조건 체크
    if (this.metrics.currentTPS < 5000) {
      console.log('⚠️  경고: TPS가 목표치(20K)보다 낮음');
    }
    
    if (this.metrics.averageLatency > 50) {
      console.log('⚠️  경고: 지연시간이 높음 (>50ms)');
    }
    
    // 샤드 과부하 체크
    for (const [shardId, utilization] of this.metrics.shardUtilization) {
      if (utilization > 90) {
        console.log(`🚨 알레르트: Shard ${shardId} 과부하 (${utilization.toFixed(1)}%)`);
      }
    }
  }
}

/**
 * 🎭 종합 데모 실행
 */
async function comprehensiveDemo() {
  console.log('🎪 Parallel Matching Engine 종합 데모');
  console.log('='.repeat(50));
  
  const loadBalancer = new LoadBalancer();
  const failureRecovery = new FailureRecovery();
  const monitoring = new RealTimeMonitoring();
  
  // 1. 모니터링 시작
  monitoring.startMonitoring();
  
  // 2. 시뮬레이션된 장애 상황
  setTimeout(async () => {
    console.log('\n💥 시뮬레이션: Shard 3 장애 발생');
    await failureRecovery.handleShardFailure(3);
  }, 5000);
  
  // 3. 리밸런싱 테스트
  setTimeout(async () => {
    console.log('\n⚖️ 시뮬레이션: 로드 리밸런싱');
    await loadBalancer.rebalanceShards();
  }, 10000);
  
  // 15초 후 종료
  setTimeout(() => {
    console.log('\n✅ 데모 완료');
    process.exit(0);
  }, 15000);
}

export { 
  LoadBalancer, 
  FailureRecovery, 
  CircuitBreaker, 
  RealTimeMonitoring,
  comprehensiveDemo 
};

// 실행
if (require.main === module) {
  comprehensiveDemo().catch(console.error);
}