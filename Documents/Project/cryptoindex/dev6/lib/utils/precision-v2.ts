// 개선된 정밀도 시스템 - 가격 9자리, 결제 6자리 체계
// 핵심 원칙: "가격은 세밀하게, 결제는 정확하게"

export interface TradingPairConfig {
  pair: string;
  baseToken: string;
  quoteToken: string;
  priceDecimals: number;    // 가격 정밀도 (9자리)
  baseDecimals: number;     // 기준 토큰 정밀도 (18자리)
  quoteDecimals: number;    // 결제 토큰 정밀도 (6자리)
  minOrderValue: string;    // 최소 주문 금액 (USDC)
  tickSize: string;         // 가격 단위 (0.000000001)
}

// 거래쌍별 정밀도 설정
export const TRADING_PAIR_CONFIGS: Record<string, TradingPairConfig> = {
  'HYPERINDEX-USDC': {
    pair: 'HYPERINDEX-USDC',
    baseToken: 'HYPERINDEX',
    quoteToken: 'USDC',
    priceDecimals: 9,      // 가격은 9자리 (0.123456789 USDC)
    baseDecimals: 18,      // HYPERINDEX는 18자리
    quoteDecimals: 6,      // USDC는 6자리
    minOrderValue: '1.0',  // 최소 1 USDC
    tickSize: '0.000000001' // 1 nano USDC 단위
  },
  'ETH-USDC': {
    pair: 'ETH-USDC',
    baseToken: 'ETH',
    quoteToken: 'USDC',
    priceDecimals: 9,
    baseDecimals: 18,
    quoteDecimals: 6,
    minOrderValue: '5.0',   // 최소 5 USDC
    tickSize: '0.000000001'
  }
};

/**
 * 3단계 정밀도 계산 클래스
 */
export class AdvancedPrecisionMath {
  
  /**
   * 내부 계산용 고정밀도 (24자리)
   */
  private static readonly INTERNAL_DECIMALS = 24;
  
  /**
   * 가격을 내부 정밀도로 변환
   */
  static priceToInternal(price: string, priceDecimals: number): bigint {
    return this.toFixed(price, priceDecimals, this.INTERNAL_DECIMALS);
  }
  
  /**
   * 수량을 내부 정밀도로 변환
   */
  static amountToInternal(amount: string, tokenDecimals: number): bigint {
    return this.toFixed(amount, tokenDecimals, this.INTERNAL_DECIMALS);
  }
  
  /**
   * 정밀도 변환
   */
  static toFixed(value: string, fromDecimals: number, toDecimals: number): bigint {
    if (!value || value === '0') return 0n;
    
    const [whole, fraction = ''] = value.split('.');
    const wholeBigInt = BigInt(whole || '0');
    
    // 소수점 부분 처리
    const fractionPadded = fraction.padEnd(fromDecimals, '0').slice(0, fromDecimals);
    const fractionBigInt = BigInt(fractionPadded || '0');
    
    // 원래 정밀도로 값 구성
    const originalValue = wholeBigInt * (10n ** BigInt(fromDecimals)) + fractionBigInt;
    
    // 대상 정밀도로 조정
    if (toDecimals > fromDecimals) {
      return originalValue * (10n ** BigInt(toDecimals - fromDecimals));
    } else if (toDecimals < fromDecimals) {
      return originalValue / (10n ** BigInt(fromDecimals - toDecimals));
    } else {
      return originalValue;
    }
  }
  
  /**
   * 내부 정밀도에서 문자열로 변환
   */
  static fromInternal(value: bigint, targetDecimals: number): string {
    if (value === 0n) return '0';
    
    // 내부 정밀도에서 대상 정밀도로 변환
    let adjustedValue = value;
    
    if (this.INTERNAL_DECIMALS > targetDecimals) {
      adjustedValue = value / (10n ** BigInt(this.INTERNAL_DECIMALS - targetDecimals));
    } else if (this.INTERNAL_DECIMALS < targetDecimals) {
      adjustedValue = value * (10n ** BigInt(targetDecimals - this.INTERNAL_DECIMALS));
    }
    
    const str = adjustedValue.toString();
    const totalLength = str.length;
    
    if (totalLength <= targetDecimals) {
      return '0.' + str.padStart(targetDecimals, '0');
    } else {
      const wholeLength = totalLength - targetDecimals;
      const whole = str.slice(0, wholeLength);
      const fraction = str.slice(wholeLength);
      
      // 뒤의 0 제거
      const trimmedFraction = fraction.replace(/0+$/, '');
      
      return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
    }
  }
  
