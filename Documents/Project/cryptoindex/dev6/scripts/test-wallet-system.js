#!/usr/bin/env node

/**
 * 지갑 시스템 테스트 스크립트
 * 
 * 사용법:
 *   node scripts/test-wallet-system.js
 *   npm run test:wallet
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 지갑 시스템 로컬 테스트 시작...\n');

// 환경 확인
function checkEnvironment() {
  console.log('📋 환경 확인 중...');
  
  // package.json 확인
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ package.json을 찾을 수 없습니다.');
    process.exit(1);
  }

  // .env.local 확인
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env.local 파일이 없습니다. 기본 설정을 사용합니다.');
  } else {
    console.log('✅ .env.local 파일 발견');
  }

  // node_modules 확인
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('📦 의존성 패키지 설치 중...');
    try {
      execSync('npm install', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
      console.log('✅ 의존성 패키지 설치 완료');
    } catch (error) {
      console.error('❌ 의존성 설치 실패:', error.message);
      process.exit(1);
    }
  }
}

// Next.js 빌드 확인
function checkBuild() {
  console.log('\n🔨 빌드 상태 확인 중...');
  
  try {
    const buildPath = path.join(__dirname, '..', '.next');
    if (!fs.existsSync(buildPath)) {
      console.log('🔧 Next.js 빌드 실행 중...');
      execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
      console.log('✅ Next.js 빌드 완료');
    } else {
      console.log('✅ 빌드 디렉토리 존재');
    }
  } catch (error) {
    console.log('⚠️  빌드 에러가 있을 수 있습니다. 개발 서버로 진행합니다.');
  }
}

// 테스트넷 연결 확인
function testNetworkConnections() {
  console.log('\n🌐 테스트넷 연결 확인 중...');
  
  const testNetworks = [
    {
      name: 'Arbitrum Sepolia',
      url: 'https://arbitrum-sepolia.public.blastapi.io',
      chainId: 421614
    },
    {
      name: 'Hyperliquid Testnet RPC',
      url: 'https://rpc.hyperliquid-testnet.xyz/evm',
      chainId: 998
    },
    {
      name: 'Hyperliquid Testnet API',
      url: 'https://api.hyperliquid-testnet.xyz',
      chainId: null
    }
  ];

  testNetworks.forEach(async (network) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(network.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: network.chainId ? 'eth_chainId' : 'info',
          params: network.chainId ? [] : [{ type: 'meta' }],
          id: 1
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`✅ ${network.name} 연결 성공`);
      } else {
        console.log(`⚠️  ${network.name} 연결 실패 (HTTP ${response.status})`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`⚠️  ${network.name} 연결 타임아웃`);
      } else {
        console.log(`❌ ${network.name} 연결 에러: ${error.message}`);
      }
    }
  });
}

// 개발 서버 시작 함수
function startDevServer() {
  console.log('\n🖥️  개발 서버 시작 중...');
  console.log('📍 http://localhost:3000 에서 테스트할 수 있습니다.');
  console.log('🔍 브라우저에서 다음 기능들을 테스트해보세요:');
  console.log('');
  console.log('   1. 이메일 로그인 → 임베디드 지갑 자동 생성');
  console.log('   2. 외부 지갑 연결 (MetaMask 등)');
  console.log('   3. Hyperliquid 네트워크 추가');
  console.log('   4. Arbitrum → Hyperliquid 브릿지 시뮬레이션');
  console.log('');
  console.log('🛑 서버를 중지하려면 Ctrl+C를 누르세요.');
  console.log('');

  try {
    execSync('npm run dev', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  } catch (error) {
    console.error('❌ 개발 서버 시작 실패:', error.message);
  }
}

// 테스팅 가이드 출력
function printTestingGuide() {
  console.log('\n📋 로컬 테스트 가이드:');
  console.log('===================');
  console.log('');
  console.log('1. 🔐 인증 테스트:');
  console.log('   - 임의의 이메일로 로그인 시도');
  console.log('   - OTP 코드는 브라우저 콘솔에서 확인');
  console.log('   - 임베디드 지갑이 자동 생성되는지 확인');
  console.log('');
  console.log('2. 🌐 네트워크 테스트:');
  console.log('   - MetaMask에 Hyperliquid Testnet 추가');
  console.log('   - 네트워크 ID: 998');
  console.log('   - RPC URL: https://rpc.hyperliquid-testnet.xyz/evm');
  console.log('');
  console.log('3. 💰 브릿지 테스트:');
  console.log('   - Arbitrum Sepolia에서 테스트 USDC 준비');
  console.log('   - 최소 5 USDC 이상 입금 테스트');
  console.log('   - 브릿지 상태 모니터링 확인');
  console.log('');
  console.log('4. 🔍 개발자 도구 활용:');
  console.log('   - 브라우저 콘솔에서 Privy 이벤트 모니터링');
  console.log('   - 네트워크 탭에서 API 호출 확인');
  console.log('   - Application 탭에서 로컬 스토리지 확인');
  console.log('');
  console.log('5. ⚠️  알려진 제한사항:');
  console.log('   - 테스트넷에서는 실제 자금 이동 없음');
  console.log('   - 일부 Hyperliquid 기능은 메인넷 전용');
  console.log('   - 브릿지 처리 시간: 1-3분 소요');
  console.log('');
}

// 메인 실행 함수
async function main() {
  try {
    checkEnvironment();
    checkBuild();
    await testNetworkConnections();
    
    // 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    printTestingGuide();
    
    // 사용자에게 선택 옵션 제공
    console.log('\n🚀 개발 서버를 시작하시겠습니까? (Enter를 누르면 시작, Ctrl+C로 취소)');
    
    process.stdin.once('data', () => {
      startDevServer();
    });
    
  } catch (error) {
    console.error('❌ 테스트 스크립트 실행 실패:', error.message);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = {
  checkEnvironment,
  checkBuild,
  testNetworkConnections,
  startDevServer,
  printTestingGuide
};