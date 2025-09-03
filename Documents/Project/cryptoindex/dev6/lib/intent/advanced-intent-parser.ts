// lib/intent/advanced-intent-parser.ts
/**
 * Advanced Intent Parser with Conditional Execution
 * 복잡한 의도도 처리 가능한 고급 자연어 처리 시스템
 */

export interface ConditionalRule {
  id: string;
  condition: {
    type: 'price' | 'time' | 'performance' | 'market_condition';
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains';
    value: string | number;
    asset?: string;
  };
  action: {
    type: 'rebalance' | 'sell' | 'buy' | 'pause' | 'notify';
    parameters: { [key: string]: any };
  };
  isActive: boolean;
  createdAt: number;
  lastChecked: number;
}

export interface AdvancedExecutionPlan {
  immediate: {
    actions: IntentAction[];
    estimatedTime: number;
    estimatedCost: string;
  };
  conditional: {
    rules: ConditionalRule[];
    monitoring: {
      interval: number; // minutes
      assets: string[];
      conditions: string[];
    };
  };
  automation: {
    autoRebalance: boolean;
    rebalanceThreshold: number; // percentage
    maxSlippage: number;
    gasOptimization: boolean;
  };
}

export interface IntentAction {
  id: string;
  type: 'create_index' | 'modify_position' | 'set_automation' | 'cross_chain_move';
  description: string;
  parameters: { [key: string]: any };
  dependencies: string[]; // 다른 액션에 대한 의존성
  priority: number; // 1-10
}

export interface MarketCondition {
  type: 'bull' | 'bear' | 'sideways' | 'volatile';
  confidence: number; // 0-100
  indicators: {
    trend: number; // -100 to 100
    volatility: number; // 0-100
    sentiment: number; // -100 to 100
  };
  timeframe: '1h' | '4h' | '1d' | '1w';
}

/**
 * 고급 Intent 파서 클래스
 */
export class AdvancedIntentParser {
  private conditionalRules: Map<string, ConditionalRule[]> = new Map();
  private marketConditionsCache: MarketCondition[] = [];
  
  // 고급 패턴들
  private readonly ADVANCED_PATTERNS = {
    // 조건부 실행
    conditional: {
      priceTarget: /(.+)가\s*(\d+(?:\.\d+)?)\s*(달러|USDC|원)\s*(이상|이하|되면|넘으면)\s*(.+)/i,
      timeCondition: /(매일|매주|매월|.*시간마다|.*분마다)\s*(.+)/i,
      performanceCondition: /수익률이?\s*(\d+(?:\.\d+)?)\s*%\s*(이상|이하|되면|나오면)\s*(.+)/i,
      marketCondition: /(시장이|시세가)\s*(상승|하락|급락|급등)하면\s*(.+)/i,
    },

    // 자동화 설정
    automation: {
      autoRebalance: /자동.*리밸런싱|auto.*rebalance|정기.*조정/i,
      stopLoss: /(손절|stop.*loss|스탑로스)\s*(\d+(?:\.\d+)?)\s*%/i,
      takeProfit: /(수익실현|take.*profit|익절)\s*(\d+(?:\.\d+)?)\s*%/i,
      gasOptimization: /가스.*저렴할?\s*때|gas.*cheap|가스.*최적화/i,
    },

    // 고급 포트폴리오 관리
    advanced: {
      dynamicAllocation: /시장.*상황에.*따라|동적.*배분|adaptive.*allocation/i,
      riskManagement: /위험.*관리|risk.*management|리스크.*조절/i,
      yieldOptimization: /수익.*최적화|yield.*optimization|이자.*극대화/i,
      crossChainArbitrage: /차익거래|arbitrage|가격.*차이.*이용/i,
    }
  };

