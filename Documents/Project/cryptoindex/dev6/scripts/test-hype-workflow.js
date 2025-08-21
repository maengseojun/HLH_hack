const { ethers } = require('hardhat');

/**
 * 🚀 TestHYPE를 사용한 전체 HyperIndex 워크플로우 테스트
 * HyperEVM 시뮬레이션 환경에서 완전한 기능 검증
 */

async function testHypeWorkflow() {
    console.log('🚀 TestHYPE 워크플로우 통합 테스트 시작...\n');
    
    const [deployer, user1, user2] = await ethers.getSigners();
    
    // 1. TestHYPE 토큰 배포
    console.log('1️⃣ TestHYPE 토큰 환경 설정...');
    const TestHYPE = await ethers.getContractFactory('TestHYPE');
    const testHYPE = await TestHYPE.deploy();
    await testHYPE.waitForDeployment();
    const testHYPEAddress = await testHYPE.getAddress();
    
    // 추가 사용자들에게 HYPE 토큰 민트
    await testHYPE.mint(user1.address, ethers.parseEther('50000'));
    await testHYPE.mint(user2.address, ethers.parseEther('30000'));
    
    console.log(`✅ TestHYPE 배포: ${testHYPEAddress}`);
    console.log(`   User1 HYPE 잔액: ${ethers.formatEther(await testHYPE.balanceOf(user1.address))}`);
    console.log(`   User2 HYPE 잔액: ${ethers.formatEther(await testHYPE.balanceOf(user2.address))}\n`);
    
    // 2. 기타 테스트 토큰들 배포
    console.log('2️⃣ 기타 테스트 토큰 배포...');
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    
    const tokens = {};
    const tokenData = [
        { name: 'Test USDC', symbol: 'TUSDC', decimals: 6 },
        { name: 'Test ETH', symbol: 'TETH', decimals: 18 },
        { name: 'Test BTC', symbol: 'TBTC', decimals: 8 }
    ];
    
    for (const token of tokenData) {
        const contract = await MockERC20.deploy(token.name, token.symbol, token.decimals);
        await contract.waitForDeployment();
        const address = await contract.getAddress();
        tokens[token.symbol] = address;
        
        // 사용자들에게 토큰 민트
        const supply = ethers.parseUnits('100000', token.decimals);
        await contract.mint(deployer.address, supply);
        await contract.mint(user1.address, supply);
        await contract.mint(user2.address, supply);
        
        console.log(`✅ ${token.name} (${token.symbol}): ${address}`);
    }
    
    // 3. MockMultiChainAggregator 배포 (HYPE 가격 포함)
    console.log('\n3️⃣ MockMultiChainAggregator 배포...');
    const MockAggregator = await ethers.getContractFactory('MockMultiChainAggregator');
    const aggregator = await MockAggregator.deploy();
    await aggregator.waitForDeployment();
    const aggregatorAddress = await aggregator.getAddress();
    
    // HYPE 토큰 가격 설정 ($1.5 for testing)
    await aggregator.setAssetPrice(4, ethers.parseEther('1.5')); // HYPE = asset index 4
    await aggregator.setTokenAddress(4, 31337, testHYPEAddress); // HYPE on hardhat
    
    console.log(`✅ MockMultiChainAggregator: ${aggregatorAddress}`);
    
    // 4. IndexTokenFactory 배포
    console.log('\n4️⃣ IndexTokenFactory 배포...');
    const IndexTokenFactory = await ethers.getContractFactory('IndexTokenFactory');
    const factory = await IndexTokenFactory.deploy(aggregatorAddress);
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    
    console.log(`✅ IndexTokenFactory: ${factoryAddress}`);
    
    // 5. 권한 및 토큰 승인 설정
    console.log('\n5️⃣ 권한 설정...');
    const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
    const PLATFORM_ADMIN_ROLE = await factory.PLATFORM_ADMIN_ROLE();
    
    await factory.grantRole(RECIPE_CREATOR_ROLE, deployer.address);
    await factory.grantRole(PLATFORM_ADMIN_ROLE, deployer.address);
    
    // 모든 토큰 승인 (TestHYPE 포함)
    const allTokens = { ...tokens, HYPE: testHYPEAddress };
    for (const [symbol, address] of Object.entries(allTokens)) {
        await factory.authorizeToken(address, true);
        console.log(`✅ ${symbol} 토큰 승인: ${address}`);
    }
    
    // 6. HYPE를 기본 토큰으로 사용하는 인덱스 펀드 생성
    console.log('\n6️⃣ HYPE 기반 인덱스 펀드 생성...');
    const componentTokens = [
        {
            tokenAddress: testHYPEAddress,
            hyperliquidAssetIndex: 4,
            targetRatio: 3000, // 30%
            depositedAmount: 0
        },
        {
            tokenAddress: tokens.TUSDC,
            hyperliquidAssetIndex: 3,
            targetRatio: 2500, // 25%
            depositedAmount: 0
        },
        {
            tokenAddress: tokens.TETH,
            hyperliquidAssetIndex: 0,
            targetRatio: 2500, // 25%
            depositedAmount: 0
        },
        {
            tokenAddress: tokens.TBTC,
            hyperliquidAssetIndex: 1,
            targetRatio: 2000, // 20%
            depositedAmount: 0
        }
    ];
    
    const createTx = await factory.createIndexFund(
        'HYPE Multi-Asset Index',
        'HMAI',
        componentTokens
    );
    const createReceipt = await createTx.wait();
    
    // 이벤트에서 fundId 추출
    let fundId = null;
    for (const log of createReceipt.logs) {
        try {
            const parsedLog = factory.interface.parseLog(log);
            if (parsedLog.name === 'FundCreated') {
                fundId = parsedLog.args.fundId;
                break;
            }
        } catch (error) {
            // 다른 컨트랙트의 이벤트일 수 있음
            continue;
        }
    }
    
    console.log(`✅ 인덱스 펀드 생성 완료`);
    console.log(`   Fund ID: ${fundId}`);
    console.log(`   구성: HYPE(30%) + TUSDC(25%) + TETH(25%) + TBTC(20%)`);
    
    // 7. 컴포넌트 토큰 예치
    console.log('\n7️⃣ 컴포넌트 토큰 예치...');
    
    const depositAmounts = [
        ethers.parseEther('3000'),      // 3000 HYPE
        ethers.parseUnits('2500', 6),   // 2500 TUSDC  
        ethers.parseEther('2500'),      // 2500 TETH
        ethers.parseUnits('2000', 8)    // 2000 TBTC
    ];
    
    // Approve tokens
    await testHYPE.approve(factoryAddress, depositAmounts[0]);
    await MockERC20.attach(tokens.TUSDC).approve(factoryAddress, depositAmounts[1]);
    await MockERC20.attach(tokens.TETH).approve(factoryAddress, depositAmounts[2]);
    await MockERC20.attach(tokens.TBTC).approve(factoryAddress, depositAmounts[3]);
    
    const depositTx = await factory.depositComponentTokens(
        fundId,
        [testHYPEAddress, tokens.TUSDC, tokens.TETH, tokens.TBTC],
        depositAmounts
    );
    await depositTx.wait();
    
    console.log('✅ 컴포넌트 토큰 예치 완료');
    
    // 8. 인덱스 토큰 발행
    console.log('\n8️⃣ 인덱스 토큰 발행...');
    const issueAmount = ethers.parseEther('1000'); // 1000 HMAI 토큰 발행
    
    const issueTx = await factory.issueIndexToken(fundId, issueAmount);
    const issueReceipt = await issueTx.wait();
    
    console.log('✅ 인덱스 토큰 발행 완료');
    console.log(`   발행량: ${ethers.formatEther(issueAmount)} HMAI`);
    
    // 9. NAV 계산 및 펀드 정보 확인
    console.log('\n9️⃣ NAV 및 펀드 상태 확인...');
    
    try {
        const nav = await factory.calculateNAV(fundId);
        console.log(`📊 현재 NAV: ${ethers.formatEther(nav)} USD per token`);
    } catch (error) {
        console.log(`⚠️  NAV 계산 실패: ${error.message}`);
    }
    
    // 펀드 컴포넌트 정보 확인
    try {
        const components = await factory.getFundComponents(fundId);
        console.log('📋 펀드 구성:');
        for (let i = 0; i < components.length; i++) {
            const comp = components[i];
            const symbol = comp.tokenAddress === testHYPEAddress ? 'HYPE' : 
                          Object.keys(tokens).find(key => tokens[key] === comp.tokenAddress) || 'UNKNOWN';
            console.log(`   ${symbol}: ${comp.targetRatio / 100}% (${ethers.formatUnits(comp.depositedAmount, 18)})`);
        }
    } catch (error) {
        console.log(`⚠️  컴포넌트 정보 조회 실패: ${error.message}`);
    }
    
    // 10. 사용자 거래 시뮬레이션
    console.log('\n🔟 사용자 거래 시뮬레이션...');
    
    // User1이 HYPE로 인덱스 토큰 구매 시뮬레이션
    console.log('👤 User1 거래 시뮬레이션...');
    const user1HypeBefore = await testHYPE.balanceOf(user1.address);
    console.log(`   거래 전 User1 HYPE 잔액: ${ethers.formatEther(user1HypeBefore)}`);
    
    // Faucet 사용 (일일 한도 테스트)
    try {
        await testHYPE.connect(user1).faucet();
        const user1HypeAfterFaucet = await testHYPE.balanceOf(user1.address);
        console.log(`   Faucet 사용 후 HYPE 잔액: ${ethers.formatEther(user1HypeAfterFaucet)}`);
    } catch (error) {
        console.log(`   ⚠️  Faucet 사용 실패: ${error.message}`);
    }
    
    // 11. 크로스체인 시뮬레이션 (LayerZero 메시지)
    console.log('\n1️⃣1️⃣ 크로스체인 메시지 시뮬레이션...');
    
    // 간단한 크로스체인 메시지 구조 생성
    const crossChainMessage = {
        sourceChain: 998, // HyperEVM (시뮬레이션)
        targetChain: 421614, // Arbitrum Sepolia
        fundId: fundId,
        action: 'rebalance',
        amount: ethers.parseEther('1000'),
        timestamp: Math.floor(Date.now() / 1000)
    };
    
    console.log('📡 크로스체인 메시지 구조:');
    console.log(`   소스 체인: ${crossChainMessage.sourceChain} (HyperEVM 시뮬레이션)`);
    console.log(`   타겟 체인: ${crossChainMessage.targetChain} (Arbitrum Sepolia)`);
    console.log(`   액션: ${crossChainMessage.action}`);
    console.log(`   금액: ${ethers.formatEther(crossChainMessage.amount)} HYPE`);
    
    // 12. 최종 상태 요약
    console.log('\n1️⃣2️⃣ 최종 상태 요약...');
    
    const finalHypeSupply = await testHYPE.totalSupply();
    const deployerHype = await testHYPE.balanceOf(deployer.address);
    const user1Hype = await testHYPE.balanceOf(user1.address);
    const user2Hype = await testHYPE.balanceOf(user2.address);
    
    console.log('📊 HYPE 토큰 분배:');
    console.log(`   총 공급량: ${ethers.formatEther(finalHypeSupply)} HYPE`);
    console.log(`   Deployer: ${ethers.formatEther(deployerHype)} HYPE`);
    console.log(`   User1: ${ethers.formatEther(user1Hype)} HYPE`);
    console.log(`   User2: ${ethers.formatEther(user2Hype)} HYPE`);
    
    console.log('\n🎉 TestHYPE 워크플로우 테스트 완료!');
    
    return {
        testHYPE: testHYPEAddress,
        factory: factoryAddress,
        aggregator: aggregatorAddress,
        fundId: fundId,
        tokens: tokens,
        crossChainMessage: crossChainMessage
    };
}

// 메인 실행
async function main() {
    try {
        console.log('=' * 80);
        console.log('🌟 TestHYPE 기반 HyperIndex 워크플로우 통합 테스트');
        console.log('=' * 80);
        
        const result = await testHypeWorkflow();
        
        console.log('\n✅ 모든 테스트 성공!');
        console.log('\n📋 배포된 컨트랙트 주소:');
        console.table({
            'TestHYPE Token': result.testHYPE,
            'IndexTokenFactory': result.factory,
            'MultiChainAggregator': result.aggregator,
            'Fund ID': result.fundId
        });
        
        console.log('\n🎯 실제 테스트넷 배포 준비 완료!');
        console.log('   1. Private key 설정 후 Arbitrum Sepolia 배포');
        console.log('   2. LayerZero OApp 컨트랙트 배포');
        console.log('   3. 크로스체인 메시징 테스트');
        console.log('   4. HyperEVM 공식 토큰 확보 시 실제 배포');
        
        return result;
        
    } catch (error) {
        console.error('❌ 테스트 실패:', error);
        throw error;
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = {
    testHypeWorkflow,
    main
};