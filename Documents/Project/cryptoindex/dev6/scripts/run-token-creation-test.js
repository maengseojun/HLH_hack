#!/usr/bin/env node

/**
 * 토큰 생성 모듈 테스트 실행 스크립트
 * 
 * 사용법:
 *   node scripts/run-token-creation-test.js
 *   npm run test:creation
 */

const { exec } = require('child_process');
const path = require('path');

console.log('🚀 토큰 생성 모듈 테스트 시작...\n');

// 테스트 환경 설정
const testCommand = 'npx hardhat test test/InstitutionalTokenCreation.test.js --verbose';

console.log('📋 테스트 시나리오:');
console.log('==================');
console.log('1. 🏦 K-Bank: K-Crypto Top 4 Index 생성');
console.log('   - BTC (40%) + ETH (30%) + USDC (20%) + SOL (10%)');
console.log('   - 펀드 생성 → 토큰 예치 → 인덱스 토큰 발행');
console.log('');
console.log('2. 🏛️ NH 투자증권: NH-AI Innovation Index 생성');
console.log('   - ETH (50%) + ADA (20%) + DOT (20%) + MATIC (10%)');
console.log('   - AI/블록체인 인프라 테마 펀드');
console.log('');
console.log('3. 🎯 플랫폼 관리자: 토큰 발행 및 분배');
console.log('   - 100,000 KTOP4 토큰 발행');
console.log('   - 투자자들에게 토큰 분배');
console.log('');
console.log('4. 🔄 다중 기관 동시 운영');
console.log('   - 여러 기관이 독립적으로 펀드 운영');
console.log('   - 펀드별 권한 분리');
console.log('');

// 테스트 실행 함수
function runTests() {
    return new Promise((resolve, reject) => {
        console.log('⏳ Hardhat 테스트 실행 중...\n');
        
        const testProcess = exec(testCommand, {
            cwd: path.join(__dirname, '..'),
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });
        
        testProcess.stdout.on('data', (data) => {
            // 테스트 출력을 실시간으로 표시
            process.stdout.write(data);
        });
        
        testProcess.stderr.on('data', (data) => {
            // 에러 출력도 표시
            process.stderr.write(data);
        });
        
        testProcess.on('close', (code) => {
            console.log(`\n테스트 프로세스 종료 코드: ${code}`);
            
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`테스트 실패, 종료 코드: ${code}`));
            }
        });
        
        testProcess.on('error', (error) => {
            reject(error);
        });
    });
}

// 결과 분석 함수
function analyzeResults() {
    console.log('\n📊 테스트 결과 분석:');
    console.log('===================');
    console.log('');
    console.log('✅ 성공한 기능들:');
    console.log('  - 기관별 인덱스 펀드 생성');
    console.log('  - 구성 토큰 비율 검증 (총 100%)');
    console.log('  - 토큰 예치 및 잔액 추적');
    console.log('  - ERC-20 인덱스 토큰 발행');
    console.log('  - 플랫폼 관리자 권한 제어');
    console.log('  - 토큰 전송 및 분배');
    console.log('  - 다중 기관 동시 운영');
    console.log('');
    console.log('⚠️  제한사항:');
    console.log('  - NAV 계산은 Hyperliquid 환경에서만 가능');
    console.log('  - 실제 가격 데이터는 L1 precompile 필요');
    console.log('  - 테스트넷에서는 목 토큰 사용');
    console.log('');
    console.log('🔧 개선 제안:');
    console.log('  1. 실시간 NAV 계산 로직 개선');
    console.log('  2. 수수료 징수 자동화');
    console.log('  3. 펀드 성과 추적 대시보드');
    console.log('  4. 리밸런싱 알고리즘 추가');
    console.log('');
}

// 실제 운용 시나리오 제안
function suggestRealWorldScenarios() {
    console.log('🌍 실제 운용 시나리오:');
    console.log('=====================');
    console.log('');
    console.log('1. 🏦 KB국민은행 "KB-Crypto Top 10"');
    console.log('   - 시가총액 상위 10개 암호화폐');
    console.log('   - 월간 리밸런싱');
    console.log('   - 최소 투자금액: 100만원');
    console.log('');
    console.log('2. 🏛️ NH투자증권 "NH-DeFi Innovators"');
    console.log('   - DeFi 프로토콜 거버넌스 토큰');
    console.log('   - UNI, COMP, AAVE, MKR 등');
    console.log('   - 분기별 리밸런싱');
    console.log('');
    console.log('3. 🏢 미래에셋 "MA-Global Blockchain"');
    console.log('   - 글로벌 블록체인 인프라 토큰');
    console.log('   - 지역별 분산 투자');
    console.log('   - 헤징 전략 포함');
    console.log('');
    console.log('4. 💼 삼성증권 "SS-Gaming & Metaverse"');
    console.log('   - 게임/메타버스 관련 토큰');
    console.log('   - SAND, MANA, AXS, ENJ 등');
    console.log('   - 테마별 집중 투자');
    console.log('');
}

// 메인 실행 함수
async function main() {
    try {
        await runTests();
        
        console.log('\n🎉 모든 테스트가 성공적으로 완료되었습니다!\n');
        
        analyzeResults();
        suggestRealWorldScenarios();
        
        console.log('📝 다음 단계:');
        console.log('=============');
        console.log('1. 소각(Redemption) 모듈 테스트');
        console.log('2. 가격 피드 통합 테스트');
        console.log('3. 수수료 계산 로직 검증');
        console.log('4. 보안 감사 및 스트레스 테스트');
        console.log('');
        
    } catch (error) {
        console.error('\n❌ 테스트 실행 중 오류 발생:');
        console.error('================================');
        console.error(error.message);
        console.error('');
        console.error('🔍 문제 해결 방법:');
        console.error('1. Hardhat 환경이 올바르게 설정되었는지 확인');
        console.error('2. 의존성 패키지가 설치되었는지 확인: npm install');
        console.error('3. 컴파일 오류가 있는지 확인: npx hardhat compile');
        console.error('4. 네트워크 설정이 올바른지 확인');
        console.error('');
        
        process.exit(1);
    }
}

// 스크립트 실행
if (require.main === module) {
    main();
}

module.exports = {
    runTests,
    analyzeResults,
    suggestRealWorldScenarios
};