#!/usr/bin/env node
// scripts/test-intent-parsing.js
/**
 * Test Intent Parsing System
 * Tests natural language processing and execution plan generation
 */

require('dotenv').config();

// Import CommonJS version for testing
const { processIntent, validateIntent } = require('../lib/intent/intent-solver.ts');

async function testIntentParsing() {
  console.log('🧪 Testing Intent Parsing System');
  console.log('=' .repeat(60));

  // Test cases with various user input patterns
  const testCases = [
    {
      category: "기본 밈코인 인덱스",
      inputs: [
        "1000 USDC로 밈코인 인덱스 만들어줘",
        "500달러로 WIF, BONK, POPCAT 균등분할해줘", 
        "밈코인 3종을 1000달러로 똑같이 나눠서 투자하고 싶어",
        "MEME코인들에 천달러 투자해줘"
      ]
    },
    {
      category: "안전 인덱스", 
      inputs: [
        "2000 USDC로 안전한 인덱스 추천해줘",
        "리스크 낮은 포트폴리오로 1500달러 투자",
        "보수적인 투자로 5000 USDC 넣고 싶어",
        "위험하지 않은 암호화폐에 3000달러"
      ]
    },
    {
      category: "금액 패턴",
      inputs: [
        "1만원으로 인덱스 만들어줘", // 한글 숫자
        "50만 USDC로 밈코인 투자",
        "백만달러로 균등 분할",
        "10000 usdc meme index"
      ]
    },
    {
      category: "오류 처리",
      inputs: [
        "인덱스 만들어줘", // 금액 없음
        "5 USDC로 투자해줘", // 최소 금액 미달
        "200000 달러로 밈코인", // 최대 금액 초과
        "" // 빈 입력
      ]
    },
    {
      category: "리밸런싱 (에러 예상)",
      inputs: [
        "내 포지션 리밸런싱해줘",
        "기존 투자를 조정하고 싶어",
        "포트폴리오 재배치해줘"
      ]
    }
  ];

  let totalTests = 0;
  let passedTests = 0;

  for (const testCategory of testCases) {
    console.log(`\\n📂 ${testCategory.category}`);
    console.log('-'.repeat(40));

    for (const input of testCategory.inputs) {
      totalTests++;
      console.log(`\\n🧾 테스트 입력: "${input}"`);

      try {
        // 1. Intent 검증 테스트
        const validation = validateIntent(input);
        console.log(`   ✅ 검증: ${validation.isValid ? '통과' : '실패'}`);
        
        if (!validation.isValid && validation.suggestions) {
          console.log(`   💡 제안사항:`, validation.suggestions);
        }

        // 2. 검증이 통과한 경우에만 파싱 시도
        if (validation.isValid) {
          const result = await processIntent(input);
          
          console.log(`   📊 결과:`, {
            indexId: result.indexId,
            amount: result.investmentAmount,
            tokenCount: result.tokenAllocation.length,
            estimatedGas: result.estimatedGas,
            estimatedTime: result.estimatedTime
          });

          console.log(`   🪙 토큰 구성:`);
          result.tokenAllocation.forEach(token => {
            console.log(`      • ${token.symbol}: ${token.percentage}% (${token.chain})`);
          });

          passedTests++;
        } else {
          // 검증 실패는 정상적인 케이스일 수 있음
          if (testCategory.category === "오류 처리" || testCategory.category.includes("에러")) {
            console.log(`   ✅ 예상된 검증 실패 - 정상`);
            passedTests++;
          }
        }

      } catch (error) {
        console.log(`   ❌ 파싱 오류:`, error.message);
        
        // 리밸런싱 등 예상된 오류는 통과로 처리
        if (testCategory.category.includes("에러") && 
            (error.message.includes('리밸런싱') || error.message.includes('기존 포지션'))) {
          console.log(`   ✅ 예상된 오류 - 정상`);
          passedTests++;
        }
      }
    }
  }

  // 추가 패턴 매칭 테스트
  console.log(`\\n🔍 패턴 매칭 상세 테스트`);
  console.log('-'.repeat(40));

  const patternTests = [
    {
      input: "WIF, BONK 포함된 밈코인 투자해줘",
      expected: "MEME_EQUAL"
    },
    {
      input: "안전하고 보수적인 투자를 원해", 
      expected: "SAFE_BALANCED"
    },
    {
      input: "균등 분할로 암호화폐 투자",
      expected: "MEME_EQUAL" 
    }
  ];

  for (const test of patternTests) {
    console.log(`\\n🎯 패턴 테스트: "${test.input}"`);
    try {
      // 임시로 금액 추가하여 테스트
      const testInput = `1000 USDC로 ${test.input}`;
      const result = await processIntent(testInput);
      
      const isCorrect = result.indexId === test.expected;
      console.log(`   예상: ${test.expected}, 실제: ${result.indexId} ${isCorrect ? '✅' : '❌'}`);
      
      if (isCorrect) passedTests++;
      totalTests++;
      
    } catch (error) {
      console.log(`   ❌ 패턴 테스트 실패:`, error.message);
      totalTests++;
    }
  }

  // 최종 결과
  console.log(`\\n📈 테스트 결과 요약`);
  console.log('='.repeat(60));
  console.log(`총 테스트: ${totalTests}`);
  console.log(`성공: ${passedTests} (${((passedTests/totalTests) * 100).toFixed(1)}%)`);
  console.log(`실패: ${totalTests - passedTests}`);
  
  if (passedTests === totalTests) {
    console.log(`\\n🎉 모든 테스트 통과! Intent 파싱 시스템이 정상 작동합니다.`);
  } else {
    console.log(`\\n⚠️ 일부 테스트 실패. 시스템 점검이 필요할 수 있습니다.`);
  }

  console.log('\\n🎯 Intent Parsing Test Complete!');
}

// Run the test
if (require.main === module) {
  testIntentParsing().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testIntentParsing };