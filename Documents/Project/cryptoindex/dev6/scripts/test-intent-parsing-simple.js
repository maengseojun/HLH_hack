#!/usr/bin/env node
// scripts/test-intent-parsing-simple.js
/**
 * Simple Intent Parsing Test
 * Manual testing of core intent parsing functions
 */

// Manual implementation of core logic for testing
const INTENT_PATTERNS = {
  memecoins: /밈코인|밈|meme|WIF|BONK|POPCAT|BOME|MEW|DOGE/i,
  equal_weight: /균등|equal|같게|동일|3종|균분|분할/i,
  safe: /안전|stable|보수적|리스크|위험/i,
  rebalance: /리밸런싱|rebalance|조정|재배치/i,
  amount: /(\d+)\s*(?:달러|dollar|USDC|usdc|\$)/i
};

// Test amount extraction
function testExtractAmount(text) {
  const match = text.match(INTENT_PATTERNS.amount);
  if (match) {
    return parseInt(match[1]);
  }

  // 한글 숫자 패턴
  const koreanNumbers = {
    '천': 1000,
    '만': 10000,
    '십만': 100000,
    '백만': 1000000
  };

  for (const [korean, value] of Object.entries(koreanNumbers)) {
    const regex = new RegExp(`(\\d+)${korean}`, 'i');
    const match = text.match(regex);
    if (match) {
      return parseInt(match[1]) * value;
    }
  }

  return null;
}

// Test index type determination
function testDetermineIndexType(text) {
  if (INTENT_PATTERNS.rebalance.test(text)) {
    throw new Error('리밸런싱 기능은 기존 포지션에서만 가능합니다');
  }

  if (INTENT_PATTERNS.safe.test(text)) {
    return 'SAFE_BALANCED';
  }

  if (INTENT_PATTERNS.memecoins.test(text) || INTENT_PATTERNS.equal_weight.test(text)) {
    return 'MEME_EQUAL';
  }

  // 기본값: 밈코인 인덱스
  return 'MEME_EQUAL';
}

// Test validation
function testValidateIntent(text) {
  if (!text || text.trim().length < 5) {
    return {
      isValid: false,
      suggestions: [
        "더 구체적으로 입력해주세요",
        "예: '1000 USDC로 밈코인 인덱스 만들어줘'"
      ]
    };
  }

  if (!testExtractAmount(text)) {
    return {
      isValid: false,
      suggestions: [
        "투자 금액을 포함해주세요",
        "예: '500달러로...', '1000 USDC로...'"
      ]
    };
  }

  return { isValid: true };
}

async function runSimpleTests() {
  console.log('🧪 Simple Intent Parsing Test');
  console.log('=' .repeat(50));

  const testCases = [
    "1000 USDC로 밈코인 인덱스 만들어줘",
    "500달러로 WIF, BONK, POPCAT 균등분할해줘",
    "2000 USDC로 안전한 인덱스 추천해줘", 
    "1만 USDC로 밈코인 투자",
    "리스크 낮은 포트폴리오로 1500달러 투자",
    "인덱스 만들어줘", // 금액 없음 - 오류 예상
    "내 포지션 리밸런싱해줘", // 리밸런싱 - 오류 예상
    ""  // 빈 입력 - 오류 예상
  ];

  let passed = 0;
  let total = testCases.length;

  testCases.forEach((testCase, index) => {
    console.log(`\\n${index + 1}. 테스트: "${testCase}"`);

    try {
      // 1. 금액 추출 테스트
      const amount = testExtractAmount(testCase);
      console.log(`   💰 추출된 금액: ${amount || '없음'}`);

      // 2. 검증 테스트
      const validation = testValidateIntent(testCase);
      console.log(`   ✅ 검증 결과: ${validation.isValid ? '통과' : '실패'}`);
      
      if (!validation.isValid) {
        console.log(`   💡 제안사항: ${validation.suggestions[0]}`);
      }

      // 3. 검증이 통과한 경우 인덱스 타입 결정
      if (validation.isValid) {
        const indexType = testDetermineIndexType(testCase);
        console.log(`   📊 선택된 인덱스: ${indexType}`);
        console.log(`   ✅ 테스트 성공`);
        passed++;
      } else {
        // 실패가 예상된 케이스들
        if (testCase === "" || testCase === "인덱스 만들어줘" || testCase === "내 포지션 리밸런싱해줘") {
          console.log(`   ✅ 예상된 검증 실패 - 정상`);
          passed++;
        }
      }

    } catch (error) {
      console.log(`   ❌ 오류: ${error.message}`);
      
      // 리밸런싱 오류는 예상된 것
      if (error.message.includes('리밸런싱')) {
        console.log(`   ✅ 예상된 오류 - 정상`);
        passed++;
      }
    }
  });

  console.log(`\\n📈 테스트 결과`);
  console.log('='.repeat(50));
  console.log(`성공: ${passed}/${total} (${((passed/total) * 100).toFixed(1)}%)`);
  
  if (passed === total) {
    console.log(`🎉 모든 테스트 통과!`);
  }

  // 패턴 매칭 상세 테스트
  console.log(`\\n🔍 패턴 매칭 테스트`);
  console.log('-'.repeat(30));

  const patternTestCases = [
    { text: "밈코인으로 투자해줘", expectedPattern: "memecoins", expected: true },
    { text: "WIF BONK 포함해서", expectedPattern: "memecoins", expected: true },
    { text: "균등 분할해줘", expectedPattern: "equal_weight", expected: true },
    { text: "안전한 투자", expectedPattern: "safe", expected: true },
    { text: "보수적인 포트폴리오", expectedPattern: "safe", expected: true },
    { text: "리밸런싱해줘", expectedPattern: "rebalance", expected: true },
    { text: "1000달러", expectedPattern: "amount", expected: true },
    { text: "500 USDC", expectedPattern: "amount", expected: true }
  ];

  patternTestCases.forEach((testCase, index) => {
    const pattern = INTENT_PATTERNS[testCase.expectedPattern];
    const matches = pattern.test(testCase.text);
    const result = matches === testCase.expected ? '✅' : '❌';
    
    console.log(`${index + 1}. "${testCase.text}" → ${testCase.expectedPattern}: ${result}`);
  });

  console.log('\\n🎯 Simple Intent Test Complete!');
}

// Run if called directly
if (require.main === module) {
  runSimpleTests().catch(console.error);
}

module.exports = { runSimpleTests };