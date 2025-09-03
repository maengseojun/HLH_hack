// lib/market/real-time-adaptation-engine.ts
/**
 * Real-Time Market Adaptation Engine
 * 시장 조건에 따른 동적 라우팅 및 전략 최적화
 */

export interface MarketIndicator {
  name: string;
  value: number;
  timestamp: number;
  source: string;
  confidence: number; // 0-100
  trend: 'up' | 'down' | 'sideways';
}

export interface MarketSnapshot {
  timestamp: number;
  overall: {
    sentiment: number; // -100 to 100
    volatility: number; // 0-100
    liquidity: number; // 0-100
    trend: 'bullish' | 'bearish' | 'neutral';
  };
  assets: {
    [symbol: string]: {
      price: number;
      change24h: number;
      volume24h: number;
      liquidityScore: number;
      volatilityScore: number;
      technicalScore: number; // -100 to 100
    };
  };
  chains: {
    [chainId: string]: {
      gasPrice: number;
      congestion: number; // 0-100
      successRate: number; // 0-100
      avgConfirmTime: number; // seconds
    };
  };
}

export interface AdaptationStrategy {
  id: string;
  name: string;
  trigger: {
    conditions: MarketCondition[];
    operator: 'AND' | 'OR';
  };
  adaptations: {
    routingChanges?: RoutingAdaptation;
    gasStrategy?: GasAdaptation;
    slippageAdjustment?: SlippageAdaptation;
    chainPreference?: ChainAdaptation;
    pauseConditions?: PauseCondition[];
  };
  priority: number;
  isActive: boolean;
}

export interface MarketCondition {
  type: 'volatility' | 'liquidity' | 'gas_price' | 'sentiment' | 'technical';
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'between';
  value: number | [number, number];
  asset?: string;
  chain?: string;
  duration?: number; // minutes - 조건이 지속되어야 하는 시간
}

export interface RoutingAdaptation {
  preferredDEXs: string[];
  avoidDEXs: string[];
  maxSlippage: number;
  minLiquidity: number;
  splitThreshold: number; // 이 금액 이상에서 분할 실행
}

export interface GasAdaptation {
  strategy: 'conservative' | 'normal' | 'aggressive';
  maxGasPrice: number; // gwei
  gasMultiplier: number; // 기본 가스비에 곱할 배수
  waitForCheapGas: boolean;
  maxWaitTime: number; // minutes
}

export interface SlippageAdaptation {
  baseSlippage: number; // basis points
  volatilityMultiplier: number;
  maxSlippage: number;
  dynamicAdjustment: boolean;
}

export interface ChainAdaptation {
  preferredChains: string[];
  avoidChains: string[];
  congestionThreshold: number;
  costThreshold: number; // USD
}

export interface PauseCondition {
  type: 'extreme_volatility' | 'network_congestion' | 'low_liquidity' | 'high_gas';
  threshold: number;
  duration: number; // minutes to pause
}

export interface AdaptationResult {
  strategyApplied: string;
  adaptations: {
    routing?: any;
    gas?: any;
    slippage?: any;
    chain?: any;
  };
  estimatedImprovement: {
    costReduction: number; // percentage
    successRate: number; // percentage  
    timeReduction: number; // percentage
  };
  confidence: number;
}

/**
 * 실시간 시장 적응 엔진
 */
export class RealTimeAdaptationEngine {
  private marketSnapshot: MarketSnapshot | null = null;
  private strategies: AdaptationStrategy[] = [];
  private indicators: Map<string, MarketIndicator[]> = new Map();
  private adaptationHistory: Map<string, AdaptationResult[]> = new Map();
  
  // 데이터 소스들
  private readonly DATA_SOURCES = {
    price: ['coingecko', 'coinmarketcap', 'dexscreener'],
    gas: ['ethgasstation', 'blocknative', 'defipulse'],
    onchain: ['dune', 'nansen', 'thegraph'],
    social: ['twitter', 'reddit', 'telegram']
  };