  /**
   * 거래 금액 계산 (가격 × 수량 = USDC 6자리)
   */
  static calculateTradeValue(
    price: string,      // 9자리 가격
    amount: string,     // 18자리 수량
    config: TradingPairConfig
  ): string {
    // 내부 정밀도로 변환
    const priceInternal = this.priceToInternal(price, config.priceDecimals);
    const amountInternal = this.amountToInternal(amount, config.baseDecimals);
    
    // 곱셈 계산
    const valueInternal = (priceInternal * amountInternal) / (10n ** BigInt(this.INTERNAL_DECIMALS));
    
    // USDC 6자리로 변환
    return this.fromInternal(valueInternal, config.quoteDecimals);
  }
  
  /**
   * 주문 금액에 맞는 수량 계산 (USDC 6자리에 딱 맞추기)
   */
  static calculateOptimalAmount(
    price: string,       // 9자리 가격
    desiredValue: string, // 원하는 USDC 금액 (6자리)
    config: TradingPairConfig
  ): {
    amount: string;      // 조정된 수량
    actualValue: string; // 실제 거래 금액 (정확히 6자리)
    adjusted: boolean;   // 수량이 조정되었는지
  } {
    // 내부 정밀도로 변환
    const priceInternal = this.priceToInternal(price, config.priceDecimals);
    const valueInternal = this.toFixed(desiredValue, config.quoteDecimals, this.INTERNAL_DECIMALS);
    
    // 이론적 수량 계산 (amount = value / price)
    const theoreticalAmountInternal = (valueInternal * (10n ** BigInt(this.INTERNAL_DECIMALS))) / priceInternal;
    
    // 기준 토큰 정밀도로 변환
    const theoreticalAmount = this.fromInternal(theoreticalAmountInternal, config.baseDecimals);
    
    // 실제 거래 금액 재계산
    const actualValue = this.calculateTradeValue(price, theoreticalAmount, config);
    
    // USDC 6자리로 정확히 떨어지는지 확인
    const actualValueFixed = this.toFixed(actualValue, config.quoteDecimals, config.quoteDecimals);
    const desiredValueFixed = this.toFixed(desiredValue, config.quoteDecimals, config.quoteDecimals);
    
    const adjusted = actualValueFixed !== desiredValueFixed;
    
    return {
      amount: theoreticalAmount,
      actualValue,
      adjusted
    };
  }
  
  /**
   * 주문 유효성 검증
   */
  static validateOrder(
    price: string,
    amount: string,
    config: TradingPairConfig
  ): {
    valid: boolean;
    error?: string;
    suggestions?: {
      adjustedAmount?: string;
      adjustedValue?: string;
    };
  } {
    try {
      // 가격 유효성 체크
      if (!this.isValidPrice(price, config)) {
        return {
          valid: false,
          error: `Price must be a multiple of ${config.tickSize}`
        };
      }
      
      // 거래 금액 계산
      const tradeValue = this.calculateTradeValue(price, amount, config);
      const tradeValueNum = parseFloat(tradeValue);
      const minValueNum = parseFloat(config.minOrderValue);
      
      // 최소 주문 금액 체크
      if (tradeValueNum < minValueNum) {
        return {
          valid: false,
          error: `Order value too small. Minimum: ${config.minOrderValue} USDC`
        };
      }
      
      // USDC 6자리로 정확히 떨어지는지 체크
      const valueFixed = this.toFixed(tradeValue, config.quoteDecimals, config.quoteDecimals);
      const valueString = this.fromInternal(valueFixed, config.quoteDecimals);
      
      if (valueString !== tradeValue) {
        // 조정된 수량 제안
        const optimal = this.calculateOptimalAmount(price, tradeValue, config);
        
        return {
          valid: false,
          error: 'Order amount will not result in exact USDC value',
          suggestions: {
            adjustedAmount: optimal.amount,
            adjustedValue: optimal.actualValue
          }
        };
      }
      
      return { valid: true };
      
    } catch (_error) {
      return {
        valid: false,
        error: 'Invalid number format'
      };
    }
  }
  
  /**
   * 가격이 유효한 틱 단위인지 확인
   */
  static isValidPrice(price: string, config: TradingPairConfig): boolean {
    try {
      const priceFixed = this.toFixed(price, config.priceDecimals, config.priceDecimals);
      const tickFixed = this.toFixed(config.tickSize, config.priceDecimals, config.priceDecimals);
      
      return priceFixed % tickFixed === 0n;
    } catch (_error) {
      return false;
    }
  }
  
