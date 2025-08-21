const { ethers } = require('hardhat');

async function checkFundStatus() {
    console.log('🔍 펀드 상태 상세 확인\n');
    
    const [deployer] = await ethers.getSigners();
    console.log(`📍 배포자 주소: ${deployer.address}`);
    
    const deployedContracts = {
        factory: '0xf35e9FcE899008e0D5333B527F8293D06A3b3847',
        fundId: '0xf93b42077a6a2c19e36af58b7e5da6f4d6708db0b062ecf55f5e3ab761fff3ca'
    };
    
    try {
        const factory = await ethers.getContractAt('IndexTokenFactory', deployedContracts.factory);
        
        console.log('📊 펀드 정보 조회...');
        const fundInfo = await factory.getFundInfo(deployedContracts.fundId);
        
        console.log('\n펀드 정보:');
        console.log(`   이름: ${fundInfo[0]}`);
        console.log(`   심볼: ${fundInfo[1]}`);  
        console.log(`   관리자: ${fundInfo[2]}`);
        console.log(`   인덱스 토큰: ${fundInfo[3]}`);
        console.log(`   생성 시간: ${fundInfo[4].toString()}`);
        console.log(`   활성 상태: ${fundInfo[5]} (${fundInfo[5] ? 'ACTIVE' : 'INACTIVE'})`);
        
        console.log('\n🔧 구성 토큰 정보:');
        const components = await factory.getFundComponents(deployedContracts.fundId);
        console.log(`   구성 토큰 수: ${components.length}`);
        
        for (let i = 0; i < components.length; i++) {
            console.log(`\n   토큰 ${i+1}:`);
            console.log(`      주소: ${components[i].tokenAddress}`);
            console.log(`      자산 인덱스: ${components[i].hyperliquidAssetIndex.toString()}`);
            console.log(`      목표 비율: ${Number(components[i].targetRatio) / 100}%`);
            console.log(`      예치된 양: ${ethers.formatEther(components[i].depositedAmount)}`);
        }
        
        // 펀드가 비활성화된 경우 활성화 시도
        if (!fundInfo[5]) {
            console.log('\n⚡ 펀드 활성화 시도...');
            
            // 권한 확인
            const DEFAULT_ADMIN_ROLE = await factory.DEFAULT_ADMIN_ROLE();
            const hasAdminRole = await factory.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
            
            console.log(`   관리자 권한: ${hasAdminRole ? 'YES' : 'NO'}`);
            
            if (hasAdminRole) {
                // 펀드 활성화 함수가 있는지 확인하고 호출
                console.log('   - 펀드 활성화 시도...');
                // 현재 IndexTokenFactory에는 펀드 활성화 함수가 없으므로 스킵
                console.log('   - 현재 버전에서는 펀드 활성화 함수가 없습니다.');
            }
        }
        
        return {
            success: true,
            fundInfo: {
                name: fundInfo[0],
                symbol: fundInfo[1],
                manager: fundInfo[2],
                indexToken: fundInfo[3],
                creationTime: fundInfo[4].toString(),
                isActive: fundInfo[5]
            },
            components: components.map(c => ({
                tokenAddress: c.tokenAddress,
                hyperliquidAssetIndex: c.hyperliquidAssetIndex.toString(),
                targetRatio: Number(c.targetRatio),
                depositedAmount: ethers.formatEther(c.depositedAmount)
            }))
        };
        
    } catch (error) {
        console.error('❌ 펀드 상태 확인 실패:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function main() {
    const result = await checkFundStatus();
    
    if (result.success) {
        console.log('\n✅ 펀드 상태 확인 완료');
        console.table(result.fundInfo);
        console.log('\n구성 토큰:');
        console.table(result.components);
    } else {
        console.log(`❌ 확인 실패: ${result.error}`);
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

module.exports = { checkFundStatus };