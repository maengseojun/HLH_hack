// lib/intent/intent-solver.ts
/**
 * Intent Parser and Solver
 * 자연어 입력을 구체적인 실행 계획으로 변환
 */

export interface TokenAllocation {
  symbol: string
  percentage: number
  chain: string
  mint?: string // Solana mint address
}

export interface IntentExecutionPlan {
  investmentAmount: number
  indexId: string
  tokenAllocation: TokenAllocation[]
  estimatedGas: string
  estimatedTime: string
  positionId?: string
  mevProtection?: {
    enabled: boolean
    estimatedSavings: string
    protectionMethod: string
  }
}

// 사전 정의된 인덱스 템플릿
const INDEX_TEMPLATES = {
  MEME_EQUAL: {
    id: 'HYPER_MEME_INDEX',
    tokens: [
      { symbol: 'WIF', percentage: 16.67, chain: 'HyperEVM' },
      { symbol: 'BONK', percentage: 16.67, chain: 'HyperEVM' },
      { symbol: 'POPCAT', percentage: 16.67, chain: 'HyperEVM' },
      { symbol: 'BOME', percentage: 16.67, chain: 'Solana' },
      { symbol: 'MEW', percentage: 16.67, chain: 'Solana' },
      { symbol: 'BABYDOGE', percentage: 16.66, chain: 'BSC' }
    ]
  },
  SAFE_BALANCED: {
    id: 'BALANCED_INDEX',
    tokens: [
      { symbol: 'ETH', percentage: 40, chain: 'Ethereum' },
      { symbol: 'BTC', percentage: 30, chain: 'Bitcoin' },
      { symbol: 'USDC', percentage: 20, chain: 'Ethereum' },
      { symbol: 'SOL', percentage: 10, chain: 'Solana' }
    ]
  }
}

// 키워드 기반 Intent 분류
const INTENT_PATTERNS = {
  memecoins: /밈코인|밈|meme|WIF|BONK|POPCAT|BOME|MEW|DOGE/i,
  equal_weight: /균등|equal|같게|동일|3종|균분|분할/i,
  safe: /안전|stable|보수적|리스크|위험/i,
  rebalance: /리밸런싱|rebalance|조정|재배치/i,
  amount: /(\d+)\s*(?:달러|dollar|USDC|usdc|\$)/i
}

/**
 * 자연어 입력을 분석하여 실행 계획 생성
 */
export async function processIntent(intentText: string): Promise<IntentExecutionPlan> {
  console.log('🔍 Parsing intent:', intentText)

  try {
    // 1. 투자 금액 추출
    const amount = extractAmount(intentText)
    if (!amount || amount < 10 || amount > 100000) {
      throw new Error('투자 금액은 10 USDC에서 100,000 USDC 사이여야 합니다')
    }

    // 2. 인덱스 타입 결정
    const indexType = determineIndexType(intentText)
    const template = INDEX_TEMPLATES[indexType]
    
    if (!template) {
      throw new Error('인덱스 타입을 인식할 수 없습니다')
    }

    // 3. 실행 계획 생성 (MEV 보호 포함)
    const mevProtectionEnabled = amount >= 100; // 100 USDC 이상에서 MEV 보호 활성화
    const executionPlan: IntentExecutionPlan = {
      investmentAmount: amount,
      indexId: template.id,
      tokenAllocation: template.tokens.map(token => ({
        ...token,
        mint: getMintAddress(token.symbol) // Solana 토큰 mint 주소
      })),
      estimatedGas: calculateEstimatedGas(template.tokens.length, mevProtectionEnabled),
      estimatedTime: mevProtectionEnabled ? '3-6 minutes' : '2-5 minutes',
      mevProtection: mevProtectionEnabled ? {
        enabled: true,
        estimatedSavings: calculateMEVSavings(amount),
        protectionMethod: amount >= 1000 ? 'Private Mempool' : 'Flashloan Atomic'
      } : {
        enabled: false,
        estimatedSavings: '$0',
        protectionMethod: 'None'
      }
    }

    console.log('✅ Execution plan generated:', executionPlan)

    // 4. 실제 SCV 포지션 생성 시뮬레이션 (테스트용)
    if (process.env.NODE_ENV === 'development') {
      executionPlan.positionId = `intent_${Date.now()}_${template.id}`
      
      // 실제 환경에서는 여기서 SCV Manager 호출
      // const scvManager = new HyperVMSCVManager()
      // const result = await scvManager.createHyperSCVPosition(...)
    }

    return executionPlan

  } catch (error) {
    console.error('❌ Intent processing failed:', error)
    throw error
  }
}

