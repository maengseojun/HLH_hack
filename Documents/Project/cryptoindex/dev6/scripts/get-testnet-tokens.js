const { execSync } = require('child_process');
const { ethers } = require('ethers');

/**
 * 🪙 테스트넷 토큰 확보 도우미 스크립트
 */

// 테스트넷 주소 (실제 private key 설정 후 사용)
const TEST_ADDRESS = "0x81Bf724a8101EC81540fA841fD1E68076A8101cd"; // 예시 주소

async function getTestnetTokens() {
    console.log('🪙 테스트넷 토큰 확보 시작...\n');
    
    console.log('⚠️  중요: 테스트넷 토큰은 실제 가치가 없는 "가짜" 토큰입니다!');
    console.log('⚠️  메인넷 자산(USDT, ETH 등)과는 완전히 별개입니다.\n');
    
    // 1. HyperEVM 테스트넷 HYPE 토큰
    console.log('1️⃣ HyperEVM 테스트넷 HYPE 토큰 요청');
    console.log(`   주소: ${TEST_ADDRESS}`);
    console.log('   방법 1: cURL 명령어');
    console.log(`   curl -X POST "https://faucet.hyperliquid-testnet.xyz/request" \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"address":"${TEST_ADDRESS}"}'`);
    
    console.log('\n   방법 2: Discord/Telegram');
    console.log('   - Hyperliquid Discord 서버 접속');
    console.log('   - #testnet-faucet 채널에 지갑 주소 요청');
    console.log(`   - 주소: ${TEST_ADDRESS}`);
    
    // 2. 다른 테스트넷 토큰들
    console.log('\n2️⃣ 기타 테스트넷 토큰 확보');
    
    const testnetFaucets = [
        {
            name: 'Ethereum Sepolia ETH',
            url: 'https://sepoliafaucet.com/',
            method: 'Website'
        },
        {
            name: 'Arbitrum Sepolia ETH', 
            url: 'https://faucet.quicknode.com/arbitrum/sepolia',
            method: 'Website'
        },
        {
            name: 'Polygon Amoy MATIC',
            url: 'https://faucet.polygon.technology/',
            method: 'Website'
        }
    ];
    
    testnetFaucets.forEach((faucet, index) => {
        console.log(`   ${index + 1}. ${faucet.name}`);
        console.log(`      URL: ${faucet.url}`);
        console.log(`      주소 입력: ${TEST_ADDRESS}`);
        console.log('');
    });
}

async function checkTestnetBalances() {
    console.log('3️⃣ 테스트넷 토큰 잔액 확인\n');
    
    const networks = [
        {
            name: 'HyperEVM Testnet',
            rpc: 'https://rpc.hyperliquid-testnet.xyz/evm',
            chainId: 998,
            token: 'HYPE'
        },
        {
            name: 'Ethereum Sepolia',
            rpc: 'https://rpc.sepolia.org',
            chainId: 11155111,
            token: 'SepoliaETH'
        },
        {
            name: 'Arbitrum Sepolia',
            rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
            chainId: 421614,
            token: 'ArbETH'
        },
        {
            name: 'Polygon Amoy',
            rpc: 'https://rpc-amoy.polygon.technology',
            chainId: 80002,
            token: 'MATIC'
        }
    ];
    
    for (const network of networks) {
        try {
            console.log(`🔍 ${network.name} 잔액 확인...`);
            console.log(`   Command: cast balance ${TEST_ADDRESS} --rpc-url ${network.rpc}`);
            
            const provider = new ethers.JsonRpcProvider(network.rpc);
            const balance = await provider.getBalance(TEST_ADDRESS);
            const balanceEth = ethers.formatEther(balance);
            
            console.log(`   ✅ 잔액: ${balanceEth} ${network.token}`);
            console.log(`   🌐 Chain ID: ${network.chainId}\n`);
            
        } catch (error) {
            console.log(`   ❌ 오류: ${error.message}\n`);
        }
    }
}

