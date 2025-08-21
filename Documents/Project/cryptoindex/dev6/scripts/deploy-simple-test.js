const { ethers } = require('hardhat');

async function deploySimpleTest() {
    console.log('🧪 간단한 컨트랙트 배포 테스트...\n');
    
    try {
        const [deployer] = await ethers.getSigners();
        
        console.log('📋 배포 정보:');
        console.log(`   Deployer: ${deployer.address}`);
        
        // 네트워크 정보 확인
        const network = await ethers.provider.getNetwork();
        console.log(`   Network: ${network.name || 'unknown'}`);
        console.log(`   Chain ID: ${network.chainId}`);
        
        // 잔액 확인
        const balance = await ethers.provider.getBalance(deployer.address);
        console.log(`   Balance: ${ethers.formatEther(balance)} ETH\n`);
        
        if (balance === 0n) {
            console.log('❌ 잔액이 부족합니다.');
            return null;
        }
        
        // 1. MockERC20 배포 (가장 간단)
        console.log('1️⃣ MockERC20 배포 시도...');
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        
        console.log('   컨트랙트 팩토리 생성 완료');
        
        // 수동으로 gas 설정
        const deployTx = await MockERC20.deploy(
            "Test Token",
            "TEST", 
            18,
            {
                gasLimit: 2000000,      // 2M gas
                gasPrice: 500000000,    // 0.5 gwei
            }
        );
        
        console.log(`   배포 트랜잭션 전송됨: ${deployTx.deploymentTransaction()?.hash}`);
        console.log('   배포 완료 대기 중...');
        
        await deployTx.waitForDeployment();
        const address = await deployTx.getAddress();
        
        console.log(`✅ MockERC20 배포 성공: ${address}\n`);
        
        // 2. 기본 기능 테스트
        console.log('2️⃣ 기본 기능 테스트...');
        const totalSupply = await deployTx.totalSupply();
        const name = await deployTx.name();
        const symbol = await deployTx.symbol();
        
        console.log(`   Name: ${name}`);
        console.log(`   Symbol: ${symbol}`);
        console.log(`   Total Supply: ${ethers.formatEther(totalSupply)}`);
        
        // 3. 간단한 트랜잭션 테스트
        console.log('\n3️⃣ 민트 트랜잭션 테스트...');
        const mintTx = await deployTx.mint(
            deployer.address, 
            ethers.parseEther('1000'),
            {
                gasLimit: 100000,
                gasPrice: 500000000,
            }
        );
        await mintTx.wait();
        
        const newBalance = await deployTx.balanceOf(deployer.address);
        console.log(`✅ 민트 성공: ${ethers.formatEther(newBalance)} TEST`);
        
        return {
            address: address,
            name: name,
            symbol: symbol,
            success: true
        };
        
    } catch (error) {
        console.error('❌ 배포 실패:', error.message);
        if (error.data) {
            console.error('   Error Data:', error.data);
        }
        if (error.code) {
            console.error('   Error Code:', error.code);
        }
        return null;
    }
}

async function main() {
    console.log('=' .repeat(60));
    console.log('🧪 HyperEVM 간단 컨트랙트 배포 테스트');
    console.log('=' .repeat(60));
    
    const result = await deploySimpleTest();
    
    if (result) {
        console.log('\n🎉 배포 테스트 성공!');
        console.log('이제 더 복잡한 컨트랙트 배포를 시도할 수 있습니다.');
    } else {
        console.log('\n❌ 배포 테스트 실패');
        console.log('다른 설정이나 네트워크를 시도해야 합니다.');
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

module.exports = { deploySimpleTest };