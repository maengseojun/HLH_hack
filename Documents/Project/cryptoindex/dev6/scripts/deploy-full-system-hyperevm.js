const { ethers } = require('hardhat');

async function deployFullSystem() {
    console.log('🚀 HyperEVM 전체 시스템 배포...\n');
    
    try {
        const [deployer] = await ethers.getSigners();
        
        console.log('📋 배포 정보:');
        console.log(`   Deployer: ${deployer.address}`);
        console.log(`   Network: ${hre.network.name}`);
        
        // 네트워크 정보 확인
        const network = await ethers.provider.getNetwork();
        console.log(`   Chain ID: ${network.chainId}`);
        
        // 잔액 확인
        const balance = await ethers.provider.getBalance(deployer.address);
        console.log(`   Balance: ${ethers.formatEther(balance)} HYPE\n`);
        
        // 1. TestHYPE 토큰 배포
        console.log('1️⃣ TestHYPE 토큰 배포...');
        const TestHYPE = await ethers.getContractFactory('TestHYPE');
        const testHYPE = await TestHYPE.deploy();
        await testHYPE.waitForDeployment();
        const testHYPEAddress = await testHYPE.getAddress();
        console.log(`✅ TestHYPE: ${testHYPEAddress}\n`);
        
        // 2. Mock 토큰들 배포
        console.log('2️⃣ Mock 토큰들 배포...');
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        
        const mockUSDC = await MockERC20.deploy("Mock USDC", "mUSDC", 6);
        await mockUSDC.waitForDeployment();
        const mockUSDCAddress = await mockUSDC.getAddress();
        console.log(`✅ Mock USDC: ${mockUSDCAddress}`);
        
        const mockETH = await MockERC20.deploy("Mock ETH", "mETH", 18);
        await mockETH.waitForDeployment();
        const mockETHAddress = await mockETH.getAddress();
        console.log(`✅ Mock ETH: ${mockETHAddress}`);
        
        const mockBTC = await MockERC20.deploy("Mock BTC", "mBTC", 8);
        await mockBTC.waitForDeployment();
        const mockBTCAddress = await mockBTC.getAddress();
        console.log(`✅ Mock BTC: ${mockBTCAddress}\n`);
        
        // 3. MockMultiChainAggregator 배포
        console.log('3️⃣ MockMultiChainAggregator 배포...');
        const MockAggregator = await ethers.getContractFactory('MockMultiChainAggregator');
        const aggregator = await MockAggregator.deploy();
        await aggregator.waitForDeployment();
        const aggregatorAddress = await aggregator.getAddress();
        console.log(`✅ MockMultiChainAggregator: ${aggregatorAddress}\n`);
        
        // 4. IndexTokenFactory 배포
        console.log('4️⃣ IndexTokenFactory 배포...');
        const IndexTokenFactory = await ethers.getContractFactory('IndexTokenFactory');
        const factory = await IndexTokenFactory.deploy(aggregatorAddress);
        await factory.waitForDeployment();
        const factoryAddress = await factory.getAddress();
        console.log(`✅ IndexTokenFactory: ${factoryAddress}\n`);
        
        // 5. 가격 설정
        console.log('5️⃣ 가격 피드 설정...');
        await aggregator.setAssetPrice(0, ethers.parseEther('2000'));  // ETH = $2000
        await aggregator.setAssetPrice(1, ethers.parseEther('30000')); // BTC = $30000
        await aggregator.setAssetPrice(3, ethers.parseEther('1'));     // USDC = $1
        await aggregator.setAssetPrice(4, ethers.parseEther('1.5'));   // HYPE = $1.5
        console.log('✅ 가격 피드 설정 완료\n');
        
        // 6. 토큰 승인
        console.log('6️⃣ 토큰 승인...');
        const PLATFORM_ADMIN_ROLE = await factory.PLATFORM_ADMIN_ROLE();
        await factory.grantRole(PLATFORM_ADMIN_ROLE, deployer.address);
        
        await factory.authorizeToken(testHYPEAddress, true);
        await factory.authorizeToken(mockUSDCAddress, true);
        await factory.authorizeToken(mockETHAddress, true);
        await factory.authorizeToken(mockBTCAddress, true);
        console.log('✅ 모든 토큰 승인 완료\n');
        
        console.log('🎉 HyperEVM 시스템 배포 완료!\n');
        
        console.log('📋 배포된 컨트랙트 주소:');
        console.table({
            'TestHYPE Token': testHYPEAddress,
            'Mock USDC': mockUSDCAddress,
            'Mock ETH': mockETHAddress,
            'Mock BTC': mockBTCAddress,
            'MultiChain Aggregator': aggregatorAddress,
            'IndexToken Factory': factoryAddress
        });
        
        console.log('\n🚀 다음 단계:');
        console.log('1. 인덱스 펀드 생성');
        console.log('2. 컴포넌트 토큰 예치');
        console.log('3. 인덱스 토큰 발행');
        console.log('4. NAV 계산 테스트');
        
        return {
            testHYPE: testHYPEAddress,
            mockUSDC: mockUSDCAddress,
            mockETH: mockETHAddress,
            mockBTC: mockBTCAddress,
            aggregator: aggregatorAddress,
            factory: factoryAddress
        };
        
    } catch (error) {
        console.error('❌ 시스템 배포 실패:', error);
        throw error;
    }
}

async function main() {
    console.log('=' .repeat(60));
    console.log('🚀 HyperEVM 전체 시스템 배포');
    console.log('=' .repeat(60));
    
    const contracts = await deployFullSystem();
    return contracts;
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { deployFullSystem };