async function setupMetaMaskGuide() {
    console.log('4️⃣ MetaMask HyperEVM 테스트넷 설정 가이드\n');
    
    const hyperevmConfig = {
        chainId: '0x3E6', // 998 in hex
        chainName: 'HyperEVM Testnet',
        rpcUrls: ['https://rpc.hyperliquid-testnet.xyz/evm'],
        nativeCurrency: {
            name: 'HYPE',
            symbol: 'HYPE',
            decimals: 18
        },
        blockExplorerUrls: ['https://explorer.hyperliquid-testnet.xyz'] // 예시
    };
    
    console.log('📱 MetaMask에 HyperEVM 테스트넷 추가:');
    console.log('   1. MetaMask 열기');
    console.log('   2. 네트워크 드롭다운 클릭');
    console.log('   3. "네트워크 추가" 선택');
    console.log('   4. 다음 정보 입력:');
    console.log(`      - 네트워크 이름: ${hyperevmConfig.chainName}`);
    console.log(`      - RPC URL: ${hyperevmConfig.rpcUrls[0]}`);
    console.log(`      - 체인 ID: ${hyperevmConfig.chainId} (${parseInt(hyperevmConfig.chainId, 16)})`);
    console.log(`      - 통화 기호: ${hyperevmConfig.nativeCurrency.symbol}`);
    console.log(`      - 블록 탐색기: ${hyperevmConfig.blockExplorerUrls[0]}`);
    
    console.log('\n🔗 자동 추가용 JSON (개발자 콘솔에서 사용):');
    console.log('ethereum.request({');
    console.log('  method: "wallet_addEthereumChain",');
    console.log('  params: [');
    console.log(JSON.stringify(hyperevmConfig, null, 4));
    console.log('  ]');
    console.log('});');
}

async function generateFaucetScript() {
    console.log('\n5️⃣ 자동 Faucet 요청 스크립트 생성\n');
    
    const faucetScript = `#!/bin/bash

# HyperEVM 테스트넷 토큰 자동 요청 스크립트
ADDRESS="${TEST_ADDRESS}"

echo "🪙 HyperEVM 테스트넷 토큰 요청 중..."
echo "주소: $ADDRESS"

# HyperEVM Faucet 요청
curl -X POST "https://faucet.hyperliquid-testnet.xyz/request" \\
  -H "Content-Type: application/json" \\
  -d "{\\"address\\":\\"$ADDRESS\\"}"

echo ""
echo "✅ HyperEVM 테스트넷 토큰 요청 완료"
echo "📊 잔액 확인: cast balance $ADDRESS --rpc-url https://rpc.hyperliquid-testnet.xyz/evm"
echo "⏰ 토큰이 도착하는데 몇 분이 걸릴 수 있습니다."
`;
    
    const fs = require('fs');
    fs.writeFileSync('./scripts/request-hype-tokens.sh', faucetScript);
    
    // 실행 권한 추가
    try {
        execSync('chmod +x ./scripts/request-hype-tokens.sh');
        console.log('📝 Faucet 스크립트 생성: ./scripts/request-hype-tokens.sh');
        console.log('   실행: ./scripts/request-hype-tokens.sh');
    } catch (error) {
        console.log('📝 Faucet 스크립트 생성: ./scripts/request-hype-tokens.sh');
        console.log('   ⚠️  chmod 권한 설정 필요: chmod +x ./scripts/request-hype-tokens.sh');
    }
}

async function main() {
    console.log('🔥 HyperEVM 테스트넷 토큰 확보 가이드\n');
    console.log('=' * 60 + '\n');
    
    await getTestnetTokens();
    console.log('\\n' + '=' * 60 + '\\n');
    
    await checkTestnetBalances();
    console.log('=' * 60 + '\\n');
    
    await setupMetaMaskGuide();
    console.log('\\n' + '=' * 60 + '\\n');
    
    await generateFaucetScript();
    
    console.log('\\n🎯 다음 단계:');
    console.log('1. 위 faucet들에서 테스트넷 토큰 확보');
    console.log('2. MetaMask에 HyperEVM 테스트넷 추가');
    console.log('3. .env 파일에 실제 private key 설정');
    console.log('4. npm run deploy:testnet 실행');
    console.log('5. 전체 워크플로우 테스트');
    
    console.log('\\n⚠️  주의사항:');
    console.log('- 테스트넷 토큰은 실제 가치가 없습니다');
    console.log('- private key는 절대 공유하지 마세요');
    console.log('- 테스트 목적으로만 사용하세요');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    getTestnetTokens,
    checkTestnetBalances,
    setupMetaMaskGuide
};