  /**
   * 고급 Intent 처리
   */
  public async parseAdvancedIntent(
    intentText: string,
    userAddress: string
  ): Promise<AdvancedExecutionPlan> {
    console.log('🧠 Parsing advanced intent:', intentText);

    try {
      // 1. 기본 Intent 분석
      const basicPlan = await this.parseBasicIntent(intentText);

      // 2. 조건부 규칙 추출
      const conditionalRules = await this.extractConditionalRules(intentText);

      // 3. 자동화 설정 추출
      const automationSettings = await this.extractAutomationSettings(intentText);

      // 4. 현재 시장 상황 분석
      const marketConditions = await this.analyzeMarketConditions();

      // 5. 종합 실행 계획 생성
      const executionPlan: AdvancedExecutionPlan = {
        immediate: {
          actions: basicPlan.actions,
          estimatedTime: this.calculateTotalTime(basicPlan.actions),
          estimatedCost: this.calculateTotalCost(basicPlan.actions)
        },
        conditional: {
          rules: conditionalRules,
          monitoring: {
            interval: this.determineMonitoringInterval(conditionalRules),
            assets: this.extractMonitoredAssets(conditionalRules),
            conditions: conditionalRules.map(rule => rule.condition.type)
          }
        },
        automation: automationSettings
      };

      // 6. 조건부 규칙 저장
      if (conditionalRules.length > 0) {
        this.conditionalRules.set(userAddress, conditionalRules);
      }

      console.log('🎯 Advanced execution plan created:', {
        immediateActions: executionPlan.immediate.actions.length,
        conditionalRules: executionPlan.conditional.rules.length,
        automationEnabled: executionPlan.automation.autoRebalance
      });

      return executionPlan;

    } catch (error) {
      console.error('❌ Advanced intent parsing failed:', error);
      throw error;
    }
  }

  /**
   * 조건부 규칙 추출
   */
  private async extractConditionalRules(intentText: string): Promise<ConditionalRule[]> {
    const rules: ConditionalRule[] = [];

    // 가격 조건 검사
    const priceMatch = intentText.match(this.ADVANCED_PATTERNS.conditional.priceTarget);
    if (priceMatch) {
      const [, asset, targetPrice, currency, operator, action] = priceMatch;
      
      rules.push({
        id: `price_${Date.now()}`,
        condition: {
          type: 'price',
          operator: this.convertOperator(operator),
          value: parseFloat(targetPrice),
          asset: this.normalizeAssetName(asset)
        },
        action: {
          type: this.parseActionType(action),
          parameters: { description: action.trim() }
        },
        isActive: true,
        createdAt: Date.now(),
        lastChecked: 0
      });
    }

    // 수익률 조건 검사
    const performanceMatch = intentText.match(this.ADVANCED_PATTERNS.conditional.performanceCondition);
    if (performanceMatch) {
      const [, percentage, operator, action] = performanceMatch;
      
      rules.push({
        id: `performance_${Date.now()}`,
        condition: {
          type: 'performance',
          operator: this.convertOperator(operator),
          value: parseFloat(percentage)
        },
        action: {
          type: this.parseActionType(action),
          parameters: { description: action.trim() }
        },
        isActive: true,
        createdAt: Date.now(),
        lastChecked: 0
      });
    }

    // 시장 상황 조건 검사
    const marketMatch = intentText.match(this.ADVANCED_PATTERNS.conditional.marketCondition);
    if (marketMatch) {
      const [, , marketDirection, action] = marketMatch;
      
      rules.push({
        id: `market_${Date.now()}`,
        condition: {
          type: 'market_condition',
          operator: '==',
          value: this.parseMarketDirection(marketDirection)
        },
        action: {
          type: this.parseActionType(action),
          parameters: { description: action.trim() }
        },
        isActive: true,
        createdAt: Date.now(),
        lastChecked: 0
      });
    }

    // 시간 기반 조건 검사
    const timeMatch = intentText.match(this.ADVANCED_PATTERNS.conditional.timeCondition);
    if (timeMatch) {
      const [, timePattern, action] = timeMatch;
      
      rules.push({
        id: `time_${Date.now()}`,
        condition: {
          type: 'time',
          operator: '>=',
          value: this.parseTimeInterval(timePattern)
        },
        action: {
          type: this.parseActionType(action),
          parameters: { description: action.trim() }
        },
        isActive: true,
        createdAt: Date.now(),
        lastChecked: 0
      });
    }

    return rules;
  }