  // 기본 적응 전략들
  private readonly DEFAULT_STRATEGIES: AdaptationStrategy[] = [
    {
      id: 'high_volatility_protection',
      name: 'High Volatility Protection',
      trigger: {
        conditions: [
          { type: 'volatility', operator: '>', value: 70 }
        ],
        operator: 'AND'
      },
      adaptations: {
        slippageAdjustment: {
          baseSlippage: 100, // 1%
          volatilityMultiplier: 1.5,
          maxSlippage: 300, // 3%
          dynamicAdjustment: true
        },
        gasStrategy: {
          strategy: 'conservative',
          maxGasPrice: 50,
          gasMultiplier: 1.2,
          waitForCheapGas: false,
          maxWaitTime: 10
        }
      },
      priority: 1,
      isActive: true
    },
    {
      id: 'gas_optimization',
      name: 'Gas Price Optimization',
      trigger: {
        conditions: [
          { type: 'gas_price', operator: '>', value: 30, chain: 'ethereum' }
        ],
        operator: 'AND'
      },
      adaptations: {
        chainPreference: {
          preferredChains: ['polygon', 'bsc', 'arbitrum'],
          avoidChains: ['ethereum'],
          congestionThreshold: 80,
          costThreshold: 10
        },
        gasStrategy: {
          strategy: 'conservative',
          maxGasPrice: 25,
          gasMultiplier: 0.9,
          waitForCheapGas: true,
          maxWaitTime: 30
        }
      },
      priority: 2,
      isActive: true
    },
    {
      id: 'liquidity_crisis',
      name: 'Liquidity Crisis Management',
      trigger: {
        conditions: [
          { type: 'liquidity', operator: '<', value: 30 }
        ],
        operator: 'AND'
      },
      adaptations: {
        routingChanges: {
          preferredDEXs: ['uniswap-v3', 'curve'],
          avoidDEXs: ['low-liquidity-dexs'],
          maxSlippage: 50, // 0.5%
          minLiquidity: 100000,
          splitThreshold: 1000
        },
        pauseConditions: [
          {
            type: 'low_liquidity',
            threshold: 10,
            duration: 15
          }
        ]
      },
      priority: 3,
      isActive: true
    }
  ];

  constructor() {
    this.strategies = [...this.DEFAULT_STRATEGIES];
    this.startMarketMonitoring();
  }

  /**
   * 시장 모니터링 시작
   */
  private startMarketMonitoring() {
    // 실시간 시장 데이터 수집
    setInterval(() => {
      this.updateMarketSnapshot();
    }, 30000); // 30초마다

    // 적응 전략 평가
    setInterval(() => {
      this.evaluateAdaptationStrategies();
    }, 60000); // 1분마다

    console.log('📊 Real-time market monitoring started');
  }

  /**
   * 시장 스냅샷 업데이트
   */
  private async updateMarketSnapshot(): Promise<void> {
    try {
      // 실제로는 여러 데이터 소스에서 병렬로 수집
      const [priceData, gasData, onChainData] = await Promise.all([
        this.fetchPriceData(),
        this.fetchGasData(),
        this.fetchOnChainData()
      ]);

      this.marketSnapshot = {
        timestamp: Date.now(),
        overall: {
          sentiment: this.calculateOverallSentiment(priceData),
          volatility: this.calculateVolatility(priceData),
          liquidity: this.calculateLiquidity(onChainData),
          trend: this.determineTrend(priceData)
        },
        assets: priceData.assets,
        chains: gasData.chains
      };

      // 지표 업데이트
      this.updateIndicators();

    } catch (error) {
      console.error('❌ Failed to update market snapshot:', error);
    }
  }

