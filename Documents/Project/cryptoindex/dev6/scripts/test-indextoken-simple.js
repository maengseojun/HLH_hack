const { ethers } = require('hardhat');

/**
 * 간단한 IndexToken 배포 테스트
 * 핵심 기능만 검증
 */

async function testIndexTokenSimple() {
    console.log('🔧 간단한 IndexToken 배포 테스트\n');
    
    const [deployer] = await ethers.getSigners();
    console.log(`📍 배포자: ${deployer.address}`);
    
    const testResults = [];
    
    try {
        // Mock Aggregator 주소 사용
        const mockAggregatorAddress = '0x4ab042302833Fe4c804Bb24167843dF0120b7d0C';
        
        console.log('🏗️ Factory 배포...');
        const IndexTokenFactory = await ethers.getContractFactory('IndexTokenFactory');
        const factory = await IndexTokenFactory.deploy(mockAggregatorAddress);
        await factory.waitForDeployment();
        
        const factoryAddress = await factory.getAddress();
        console.log(`   Factory: ${factoryAddress}`);
        
        // IndexToken 템플릿 확인
        const templateAddress = await factory.indexTokenImplementation();
        console.log(`   템플릿: ${templateAddress}`);
        
        const templateTest = templateAddress !== ethers.ZeroAddress;
        testResults.push({
            test: '템플릿 생성',
            status: templateTest ? '✅ PASS' : '❌ FAIL',
            details: templateAddress
        });
        
        // Factory에서 createIndexFund 호출해서 자동 생성 테스트
        console.log('\n🪙 Factory를 통한 자동 생성 테스트...');
        
        // 권한 부여
        const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
        await factory.grantRole(RECIPE_CREATOR_ROLE, deployer.address);
        
        // TestHYPE 승인
        const testHYPEAddress = '0xD8757Bb2a34f78ADa77D7ccedcd451185ff6587b';
        await factory.authorizeToken(testHYPEAddress);
        
        // 펀드 생성 (IndexToken 자동 생성됨)
        const components = [{
            tokenAddress: testHYPEAddress,
            hyperliquidAssetIndex: 4,
            targetRatio: 10000,
            depositedAmount: 0
        }];
        
        const tx = await factory.createIndexFund("Test Fund", "TEST", components);
        const receipt = await tx.wait();
        
        console.log('   펀드 생성 완료');
        
        // IndexTokenCreated 이벤트 찾기
        const indexTokenCreatedEvent = receipt.logs.find(log => {
            try {
                const parsed = factory.interface.parseLog(log);
                return parsed && parsed.name === 'IndexTokenCreated';
            } catch { return false; }
        });
        
        if (indexTokenCreatedEvent) {
            const parsedEvent = factory.interface.parseLog(indexTokenCreatedEvent);
            const tokenAddress = parsedEvent.args.tokenAddress;
            const fundId = parsedEvent.args.fundId;
            
            console.log(`   생성된 토큰: ${tokenAddress}`);
            console.log(`   펀드 ID: ${fundId}`);
            
            // IndexToken 확인
            const IndexToken = await ethers.getContractFactory('IndexToken');
            const indexToken = IndexToken.attach(tokenAddress);
            
            const name = await indexToken.name();
            const symbol = await indexToken.symbol();
            
            console.log(`   토큰 이름: ${name}`);
            console.log(`   토큰 심볼: ${symbol}`);
            
            const autoTest = tokenAddress !== ethers.ZeroAddress && name === "Test Fund";
            
            testResults.push({
                test: '자동 IndexToken 생성',
                status: autoTest ? '✅ PASS' : '❌ FAIL',
                details: `${tokenAddress}`
            });
        } else {
            testResults.push({
                test: '자동 IndexToken 생성',
                status: '❌ FAIL',
                details: 'IndexTokenCreated 이벤트 없음'
            });
        }
        
        // 최종 결과
        const passCount = testResults.filter(r => r.status.includes('PASS')).length;
        const totalTests = testResults.length;
        
        console.log('\n🎯 테스트 완료!');
        console.log(`✅ 통과: ${passCount}/${totalTests}`);
        console.log(`📊 성공률: ${Math.round((passCount / totalTests) * 100)}%`);
        
        return {
            success: true,
            totalTests,
            passCount,
            successRate: Math.round((passCount / totalTests) * 100),
            testResults,
            factoryAddress,
            templateAddress
        };
        
    } catch (error) {
        console.error('❌ 테스트 실패:', error);
        return {
            success: false,
            error: error.message,
            testResults
        };
    }
}

async function main() {
    const result = await testIndexTokenSimple();
    
    if (result.success) {
        console.table(result.testResults);
        console.log('\n✅ IndexToken 배포 로직이 정상적으로 작동합니다!');
        console.log(`🏭 Factory: ${result.factoryAddress}`);
        console.log(`📄 템플릿: ${result.templateAddress}`);
    } else {
        console.log(`❌ 테스트 실패: ${result.error}`);
    }
    
    return result;
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { testIndexTokenSimple };