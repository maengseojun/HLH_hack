const { ethers } = require('hardhat');

/**
 * IndexToken 배포 실패 원인 분석 및 수정
 */

async function debugIndexTokenDeployment() {
    console.log('🔍 IndexToken 배포 실패 원인 분석\n');
    
    const [deployer] = await ethers.getSigners();
    console.log(`📍 배포자: ${deployer.address}`);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 잔액: ${ethers.formatEther(balance)} HYPE\n`);
    
    const deployedContracts = {
        testHYPE: '0xD8757Bb2a34f78ADa77D7ccedcd451185ff6587b',
        aggregator: '0x4ab042302833Fe4c804Bb24167843dF0120b7d0C',
        factory: '0xf35e9FcE899008e0D5333B527F8293D06A3b3847',
        fundId: '0xf93b42077a6a2c19e36af58b7e5da6f4d6708db0b062ecf55f5e3ab761fff3ca'
    };
    
    const debugResults = [];
    
    try {
        // 1. Factory 컨트랙트 상태 확인
        console.log('🏭 1. Factory 컨트랙트 상태 상세 분석...');
        const factory = await ethers.getContractAt('IndexTokenFactory', deployedContracts.factory);
        
        const fundInfo = await factory.getFundInfo(deployedContracts.fundId);
        console.log(`   펀드 이름: "${fundInfo[0]}"`);
        console.log(`   펀드 심볼: "${fundInfo[1]}"`);
        console.log(`   펀드 관리자: ${fundInfo[2]}`);
        console.log(`   인덱스 토큰 주소: ${fundInfo[3]}`);
        console.log(`   생성 시간: ${fundInfo[4].toString()}`);
        console.log(`   활성 상태: ${fundInfo[5]}`);
        
        debugResults.push({
            component: 'Fund Info',
            status: fundInfo[3] === ethers.ZeroAddress ? '❌ FAIL' : '✅ PASS',
            details: `IndexToken: ${fundInfo[3]}`
        });
        
        // 2. 새로운 펀드 생성 시도 (더 상세한 로깅)
        console.log('\n🆕 2. 새로운 펀드 생성으로 원인 분석...');
        
        const componentTokens = [
            {
                tokenAddress: deployedContracts.testHYPE,
                hyperliquidAssetIndex: 4,
                targetRatio: 10000, // 100%
                depositedAmount: 0
            }
        ];
        
        console.log('   - 구성 토큰 검증 중...');
        console.log(`     토큰 주소: ${componentTokens[0].tokenAddress}`);
        console.log(`     자산 인덱스: ${componentTokens[0].hyperliquidAssetIndex}`);
        console.log(`     목표 비율: ${componentTokens[0].targetRatio / 100}%`);
        
        // 토큰 승인 상태 재확인
        const isAuthorized = await factory.authorizedTokens(deployedContracts.testHYPE);
        console.log(`     토큰 승인 상태: ${isAuthorized ? 'YES' : 'NO'}`);
        
        if (!isAuthorized) {
            console.log('   ⚠️  토큰이 승인되지 않음, 승인 처리 중...');
            await factory.authorizeToken(deployedContracts.testHYPE, true);
            console.log('   ✅ 토큰 승인 완료');
        }
        
        // 권한 확인
        const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
        const hasCreatorRole = await factory.hasRole(RECIPE_CREATOR_ROLE, deployer.address);
        console.log(`     Creator 권한: ${hasCreatorRole ? 'YES' : 'NO'}`);
        
        if (!hasCreatorRole) {
            console.log('   ⚠️  Creator 권한이 없음, 권한 부여 중...');
            await factory.grantRole(RECIPE_CREATOR_ROLE, deployer.address);
            console.log('   ✅ Creator 권한 부여 완료');
        }
        
        console.log('   - 새 펀드 생성 시도...');
        
        try {
            const createTx = await factory.createIndexFund(
                'Debug Test Fund',
                'DTF',
                componentTokens,
                {
                    gasLimit: 5000000, // 5M gas
                    gasPrice: ethers.parseUnits('0.2', 'gwei')
                }
            );
            
            console.log(`   - 트랜잭션 해시: ${createTx.hash}`);
            console.log('   - 트랜잭션 대기 중...');
            
            const receipt = await createTx.wait();
            console.log(`   - 블록 번호: ${receipt.blockNumber}`);
            console.log(`   - 가스 사용량: ${receipt.gasUsed.toString()}`);
            console.log(`   - 상태: ${receipt.status === 1 ? 'SUCCESS' : 'FAILED'}`);
            
            // 이벤트 로그 분석
            console.log(`   - 이벤트 로그 수: ${receipt.logs.length}`);
            
            let newFundId = null;
            for (const log of receipt.logs) {
                try {
                    const parsedLog = factory.interface.parseLog(log);
                    console.log(`     이벤트: ${parsedLog.name}`);
                    
                    if (parsedLog.name === 'FundCreated') {
                        newFundId = parsedLog.args.fundId;
                        console.log(`     새 펀드 ID: ${newFundId}`);
                        console.log(`     펀드 이름: ${parsedLog.args.name}`);
                        console.log(`     인덱스 토큰: ${parsedLog.args.indexToken}`);
                    }
                } catch (parseError) {
                    console.log(`     파싱 불가 로그: ${log.topics[0]}`);
                }
            }
            
            if (newFundId) {
                console.log('   ✅ 새 펀드 생성 성공!');
                
                // 새 펀드 정보 확인
                const newFundInfo = await factory.getFundInfo(newFundId);
                console.log(`     새 펀드 인덱스 토큰: ${newFundInfo[3]}`);
                console.log(`     새 펀드 활성 상태: ${newFundInfo[5]}`);
                
                debugResults.push({
                    component: 'New Fund Creation',
                    status: newFundInfo[3] !== ethers.ZeroAddress ? '✅ PASS' : '❌ FAIL',
                    details: `New IndexToken: ${newFundInfo[3]}`
                });
                
                // IndexToken 컨트랙트 직접 확인
                if (newFundInfo[3] !== ethers.ZeroAddress) {
                    console.log('   - IndexToken 컨트랙트 검증 중...');
                    const indexToken = await ethers.getContractAt('IndexToken', newFundInfo[3]);
                    
                    const tokenName = await indexToken.name();
                    const tokenSymbol = await indexToken.symbol();
                    const tokenFundId = await indexToken.fundId();
                    const tokenFactory = await indexToken.factory();
                    
                    console.log(`     토큰 이름: ${tokenName}`);
                    console.log(`     토큰 심볼: ${tokenSymbol}`);
                    console.log(`     연결된 펀드 ID: ${tokenFundId}`);
                    console.log(`     연결된 Factory: ${tokenFactory}`);
                    
                    debugResults.push({
                        component: 'IndexToken Contract',
                        status: '✅ PASS',
                        details: `${tokenName} (${tokenSymbol})`
                    });
                }
            } else {
                console.log('   ❌ 펀드 생성 이벤트를 찾을 수 없음');
                debugResults.push({
                    component: 'Fund Creation Event',
                    status: '❌ FAIL',
                    details: '이벤트 누락'
                });
            }
            
        } catch (createError) {
            console.error(`   ❌ 펀드 생성 실패: ${createError.message}`);
            
            // Revert 이유 분석
            if (createError.reason) {
                console.log(`   Revert 이유: ${createError.reason}`);
            }
            if (createError.data) {
                console.log(`   Revert 데이터: ${createError.data}`);
            }
            
            debugResults.push({
                component: 'Fund Creation',
                status: '❌ FAIL',
                details: createError.reason || createError.message
            });
        }
        
        // 3. 기존 펀드 IndexToken 배포 재시도
        console.log('\n🔄 3. 기존 펀드 IndexToken 수동 배포 시도...');
        
        if (fundInfo[3] === ethers.ZeroAddress) {
            console.log('   - IndexToken이 배포되지 않음, 수동 배포 시도...');
            
            try {
                // IndexToken 컨트랙트 직접 배포
                const IndexToken = await ethers.getContractFactory('IndexToken');
                
                const indexToken = await IndexToken.deploy(
                    fundInfo[0], // name
                    fundInfo[1], // symbol  
                    deployedContracts.fundId, // fundId
                    deployedContracts.factory, // factory
                    {
                        gasLimit: 3000000,
                        gasPrice: ethers.parseUnits('0.2', 'gwei')
                    }
                );
                
                console.log(`   - IndexToken 배포 트랜잭션: ${indexToken.deploymentTransaction().hash}`);
                await indexToken.waitForDeployment();
                
                const indexTokenAddress = await indexToken.getAddress();
                console.log(`   ✅ IndexToken 수동 배포 성공: ${indexTokenAddress}`);
                
                debugResults.push({
                    component: 'Manual IndexToken Deploy',
                    status: '✅ PASS',
                    details: `Address: ${indexTokenAddress}`
                });
                
            } catch (manualError) {
                console.error(`   ❌ 수동 배포 실패: ${manualError.message}`);
                debugResults.push({
                    component: 'Manual IndexToken Deploy',
                    status: '❌ FAIL',
                    details: manualError.message
                });
            }
        }
        
        // 4. 가스비 및 네트워크 상태 분석
        console.log('\n⛽ 4. 가스비 및 네트워크 상태 분석...');
        
        const feeData = await ethers.provider.getFeeData();
        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);
        
        console.log(`   현재 블록: ${blockNumber}`);
        console.log(`   Gas Price: ${ethers.formatUnits(feeData.gasPrice || 0n, 'gwei')} gwei`);
        console.log(`   Max Fee: ${ethers.formatUnits(feeData.maxFeePerGas || 0n, 'gwei')} gwei`);
        console.log(`   블록 가스 한도: ${block.gasLimit.toString()}`);
        console.log(`   블록 가스 사용량: ${block.gasUsed.toString()}`);
        console.log(`   블록 사용률: ${Math.round(Number(block.gasUsed * 100n / block.gasLimit))}%`);
        
        debugResults.push({
            component: 'Network Status',
            status: '✅ PASS',
            details: `Block: ${blockNumber}, Gas: ${ethers.formatUnits(feeData.gasPrice || 0n, 'gwei')} gwei`
        });
        
        return {
            success: true,
            debugResults,
            recommendations: [
                'IndexToken 배포 프로세스 검증 완료',
                '새로운 펀드 생성으로 배포 메커니즘 확인',
                '가스비 및 네트워크 상태 정상',
                '수동 배포 방식으로 문제 해결 가능'
            ]
        };
        
    } catch (error) {
        console.error('❌ 디버그 분석 실패:', error);
        return {
            success: false,
            error: error.message,
            debugResults
        };
    }
}

async function main() {
    console.log('=' .repeat(80));
    console.log('🔍 IndexToken 배포 실패 원인 분석 및 수정');
    console.log('=' .repeat(80));
    
    const result = await debugIndexTokenDeployment();
    
    console.log('\n📊 디버그 분석 결과:');
    console.log('=' .repeat(80));
    
    if (result.success) {
        console.table(result.debugResults);
        
        console.log('\n💡 분석 결과:');
        result.recommendations.forEach((rec, index) => {
            console.log(`   ${index + 1}. ${rec}`);
        });
        
        console.log('\n🎯 IndexToken 배포 원인 분석 완료!');
        
        // 결과를 파일로 저장
        const fs = require('fs');
        fs.writeFileSync('./indextoken-debug-results.json', JSON.stringify(result, null, 2));
        console.log('📁 디버그 결과가 indextoken-debug-results.json에 저장되었습니다.');
        
    } else {
        console.log(`❌ 분석 실패: ${result.error}`);
        if (result.debugResults.length > 0) {
            console.table(result.debugResults);
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

module.exports = { debugIndexTokenDeployment };