  /**
   * 자동화 설정 추출
   */
  private async extractAutomationSettings(intentText: string): Promise<AdvancedExecutionPlan['automation']> {
    const settings: AdvancedExecutionPlan['automation'] = {
      autoRebalance: false,
      rebalanceThreshold: 5, // 5% 기본값
      maxSlippage: 100, // 1% 기본값
      gasOptimization: false
    };

    // 자동 리밸런싱 체크
    if (this.ADVANCED_PATTERNS.automation.autoRebalance.test(intentText)) {
      settings.autoRebalance = true;
      
      // 리밸런싱 임계값 추출
      const thresholdMatch = intentText.match(/(\d+(?:\.\d+)?)\s*%.*차이/i);
      if (thresholdMatch) {
        settings.rebalanceThreshold = parseFloat(thresholdMatch[1]);
      }
    }

    // 손절 설정
    const stopLossMatch = intentText.match(this.ADVANCED_PATTERNS.automation.stopLoss);
    if (stopLossMatch) {
      settings.autoRebalance = true; // 손절도 자동화의 일종
      // 손절 로직 구현...
    }

    // 익절 설정
    const takeProfitMatch = intentText.match(this.ADVANCED_PATTERNS.automation.takeProfit);
    if (takeProfitMatch) {
      settings.autoRebalance = true;
      // 익절 로직 구현...
    }

    // 가스 최적화
    if (this.ADVANCED_PATTERNS.automation.gasOptimization.test(intentText)) {
      settings.gasOptimization = true;
    }

    return settings;
  }

  /**
   * 기본 Intent 파싱
   */
  private async parseBasicIntent(intentText: string): Promise<{ actions: IntentAction[] }> {
    const actions: IntentAction[] = [];

    // 기본 투자 의도 파싱
    const investmentMatch = intentText.match(/(\d+(?:\.\d+)?)\s*(?:달러|USDC|usdc|\$)\s*(.+)/i);
    if (investmentMatch) {
      const [, amount, description] = investmentMatch;
      
      actions.push({
        id: `invest_${Date.now()}`,
        type: 'create_index',
        description: `${amount} USDC 투자: ${description}`,
        parameters: {
          amount: parseFloat(amount),
          description: description.trim()
        },
        dependencies: [],
        priority: 1
      });
    }

    // 크로스체인 이동 의도
    if (/체인.*이동|bridge|브릿지/i.test(intentText)) {
      actions.push({
        id: `bridge_${Date.now()}`,
        type: 'cross_chain_move',
        description: '크로스체인 자산 이동',
        parameters: { optimization: true },
        dependencies: [],
        priority: 2
      });
    }

    return { actions };
  }

  /**
   * 시장 상황 분석
   */
  private async analyzeMarketConditions(): Promise<MarketCondition[]> {
    // 실제로는 외부 API에서 시장 데이터 수집
    const mockConditions: MarketCondition[] = [
      {
        type: 'sideways',
        confidence: 75,
        indicators: {
          trend: 5, // 약간 상승
          volatility: 45, // 보통 변동성
          sentiment: 20 // 약간 긍정적
        },
        timeframe: '1d'
      }
    ];

    this.marketConditionsCache = mockConditions;
    return mockConditions;
  }

  /**
   * 조건부 규칙 모니터링 및 실행
   */
  public async monitorConditionalRules(userAddress: string): Promise<{
    triggered: ConditionalRule[];
    executed: number;
  }> {
    const userRules = this.conditionalRules.get(userAddress) || [];
    const triggeredRules: ConditionalRule[] = [];
    let executed = 0;

    for (const rule of userRules.filter(r => r.isActive)) {
      const shouldTrigger = await this.evaluateCondition(rule.condition);
      
      if (shouldTrigger) {
        console.log(`🎯 Conditional rule triggered:`, rule.id);
        triggeredRules.push(rule);
        
        try {
          await this.executeConditionalAction(rule.action, userAddress);
          executed++;
          
          // 일회성 규칙은 비활성화
          if (rule.action.type !== 'notify') {
            rule.isActive = false;
          }
        } catch (error) {
          console.error(`❌ Failed to execute conditional action:`, error);
        }
      }

      rule.lastChecked = Date.now();
    }

    return { triggered: triggeredRules, executed };
  }

