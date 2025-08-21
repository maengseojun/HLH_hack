const { ethers } = require('hardhat');

/**
 * HyperEVM 테스트넷 단계별 배포 - Step 3: IndexTokenFactory
 * 최종 단계: 인덱스 토큰 팩토리 배포 및 테스트 펀드 생성
 */

async function deployStep3() {
    console.log('🚀 HyperEVM 테스트넷 배포 - Step 3: IndexTokenFactory\n');
    
    const [deployer] = await ethers.getSigners();
    console.log(`📍 배포자 주소: ${deployer.address}`);
    
    const initialBalance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 현재 잔액: ${ethers.formatEther(initialBalance)} HYPE\n`);
    
    // 이전 단계 결과 (확인된 주소)
    const previousContracts = {
        testHYPE: '0xD8757Bb2a34f78ADa77D7ccedcd451185ff6587b',
        aggregator: '0x4ab042302833Fe4c804Bb24167843dF0120b7d0C'
    };
    
    console.log('📋 이전 배포 결과 확인:');
    console.log(`   TestHYPE: ${previousContracts.testHYPE}`);
    console.log(`   Aggregator: ${previousContracts.aggregator}`);
    
    const deployResults = { ...previousContracts };
    
    try {
        // 1. IndexTokenFactory 배포
        console.log('\n🏭 1. IndexTokenFactory 배포...');
        const IndexTokenFactory = await ethers.getContractFactory('IndexTokenFactory');
        
        console.log('   - 배포 시작...');
        const factory = await IndexTokenFactory.deploy(previousContracts.aggregator);
        console.log(`   - 트랜잭션 해시: ${factory.deploymentTransaction().hash}`);
        
        console.log('   - 배포 대기 중...');
        await factory.waitForDeployment();
        const factoryAddress = await factory.getAddress();
        
        console.log(`   ✅ IndexTokenFactory 배포 완료: ${factoryAddress}`);
        deployResults.factory = factoryAddress;
        
        // 2. 권한 설정
        console.log('\n🔐 2. 권한 설정...');
        
        const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
        const PLATFORM_ADMIN_ROLE = await factory.PLATFORM_ADMIN_ROLE();
        
        console.log('   - 권한 부여 중...');
        await factory.grantRole(RECIPE_CREATOR_ROLE, deployer.address);
        await factory.grantRole(PLATFORM_ADMIN_ROLE, deployer.address);
        
        console.log('   ✅ 권한 설정 완료');
        
        // 3. 토큰 승인
        console.log('\n✅ 3. 토큰 승인...');
        
        await factory.authorizeToken(previousContracts.testHYPE, true);
        console.log('   ✅ TestHYPE 토큰 승인 완료');
        
        // 4. 테스트 인덱스 펀드 생성
        console.log('\n🏦 4. 테스트 인덱스 펀드 생성...');
        
        const componentTokens = [
            {
                tokenAddress: previousContracts.testHYPE,
                hyperliquidAssetIndex: 4, // HYPE
                targetRatio: 10000, // 100%
                depositedAmount: 0
            }
        ];
        
        console.log('   - 펀드 생성 중...');
        const createTx = await factory.createIndexFund(
            'HyperEVM Test Index Fund',
            'HTIF',
            componentTokens
        );
        
        console.log(`   - 트랜잭션 해시: ${createTx.hash}`);
        const createReceipt = await createTx.wait();
        
        // FundCreated 이벤트에서 fundId 추출
        let fundId = null;
        for (const log of createReceipt.logs) {
            try {
                const parsedLog = factory.interface.parseLog(log);
                if (parsedLog.name === 'FundCreated') {
                    fundId = parsedLog.args.fundId;
                    break;
                }
            } catch (error) {
                continue;
            }
        }
        
        console.log(`   ✅ 테스트 펀드 생성: ${fundId}`);
        deployResults.fundId = fundId;
        
        // 5. 펀드 정보 확인
        console.log('\n📊 5. 펀드 정보 확인...');
        
        const fundInfo = await factory.getFundInfo(fundId);
        console.log(`   펀드 이름: ${fundInfo[0]}`);
        console.log(`   펀드 심볼: ${fundInfo[1]}`);
        console.log(`   펀드 관리자: ${fundInfo[2]}`);
        console.log(`   인덱스 토큰: ${fundInfo[3]}`);
        console.log(`   생성 시간: ${new Date(Number(fundInfo[4]) * 1000).toISOString()}`);
        console.log(`   활성 상태: ${fundInfo[5]}`);
        
        deployResults.indexTokenAddress = fundInfo[3];
        
        // 6. 구성 토큰 확인
        const components = await factory.getFundComponents(fundId);
        console.log(`\n📋 6. 구성 토큰 (${components.length}개):`);
        
        for (let i = 0; i < components.length; i++) {
            console.log(`   토큰 ${i+1}:`);
            console.log(`      주소: ${components[i].tokenAddress}`);
            console.log(`      자산 인덱스: ${components[i].hyperliquidAssetIndex}`);
            console.log(`      목표 비율: ${components[i].targetRatio / 100}%`);
            console.log(`      예치된 양: ${ethers.formatEther(components[i].depositedAmount)}`);
        }
        
        // 최종 가스 사용량 계산
        const finalBalance = await ethers.provider.getBalance(deployer.address);
        const gasUsed = initialBalance - finalBalance;
        
        console.log('\n🎉 HyperEVM 테스트넷 전체 배포 완료!');
        console.log(`💸 Step 3 가스 사용량: ${ethers.formatEther(gasUsed)} HYPE`);
        console.log(`💰 남은 잔액: ${ethers.formatEther(finalBalance)} HYPE`);
        
        return {
            success: true,
            step: 3,
            contracts: deployResults,
            fundInfo: {
                id: fundId,
                name: fundInfo[0],
                symbol: fundInfo[1],
                manager: fundInfo[2],
                indexToken: fundInfo[3],
                active: fundInfo[5]
            },
            gasUsed: ethers.formatEther(gasUsed),
            remainingBalance: ethers.formatEther(finalBalance)
        };
        
    } catch (error) {
        console.error('❌ Step 3 배포 실패:', error);
        
        const finalBalance = await ethers.provider.getBalance(deployer.address);
        const gasUsed = initialBalance - finalBalance;
        
        return {
            success: false,
            error: error.message,
            contracts: deployResults,
            gasUsed: ethers.formatEther(gasUsed),
            remainingBalance: ethers.formatEther(finalBalance)
        };
    }
}

async function main() {
    console.log('=' .repeat(80));
    console.log('🚀 HyperEVM 테스트넷 - Step 3: IndexTokenFactory 배포');
    console.log('=' .repeat(80));
    
    const result = await deployStep3();
    
    console.log('\n📋 Step 3 최종 결과:');
    console.log('=' .repeat(50));
    
    if (result.success) {
        console.table(result.contracts);
        
        console.log('\n🏦 생성된 펀드 정보:');
        console.table(result.fundInfo);
        
        console.log(`\n🎉 전체 배포 성공!`);
        console.log(`💸 Step 3 가스 사용량: ${result.gasUsed} HYPE`);
        console.log(`💰 최종 잔액: ${result.remainingBalance} HYPE`);
        
        console.log('\n✅ HyperIndex 시스템 HyperEVM 테스트넷 배포 완료!');
        console.log('다음 단계: E2E 테스트 실행');
        
        // 결과를 파일로 저장
        const fs = require('fs');
        fs.writeFileSync('./testnet-final-results.json', JSON.stringify(result, null, 2));
        console.log('📁 최종 배포 결과가 testnet-final-results.json에 저장되었습니다.');
        
    } else {
        console.log(`❌ Step 3 배포 실패: ${result.error}`);
        console.log(`💸 가스 사용량: ${result.gasUsed} HYPE`);
        console.log(`💰 남은 잔액: ${result.remainingBalance} HYPE`);
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

module.exports = { deployStep3 };