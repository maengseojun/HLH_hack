// 정밀한 소수점 계산을 위한 유틸리티
// 부동소수점 오차 방지를 위해 정수 기반 계산 사용

export interface TokenPrecision {
  symbol: string;
  decimals: number;
  minAmount: string; // 최소 주문 수량
  stepSize: string;  // 주문 단위
}

// 토큰별 정밀도 설정
export const TOKEN_PRECISION: Record<string, TokenPrecision> = {
  'USDC': {
    symbol: 'USDC',
    decimals: 6,
    minAmount: '0.000001', // 1 micro USDC
    stepSize: '0.000001'
  },
  'HYPERINDEX': {
    symbol: 'HYPERINDEX', 
    decimals: 18,
    minAmount: '0.000000000000000001', // 1 wei
    stepSize: '0.000000000000000001'
  },
  'ETH': {
    symbol: 'ETH',
    decimals: 18,
    minAmount: '0.000000000000000001',
    stepSize: '0.000000000000000001'
  }
};

/**
 * 정밀한 소수점 계산을 위한 클래스
 */
export class PrecisionMath {
  
  /**
   * 문자열을 정수로 변환 (정밀도 유지)
   */
  static toInteger(value: string, decimals: number): bigint {
    if (!value || value === '0') return 0n;
    
    const [whole, fraction = ''] = value.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    
    return BigInt(whole + paddedFraction);
  }
  
  /**
   * 정수를 문자열로 변환 (정밀도 유지)
   */
  static toString(value: bigint, decimals: number): string {
    if (value === 0n) return '0';
    
    const str = value.toString();
    const totalLength = str.length;
    
    if (totalLength <= decimals) {
      // 소수점 이하만 있는 경우
      return '0.' + str.padStart(decimals, '0');
    } else {
      // 정수부와 소수부 모두 있는 경우
      const wholeLength = totalLength - decimals;
      const whole = str.slice(0, wholeLength);
      const fraction = str.slice(wholeLength);
      
      // 뒤의 0 제거
      const trimmedFraction = fraction.replace(/0+$/, '');
      
      return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
    }
  }
  
  /**
   * 곱셈 (amount * price)
   */
  static multiply(
    amount: string, 
    price: string, 
    amountDecimals: number, 
    priceDecimals: number,
    resultDecimals: number
  ): string {
    const amountInt = this.toInteger(amount, amountDecimals);
    const priceInt = this.toInteger(price, priceDecimals);
    
    const result = (amountInt * priceInt) / BigInt(10 ** (amountDecimals + priceDecimals - resultDecimals));
    
    return this.toString(result, resultDecimals);
  }
  
  /**
   * 뺄셈
   */
  static subtract(a: string, b: string, decimals: number): string {
    const aInt = this.toInteger(a, decimals);
    const bInt = this.toInteger(b, decimals);
    
    return this.toString(aInt - bInt, decimals);
  }
  
  /**
   * 덧셈
   */
  static add(a: string, b: string, decimals: number): string {
    const aInt = this.toInteger(a, decimals);
    const bInt = this.toInteger(b, decimals);
    
    return this.toString(aInt + bInt, decimals);
  }
  
  /**
   * 비교 (a > b 이면 1, a < b 이면 -1, 같으면 0)
   */
  static compare(a: string, b: string, decimals: number): number {
    const aInt = this.toInteger(a, decimals);
    const bInt = this.toInteger(b, decimals);
    
    if (aInt > bInt) return 1;
    if (aInt < bInt) return -1;
    return 0;
  }
  
  /**
   * 최소값 반환
   */
  static min(a: string, b: string, decimals: number): string {
    return this.compare(a, b, decimals) <= 0 ? a : b;
  }
  
  /**
   * 최대값 반환
   */
  static max(a: string, b: string, decimals: number): string {
    return this.compare(a, b, decimals) >= 0 ? a : b;
  }
  
  /**
   * 0인지 확인
   */
  static isZero(value: string): boolean {
    return this.toInteger(value, 18) === 0n;
  }
  
  /**
   * 유효한 수량인지 검증
   */
  static isValidAmount(amount: string, tokenSymbol: string): boolean {
    const precision = TOKEN_PRECISION[tokenSymbol];
    if (!precision) return false;
    
    const amountInt = this.toInteger(amount, precision.decimals);
    const minAmountInt = this.toInteger(precision.minAmount, precision.decimals);
    const stepSizeInt = this.toInteger(precision.stepSize, precision.decimals);
    
    // 최소 수량 체크
    if (amountInt < minAmountInt) return false;
    
    // 스텝 사이즈 체크 (나누어떨어지는지)
    if (amountInt % stepSizeInt !== 0n) return false;
    
    return true;
  }
  
  /**
   * 수량을 유효한 단위로 조정 (USDC 6자리 기준)
   */
  static adjustToValidAmount(amount: string, tokenSymbol: string): string {
    const precision = TOKEN_PRECISION[tokenSymbol];
    if (!precision) return amount;
    
    const amountInt = this.toInteger(amount, precision.decimals);
    const stepSizeInt = this.toInteger(precision.stepSize, precision.decimals);
    const minAmountInt = this.toInteger(precision.minAmount, precision.decimals);
    
    // 스텝 사이즈로 내림 조정
    const adjustedInt = (amountInt / stepSizeInt) * stepSizeInt;
    
    // 최소 수량보다 작으면 0으로
    if (adjustedInt < minAmountInt) {
      return '0';
    }
    
    return this.toString(adjustedInt, precision.decimals);
  }
}

/**
 * 거래쌍별 정밀도 정보
 */
export class TradingPairPrecision {
  static getPairInfo(pair: string): { base: TokenPrecision; quote: TokenPrecision } {
    const [baseSymbol, quoteSymbol] = pair.split('-');
    
    const base = TOKEN_PRECISION[baseSymbol];
    const quote = TOKEN_PRECISION[quoteSymbol];
    
    if (!base || !quote) {
      throw new Error(`Unsupported trading pair: ${pair}`);
    }
    
    return { base, quote };
  }
  
  /**
   * 체결 금액 계산 (정밀도 유지)
   */
  static calculateTradeValue(amount: string, price: string, pair: string): string {
    const { base, quote } = this.getPairInfo(pair);
    
    return PrecisionMath.multiply(
      amount, 
      price, 
      base.decimals, 
      quote.decimals, 
      quote.decimals // 결과는 quote 토큰 정밀도
    );
  }
  
  /**
   * 부분체결 시 나머지 수량 조정
   */
  static adjustRemainingAmount(
    originalAmount: string, 
    filledAmount: string, 
    pair: string
  ): { remaining: string; adjusted: boolean } {
    const { base } = this.getPairInfo(pair);
    
    const remaining = PrecisionMath.subtract(
      originalAmount, 
      filledAmount, 
      base.decimals
    );
    
    const adjustedRemaining = PrecisionMath.adjustToValidAmount(
      remaining, 
      base.symbol
    );
    
    return {
      remaining: adjustedRemaining,
      adjusted: remaining !== adjustedRemaining
    };
  }
}