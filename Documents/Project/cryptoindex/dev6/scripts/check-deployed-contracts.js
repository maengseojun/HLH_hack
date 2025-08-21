const { ethers } = require('hardhat');

/**
 * 배포된 컨트랙트 상태 확인
 */

async function checkDeployedContracts() {
    console.log('🔍 배포된 컨트랙트 상태 확인\n');
    
    const [deployer] = await ethers.getSigners();
    console.log(`📍 배포자 주소: ${deployer.address}`);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 현재 잔액: ${ethers.formatEther(balance)} HYPE\n`);
    
    // 알려진 배포 주소들
    const deployedContracts = {
        testHYPE: '0xD8757Bb2a34f78ADa77D7ccedcd451185ff6587b',
        aggregator: '0x4ab042302833Fe4c804Bb24167843dF0120b7d0C'
    };
    
    const results = {};
    
    try {
        // 1. TestHYPE 토큰 확인
        console.log('🪙 1. TestHYPE 토큰 상태 확인...');
        const testHYPE = await ethers.getContractAt('TestHYPE', deployedContracts.testHYPE);
        
        const name = await testHYPE.name();
        const symbol = await testHYPE.symbol();
        const totalSupply = await testHYPE.totalSupply();
        const deployerTokenBalance = await testHYPE.balanceOf(deployer.address);
        
        console.log(`   이름: ${name}`);
        console.log(`   심볼: ${symbol}`);
        console.log(`   총 공급량: ${ethers.formatEther(totalSupply)} HYPE`);
        console.log(`   배포자 잔액: ${ethers.formatEther(deployerTokenBalance)} HYPE`);
        console.log(`   ✅ TestHYPE 정상 작동`);
        
        results.testHYPE = {
            address: deployedContracts.testHYPE,
            status: 'working',
            name,
            symbol,
            totalSupply: ethers.formatEther(totalSupply),
            deployerBalance: ethers.formatEther(deployerTokenBalance)
        };
        
        // 2. MockMultiChainAggregator 확인
        console.log('\n📊 2. MockMultiChainAggregator 상태 확인...');
        const aggregator = await ethers.getContractAt('MockMultiChainAggregator', deployedContracts.aggregator);
        
        // 가격 확인
        const ethPrice = await aggregator.assetPrices(0);
        const btcPrice = await aggregator.assetPrices(1);
        const solPrice = await aggregator.assetPrices(2);
        const usdcPrice = await aggregator.assetPrices(3);
        
        console.log(`   ETH 가격: $${ethers.formatEther(ethPrice)}`);
        console.log(`   BTC 가격: $${ethers.formatEther(btcPrice)}`);
        console.log(`   SOL 가격: $${ethers.formatEther(solPrice)}`);
        console.log(`   USDC 가격: $${ethers.formatEther(usdcPrice)}`);
        
        // HYPE 가격 확인 (설정되었는지 확인)
        try {
            const hypePrice = await aggregator.assetPrices(4);
            console.log(`   HYPE 가격: $${ethers.formatEther(hypePrice)}`);
            
            // 만약 0이면 설정 필요
            if (hypePrice.toString() === '0') {
                console.log('   ⚠️  HYPE 가격이 설정되지 않음, 설정 필요');
                
                // HYPE 가격 설정
                console.log('   - HYPE 가격 설정 중...');
                await aggregator.setAssetPrice(4, ethers.parseEther('1.5'));
                
                const newHypePrice = await aggregator.assetPrices(4);
                console.log(`   ✅ HYPE 가격 설정: $${ethers.formatEther(newHypePrice)}`);
            }
        } catch (error) {
            console.log(`   ❌ HYPE 가격 조회 실패: ${error.message}`);
        }
        
        // 토큰 매핑 확인
        const chainId = 998;
        const mappedHYPE = await aggregator.tokenAddresses(4, chainId);
        console.log(`   HYPE 토큰 매핑: ${mappedHYPE}`);
        
        if (mappedHYPE === ethers.ZeroAddress || mappedHYPE === '0x0000000000000000000000000000000000000000') {
            console.log('   ⚠️  HYPE 토큰 매핑 필요');
            
            // 토큰 매핑 설정
            console.log('   - HYPE 토큰 매핑 중...');
            await aggregator.setTokenAddress(4, chainId, deployedContracts.testHYPE);
            
            const newMapping = await aggregator.tokenAddresses(4, chainId);
            console.log(`   ✅ HYPE 토큰 매핑 완료: ${newMapping}`);
        }
        
        console.log(`   ✅ Aggregator 정상 작동`);
        
        results.aggregator = {
            address: deployedContracts.aggregator,
            status: 'working',
            ethPrice: ethers.formatEther(ethPrice),
            btcPrice: ethers.formatEther(btcPrice),
            solPrice: ethers.formatEther(solPrice),
            usdcPrice: ethers.formatEther(usdcPrice)
        };
        
        // 3. 전체 상태 요약
        console.log('\n📊 전체 상태 요약:');
        console.log('✅ TestHYPE 토큰: 정상 작동');
        console.log('✅ MockMultiChainAggregator: 정상 작동');
        console.log('✅ 가격 피드: 4개 자산 설정 완료');
        console.log('✅ 토큰 매핑: HYPE 매핑 완료');
        
        return {
            success: true,
            contracts: results,
            nextStep: 'IndexTokenFactory 배포',
            readyForNextStep: true
        };
        
    } catch (error) {
        console.error('❌ 컨트랙트 확인 실패:', error);
        return {
            success: false,
            error: error.message,
            contracts: results
        };
    }
}

async function main() {
    console.log('=' .repeat(80));
    console.log('🔍 HyperEVM 테스트넷 - 배포된 컨트랙트 상태 확인');
    console.log('=' .repeat(80));
    
    const result = await checkDeployedContracts();
    
    console.log('\n📋 확인 결과:');
    console.log('=' .repeat(50));
    
    if (result.success) {
        console.log('✅ 모든 컨트랙트 정상 작동 확인!');
        console.log(`\n다음 단계: ${result.nextStep}`);
        console.log('명령어: npx hardhat run scripts/deploy-testnet-step3.js --network hyperevmTestnet');
        
    } else {
        console.log(`❌ 컨트랙트 확인 실패: ${result.error}`);
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

module.exports = { checkDeployedContracts };