  /**
   * 시장 조건 기반 적응 실행
   */
  public async adaptToMarketConditions(
    userIntent: string,
    userAddress: string
  ): Promise<AdaptationResult> {
    console.log('🎯 Adapting to current market conditions...');

    if (!this.marketSnapshot) {
      await this.updateMarketSnapshot();
    }

    try {
      // 1. 현재 시장 조건 분석
      const currentConditions = this.analyzeCurrentConditions();

      // 2. 적용 가능한 전략 찾기
      const applicableStrategies = this.findApplicableStrategies(currentConditions);

      // 3. 최적 전략 선택
      const selectedStrategy = this.selectOptimalStrategy(applicableStrategies);

      // 4. 적응 실행
      const adaptationResult = await this.executeAdaptation(selectedStrategy, userIntent);

      // 5. 결과 기록
      this.recordAdaptation(userAddress, adaptationResult);

      console.log('✅ Market adaptation completed:', {
        strategy: adaptationResult.strategyApplied,
        improvements: adaptationResult.estimatedImprovement
      });

      return adaptationResult;

    } catch (error) {
      console.error('❌ Market adaptation failed:', error);
      
      return {
        strategyApplied: 'default',
        adaptations: {},
        estimatedImprovement: {
          costReduction: 0,
          successRate: 0,
          timeReduction: 0
        },
        confidence: 0
      };
    }
  }

  /**
   * 현재 시장 조건 분석
   */
  private analyzeCurrentConditions(): { [key: string]: any } {
    if (!this.marketSnapshot) return {};

    const conditions = {
      volatility: this.marketSnapshot.overall.volatility,
      sentiment: this.marketSnapshot.overall.sentiment,
      liquidity: this.marketSnapshot.overall.liquidity,
      gasPrice: {
        ethereum: this.marketSnapshot.chains['ethereum']?.gasPrice || 20,
        polygon: this.marketSnapshot.chains['polygon']?.gasPrice || 30,
        bsc: this.marketSnapshot.chains['bsc']?.gasPrice || 5
      },
      congestion: {
        ethereum: this.marketSnapshot.chains['ethereum']?.congestion || 50,
        polygon: this.marketSnapshot.chains['polygon']?.congestion || 30,
        bsc: this.marketSnapshot.chains['bsc']?.congestion || 20
      }
    };

    return conditions;
  }

  /**
   * 적용 가능한 전략 찾기
   */
  private findApplicableStrategies(conditions: { [key: string]: any }): AdaptationStrategy[] {
    return this.strategies.filter(strategy => {
      if (!strategy.isActive) return false;

      const conditionsMatch = strategy.trigger.conditions.every(condition => {
        return this.evaluateCondition(condition, conditions);
      });

      return strategy.trigger.operator === 'AND' ? conditionsMatch : 
             strategy.trigger.conditions.some(condition => this.evaluateCondition(condition, conditions));
    });
  }

  /**
   * 조건 평가
   */
  private evaluateCondition(condition: MarketCondition, currentConditions: { [key: string]: any }): boolean {
    let currentValue: number;

    switch (condition.type) {
      case 'volatility':
        currentValue = currentConditions.volatility;
        break;
      case 'liquidity':
        currentValue = currentConditions.liquidity;
        break;
      case 'sentiment':
        currentValue = currentConditions.sentiment;
        break;
      case 'gas_price':
        currentValue = condition.chain ? 
          currentConditions.gasPrice[condition.chain] : 
          Math.max(...Object.values(currentConditions.gasPrice));
        break;
      default:
        return false;
    }

    const targetValue = condition.value;

    switch (condition.operator) {
      case '>':
        return currentValue > (targetValue as number);
      case '<':
        return currentValue < (targetValue as number);
      case '>=':
        return currentValue >= (targetValue as number);
      case '<=':
        return currentValue <= (targetValue as number);
      case '==':
        return currentValue === (targetValue as number);
      case 'between':
        const [min, max] = targetValue as [number, number];
        return currentValue >= min && currentValue <= max;
      default:
        return false;
    }
  }

  /**
   * 최적 전략 선택
   */
  private selectOptimalStrategy(strategies: AdaptationStrategy[]): AdaptationStrategy | null {
    if (strategies.length === 0) return null;

    // 우선순위가 높은 전략 선택
    return strategies.reduce((best, current) => 
      current.priority < best.priority ? current : best
    );
  }

