/**
 * Performance Monitoring & API Health Checker
 * 실제 외부 API들과 시스템 성능을 모니터링
 */

import { ethers } from 'ethers';

interface APIEndpoint {
  name: string;
  url: string;
  timeout: number;
  retries: number;
  healthCheck: () => Promise<boolean>;
}

interface PerformanceMetrics {
  responseTime: number;
  successRate: number;
  errorRate: number;
  throughput: number;
  lastCheck: Date;
  errors: string[];
}

interface SystemMetrics {
  gasUsage: {
    average: number;
    peak: number;
    transactions: number;
  };
  blockTime: number;
  transactionSpeed: number;
  memoryUsage: number;
  cpuUsage: number;
}

class PerformanceMonitor {
  private apiEndpoints: Map<string, APIEndpoint> = new Map();
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private systemMetrics: SystemMetrics = {
    gasUsage: { average: 0, peak: 0, transactions: 0 },
    blockTime: 0,
    transactionSpeed: 0,
    memoryUsage: 0,
    cpuUsage: 0
  };

  constructor() {
    this.initializeAPIEndpoints();
    this.startMonitoring();
  }

  /**
   * 실제 사용할 외부 API 엔드포인트들 초기화
   */
  private initializeAPIEndpoints() {
    // 1inch Aggregator API
    this.apiEndpoints.set('1inch', {
      name: '1inch Aggregator',
      url: 'https://api.1inch.io/v5.0/1/quote',
      timeout: 5000,
      retries: 3,
      healthCheck: async () => {
        try {
          const response = await fetch(
            'https://api.1inch.io/v5.0/1/quote?fromTokenAddress=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&toTokenAddress=0xA0b86a33E6441d1b1B80BB51e3ee7C80E60b0E00&amount=1000000000000000000',
            { 
              method: 'GET',
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(5000)
            }
          );
          return response.ok;
        } catch {
          return false;
        }
      }
    });

    // LayerZero API (실제 엔드포인트는 LayerZero Labs에서 제공)
    this.apiEndpoints.set('layerzero', {
      name: 'LayerZero Messaging',
      url: 'https://api.layerzero.network/v1',
      timeout: 10000,
      retries: 3,
      healthCheck: async () => {
        try {
          // LayerZero의 실제 health check endpoint를 사용해야 함
          const response = await fetch('https://api.layerzero.network/v1/status', {
            signal: AbortSignal.timeout(10000)
          });
          return response.ok;
        } catch {
          return false;
        }
      }
    });

    // CoinGecko API (가격 피드용)
    this.apiEndpoints.set('coingecko', {
      name: 'CoinGecko Price Feed',
      url: 'https://api.coingecko.com/api/v3',
      timeout: 3000,
      retries: 2,
      healthCheck: async () => {
        try {
          const response = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
            { signal: AbortSignal.timeout(3000) }
          );
          return response.ok;
        } catch {
          return false;
        }
      }
    });

    // DefiLlama API (TVL 및 프로토콜 데이터)
    this.apiEndpoints.set('defillama', {
      name: 'DefiLlama Protocol Data',
      url: 'https://api.llama.fi',
      timeout: 5000,
      retries: 2,
      healthCheck: async () => {
        try {
          const response = await fetch('https://api.llama.fi/protocols', {
            signal: AbortSignal.timeout(5000)
          });
          return response.ok;
        } catch {
          return false;
        }
      }
    });

