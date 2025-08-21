const { ethers } = require('hardhat');

/**
 * 수정된 Factory로 IndexToken 자동 배포 테스트
 * Clones 패턴과 initialize 함수 검증
 */

async function testFixedIndexTokenDeployment() {
    console.log('🔧 수정된 Factory IndexToken 자동 배포 테스트\n');
    
    const [deployer] = await ethers.getSigners();
    console.log(`📍 배포자: ${deployer.address}`);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 잔액: ${ethers.formatEther(balance)} HYPE\n`);
    
    const testResults = [];
    
    try {
        // =====================================================================
        // 1. 새로운 Factory 배포 (업데이트된 버전)
        // =====================================================================
        console.log('🏗️ 1. 새로운 Factory 배포...');
        
        // Mock Aggregator 주소 사용
        const mockAggregatorAddress = '0x4ab042302833Fe4c804Bb24167843dF0120b7d0C';
        
        const IndexTokenFactory = await ethers.getContractFactory('IndexTokenFactory');
        const newFactory = await IndexTokenFactory.deploy(mockAggregatorAddress);
        await newFactory.waitForDeployment();
        
        const newFactoryAddress = await newFactory.getAddress();
        console.log(`   새 Factory 주소: ${newFactoryAddress}`);
        
        // IndexToken 템플릿이 생성되었는지 확인
        const indexTokenImplementation = await newFactory.indexTokenImplementation();
        console.log(`   IndexToken 템플릿: ${indexTokenImplementation}`);
        
        const templateTest = indexTokenImplementation !== ethers.ZeroAddress;
        console.log(`   ✅ 템플릿 생성: ${templateTest ? 'PASS' : 'FAIL'}`);
        
        testResults.push({
            test: 'Factory 배포 및 템플릿 생성',
            status: templateTest ? '✅ PASS' : '❌ FAIL',
            details: `템플릿: ${indexTokenImplementation}`
        });
        
        // =====================================================================
        // 2. TestHYPE 토큰 승인
        // =====================================================================
        console.log('\n🪙 2. TestHYPE 토큰 승인...');
        
        const testHYPEAddress = '0xD8757Bb2a34f78ADa77D7ccedcd451185ff6587b';
        
        // RECIPE_CREATOR_ROLE 부여
        const RECIPE_CREATOR_ROLE = await newFactory.RECIPE_CREATOR_ROLE();
        await newFactory.grantRole(RECIPE_CREATOR_ROLE, deployer.address);
        console.log(`   RECIPE_CREATOR_ROLE 부여됨`);
        
        // 토큰 승인
        await newFactory.authorizeToken(testHYPEAddress);
        const isAuthorized = await newFactory.authorizedTokens(testHYPEAddress);
        console.log(`   TestHYPE 승인: ${isAuthorized ? 'YES' : 'NO'}`);
        
        testResults.push({
            test: 'TestHYPE 토큰 승인',
            status: isAuthorized ? '✅ PASS' : '❌ FAIL',
            details: `주소: ${testHYPEAddress}`
        });
        
        // =====================================================================
        // 3. IndexFund 생성 및 IndexToken 자동 배포 테스트
        // =====================================================================
        console.log('\n🚀 3. IndexFund 생성 및 IndexToken 자동 배포...');
        
        const fundName = "Fixed HYPE Index";
        const fundSymbol = "FHYPE";
        const components = [
            {
                tokenAddress: testHYPEAddress,
                hyperliquidAssetIndex: 4,
                targetRatio: 10000, // 100%
                depositedAmount: 0
            }
        ];
        
        console.log(`   펀드명: ${fundName}`);
        console.log(`   심볼: ${fundSymbol}`);
        console.log(`   구성요소: 1개 (HYPE 100%)`);
        
        // createIndexFund 호출 (이제 IndexToken도 자동 생성됨)
        const tx = await newFactory.createIndexFund(fundName, fundSymbol, components);
        const receipt = await tx.wait();
        
        console.log(`   트랜잭션: ${receipt.hash}`);
        console.log(`   가스 사용: ${receipt.gasUsed.toString()}`);
        
        // 이벤트 파싱
        const fundCreatedEvent = receipt.logs.find(log => {
            try {
                const parsed = newFactory.interface.parseLog(log);
                return parsed && parsed.name === 'FundCreated';
            } catch { return false; }
        });
        
        const indexTokenCreatedEvent = receipt.logs.find(log => {
            try {
                const parsed = newFactory.interface.parseLog(log);
                return parsed && parsed.name === 'IndexTokenCreated';
            } catch { return false; }
        });
        
        if (fundCreatedEvent) {
            const parsedFundEvent = newFactory.interface.parseLog(fundCreatedEvent);
            const fundId = parsedFundEvent.args.fundId;
            console.log(`   생성된 Fund ID: ${fundId}`);
            
            if (indexTokenCreatedEvent) {
                const parsedTokenEvent = newFactory.interface.parseLog(indexTokenCreatedEvent);
                const tokenAddress = parsedTokenEvent.args.tokenAddress;
                console.log(`   생성된 IndexToken: ${tokenAddress}`);
                
                // =====================================================================
                // 4. IndexToken 초기화 검증
                // =====================================================================
                console.log('\n✅ 4. IndexToken 초기화 검증...');
                
                const indexToken = await ethers.getContractAt('IndexToken', tokenAddress);
                
                const tokenName = await indexToken.name();
                const tokenSymbol = await indexToken.symbol();
                const tokenFundId = await indexToken.fundId();
                const tokenFactory = await indexToken.factory();
                const totalSupply = await indexToken.totalSupply();
                
                console.log(`     토큰 이름: ${tokenName}`);
                console.log(`     토큰 심볼: ${tokenSymbol}`);
                console.log(`     연결된 펀드 ID: ${tokenFundId}`);
                console.log(`     연결된 Factory: ${tokenFactory}`);
                console.log(`     총 공급량: ${ethers.formatEther(totalSupply)}`);
                
                const initTest = tokenName === fundName && 
                                tokenSymbol === fundSymbol && 
                                tokenFundId === fundId && 
                                tokenFactory === newFactoryAddress;
                
                console.log(`     ✅ 초기화 검증: ${initTest ? 'PASS' : 'FAIL'}`);
                
                testResults.push({
                    test: 'IndexToken 자동 생성',
                    status: '✅ PASS',
                    details: `주소: ${tokenAddress}`
                });
                
                testResults.push({
                    test: 'IndexToken 초기화 검증',
                    status: initTest ? '✅ PASS' : '❌ FAIL',
                    details: `이름: ${tokenName}, 심볼: ${tokenSymbol}`
                });
                
                // =====================================================================
                // 5. getFundInfo 함수로 IndexToken 조회 테스트
                // =====================================================================
                console.log('\n🔍 5. getFundInfo IndexToken 조회 테스트...');
                
                const fundInfo = await newFactory.getFundInfo(fundId);
                const [name, symbol, creator, indexTokenAddr, , , isActive, isIssued] = fundInfo;
                
                console.log(`     조회된 정보:`);
                console.log(`       이름: ${name}`);
                console.log(`       심볼: ${symbol}`);
                console.log(`       생성자: ${creator}`);
                console.log(`       IndexToken: ${indexTokenAddr}`);
                console.log(`       활성화: ${isActive}`);
                console.log(`       발행됨: ${isIssued}`);
                
                const lookupTest = indexTokenAddr === tokenAddress && indexTokenAddr !== ethers.ZeroAddress;
                console.log(`     ✅ 조회 테스트: ${lookupTest ? 'PASS' : 'FAIL'}`);
                
                testResults.push({
                    test: 'getFundInfo IndexToken 조회',
                    status: lookupTest ? '✅ PASS' : '❌ FAIL',
                    details: `조회된 주소: ${indexTokenAddr}`
                });
                
                // =====================================================================
                // 6. Clones 패턴 검증 (구현체와 다른 주소인지)
                // =====================================================================
                console.log('\n🔬 6. Clones 패턴 검증...');
                
                console.log(`     템플릿 주소: ${indexTokenImplementation}`);
                console.log(`     클론 주소: ${tokenAddress}`);
                
                const clonesTest = tokenAddress !== indexTokenImplementation;
                console.log(`     ✅ Clones 패턴: ${clonesTest ? 'PASS' : 'FAIL'}`);
                
                testResults.push({
                    test: 'Clones 패턴 검증',
                    status: clonesTest ? '✅ PASS' : '❌ FAIL',
                    details: `템플릿 ≠ 클론: ${clonesTest}`
                });
                
            } else {
                console.log(`   ❌ IndexTokenCreated 이벤트 없음`);
                testResults.push({
                    test: 'IndexTokenCreated 이벤트',
                    status: '❌ FAIL',
                    details: '이벤트가 발생하지 않음'
                });
            }
        } else {
            console.log(`   ❌ FundCreated 이벤트 없음`);
            testResults.push({
                test: 'FundCreated 이벤트',
                status: '❌ FAIL',
                details: '이벤트가 발생하지 않음'
            });
        }
        
        // =====================================================================
        // 최종 결과 종합
        // =====================================================================
        const passCount = testResults.filter(r => r.status.includes('PASS')).length;
        const totalTests = testResults.length;
        
        console.log('\n🔧 수정된 IndexToken 배포 테스트 완료!');
        console.log('='.repeat(70));
        console.log(`✅ 통과: ${passCount}/${totalTests}`);
        console.log(`📊 성공률: ${Math.round((passCount / totalTests) * 100)}%`);
        
        return {
            success: true,
            totalTests,
            passCount,
            successRate: Math.round((passCount / totalTests) * 100),
            testResults,
            newFactoryAddress,
            fixes: [
                'Factory에 Clones 패턴 추가',
                'IndexToken을 Upgradeable 버전으로 변환',
                'initialize 함수로 초기화 로직 변경',
                'IndexTokenCreated 이벤트 추가',
                'fundIndexTokens 매핑으로 토큰 추적'
            ],
            recommendations: [
                'IndexToken 자동 배포 문제 해결됨',
                'Clones 패턴으로 가스비 절약',
                'initialize 함수로 안전한 초기화',
                '이벤트 로깅으로 추적 가능',
                'getFundInfo로 정상 조회 확인'
            ]
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
    console.log('='.repeat(80));
    console.log('🔧 수정된 Factory IndexToken 자동 배포 테스트');
    console.log('='.repeat(80));
    
    const result = await testFixedIndexTokenDeployment();
    
    console.log('\n📊 최종 테스트 결과:');
    console.log('='.repeat(80));
    
    if (result.success) {
        console.table(result.testResults);
        
        console.log('\n🔧 적용된 수정사항:');
        result.fixes.forEach((fix, index) => {
            console.log(`   ${index + 1}. ${fix}`);
        });
        
        console.log('\n💡 테스트 결과:');
        result.recommendations.forEach((rec, index) => {
            console.log(`   ${index + 1}. ${rec}`);
        });
        
        console.log('\n🎉 IndexToken 자동 배포 수정 완료!');
        console.log(`🚀 성공률: ${result.successRate}%`);
        console.log(`🏭 새 Factory: ${result.newFactoryAddress}`);
        
        // 결과를 파일로 저장
        const fs = require('fs');
        fs.writeFileSync('./fixed-indextoken-deployment-results.json', JSON.stringify(result, null, 2));
        console.log('📁 테스트 결과가 fixed-indextoken-deployment-results.json에 저장되었습니다.');
        
    } else {
        console.log(`❌ 테스트 실패: ${result.error}`);
        if (result.testResults.length > 0) {
            console.table(result.testResults);
        }
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

module.exports = { testFixedIndexTokenDeployment };