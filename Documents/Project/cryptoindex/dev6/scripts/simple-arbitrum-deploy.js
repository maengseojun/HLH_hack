const { ethers } = require('hardhat');

async function main() {
    console.log('🚀 Arbitrum Sepolia 간단 배포 시작...');
    
    const [deployer] = await ethers.getSigners();
    console.log('Deployer:', deployer.address);
    
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log('Balance:', ethers.formatEther(balance), 'ETH');
    
    if (balance < ethers.parseEther("0.01")) {
        console.log('❌ 잔액 부족! Arbitrum Sepolia ETH가 필요합니다.');
        console.log('📍 Faucet: https://faucet.quicknode.com/arbitrum/sepolia');
        console.log(`📍 주소: ${deployer.address}`);
        return;
    }
    
    console.log('✅ 잔액 충분, 배포 진행...');
    
    // 1. Mock 토큰들 배포
    console.log('\n📦 테스트 토큰 배포 중...');
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    
    const tokens = {};
    const tokenData = [
        { name: 'Test USDC', symbol: 'TUSDC', decimals: 18 },
        { name: 'Test ETH', symbol: 'TETH', decimals: 18 }
    ];
    
    for (const token of tokenData) {
        const contract = await MockERC20.deploy(token.name, token.symbol, token.decimals);
        await contract.waitForDeployment();
        const address = await contract.getAddress();
        tokens[token.symbol] = address;
        
        // 초기 공급량 발행
        await contract.mint(deployer.address, ethers.parseEther('1000000'));
        console.log(`✅ ${token.name}: ${address}`);
    }
    
    // 2. MockMultiChainAggregator 배포
    console.log('\n🔗 MockMultiChainAggregator 배포 중...');
    const MockAggregator = await ethers.getContractFactory('MockMultiChainAggregator');
    const aggregator = await MockAggregator.deploy();
    await aggregator.waitForDeployment();
    const aggregatorAddress = await aggregator.getAddress();
    console.log(`✅ MockMultiChainAggregator: ${aggregatorAddress}`);
    
    // 3. IndexTokenFactory 배포
    console.log('\n🏭 IndexTokenFactory 배포 중...');
    const IndexTokenFactory = await ethers.getContractFactory('IndexTokenFactory');
    const factory = await IndexTokenFactory.deploy(aggregatorAddress);
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log(`✅ IndexTokenFactory: ${factoryAddress}`);
    
    // 4. 배포 정보 저장
    const deploymentInfo = {
        network: 'arbitrumSepolia',
        chainId: 421614,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            factory: factoryAddress,
            aggregator: aggregatorAddress,
            tokens: tokens
        }
    };
    
    console.log('\n🎉 배포 완료!');
    console.log('📋 배포된 컨트랙트:');
    console.table(deploymentInfo.contracts);
    
    // 5. 기본 설정
    console.log('\n⚙️  기본 설정 중...');
    
    // 역할 부여
    const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
    await factory.grantRole(RECIPE_CREATOR_ROLE, deployer.address);
    
    // 토큰 승인
    for (const tokenAddress of Object.values(tokens)) {
        await factory.authorizeToken(tokenAddress, true);
    }
    
    console.log('✅ 기본 설정 완료');
    
    // 6. 간단한 테스트
    console.log('\n🧪 간단 테스트...');
    
    const componentTokens = [
        {
            tokenAddress: tokens.TUSDC,
            hyperliquidAssetIndex: 0,
            targetRatio: 5000, // 50%
            depositedAmount: 0
        },
        {
            tokenAddress: tokens.TETH,
            hyperliquidAssetIndex: 1,
            targetRatio: 5000, // 50%
            depositedAmount: 0
        }
    ];
    
    try {
        const createTx = await factory.createIndexFund(
            'Arbitrum Test Index',
            'ATI',
            componentTokens
        );
        const receipt = await createTx.wait();
        console.log('✅ 테스트 인덱스 펀드 생성 성공');
        console.log(`   Tx Hash: ${receipt.hash}`);
    } catch (error) {
        console.log('⚠️  테스트 실패:', error.message);
    }
    
    console.log('\n🎯 다음 단계:');
    console.log('1. LayerZero OApp 배포');
    console.log('2. 크로스체인 메시징 테스트');
    console.log('3. 전체 워크플로우 검증');
    
    console.log('\n📍 Arbitrum Sepolia 익스플로러:');
    console.log(`https://sepolia.arbiscan.io/address/${factoryAddress}`);
    
    return deploymentInfo;
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('❌ 배포 실패:', error);
            process.exit(1);
        });
}

module.exports = main;