/**
 * 텍스트에서 투자 금액 추출
 */
function extractAmount(text: string): number | null {
  const match = text.match(INTENT_PATTERNS.amount)
  if (match) {
    return parseInt(match[1])
  }

  // 한글 숫자 패턴도 시도
  const koreanNumbers: { [key: string]: number } = {
    '천': 1000,
    '만': 10000,
    '백만': 1000000
  }

  for (const [korean, value] of Object.entries(koreanNumbers)) {
    const regex = new RegExp(`(\\d+)${korean}`, 'i')
    const match = text.match(regex)
    if (match) {
      return parseInt(match[1]) * value
    }
  }

  return null
}

/**
 * 인덱스 타입 결정
 */
function determineIndexType(text: string): keyof typeof INDEX_TEMPLATES {
  if (INTENT_PATTERNS.rebalance.test(text)) {
    throw new Error('리밸런싱 기능은 기존 포지션에서만 가능합니다')
  }

  if (INTENT_PATTERNS.safe.test(text)) {
    return 'SAFE_BALANCED'
  }

  if (INTENT_PATTERNS.memecoins.test(text) || INTENT_PATTERNS.equal_weight.test(text)) {
    return 'MEME_EQUAL'
  }

  // 기본값: 밈코인 인덱스
  return 'MEME_EQUAL'
}

/**
 * 토큰 심볼에서 Solana mint 주소 조회
 */
function getMintAddress(symbol: string): string | undefined {
  const MINT_ADDRESSES: { [key: string]: string } = {
    'SOL': 'So11111111111111111111111111111111111111112',
    'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'WIF': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    'BOME': 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',
    'MEW': 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
    'POPCAT': '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr'
  }

  return MINT_ADDRESSES[symbol.toUpperCase()]
}

/**
 * 가스비 추정 (토큰 수 및 MEV 보호에 따라)
 */
function calculateEstimatedGas(tokenCount: number, mevProtectionEnabled: boolean = false): string {
  const baseGas = 5 // USD
  const perTokenGas = 2 // USD
  const mevProtectionGas = mevProtectionEnabled ? 8 : 0 // MEV 보호 추가 비용
  const totalGas = baseGas + (tokenCount * perTokenGas) + mevProtectionGas
  
  return `$${totalGas-2}-${totalGas+5}`
}

/**
 * MEV 절약 추정
 */
function calculateMEVSavings(amount: number): string {
  // 투자액의 0.1-0.5% MEV 절약 추정
  const savingsRate = amount >= 1000 ? 0.005 : 0.002; // 0.5% vs 0.2%
  const savingsAmount = Math.floor(amount * savingsRate);
  
  return `$${savingsAmount}`;
}

/**
 * Intent 검증 및 제안
 */
export function validateIntent(text: string): { isValid: boolean; suggestions?: string[] } {
  if (!text || text.trim().length < 5) {
    return {
      isValid: false,
      suggestions: [
        "더 구체적으로 입력해주세요",
        "예: '1000 USDC로 밈코인 인덱스 만들어줘'"
      ]
    }
  }

  if (!extractAmount(text)) {
    return {
      isValid: false,
      suggestions: [
        "투자 금액을 포함해주세요",
        "예: '500달러로...', '1000 USDC로...'"
      ]
    }
  }

  return { isValid: true }
}

/**
 * 실제 SCV Manager와 연동하는 함수
 */
export async function executeIntentPlan(plan: IntentExecutionPlan, userAddress: string, authToken?: string) {
  console.log('🚀 Executing intent plan:', plan, 'for user:', userAddress)

  try {
    // API 호출을 통해 SCV 포지션 생성
    const response = await fetch('/api/scv/create-position', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken || 'dev-token'}`, 
      },
      body: JSON.stringify({
        indexId: plan.indexId,
        investmentAmount: plan.investmentAmount,
        userAddress,
        tokenAllocation: plan.tokenAllocation
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }))
      throw new Error(errorData.error || `API Error: ${response.status}`)
    }

    const result = await response.json()
    
    return {
      success: true,
      positionId: result.positionId,
      message: result.message || 'Intent-based position created successfully'
    }

  } catch (error) {
    console.error('❌ Intent execution API error:', error)
    
    // Development 환경에서는 mock 응답 반환
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        positionId: `intent_dev_${Date.now()}_${plan.indexId}`,
        message: 'Intent-based position created successfully (dev mode)'
      }
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Position 생성 중 오류가 발생했습니다'
    }
  }
}