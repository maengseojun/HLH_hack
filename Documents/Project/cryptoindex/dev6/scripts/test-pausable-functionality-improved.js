const { ethers } = require('hardhat');

/**
 * 개선된 Pausable 긴급 정지 기능 테스트
 * 단계별 검증 및 상세 에러 분석 포함
 */

async function testPausableFunctionalityImproved() {
    console.log('⏸️ 개선된 Pausable 긴급 정지 기능 테스트\n');
    
    const [deployer, user] = await ethers.getSigners();
    console.log(`📍 배포자: ${deployer.address}`);
    console.log(`👤 사용자: ${user.address}`);
    
    const testResults = [];
    
    try {
        // =====================================================================
        // 1. Factory 배포 및 기본 설정 (완전한 사전 조건 설정)
        // =====================================================================
        console.log('🏗️ 1. Factory 배포 및 사전 조건 완전 설정...');
        
        const mockAggregatorAddress = '0x4ab042302833Fe4c804Bb24167843dF0120b7d0C';
        
        const IndexTokenFactory = await ethers.getContractFactory('IndexTokenFactory');
        const factory = await IndexTokenFactory.deploy(mockAggregatorAddress);
        await factory.waitForDeployment();
        
        const factoryAddress = await factory.getAddress();
        console.log(`   Factory: ${factoryAddress}`);
        
        // 초기 pause 상태 확인
        const initialPauseState = await factory.paused();
        console.log(`   초기 pause 상태: ${initialPauseState}`);
        
        testResults.push({
            test: 'Factory 배포 (개선된 Pausable)',
            status: !initialPauseState ? '✅ PASS' : '❌ FAIL',
            details: `초기 상태: ${initialPauseState ? 'paused' : 'active'}`
        });
        
        // =====================================================================
        // 2. 완전한 사전 조건 설정 (토큰 권한 + Role + 매개변수)
        // =====================================================================
        console.log('\n🔧 2. 완전한 사전 조건 설정...');
        
        // A. Role 권한 부여
        const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
        const PLATFORM_ADMIN_ROLE = await factory.PLATFORM_ADMIN_ROLE();
        
        await factory.grantRole(RECIPE_CREATOR_ROLE, deployer.address);
        await factory.grantRole(PLATFORM_ADMIN_ROLE, deployer.address);
        
        console.log('   ✅ RECIPE_CREATOR_ROLE 부여됨');
        console.log('   ✅ PLATFORM_ADMIN_ROLE 부여됨');
        
        // B. 토큰 권한 설정
        const testHYPEAddress = '0xD8757Bb2a34f78ADa77D7ccedcd451185ff6587b';
        await factory.authorizeToken(testHYPEAddress);
        
        const isTokenAuthorized = await factory.authorizedTokens(testHYPEAddress);
        console.log(`   토큰 승인 상태: ${isTokenAuthorized ? 'YES' : 'NO'}`);
        
        // C. 유효한 컴포넌트 구성
        const components = [{
            tokenAddress: testHYPEAddress,
            hyperliquidAssetIndex: 4,
            targetRatio: 10000, // 100%
            depositedAmount: 0
        }];
        
        console.log('   ✅ 모든 사전 조건 설정 완료');
        
        testResults.push({
            test: '완전한 사전 조건 설정',
            status: isTokenAuthorized ? '✅ PASS' : '❌ FAIL',
            details: `토큰 승인: ${isTokenAuthorized}, Role 설정: 완료`
        });
        
        // =====================================================================
        // 3. 정상 상태에서 모든 함수 테스트
        // =====================================================================
        console.log('\n✅ 3. 정상 상태에서 모든 함수 동작 검증...');
        
        let fundId;
        
        try {
            // A. createIndexFund 정상 동작
            const createTx = await factory.createIndexFund("Normal Fund", "NORM", components);
            const createReceipt = await createTx.wait();
            
            // FundCreated 이벤트에서 fundId 추출
            const fundCreatedEvent = createReceipt.logs.find(log => {
                try {
                    const parsed = factory.interface.parseLog(log);
                    return parsed && parsed.name === 'FundCreated';
                } catch { return false; }
            });
            
            if (fundCreatedEvent) {
                const parsedEvent = factory.interface.parseLog(fundCreatedEvent);
                fundId = parsedEvent.args.fundId;
                console.log(`   ✅ createIndexFund 성공 - Fund ID: ${fundId}`);
                
                testResults.push({
                    test: '정상 상태 createIndexFund',
                    status: '✅ PASS',
                    details: `Fund ID: ${fundId.slice(0, 10)}...`
                });
            } else {
                throw new Error('FundCreated 이벤트가 발생하지 않음');
            }
            
        } catch (error) {
            console.log(`   ❌ createIndexFund 실패: ${error.message}`);
            testResults.push({
                test: '정상 상태 createIndexFund',
                status: '❌ FAIL',
                details: error.message
            });
        }
        
        // =====================================================================
        // 4. Emergency Pause 실행
        // =====================================================================
        console.log('\n⏸️ 4. Emergency Pause 실행...');
        
        const pauseTx = await factory.emergencyPause();
        const pauseReceipt = await pauseTx.wait();
        
        const pauseState = await factory.paused();
        console.log(`   Pause 후 상태: ${pauseState}`);
        
        // EmergencyPaused 이벤트 확인
        const pauseEvent = pauseReceipt.logs.find(log => {
            try {
                const parsed = factory.interface.parseLog(log);
                return parsed && parsed.name === 'EmergencyPaused';
            } catch { return false; }
        });
        
        testResults.push({
            test: 'Emergency Pause 실행',
            status: (pauseState && pauseEvent) ? '✅ PASS' : '❌ FAIL',
            details: `상태: ${pauseState}, 이벤트: ${pauseEvent ? 'YES' : 'NO'}`
        });
        
        // =====================================================================
        // 5. Pause 상태에서 함수 차단 테스트 (상세 에러 분석)
        // =====================================================================
        console.log('\n🚫 5. Pause 상태에서 함수 차단 상세 검증...');
        
        const pausedFunctions = [
            {
                name: 'createIndexFund',
                test: async () => {
                    return await factory.createIndexFund("Blocked Fund", "BLOCK", components);
                },
                expectedError: 'IndexTokenFactory: Contract is paused'
            },
            {
                name: 'depositComponentTokens', 
                test: async () => {
                    if (!fundId) throw new Error('No valid fundId available');
                    return await factory.depositComponentTokens(fundId, [testHYPEAddress], [1000]);
                },
                expectedError: 'IndexTokenFactory: Contract is paused'
            },
            {
                name: 'transferIndexTokens',
                test: async () => {
                    if (!fundId) throw new Error('No valid fundId available');
                    return await factory.transferIndexTokens(fundId, deployer.address, 1000);
                },
                expectedError: 'IndexTokenFactory: Contract is paused'
            }
        ];
        
        for (const func of pausedFunctions) {
            try {
                console.log(`   테스트: ${func.name}`);
                await func.test();
                
                // 함수가 성공하면 안 됨
                console.log(`     ❌ FAIL: 함수가 차단되지 않음`);
                testResults.push({
                    test: `Pause 상태 ${func.name} 차단`,
                    status: '❌ FAIL',
                    details: '함수가 실행됨 (차단되어야 함)'
                });
                
            } catch (error) {
                const errorMessage = error.message || error.toString();
                console.log(`     에러 메시지: "${errorMessage}"`);
                
                // 정확한 pause 에러인지 확인 (OpenZeppelin v5 사용 시 EnforcedPause 커스텀 에러 발생)
                const isPauseError = errorMessage.includes('Contract is paused') ||
                                   errorMessage.includes('Pausable: paused') ||
                                   errorMessage.includes('EnforcedPause()');
                
                const isExpectedError = errorMessage.includes(func.expectedError) ||
                                      errorMessage.includes('EnforcedPause()');
                
                if (isPauseError || isExpectedError) {
                    console.log(`     ✅ PASS: 올바른 pause 에러로 차단됨`);
                    testResults.push({
                        test: `Pause 상태 ${func.name} 차단`,
                        status: '✅ PASS',
                        details: 'Pausable에 의해 올바르게 차단됨'
                    });
                } else {
                    console.log(`     ⚠️ WARNING: 다른 이유로 차단됨`);
                    console.log(`     실제 에러: ${errorMessage}`);
                    console.log(`     기대 에러: ${func.expectedError}`);
                    testResults.push({
                        test: `Pause 상태 ${func.name} 차단`,
                        status: '⚠️ WARNING',
                        details: `다른 에러로 차단: ${errorMessage.slice(0, 50)}...`
                    });
                }
            }
        }
        
        // =====================================================================
        // 6. Emergency Unpause 및 기능 복원
        // =====================================================================
        console.log('\n▶️ 6. Emergency Unpause 및 기능 복원...');
        
        const unpauseTx = await factory.emergencyUnpause();
        const unpauseReceipt = await unpauseTx.wait();
        
        const unpauseState = await factory.paused();
        console.log(`   Unpause 후 상태: ${unpauseState}`);
        
        // 기능 복원 테스트
        try {
            const restoreTx = await factory.createIndexFund("Restored Fund", "REST", components);
            await restoreTx.wait();
            console.log('   ✅ createIndexFund 기능 복원 확인됨');
            
            testResults.push({
                test: 'Emergency Unpause 및 기능 복원',
                status: '✅ PASS',
                details: 'Unpause 후 정상 동작 확인'
            });
        } catch (error) {
            console.log(`   ❌ 기능 복원 실패: ${error.message}`);
            testResults.push({
                test: 'Emergency Unpause 및 기능 복원',
                status: '❌ FAIL',
                details: `복원 실패: ${error.message}`
            });
        }
        
        // =====================================================================
        // 최종 결과 종합
        // =====================================================================
        const passCount = testResults.filter(r => r.status.includes('PASS')).length;
        const warningCount = testResults.filter(r => r.status.includes('WARNING')).length;
        const totalTests = testResults.length;
        
        console.log('\n⏸️ 개선된 Pausable 기능 테스트 완료!');
        console.log('='.repeat(80));
        console.log(`✅ 통과: ${passCount}/${totalTests}`);
        console.log(`⚠️ 경고: ${warningCount}/${totalTests}`);
        console.log(`📊 성공률: ${Math.round((passCount / totalTests) * 100)}%`);
        
        // 성공률 90% 이상이면 성공으로 간주
        const successRate = Math.round((passCount / totalTests) * 100);
        const isSuccess = successRate >= 90;
        
        return {
            success: isSuccess,
            totalTests,
            passCount,
            warningCount,
            successRate,
            testResults,
            factoryAddress,
            improvements: [
                '명시적 pause 체크를 모든 함수 첫 줄에 추가',
                '완전한 사전 조건 설정 (토큰 권한 + Role + 매개변수)',
                '상세한 에러 메시지 분석 및 검증',
                '각 함수별 기대 에러와 실제 에러 비교',
                'Fund ID 추출 및 재사용으로 realistic 테스트'
            ],
            finalStatus: isSuccess ? 'A급: 프로덕션 준비 완료' : 'B급: 추가 개선 필요'
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
    console.log('⏸️ 개선된 Pausable 긴급 정지 기능 테스트');
    console.log('='.repeat(80));
    
    const result = await testPausableFunctionalityImproved();
    
    console.log('\n📊 최종 테스트 결과:');
    console.log('='.repeat(80));
    
    if (result.success || result.successRate >= 90) {
        console.table(result.testResults);
        
        console.log('\n🔧 적용된 개선사항:');
        result.improvements.forEach((improvement, index) => {
            console.log(`   ${index + 1}. ${improvement}`);
        });
        
        console.log(`\n🎉 Priority 3 완성! ${result.finalStatus}`);
        console.log(`🚀 성공률: ${result.successRate}% (목표: 90%+)`);
        console.log(`🏭 Factory: ${result.factoryAddress}`);
        
        // 결과를 파일로 저장
        const fs = require('fs');
        fs.writeFileSync('./pausable-functionality-improved-results.json', JSON.stringify(result, null, 2));
        console.log('📁 개선된 테스트 결과가 pausable-functionality-improved-results.json에 저장되었습니다.');
        
    } else {
        console.log(`❌ 테스트 실패: ${result.error}`);
        if (result.testResults && result.testResults.length > 0) {
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

module.exports = { testPausableFunctionalityImproved };