    // Hyperliquid API
    this.apiEndpoints.set('hyperliquid', {
      name: 'Hyperliquid Exchange',
      url: 'https://api.hyperliquid.xyz',
      timeout: 8000,
      retries: 3,
      healthCheck: async () => {
        try {
          const response = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'meta' }),
            signal: AbortSignal.timeout(8000)
          });
          return response.ok;
        } catch {
          return false;
        }
      }
    });
  }

  /**
   * 모니터링 시작
   */
  private startMonitoring() {
    // API 상태 체크 (30초마다)
    setInterval(() => this.checkAllAPIs(), 30000);
    
    // 시스템 메트릭스 수집 (10초마다)
    setInterval(() => this.collectSystemMetrics(), 10000);
    
    // 상세 성능 분석 (5분마다)
    setInterval(() => this.performDetailedAnalysis(), 300000);
  }

  /**
   * 모든 API 엔드포인트 상태 체크
   */
  private async checkAllAPIs(): Promise<void> {
    const promises = Array.from(this.apiEndpoints.entries()).map(async ([name, endpoint]) => {
      const startTime = Date.now();
      let success = false;
      let error = '';

      try {
        success = await endpoint.healthCheck();
      } catch (err) {
        error = err instanceof Error ? err.message : 'Unknown error';
      }

      const responseTime = Date.now() - startTime;
      this.updateMetrics(name, responseTime, success, error);
    });

    await Promise.allSettled(promises);
  }

  /**
   * 메트릭스 업데이트
   */
  private updateMetrics(apiName: string, responseTime: number, success: boolean, error: string) {
    const current = this.metrics.get(apiName) || {
      responseTime: 0,
      successRate: 100,
      errorRate: 0,
      throughput: 0,
      lastCheck: new Date(),
      errors: []
    };

    // 이동 평균으로 응답 시간 계산
    current.responseTime = (current.responseTime * 0.9) + (responseTime * 0.1);
    
    // 성공률 계산 (최근 100회 기준)
    current.successRate = (current.successRate * 0.99) + (success ? 1 : 0);
    current.errorRate = 100 - current.successRate;
    
    current.lastCheck = new Date();
    
    if (!success && error) {
      current.errors.push(`${new Date().toISOString()}: ${error}`);
      if (current.errors.length > 10) {
        current.errors.shift(); // 최근 10개 오류만 유지
      }
    }

    this.metrics.set(apiName, current);
  }

  /**
   * 시스템 메트릭스 수집
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      // 메모리 사용량
      if (typeof process !== 'undefined') {
        const memUsage = process.memoryUsage();
        this.systemMetrics.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
      }

      // 블록체인 메트릭스 (실제 provider가 있을 때)
      // const provider = new ethers.providers.JsonRpcProvider();
      // const blockNumber = await provider.getBlockNumber();
      // const block = await provider.getBlock(blockNumber);
      // this.systemMetrics.blockTime = block.timestamp;

    } catch (error) {
      console.error('System metrics collection failed:', error);
    }
  }

  /**
   * 상세 성능 분석
   */
  private async performDetailedAnalysis(): Promise<void> {
    console.log('\n=== HyperIndex Performance Analysis ===');
    
    // API 상태 리포트
    console.log('\n📡 API Health Status:');
    for (const [name, metrics] of this.metrics.entries()) {
      const status = metrics.successRate > 95 ? '✅' : metrics.successRate > 80 ? '⚠️' : '❌';
      console.log(`${status} ${name}:`);
      console.log(`   Response Time: ${metrics.responseTime.toFixed(0)}ms`);
      console.log(`   Success Rate: ${metrics.successRate.toFixed(1)}%`);
      console.log(`   Last Check: ${metrics.lastCheck.toLocaleString()}`);
      
      if (metrics.errors.length > 0) {
        console.log(`   Recent Errors: ${metrics.errors.slice(-3).join(', ')}`);
      }
    }

    // 시스템 성능 리포트
    console.log('\n🖥️ System Performance:');
    console.log(`   Memory Usage: ${this.systemMetrics.memoryUsage.toFixed(1)} MB`);
    console.log(`   Gas Usage (Avg): ${this.systemMetrics.gasUsage.average}`);
    console.log(`   Gas Usage (Peak): ${this.systemMetrics.gasUsage.peak}`);

    // 경고 및 권장사항
    this.generateRecommendations();
  }

  /**
   * 성능 권장사항 생성
   */
  private generateRecommendations(): void {
    console.log('\n💡 Performance Recommendations:');
    
    for (const [name, metrics] of this.metrics.entries()) {
      if (metrics.responseTime > 5000) {
        console.log(`⚠️ ${name}: Response time too high (${metrics.responseTime.toFixed(0)}ms). Consider implementing caching or switching providers.`);
      }
      
      if (metrics.successRate < 95) {
        console.log(`❌ ${name}: Low success rate (${metrics.successRate.toFixed(1)}%). Implement retry logic and fallback providers.`);
      }
      
      if (metrics.errorRate > 10) {
        console.log(`🚨 ${name}: High error rate (${metrics.errorRate.toFixed(1)}%). Check API key limits and rate limiting.`);
      }
    }

    if (this.systemMetrics.memoryUsage > 500) {
      console.log('🧠 High memory usage detected. Consider implementing memory optimization.');
    }

    if (this.systemMetrics.gasUsage.average > 500000) {
      console.log('⛽ High gas usage detected. Consider optimizing smart contract interactions.');
    }
  }

  /**
   * 특정 API 성능 테스트
   */
  async testAPIPerformance(apiName: string, iterations: number = 10): Promise<void> {
    const endpoint = this.apiEndpoints.get(apiName);
    if (!endpoint) {
      console.error(`API ${apiName} not found`);
      return;
    }

    console.log(`\n🧪 Testing ${apiName} performance (${iterations} iterations)...`);
    
    const results: number[] = [];
    let successes = 0;

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      try {
        const success = await endpoint.healthCheck();
        const duration = Date.now() - start;
        results.push(duration);
        if (success) successes++;
      } catch (error) {
        results.push(Date.now() - start);
      }
    }

    const avgTime = results.reduce((a, b) => a + b, 0) / results.length;
    const minTime = Math.min(...results);
    const maxTime = Math.max(...results);
    const successRate = (successes / iterations) * 100;

    console.log(`📊 Results for ${apiName}:`);
    console.log(`   Average: ${avgTime.toFixed(0)}ms`);
    console.log(`   Min: ${minTime}ms`);
    console.log(`   Max: ${maxTime}ms`);
    console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
  }

  /**
   * 크리티컬 API 체크 (거래 전 필수 확인)
   */
  async checkCriticalAPIs(): Promise<{ ready: boolean; issues: string[] }> {
    const critical = ['1inch', 'hyperliquid', 'coingecko'];
    const issues: string[] = [];

    for (const apiName of critical) {
      const metrics = this.metrics.get(apiName);
      if (!metrics || metrics.successRate < 90) {
        issues.push(`${apiName} is experiencing issues (${metrics?.successRate.toFixed(1)}% success rate)`);
      }
      
      if (metrics && metrics.responseTime > 10000) {
        issues.push(`${apiName} response time too high (${metrics.responseTime.toFixed(0)}ms)`);
      }
    }

    return {
      ready: issues.length === 0,
      issues
    };
  }

  /**
   * API 의존성 체크
   */
  async checkDependencies(): Promise<void> {
    console.log('\n🔗 Checking API Dependencies...');
    
    // 1inch Aggregator 의존성
    console.log('\n📈 1inch Aggregator Dependency:');
    console.log('   - Used for: Optimal swap routing');
    console.log('   - Fallbacks: 0x Protocol, Paraswap, Direct DEX');
    console.log('   - Risk: High (core trading functionality)');
    
    // LayerZero 의존성
    console.log('\n🌉 LayerZero Messaging Dependency:');
    console.log('   - Used for: Cross-chain communication');
    console.log('   - Fallbacks: Axelar, Wormhole, Direct bridges');
    console.log('   - Risk: Medium (cross-chain features only)');
    
    // Hyperliquid 의존성
    console.log('\n🚀 Hyperliquid Exchange Dependency:');
    console.log('   - Used for: HyperEVM integration, perpetuals');
    console.log('   - Fallbacks: Direct EVM calls, other perp DEXs');
    console.log('   - Risk: High (core infrastructure)');
    
    // 가격 피드 의존성
    console.log('\n💰 Price Feed Dependencies:');
    console.log('   - Primary: CoinGecko API');
    console.log('   - Fallbacks: Chainlink oracles, DefiLlama, CoinMarketCap');
    console.log('   - Risk: Critical (pricing affects all operations)');
  }

  /**
   * 극한 부하 테스트
   */
  async stressTest(concurrent: number = 50, duration: number = 60000): Promise<void> {
    console.log(`\n🔥 Starting stress test: ${concurrent} concurrent requests for ${duration/1000}s`);
    
    const startTime = Date.now();
    const results: { success: boolean; time: number }[] = [];
    
    const runConcurrentTests = async () => {
      const promises = Array.from({ length: concurrent }, async () => {
        const start = Date.now();
        try {
          const success = await this.apiEndpoints.get('1inch')?.healthCheck();
          return { success: !!success, time: Date.now() - start };
        } catch {
          return { success: false, time: Date.now() - start };
        }
      });
      
      const batchResults = await Promise.allSettled(promises);
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      });
    };

    while (Date.now() - startTime < duration) {
      await runConcurrentTests();
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms between batches
    }

    const totalRequests = results.length;
    const successCount = results.filter(r => r.success).length;
    const avgResponseTime = results.reduce((sum, r) => sum + r.time, 0) / totalRequests;
    const successRate = (successCount / totalRequests) * 100;
    const throughput = totalRequests / (duration / 1000);

    console.log('\n📊 Stress Test Results:');
    console.log(`   Total Requests: ${totalRequests}`);
    console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`   Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`   Throughput: ${throughput.toFixed(1)} req/s`);
    
    if (successRate < 95) {
      console.log('⚠️ WARNING: System may not handle high load reliably');
    }
    
    if (avgResponseTime > 5000) {
      console.log('⚠️ WARNING: Response times too high under load');
    }
  }

  /**
   * 메트릭스 반환
   */
  getMetrics(): Map<string, PerformanceMetrics> {
    return new Map(this.metrics);
  }

  getSystemMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }
}

/**
 * 실제 거래 전 안전성 체크
 */
export class PreTradeValidator {
  private monitor: PerformanceMonitor;

  constructor(monitor: PerformanceMonitor) {
    this.monitor = monitor;
  }

  async validateTradeConditions(tradeParams: {
    amount: string;
    tokenIn: string;
    tokenOut: string;
    slippage: number;
  }): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    // API 상태 체크
    const { ready, issues: apiIssues } = await this.monitor.checkCriticalAPIs();
    if (!ready) {
      issues.push(...apiIssues);
    }

    // 거래 크기 검증
    const amount = parseFloat(tradeParams.amount);
    if (amount > 1000000) { // 1M 이상
      issues.push('Trade size exceeds recommended limits');
    }

    // 슬리피지 검증
    if (tradeParams.slippage > 5) { // 5% 이상
      issues.push('Slippage tolerance too high - potential MEV risk');
    }

    // 시스템 부하 체크
    const systemMetrics = this.monitor.getSystemMetrics();
    if (systemMetrics.memoryUsage > 800) {
      issues.push('System under high memory pressure');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
export const preTradeValidator = new PreTradeValidator(performanceMonitor);

// CLI 실행을 위한 메인 함수
if (require.main === module) {
  console.log('🚀 Starting HyperIndex Performance Monitor...');
  
  // 5초 후 초기 분석 실행
  setTimeout(async () => {
    await performanceMonitor.checkAllAPIs();
    await performanceMonitor.checkDependencies();
    
    // 특정 API 테스트
    await performanceMonitor.testAPIPerformance('1inch', 5);
    await performanceMonitor.testAPIPerformance('hyperliquid', 5);
    
    // 스트레스 테스트 (10초간 10개 동시 요청)
    await performanceMonitor.stressTest(10, 10000);
  }, 5000);
}