  /**
   * 조건 평가
   */
  private async evaluateCondition(condition: ConditionalRule['condition']): Promise<boolean> {
    switch (condition.type) {
      case 'price':
        return await this.evaluatePriceCondition(condition);
      case 'time':
        return this.evaluateTimeCondition(condition);
      case 'performance':
        return await this.evaluatePerformanceCondition(condition);
      case 'market_condition':
        return await this.evaluateMarketCondition(condition);
      default:
        return false;
    }
  }

  /**
   * 가격 조건 평가
   */
  private async evaluatePriceCondition(condition: ConditionalRule['condition']): Promise<boolean> {
    if (!condition.asset) return false;

    // 실제로는 가격 피드에서 현재 가격 조회
    const mockPrice = this.getMockPrice(condition.asset);
    const targetPrice = condition.value as number;

    switch (condition.operator) {
      case '>':
        return mockPrice > targetPrice;
      case '<':
        return mockPrice < targetPrice;
      case '>=':
        return mockPrice >= targetPrice;
      case '<=':
        return mockPrice <= targetPrice;
      case '==':
        return Math.abs(mockPrice - targetPrice) < (targetPrice * 0.01); // 1% 오차
      default:
        return false;
    }
  }

  /**
   * 시간 조건 평가
   */
  private evaluateTimeCondition(condition: ConditionalRule['condition']): boolean {
    const intervalMinutes = condition.value as number;
    const lastExecuted = condition.value as number; // 실제로는 별도 저장
    const minutesPassed = (Date.now() - lastExecuted) / (1000 * 60);
    
    return minutesPassed >= intervalMinutes;
  }

  /**
   * 수익률 조건 평가
   */
  private async evaluatePerformanceCondition(condition: ConditionalRule['condition']): Promise<boolean> {
    // 실제로는 포지션 수익률 계산
    const mockReturn = 12.5; // 12.5% 수익
    const targetReturn = condition.value as number;

    switch (condition.operator) {
      case '>':
        return mockReturn > targetReturn;
      case '<':
        return mockReturn < targetReturn;
      case '>=':
        return mockReturn >= targetReturn;
      case '<=':
        return mockReturn <= targetReturn;
      default:
        return false;
    }
  }

  /**
   * 시장 상황 조건 평가
   */
  private async evaluateMarketCondition(condition: ConditionalRule['condition']): Promise<boolean> {
    const currentMarket = this.marketConditionsCache[0];
    if (!currentMarket) return false;

    const expectedCondition = condition.value as string;
    
    switch (expectedCondition) {
      case 'bull':
        return currentMarket.type === 'bull' || currentMarket.indicators.trend > 30;
      case 'bear':
        return currentMarket.type === 'bear' || currentMarket.indicators.trend < -30;
      case 'volatile':
        return currentMarket.indicators.volatility > 70;
      default:
        return false;
    }
  }

  /**
   * 조건부 액션 실행
   */
  private async executeConditionalAction(
    action: ConditionalRule['action'], 
    userAddress: string
  ): Promise<void> {
    console.log(`🚀 Executing conditional action: ${action.type}`);

    switch (action.type) {
      case 'rebalance':
        await this.executeRebalance(userAddress, action.parameters);
        break;
      case 'sell':
        await this.executeSell(userAddress, action.parameters);
        break;
      case 'buy':
        await this.executeBuy(userAddress, action.parameters);
        break;
      case 'notify':
        await this.sendNotification(userAddress, action.parameters);
        break;
      case 'pause':
        await this.pauseAutomation(userAddress);
        break;
    }
  }

  // Utility Methods

  private convertOperator(operator: string): ConditionalRule['condition']['operator'] {
    const operatorMap: { [key: string]: ConditionalRule['condition']['operator'] } = {
      '이상': '>=',
      '이하': '<=',
      '되면': '>=',
      '넘으면': '>',
      '아래': '<'
    };
    
    return operatorMap[operator] || '>=';
  }

