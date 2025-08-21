const { ethers } = require('hardhat');

/**
 * 로컬 하드햇 네트워크에서 전체 HyperIndex 시스템 배포
 * - 모든 컨트랙트 순차 배포
 * - 초기 설정 및 권한 부여
 * - 테스트 데이터 준비
 */

async function deployAllLocal() {
    console.log('🚀 HyperIndex 전체 시스템 로컬 배포 시작\n');
    
    const [deployer, user1, user2, treasury] = await ethers.getSigners();
    const deployments = {};
    
    console.log('📍 계정 정보:');
    console.log(`   Deployer: ${deployer.address}`);
    console.log(`   User1: ${user1.address}`);
    console.log(`   User2: ${user2.address}`);
    console.log(`   Treasury: ${treasury.address}\n`);
    
    try {
        // 1. TestHYPE 토큰 배포
        console.log('1️⃣ TestHYPE 토큰 배포...');
        const TestHYPE = await ethers.getContractFactory('TestHYPE');
        const testHYPE = await TestHYPE.deploy();
        await testHYPE.waitForDeployment();
        deployments.testHYPE = await testHYPE.getAddress();
        console.log(`   ✅ TestHYPE: ${deployments.testHYPE}`);
        
        // 사용자들에게 테스트 토큰 배포
        await testHYPE.mint(user1.address, ethers.parseEther('50000'));
        await testHYPE.mint(user2.address, ethers.parseEther('30000'));
        await testHYPE.mint(treasury.address, ethers.parseEther('10000'));
        console.log('   💰 테스트 토큰 배포 완료\n');
        
        // 2. Mock 토큰들 배포 (USDC, ETH, BTC 시뮬레이션)
        console.log('2️⃣ Mock 토큰들 배포...');
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        
        const tokens = {
            USDC: { name: 'Mock USDC', symbol: 'mUSDC', decimals: 6 },
            ETH: { name: 'Mock ETH', symbol: 'mETH', decimals: 18 },
            BTC: { name: 'Mock BTC', symbol: 'mBTC', decimals: 8 },
            SOL: { name: 'Mock SOL', symbol: 'mSOL', decimals: 9 }
        };
        
        for (const [key, tokenInfo] of Object.entries(tokens)) {
            const token = await MockERC20.deploy(tokenInfo.name, tokenInfo.symbol, tokenInfo.decimals);
            await token.waitForDeployment();
            const tokenAddress = await token.getAddress();
            deployments[key.toLowerCase()] = tokenAddress;
            
            // 사용자들에게 토큰 민트
            const supply = ethers.parseUnits('100000', tokenInfo.decimals);
            await token.mint(deployer.address, supply);
            await token.mint(user1.address, supply);
            await token.mint(user2.address, supply);
            
            console.log(`   ✅ ${tokenInfo.name}: ${tokenAddress}`);
        }
        console.log();
        
        // 3. MockMultiChainAggregator 배포
        console.log('3️⃣ MockMultiChainAggregator 배포...');
        const MockAggregator = await ethers.getContractFactory('MockMultiChainAggregator');
        const aggregator = await MockAggregator.deploy();
        await aggregator.waitForDeployment();
        deployments.aggregator = await aggregator.getAddress();
        console.log(`   ✅ Aggregator: ${deployments.aggregator}`);
        
        // 가격 설정
        const assetPrices = [
            { index: 0, price: ethers.parseEther('2000') },   // ETH
            { index: 1, price: ethers.parseEther('30000') },  // BTC  
            { index: 2, price: ethers.parseEther('100') },    // SOL
            { index: 3, price: ethers.parseEther('1') },      // USDC
            { index: 4, price: ethers.parseEther('1.5') }     // HYPE
        ];
        
        for (const asset of assetPrices) {
            await aggregator.setAssetPrice(asset.index, asset.price);
        }
        
        // 토큰 주소 매핑
        const chainId = 31337; // Hardhat 로컬
        await aggregator.setTokenAddress(0, chainId, deployments.eth);
        await aggregator.setTokenAddress(1, chainId, deployments.btc);
        await aggregator.setTokenAddress(2, chainId, deployments.sol);
        await aggregator.setTokenAddress(3, chainId, deployments.usdc);
        await aggregator.setTokenAddress(4, chainId, deployments.testHYPE);
        
        console.log('   💰 가격 피드 및 토큰 매핑 완료\n');
        
        // 4. IndexTokenFactory 배포
        console.log('4️⃣ IndexTokenFactory 배포...');
        const IndexTokenFactory = await ethers.getContractFactory('IndexTokenFactory');
        const factory = await IndexTokenFactory.deploy(deployments.aggregator);
        await factory.waitForDeployment();
        deployments.factory = await factory.getAddress();
        console.log(`   ✅ IndexTokenFactory: ${deployments.factory}`);
        
        // 권한 설정
        const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
        const PLATFORM_ADMIN_ROLE = await factory.PLATFORM_ADMIN_ROLE();
        
        await factory.grantRole(RECIPE_CREATOR_ROLE, deployer.address);
        await factory.grantRole(PLATFORM_ADMIN_ROLE, deployer.address);
        await factory.grantRole(RECIPE_CREATOR_ROLE, user1.address); // User1도 펀드 생성 가능
        
        // 모든 토큰 승인
        const allTokenAddresses = [
            deployments.testHYPE,
            deployments.usdc,
            deployments.eth,
            deployments.btc,
            deployments.sol
        ];
        
        for (const tokenAddress of allTokenAddresses) {
            await factory.authorizeToken(tokenAddress, true);
        }
        
        console.log('   🔐 권한 설정 및 토큰 승인 완료\n');
        
        // 5. Mock AMM 배포 (RedemptionManager용)
        console.log('5️⃣ Mock AMM 배포...');
        const MockAMM = await ethers.getContractFactory('MockERC20'); // 임시로 MockERC20 사용
        const mockAMM = await MockAMM.deploy("Mock AMM", "AMM", 18);
        await mockAMM.waitForDeployment();
        deployments.mockAMM = await mockAMM.getAddress();
        console.log(`   ✅ Mock AMM: ${deployments.mockAMM}`);
        
        // 6. Mock ChainVault 배포
        console.log('6️⃣ Mock ChainVault 배포...');
        const mockChainVault = await MockERC20.deploy("Mock ChainVault", "VAULT", 18);
        await mockChainVault.waitForDeployment();
        deployments.mockChainVault = await mockChainVault.getAddress();
        console.log(`   ✅ Mock ChainVault: ${deployments.mockChainVault}`);
        
        // 7. RedemptionManager 배포 (토큰 소각용) - 컨트랙트가 복잡하므로 스킵
        console.log('7️⃣ RedemptionManager 배포 스킵...');
        console.log('   ⚠️  RedemptionManager는 의존성이 복잡하여 스킵');
        console.log('   💡 대신 IndexTokenFactory 자체 기능으로 테스트\n');
        
        // 8. 테스트 인덱스 펀드 생성
        console.log('8️⃣ 테스트 인덱스 펀드 생성...');
        
        const componentTokens = [
            {
                tokenAddress: deployments.testHYPE,
                hyperliquidAssetIndex: 4,
                targetRatio: 3000, // 30%
                depositedAmount: 0
            },
            {
                tokenAddress: deployments.usdc,
                hyperliquidAssetIndex: 3,
                targetRatio: 2500, // 25%
                depositedAmount: 0
            },
            {
                tokenAddress: deployments.eth,
                hyperliquidAssetIndex: 0,
                targetRatio: 2500, // 25%
                depositedAmount: 0
            },
            {
                tokenAddress: deployments.btc,
                hyperliquidAssetIndex: 1,
                targetRatio: 2000, // 20%
                depositedAmount: 0
            }
        ];
        
        const createTx = await factory.createIndexFund(
            'HyperIndex Multi-Asset Fund',
            'HMAF',
            componentTokens
        );
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
        
        deployments.testFundId = fundId;
        console.log(`   ✅ 테스트 펀드 생성: ${fundId}`);
        console.log('   📊 구성: HYPE(30%) + USDC(25%) + ETH(25%) + BTC(20%)\n');
        
        return {
            success: true,
            deployments,
            testFundId: fundId,
            accounts: {
                deployer: deployer.address,
                user1: user1.address,
                user2: user2.address,
                treasury: treasury.address
            }
        };
        
    } catch (error) {
        console.error('❌ 로컬 배포 실패:', error);
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('=' .repeat(80));
    console.log('🚀 HyperIndex - 로컬 전체 시스템 배포');
    console.log('=' .repeat(80));
    
    const result = await deployAllLocal();
    
    if (result.success) {
        console.log('📋 배포 결과 요약:');
        console.table(result.deployments);
        
        console.log('\n👥 계정 정보:');
        console.table(result.accounts);
        
        console.log('\n🎉 로컬 전체 시스템 배포 완료!');
        console.log('다음 단계: E2E 테스트 실행');
        console.log('명령어: npx hardhat run scripts/test-e2e-workflow.js');
        
        // 배포 정보를 파일로 저장
        const fs = require('fs');
        fs.writeFileSync(
            './deployments-local.json',
            JSON.stringify(result, null, 2)
        );
        console.log('📁 배포 정보가 deployments-local.json에 저장되었습니다.');
        
    } else {
        console.log('❌ 배포 실패:', result.error);
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

module.exports = { deployAllLocal };