  /**
   * 적응 실행
   */
  private async executeAdaptation(
    strategy: AdaptationStrategy | null,
    userIntent: string
  ): Promise<AdaptationResult> {
    
    if (!strategy) {
      return {
        strategyApplied: 'none',
        adaptations: {},
        estimatedImprovement: { costReduction: 0, successRate: 0, timeReduction: 0 },
        confidence: 0
      };
    }

    console.log(`🔄 Applying adaptation strategy: ${strategy.name}`);

    const adaptations: any = {};
    let totalImprovement = { costReduction: 0, successRate: 0, timeReduction: 0 };

    // 라우팅 적응
    if (strategy.adaptations.routingChanges) {
      adaptations.routing = this.applyRoutingAdaptation(strategy.adaptations.routingChanges);
      totalImprovement.costReduction += 10;
      totalImprovement.successRate += 15;
    }

    // 가스 전략 적응
    if (strategy.adaptations.gasStrategy) {
      adaptations.gas = this.applyGasAdaptation(strategy.adaptations.gasStrategy);
      totalImprovement.costReduction += 25;
      totalImprovement.timeReduction += 20;
    }

    // 슬리피지 적응
    if (strategy.adaptations.slippageAdjustment) {
      adaptations.slippage = this.applySlippageAdaptation(strategy.adaptations.slippageAdjustment);
      totalImprovement.successRate += 20;
    }

    // 체인 선호도 적응
    if (strategy.adaptations.chainPreference) {
      adaptations.chain = this.applyChainAdaptation(strategy.adaptations.chainPreference);
      totalImprovement.costReduction += 30;
      totalImprovement.timeReduction += 25;
    }

    return {
      strategyApplied: strategy.name,
      adaptations,
      estimatedImprovement: totalImprovement,
      confidence: this.calculateAdaptationConfidence(strategy, adaptations)
    };
  }

  /**
   * 라우팅 적응 적용
   */
  private applyRoutingAdaptation(routing: RoutingAdaptation): any {
    return {
      preferredDEXs: routing.preferredDEXs,
      maxSlippage: routing.maxSlippage,
      splitLargeOrders: true,
      liquidityCheck: true
    };
  }

  /**
   * 가스 적응 적용
   */
  private applyGasAdaptation(gas: GasAdaptation): any {
    const currentGasPrice = this.marketSnapshot?.chains['ethereum']?.gasPrice || 20;
    
    return {
      strategy: gas.strategy,
      targetGasPrice: Math.min(currentGasPrice * gas.gasMultiplier, gas.maxGasPrice),
      waitForBetterPrice: gas.waitForCheapGas && currentGasPrice > gas.maxGasPrice,
      maxWaitTime: gas.maxWaitTime
    };
  }

  /**
   * 슬리피지 적응 적용
   */
  private applySlippageAdaptation(slippage: SlippageAdaptation): any {
    const volatility = this.marketSnapshot?.overall.volatility || 50;
    const adjustedSlippage = slippage.dynamicAdjustment ? 
      Math.min(slippage.baseSlippage * (1 + volatility / 100 * slippage.volatilityMultiplier), slippage.maxSlippage) :
      slippage.baseSlippage;

    return {
      slippage: adjustedSlippage,
      isDynamic: slippage.dynamicAdjustment,
      volatilityFactor: volatility
    };
  }

  /**
   * 체인 적응 적용
   */
  private applyChainAdaptation(chain: ChainAdaptation): any {
    const chainsInfo = this.marketSnapshot?.chains || {};
    
    // 체인들을 비용과 성능으로 순위 매기기
    const chainRankings = Object.entries(chainsInfo)
      .map(([chainId, info]) => ({
        chainId,
        score: this.calculateChainScore(info),
        congestion: info.congestion
      }))
      .filter(chain => 
        !chain.avoidChains?.includes(chain.chainId) && 
        chain.congestion < chain.congestionThreshold
      )
      .sort((a, b) => b.score - a.score);

    return {
      recommendedChains: chainRankings.slice(0, 3).map(c => c.chainId),
      avoidChains: chain.avoidChains,
      reasoning: 'Cost and performance optimization'
    };
  }

  /**
   * 체인 점수 계산
   */
  private calculateChainScore(chainInfo: any): number {
    const costScore = Math.max(0, 100 - chainInfo.gasPrice);
    const speedScore = Math.max(0, 100 - chainInfo.avgConfirmTime);
    const reliabilityScore = chainInfo.successRate;
    const congestionScore = Math.max(0, 100 - chainInfo.congestion);

    return (costScore * 0.3 + speedScore * 0.2 + reliabilityScore * 0.3 + congestionScore * 0.2);
  }