  private normalizeAssetName(asset: string): string {
    const assetMap: { [key: string]: string } = {
      '이더리움': 'ETH',
      '이더': 'ETH',
      '비트코인': 'BTC',
      '비트': 'BTC',
      '솔라나': 'SOL'
    };
    
    return assetMap[asset] || asset.toUpperCase();
  }

  private parseActionType(action: string): ConditionalRule['action']['type'] {
    if (/매도|팔기|sell/i.test(action)) return 'sell';
    if (/매수|사기|buy/i.test(action)) return 'buy';
    if (/리밸런싱|rebalance/i.test(action)) return 'rebalance';
    if (/중단|pause/i.test(action)) return 'pause';
    return 'notify';
  }

  private parseMarketDirection(direction: string): string {
    const directionMap: { [key: string]: string } = {
      '상승': 'bull',
      '급등': 'bull', 
      '하락': 'bear',
      '급락': 'bear'
    };
    
    return directionMap[direction] || 'sideways';
  }

  private parseTimeInterval(timePattern: string): number {
    if (/매일|daily/i.test(timePattern)) return 24 * 60; // 24시간
    if (/매주|weekly/i.test(timePattern)) return 7 * 24 * 60; // 1주
    if (/매월|monthly/i.test(timePattern)) return 30 * 24 * 60; // 30일
    
    const hourMatch = timePattern.match(/(\d+)\s*시간/);
    if (hourMatch) return parseInt(hourMatch[1]) * 60;
    
    const minuteMatch = timePattern.match(/(\d+)\s*분/);
    if (minuteMatch) return parseInt(minuteMatch[1]);
    
    return 60; // 기본값: 1시간
  }

  private calculateTotalTime(actions: IntentAction[]): number {
    return actions.reduce((total, action) => total + (action.priority * 2), 0); // 우선순위 * 2분
  }

  private calculateTotalCost(actions: IntentAction[]): string {
    const baseCost = 5;
    const actionCost = actions.length * 3;
    return `$${baseCost + actionCost - 2}-${baseCost + actionCost + 3}`;
  }

  private determineMonitoringInterval(rules: ConditionalRule[]): number {
    const hasTimeRules = rules.some(r => r.condition.type === 'time');
    const hasPriceRules = rules.some(r => r.condition.type === 'price');
    
    if (hasPriceRules) return 5; // 5분 간격
    if (hasTimeRules) return 60; // 1시간 간격
    return 30; // 기본값: 30분
  }

  private extractMonitoredAssets(rules: ConditionalRule[]): string[] {
    const assets = new Set<string>();
    rules.forEach(rule => {
      if (rule.condition.asset) {
        assets.add(rule.condition.asset);
      }
    });
    return Array.from(assets);
  }

  private getMockPrice(asset: string): number {
    const mockPrices: { [key: string]: number } = {
      'ETH': 3520,
      'BTC': 67000,
      'SOL': 125,
      'WIF': 0.28,
      'BONK': 0.000019
    };
    
    return mockPrices[asset] || 1;
  }

  // Mock execution methods
  private async executeRebalance(userAddress: string, params: any): Promise<void> {
    console.log('🔄 Executing automatic rebalance');
  }

  private async executeSell(userAddress: string, params: any): Promise<void> {
    console.log('💰 Executing conditional sell');
  }

  private async executeBuy(userAddress: string, params: any): Promise<void> {
    console.log('💰 Executing conditional buy');
  }

  private async sendNotification(userAddress: string, params: any): Promise<void> {
    console.log('📱 Sending notification to user');
  }

  private async pauseAutomation(userAddress: string): Promise<void> {
    console.log('⏸️ Pausing automation');
  }

  /**
   * 건강상태 체크
   */
  public async healthCheck(): Promise<{
    activeRules: number;
    monitoringUsers: number;
    lastExecutionTime: number;
  }> {
    let totalRules = 0;
    this.conditionalRules.forEach(rules => {
      totalRules += rules.filter(r => r.isActive).length;
    });

    return {
      activeRules: totalRules,
      monitoringUsers: this.conditionalRules.size,
      lastExecutionTime: Date.now()
    };
  }
}

/**
 * 고급 Intent 파서 싱글톤 인스턴스
 */
export const advancedIntentParser = new AdvancedIntentParser();