  /**
   * 부분 체결 시 나머지 계산
   */
  static calculatePartialFill(
    originalAmount: string,
    filledAmount: string,
    price: string,
    config: TradingPairConfig
  ): {
    remainingAmount: string;
    remainingValue: string;
    canFillRemaining: boolean; // 남은 수량으로 유효한 거래 가능한지
  } {
    // 내부 정밀도로 계산
    const originalInternal = this.amountToInternal(originalAmount, config.baseDecimals);
    const filledInternal = this.amountToInternal(filledAmount, config.baseDecimals);
    
    const remainingInternal = originalInternal - filledInternal;
    const remainingAmount = this.fromInternal(remainingInternal, config.baseDecimals);
    
    // 남은 금액 계산
    const remainingValue = this.calculateTradeValue(price, remainingAmount, config);
    
    // 최소 주문 금액 이상인지 확인
    const canFillRemaining = parseFloat(remainingValue) >= parseFloat(config.minOrderValue);
    
    return {
      remainingAmount,
      remainingValue,
      canFillRemaining
    };
  }
  
  /**
   * 가격 비교 (9자리 정밀도)
   */
  static comparePrice(priceA: string, priceB: string, config: TradingPairConfig): number {
    const aFixed = this.toFixed(priceA, config.priceDecimals, config.priceDecimals);
    const bFixed = this.toFixed(priceB, config.priceDecimals, config.priceDecimals);
    
    if (aFixed > bFixed) return 1;
    if (aFixed < bFixed) return -1;
    return 0;
  }
  
  /**
   * 수량 비교 (토큰 정밀도)
   */
  static compareAmount(amountA: string, amountB: string, tokenDecimals: number): number {
    const aFixed = this.toFixed(amountA, tokenDecimals, tokenDecimals);
    const bFixed = this.toFixed(amountB, tokenDecimals, tokenDecimals);
    
    if (aFixed > bFixed) return 1;
    if (aFixed < bFixed) return -1;
    return 0;
  }
}

/**
 * 거래쌍별 헬퍼 클래스
 */
export class TradingPairHelper {
  
  static getConfig(pair: string): TradingPairConfig {
    const config = TRADING_PAIR_CONFIGS[pair];
    if (!config) {
      throw new Error(`Unsupported trading pair: ${pair}`);
    }
    return config;
  }
  
  /**
   * 스마트 주문 금액 조정
   */
  static smartOrderAdjustment(
    price: string,
    desiredAmount: string,
    pair: string
  ): {
    recommendedAmount: string;
    actualValue: string;
    savings: string; // 절약되는 USDC (dust 방지)
  } {
    const config = this.getConfig(pair);
    
    // 원래 거래 금액 계산
    const originalValue = AdvancedPrecisionMath.calculateTradeValue(price, desiredAmount, config);
    
    // 최적 수량 계산
    const optimal = AdvancedPrecisionMath.calculateOptimalAmount(price, originalValue, config);
    
    // 절약 금액 계산
    const savingsNum = parseFloat(originalValue) - parseFloat(optimal.actualValue);
    
    return {
      recommendedAmount: optimal.amount,
      actualValue: optimal.actualValue,
      savings: Math.abs(savingsNum).toFixed(6)
    };
  }
  
  /**
   * 호가 단위 스냅
   */
  static snapToTickSize(price: string, pair: string): string {
    const config = this.getConfig(pair);
    
    const priceFixed = AdvancedPrecisionMath.toFixed(price, config.priceDecimals, config.priceDecimals);
    const tickFixed = AdvancedPrecisionMath.toFixed(config.tickSize, config.priceDecimals, config.priceDecimals);
    
    // 가장 가까운 틱으로 반올림
    const snappedFixed = (priceFixed / tickFixed) * tickFixed;
    
    return AdvancedPrecisionMath.fromInternal(snappedFixed, config.priceDecimals);
  }
}

/**
 * UI 표시용 포맷터
 */
export class PrecisionFormatter {
  
  static formatPrice(price: string, _pair: string): string {
    // const config = TradingPairHelper.getConfig(pair); // Currently not used
    const priceNum = parseFloat(price);
    
    if (priceNum >= 1000) {
      return priceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    } else if (priceNum >= 1) {
      return priceNum.toFixed(6);
    } else {
      return priceNum.toFixed(9); // 가격 9자리 표시
    }
  }
  
  static formatAmount(amount: string, tokenDecimals: number): string {
    const amountNum = parseFloat(amount);
    
    if (amountNum >= 1000000) {
      return (amountNum / 1000000).toFixed(2) + 'M';
    } else if (amountNum >= 1000) {
      return (amountNum / 1000).toFixed(2) + 'K';
    } else if (amountNum >= 1) {
      return amountNum.toFixed(4);
    } else {
      return amountNum.toFixed(Math.min(tokenDecimals, 8));
    }
  }
  
  static formatValue(value: string): string {
    const valueNum = parseFloat(value);
    return '$' + valueNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  }
}