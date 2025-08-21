const { ethers } = require('hardhat');

/**
 * HyperEVM 테스트넷 단계별 배포 - Step 1: Core Tokens
 * Big Block 모드 nonce 충돌 방지를 위한 순차 배포
 */

async function deployStep1() {
    console.log('🚀 HyperEVM 테스트넷 배포 - Step 1: Core Tokens\n');
    
    const [deployer] = await ethers.getSigners();
    console.log(`📍 배포자 주소: ${deployer.address}`);
    
    const initialBalance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 초기 잔액: ${ethers.formatEther(initialBalance)} HYPE\n`);
    
    const deployResults = {};
    
    try {
        // 1. TestHYPE 토큰 배포
        console.log('🪙 1. TestHYPE 토큰 배포...');
        const TestHYPE = await ethers.getContractFactory('TestHYPE');
        
        console.log('   - 배포 시작...');
        const testHYPE = await TestHYPE.deploy();
        console.log(`   - 트랜잭션 해시: ${testHYPE.deploymentTransaction().hash}`);
        
        console.log('   - 배포 대기 중...');
        await testHYPE.waitForDeployment();
        const testHYPEAddress = await testHYPE.getAddress();
        
        console.log(`   ✅ TestHYPE 배포 완료: ${testHYPEAddress}`);
        deployResults.testHYPE = testHYPEAddress;
        
        // 배포 후 기본 정보 확인
        const totalSupply = await testHYPE.totalSupply();
        const deployerBalance = await testHYPE.balanceOf(deployer.address);
        console.log(`      총 공급량: ${ethers.formatEther(totalSupply)} HYPE`);
        console.log(`      배포자 잔액: ${ethers.formatEther(deployerBalance)} HYPE`);
        
        // Big Block 모드 대기 (60초)
        console.log('   ⏳ Big Block 모드 대기 중... (60초)');
        await new Promise(resolve => setTimeout(resolve, 60000));
        
        // 2. Mock USDC 토큰 배포
        console.log('\n💰 2. Mock USDC 토큰 배포...');
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        
        console.log('   - 배포 시작...');
        const mockUSDC = await MockERC20.deploy("Mock USDC", "mUSDC", 6);
        console.log(`   - 트랜잭션 해시: ${mockUSDC.deploymentTransaction().hash}`);
        
        console.log('   - 배포 대기 중...');
        await mockUSDC.waitForDeployment();
        const mockUSDCAddress = await mockUSDC.getAddress();
        
        console.log(`   ✅ Mock USDC 배포 완료: ${mockUSDCAddress}`);
        deployResults.mockUSDC = mockUSDCAddress;
        
        // 테스트 토큰 민트
        console.log('   - 테스트 토큰 민트 중...');
        const mintAmount = ethers.parseUnits('100000', 6); // 100,000 USDC
        await mockUSDC.mint(deployer.address, mintAmount);
        
        const usdcBalance = await mockUSDC.balanceOf(deployer.address);
        console.log(`      배포자 USDC 잔액: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
        
        // Big Block 모드 대기 (60초)
        console.log('   ⏳ Big Block 모드 대기 중... (60초)');
        await new Promise(resolve => setTimeout(resolve, 60000));
        
        // 3. Mock ETH 토큰 배포
        console.log('\n⚡ 3. Mock ETH 토큰 배포...');
        console.log('   - 배포 시작...');
        const mockETH = await MockERC20.deploy("Mock ETH", "mETH", 18);
        console.log(`   - 트랜잭션 해시: ${mockETH.deploymentTransaction().hash}`);
        
        console.log('   - 배포 대기 중...');
        await mockETH.waitForDeployment();
        const mockETHAddress = await mockETH.getAddress();
        
        console.log(`   ✅ Mock ETH 배포 완료: ${mockETHAddress}`);
        deployResults.mockETH = mockETHAddress;
        
        // 테스트 토큰 민트
        const ethMintAmount = ethers.parseEther('1000'); // 1,000 ETH
        await mockETH.mint(deployer.address, ethMintAmount);
        
        const ethBalance = await mockETH.balanceOf(deployer.address);
        console.log(`      배포자 ETH 잔액: ${ethers.formatEther(ethBalance)} mETH`);
        
        // 최종 가스 사용량 계산
        const finalBalance = await ethers.provider.getBalance(deployer.address);
        const gasUsed = initialBalance - finalBalance;
        
        console.log('\n📊 Step 1 배포 완료!');
        console.log(`💸 총 가스 사용량: ${ethers.formatEther(gasUsed)} HYPE`);
        console.log(`💰 남은 잔액: ${ethers.formatEther(finalBalance)} HYPE`);
        
        return {
            success: true,
            step: 1,
            contracts: deployResults,
            gasUsed: ethers.formatEther(gasUsed),
            remainingBalance: ethers.formatEther(finalBalance)
        };
        
    } catch (error) {
        console.error('❌ Step 1 배포 실패:', error);
        
        // 실패 시에도 부분 결과 반환
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
    console.log('🚀 HyperEVM 테스트넷 - Step 1: Core Tokens 배포');
    console.log('=' .repeat(80));
    
    const result = await deployStep1();
    
    console.log('\n📋 Step 1 결과:');
    console.log('=' .repeat(50));
    
    if (result.success) {
        console.table(result.contracts);
        console.log(`\n✅ Step 1 배포 성공!`);
        console.log(`💸 가스 사용량: ${result.gasUsed} HYPE`);
        console.log(`💰 남은 잔액: ${result.remainingBalance} HYPE`);
        
        console.log('\n다음 단계: Step 2 - Aggregator 배포');
        console.log('명령어: npx hardhat run scripts/deploy-testnet-step2.js --network hyperevmTestnet');
        
        // 결과를 파일로 저장
        const fs = require('fs');
        fs.writeFileSync('./testnet-step1-results.json', JSON.stringify(result, null, 2));
        console.log('📁 배포 결과가 testnet-step1-results.json에 저장되었습니다.');
        
    } else {
        console.log(`❌ Step 1 배포 실패: ${result.error}`);
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

module.exports = { deployStep1 };