  /**
   * 적응 신뢰도 계산
   */
  private calculateAdaptationConfidence(strategy: AdaptationStrategy, adaptations: any): number {
    let confidence = 70; // 기본 신뢰도

    // 시장 데이터 품질 고려
    if (this.marketSnapshot && Date.now() - this.marketSnapshot.timestamp < 60000) {
      confidence += 15; // 최신 데이터
    }

    // 전략 우선순위 고려
    confidence += Math.max(0, 10 - strategy.priority * 2);

    // 적응 수 고려
    const adaptationCount = Object.keys(adaptations).length;
    confidence += Math.min(adaptationCount * 3, 15);

    return Math.min(confidence, 95);
  }

  /**
   * 예측 시장 분석
   */
  public async predictMarketConditions(timeHorizon: number): Promise<{
    prediction: MarketSnapshot;
    confidence: number;
    factors: string[];
  }> {
    console.log(`🔮 Predicting market conditions for next ${timeHorizon} minutes`);

    // 실제로는 ML 모델 또는 시계열 분석 사용
    const currentSnapshot = this.marketSnapshot;
    if (!currentSnapshot) {
      throw new Error('No current market data available');
    }

    // 간단한 트렌드 예측
    const volatilityTrend = this.predictVolatilityTrend(timeHorizon);
    const gasPrediction = this.predictGasPrices(timeHorizon);
    const liquidityTrend = this.predictLiquidityTrend(timeHorizon);

    const prediction: MarketSnapshot = {
      ...currentSnapshot,
      timestamp: Date.now() + timeHorizon * 60000,
      overall: {
        ...currentSnapshot.overall,
        volatility: Math.max(0, Math.min(100, currentSnapshot.overall.volatility + volatilityTrend)),
        liquidity: Math.max(0, Math.min(100, currentSnapshot.overall.liquidity + liquidityTrend))
      },
      chains: {
        ...currentSnapshot.chains,
        ethereum: {
          ...currentSnapshot.chains.ethereum,
          gasPrice: Math.max(5, currentSnapshot.chains.ethereum?.gasPrice + gasPrediction.ethereum)
        }
      }
    };

    return {
      prediction,
      confidence: this.calculatePredictionConfidence(timeHorizon),
      factors: ['historical_trends', 'current_momentum', 'on_chain_metrics']
    };
  }

  // Data fetching methods (mocked)

  private async fetchPriceData(): Promise<any> {
    // Mock price data
    return {
      assets: {
        'ETH': {
          price: 3520 + (Math.random() - 0.5) * 100,
          change24h: (Math.random() - 0.5) * 10,
          volume24h: 1500000000,
          liquidityScore: 90,
          volatilityScore: Math.random() * 100,
          technicalScore: (Math.random() - 0.5) * 100
        },
        'BTC': {
          price: 67000 + (Math.random() - 0.5) * 2000,
          change24h: (Math.random() - 0.5) * 8,
          volume24h: 2000000000,
          liquidityScore: 95,
          volatilityScore: Math.random() * 80,
          technicalScore: (Math.random() - 0.5) * 80
        }
      }
    };
  }

  private async fetchGasData(): Promise<any> {
    return {
      chains: {
        'ethereum': {
          gasPrice: 20 + Math.random() * 30,
          congestion: Math.random() * 100,
          successRate: 95 + Math.random() * 5,
          avgConfirmTime: 15 + Math.random() * 30
        },
        'polygon': {
          gasPrice: 30 + Math.random() * 20,
          congestion: Math.random() * 60,
          successRate: 98 + Math.random() * 2,
          avgConfirmTime: 2 + Math.random() * 3
        },
        'bsc': {
          gasPrice: 5 + Math.random() * 10,
          congestion: Math.random() * 50,
          successRate: 97 + Math.random() * 3,
          avgConfirmTime: 3 + Math.random() * 2
        }
      }
    };
  }

  private async fetchOnChainData(): Promise<any> {
    return {
      totalValueLocked: 50000000000 + Math.random() * 10000000000,
      activeUsers: 100000 + Math.random() * 20000,
      transactionVolume: 1000000000 + Math.random() * 200000000
    };
  }

