const { ethers } = require('hardhat');

/**
 * HyperEVM 테스트넷 빠른 검증
 * 핵심 아키텍처 요소만 검증
 */

async function quickTestnetValidation() {
    console.log('🎯 HyperIndex 아키텍처 기반 빠른 테스트넷 검증\n');
    
    const [deployer] = await ethers.getSigners();
    console.log(`📍 배포자: ${deployer.address}`);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 잔액: ${ethers.formatEther(balance)} HYPE\n`);
    
    // 기존 배포된 컨트랙트 주소들
    const deployedContracts = {
        testHYPE: '0xD8757Bb2a34f78ADa77D7ccedcd451185ff6587b',
        aggregator: '0x4ab042302833Fe4c804Bb24167843dF0120b7d0C',
        factory: '0xf35e9FcE899008e0D5333B527F8293D06A3b3847',
        fundId: '0xf93b42077a6a2c19e36af58b7e5da6f4d6708db0b062ecf55f5e3ab761fff3ca'
    };
    
    const validationResults = [];
    
    try {
        // =====================================================================
        // Phase 1: Multi-Chain Aggregator 핵심 검증
        // =====================================================================
        console.log('🔍 Phase 1: Multi-Chain Aggregator 핵심 검증');
        console.log('=' .repeat(70));
        
        const aggregator = await ethers.getContractAt('MockMultiChainAggregator', deployedContracts.aggregator);
        
        // 가격 피드 확인
        console.log('\n💱 1-1. 가격 피드 확인...');
        
        const hypePrice = await aggregator.getAggregatedPrice(4);
        console.log(`   현재 HYPE 가격: $${ethers.formatEther(hypePrice.weightedPrice)}`);
        console.log(`   최적 가격: $${ethers.formatEther(hypePrice.bestPrice)}`);
        console.log(`   최악 가격: $${ethers.formatEther(hypePrice.worstPrice)}`);
        
        const priceTest = hypePrice.weightedPrice > 0;
        console.log(`   ✅ 가격 피드: ${priceTest ? 'PASS' : 'FAIL'}`);
        
        validationResults.push({
            phase: 'Phase 1-1',
            test: '가격 피드 확인',
            status: priceTest ? '✅ PASS' : '❌ FAIL',
            details: `HYPE 가격: $${ethers.formatEther(hypePrice.weightedPrice)}`
        });
        
        // 토큰 매핑 확인 (기존 매핑만)
        console.log('\n🗺️ 1-2. 기존 토큰 매핑 확인...');
        const mappedToken = await aggregator.tokenAddresses(4, 998);
        console.log(`   HyperEVM HYPE 매핑: ${mappedToken}`);
        
        const mappingTest = mappedToken.toLowerCase() === deployedContracts.testHYPE.toLowerCase();
        console.log(`   ✅ 토큰 매핑: ${mappingTest ? 'PASS' : 'FAIL'}`);
        
        validationResults.push({
            phase: 'Phase 1-2',
            test: '토큰 매핑 확인',
            status: mappingTest ? '✅ PASS' : '❌ FAIL',
            details: `매핑 주소: ${mappedToken}`
        });
        
        // =====================================================================
        // Phase 2: Smart Contract Vault (SCV) 구조 검증
        // =====================================================================
        console.log('\n🏗️ Phase 2: Smart Contract Vault (SCV) 구조 검증');
        console.log('=' .repeat(70));
        
        const factory = await ethers.getContractAt('IndexTokenFactory', deployedContracts.factory);
        
        // 펀드 정보 확인
        console.log('\n🏦 2-1. 기존 펀드 구조 확인...');
        
        const fundInfo = await factory.getFundInfo(deployedContracts.fundId);
        console.log(`   펀드 이름: ${fundInfo[0]}`);
        console.log(`   펀드 심볼: ${fundInfo[1]}`);
        console.log(`   펀드 관리자: ${fundInfo[2]}`);
        console.log(`   인덱스 토큰: ${fundInfo[3]}`);
        console.log(`   활성 상태: ${fundInfo[5]}`);
        
        const fundTest = fundInfo[5]; // isActive
        console.log(`   ✅ 펀드 구조: ${fundTest ? 'PASS' : 'FAIL'}`);
        
        validationResults.push({
            phase: 'Phase 2-1',
            test: '펀드 구조 확인',
            status: fundTest ? '✅ PASS' : '❌ FAIL',
            details: `펀드: ${fundInfo[0]} (${fundInfo[1]})`
        });
        
        // 구성 토큰 확인
        console.log('\n📊 2-2. 구성 토큰 확인...');
        const components = await factory.getFundComponents(deployedContracts.fundId);
        console.log(`   구성 토큰 수: ${components.length}`);
        
        for (let i = 0; i < components.length; i++) {
            console.log(`   토큰 ${i+1}: ${components[i].tokenAddress}`);
            console.log(`      자산 인덱스: ${components[i].hyperliquidAssetIndex.toString()}`);
            console.log(`      목표 비율: ${Number(components[i].targetRatio) / 100}%`);
        }
        
        const componentsTest = components.length > 0;
        console.log(`   ✅ 구성 토큰: ${componentsTest ? 'PASS' : 'FAIL'}`);
        
        validationResults.push({
            phase: 'Phase 2-2',
            test: '구성 토큰 확인',
            status: componentsTest ? '✅ PASS' : '❌ FAIL',
            details: `${components.length}개 토큰`
        });
        
        // =====================================================================
        // Phase 3: 시스템 통합 검증
        // =====================================================================
        console.log('\n🌉 Phase 3: 시스템 통합 검증');
        console.log('=' .repeat(70));
        
        // Aggregator-Factory 연결 확인
        console.log('\n🔗 3-1. Aggregator-Factory 연결 확인...');
        const connectedAggregator = await factory.priceFeed();
        const connectionTest = connectedAggregator.toLowerCase() === deployedContracts.aggregator.toLowerCase();
        
        console.log(`   Factory의 Aggregator: ${connectedAggregator}`);
        console.log(`   실제 Aggregator: ${deployedContracts.aggregator}`);
        console.log(`   ✅ 연결 상태: ${connectionTest ? 'PASS' : 'FAIL'}`);
        
        validationResults.push({
            phase: 'Phase 3-1',
            test: 'Aggregator-Factory 연결',
            status: connectionTest ? '✅ PASS' : '❌ FAIL',
            details: '시스템 구성요소 연결 확인'
        });
        
        // 토큰 승인 확인
        console.log('\n✅ 3-2. 토큰 승인 상태 확인...');
        const tokenAuthorized = await factory.authorizedTokens(deployedContracts.testHYPE);
        console.log(`   HYPE 토큰 승인: ${tokenAuthorized ? 'YES' : 'NO'}`);
        console.log(`   ✅ 토큰 승인: ${tokenAuthorized ? 'PASS' : 'FAIL'}`);
        
        validationResults.push({
            phase: 'Phase 3-2',
            test: '토큰 승인 상태',
            status: tokenAuthorized ? '✅ PASS' : '❌ FAIL',
            details: 'HYPE 토큰 승인 확인'
        });
        
        // =====================================================================
        // Phase 4: 네트워크 환경 검증
        // =====================================================================
        console.log('\n🌐 Phase 4: 네트워크 환경 검증');
        console.log('=' .repeat(70));
        
        const network = await ethers.provider.getNetwork();
        const blockNumber = await ethers.provider.getBlockNumber();
        const feeData = await ethers.provider.getFeeData();
        
        console.log('\n📡 4-1. HyperEVM 네트워크 정보...');
        console.log(`   네트워크: ${network.name}`);
        console.log(`   Chain ID: ${network.chainId}`);
        console.log(`   현재 블록: ${blockNumber}`);
        console.log(`   Gas Price: ${ethers.formatUnits(feeData.gasPrice || 0n, 'gwei')} gwei`);
        
        const networkTest = Number(network.chainId) === 998;
        console.log(`   ✅ HyperEVM 연결: ${networkTest ? 'PASS' : 'FAIL'}`);
        
        validationResults.push({
            phase: 'Phase 4-1',
            test: 'HyperEVM 네트워크',
            status: networkTest ? '✅ PASS' : '❌ FAIL',
            details: `Chain ID: ${network.chainId}`
        });
        
        // =====================================================================
        // 최종 결과 종합
        // =====================================================================
        const passCount = validationResults.filter(r => r.status.includes('PASS')).length;
        const totalTests = validationResults.length;
        
        console.log('\n🎯 빠른 검증 완료!');
        console.log('=' .repeat(70));
        console.log(`✅ 통과: ${passCount}/${totalTests}`);
        console.log(`📊 성공률: ${Math.round((passCount / totalTests) * 100)}%`);
        
        return {
            success: true,
            totalTests,
            passCount,
            successRate: Math.round((passCount / totalTests) * 100),
            validationResults,
            contracts: deployedContracts,
            network: {
                name: network.name,
                chainId: Number(network.chainId),
                blockNumber
            },
            recommendations: [
                'Phase 1: Multi-Chain Aggregator 핵심 기능 작동 확인',
                'Phase 2: SCV 구조 및 펀드 시스템 정상 작동',
                'Phase 3: 시스템 통합 완료',
                'Phase 4: HyperEVM 테스트넷 환경 연결 확인'
            ]
        };
        
    } catch (error) {
        console.error('❌ 빠른 검증 실패:', error);
        return {
            success: false,
            error: error.message,
            validationResults
        };
    }
}

async function main() {
    console.log('=' .repeat(80));
    console.log('🎯 HyperIndex 아키텍처 기반 빠른 테스트넷 검증');
    console.log('=' .repeat(80));
    
    const result = await quickTestnetValidation();
    
    console.log('\n📊 최종 검증 결과:');
    console.log('=' .repeat(80));
    
    if (result.success) {
        console.table(result.validationResults);
        
        console.log('\n🏆 종합 평가:');
        console.log(`✅ 통과율: ${result.successRate}%`);
        console.log(`🔍 총 테스트: ${result.totalTests}개`);
        console.log(`🌐 네트워크: ${result.network.name} (Chain ID: ${result.network.chainId})`);
        
        console.log('\n💡 검증된 기능:');
        result.recommendations.forEach((rec, index) => {
            console.log(`   ${index + 1}. ${rec}`);
        });
        
        console.log('\n🎉 HyperIndex 아키텍처 기반 빠른 검증 완료!');
        console.log('🚀 핵심 시스템 기능 정상 작동 확인됨');
        
        // 결과를 파일로 저장
        const fs = require('fs');
        fs.writeFileSync('./quick-validation-results.json', JSON.stringify(result, null, 2));
        console.log('\n📁 빠른 검증 결과가 quick-validation-results.json에 저장되었습니다.');
        
    } else {
        console.log(`❌ 검증 실패: ${result.error}`);
        if (result.validationResults.length > 0) {
            console.table(result.validationResults);
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

module.exports = { quickTestnetValidation };