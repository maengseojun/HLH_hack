const { ethers } = require('hardhat');

/**
 * HyperEVM 테스트넷 단계별 배포 - Step 2: Aggregator
 * 이전 단계 결과를 이용하여 Aggregator 배포
 */

async function deployStep2() {
    console.log('🚀 HyperEVM 테스트넷 배포 - Step 2: Aggregator\n');
    
    const [deployer] = await ethers.getSigners();
    console.log(`📍 배포자 주소: ${deployer.address}`);
    
    const initialBalance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 현재 잔액: ${ethers.formatEther(initialBalance)} HYPE\n`);
    
    // Step 1 결과 확인 (알려진 주소 사용)
    const step1Results = {
        testHYPE: '0xD8757Bb2a34f78ADa77D7ccedcd451185ff6587b'
    };
    
    console.log('📋 Step 1 배포 결과 확인:');
    console.log(`   TestHYPE: ${step1Results.testHYPE}`);
    
    const deployResults = { ...step1Results };
    
    try {
        // 1. MockMultiChainAggregator 배포
        console.log('\n📊 1. MockMultiChainAggregator 배포...');
        const MockAggregator = await ethers.getContractFactory('MockMultiChainAggregator');
        
        console.log('   - 배포 시작...');
        const aggregator = await MockAggregator.deploy();
        console.log(`   - 트랜잭션 해시: ${aggregator.deploymentTransaction().hash}`);
        
        console.log('   - 배포 대기 중...');
        await aggregator.waitForDeployment();
        const aggregatorAddress = await aggregator.getAddress();
        
        console.log(`   ✅ Aggregator 배포 완료: ${aggregatorAddress}`);
        deployResults.aggregator = aggregatorAddress;
        
        // 2. 가격 피드 설정
        console.log('\n💰 2. 가격 피드 설정...');
        
        const assetPrices = [
            { index: 0, name: 'ETH', price: ethers.parseEther('2000') },
            { index: 1, name: 'BTC', price: ethers.parseEther('30000') },
            { index: 2, name: 'SOL', price: ethers.parseEther('100') },
            { index: 3, name: 'USDC', price: ethers.parseEther('1') },
            { index: 4, name: 'HYPE', price: ethers.parseEther('1.5') }
        ];
        
        console.log('   - 가격 설정 중...');
        for (const asset of assetPrices) {
            await aggregator.setAssetPrice(asset.index, asset.price);
            console.log(`      ✅ ${asset.name}: $${ethers.formatEther(asset.price)}`);
            
            // 각 설정 사이에 짧은 대기
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        // 3. 토큰 주소 매핑
        console.log('\n🗺️  3. 토큰 주소 매핑...');
        const chainId = 998; // HyperEVM
        
        await aggregator.setTokenAddress(4, chainId, step1Results.testHYPE);
        console.log(`      ✅ HYPE 토큰 매핑: ${step1Results.testHYPE}`);
        
        // 매핑 확인
        const mappedAddress = await aggregator.tokenAddresses(4, chainId);
        console.log(`      🔍 매핑 확인: ${mappedAddress}`);
        
        // 4. 가격 조회 테스트
        console.log('\n📈 4. 가격 조회 테스트...');
        const priceData = await aggregator.getAggregatedPrice(4);
        console.log(`      HYPE 가격: $${ethers.formatEther(priceData.weightedPrice)}`);
        
        // 최종 가스 사용량 계산
        const finalBalance = await ethers.provider.getBalance(deployer.address);
        const gasUsed = initialBalance - finalBalance;
        
        console.log('\n📊 Step 2 배포 완료!');
        console.log(`💸 총 가스 사용량: ${ethers.formatEther(gasUsed)} HYPE`);
        console.log(`💰 남은 잔액: ${ethers.formatEther(finalBalance)} HYPE`);
        
        return {
            success: true,
            step: 2,
            contracts: deployResults,
            gasUsed: ethers.formatEther(gasUsed),
            remainingBalance: ethers.formatEther(finalBalance)
        };
        
    } catch (error) {
        console.error('❌ Step 2 배포 실패:', error);
        
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
    console.log('🚀 HyperEVM 테스트넷 - Step 2: Aggregator 배포');
    console.log('=' .repeat(80));
    
    const result = await deployStep2();
    
    console.log('\n📋 Step 2 결과:');
    console.log('=' .repeat(50));
    
    if (result.success) {
        console.table(result.contracts);
        console.log(`\n✅ Step 2 배포 성공!`);
        console.log(`💸 가스 사용량: ${result.gasUsed} HYPE`);
        console.log(`💰 남은 잔액: ${result.remainingBalance} HYPE`);
        
        console.log('\n다음 단계: Step 3 - IndexTokenFactory 배포');
        console.log('명령어: npx hardhat run scripts/deploy-testnet-step3.js --network hyperevmTestnet');
        
        // 결과를 파일로 저장
        const fs = require('fs');
        fs.writeFileSync('./testnet-step2-results.json', JSON.stringify(result, null, 2));
        console.log('📁 배포 결과가 testnet-step2-results.json에 저장되었습니다.');
        
    } else {
        console.log(`❌ Step 2 배포 실패: ${result.error}`);
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

module.exports = { deployStep2 };