  // Utility methods

  private calculateOverallSentiment(priceData: any): number {
    const assets = Object.values(priceData.assets) as any[];
    const avgChange = assets.reduce((sum, asset) => sum + asset.change24h, 0) / assets.length;
    return Math.max(-100, Math.min(100, avgChange * 10));
  }

  private calculateVolatility(priceData: any): number {
    const assets = Object.values(priceData.assets) as any[];
    const avgVolatility = assets.reduce((sum, asset) => sum + asset.volatilityScore, 0) / assets.length;
    return Math.max(0, Math.min(100, avgVolatility));
  }

  private calculateLiquidity(onChainData: any): number {
    const tvl = onChainData.totalValueLocked;
    const volume = onChainData.transactionVolume;
    return Math.min(100, (tvl / 1000000000) * 2 + (volume / 10000000) * 0.1);
  }

  private determineTrend(priceData: any): 'bullish' | 'bearish' | 'neutral' {
    const sentiment = this.calculateOverallSentiment(priceData);
    if (sentiment > 20) return 'bullish';
    if (sentiment < -20) return 'bearish';
    return 'neutral';
  }

  private updateIndicators(): void {
    if (!this.marketSnapshot) return;

    const indicators: MarketIndicator[] = [
      {
        name: 'overall_sentiment',
        value: this.marketSnapshot.overall.sentiment,
        timestamp: Date.now(),
        source: 'internal',
        confidence: 80,
        trend: this.marketSnapshot.overall.sentiment > 0 ? 'up' : 'down'
      },
      {
        name: 'volatility_index',
        value: this.marketSnapshot.overall.volatility,
        timestamp: Date.now(),
        source: 'internal',
        confidence: 85,
        trend: 'sideways'
      }
    ];

    this.indicators.set('market_overview', indicators);
  }

  private predictVolatilityTrend(timeHorizon: number): number {
    return (Math.random() - 0.5) * 10 * (timeHorizon / 60); // ±10% per hour max
  }

  private predictGasPrices(timeHorizon: number): any {
    return {
      ethereum: (Math.random() - 0.5) * 20 * (timeHorizon / 60),
      polygon: (Math.random() - 0.5) * 10 * (timeHorizon / 60),
      bsc: (Math.random() - 0.5) * 5 * (timeHorizon / 60)
    };
  }

  private predictLiquidityTrend(timeHorizon: number): number {
    return (Math.random() - 0.5) * 5 * (timeHorizon / 60); // ±5% per hour max
  }

  private calculatePredictionConfidence(timeHorizon: number): number {
    // 시간이 길수록 신뢰도 감소
    return Math.max(30, 90 - timeHorizon * 0.5);
  }

  private recordAdaptation(userAddress: string, result: AdaptationResult): void {
    if (!this.adaptationHistory.has(userAddress)) {
      this.adaptationHistory.set(userAddress, []);
    }
    
    const history = this.adaptationHistory.get(userAddress)!;
    history.push({
      ...result,
      timestamp: Date.now()
    } as any);

    // 최근 100개만 유지
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  private evaluateAdaptationStrategies(): void {
    // 전략 성과 평가 및 자동 조정
    console.log('📈 Evaluating adaptation strategies performance...');
  }

  /**
   * 건강상태 체크
   */
  public async healthCheck(): Promise<{
    marketDataAge: number;
    activeStrategies: number;
    indicatorsCount: number;
    adaptationHistory: number;
  }> {
    return {
      marketDataAge: this.marketSnapshot ? Date.now() - this.marketSnapshot.timestamp : -1,
      activeStrategies: this.strategies.filter(s => s.isActive).length,
      indicatorsCount: Array.from(this.indicators.values()).reduce((sum, arr) => sum + arr.length, 0),
      adaptationHistory: Array.from(this.adaptationHistory.values()).reduce((sum, arr) => sum + arr.length, 0)
    };
  }
}

/**
 * 실시간 시장 적응 엔진 싱글톤 인스턴스
 */
export const realTimeAdaptationEngine = new RealTimeAdaptationEngine();