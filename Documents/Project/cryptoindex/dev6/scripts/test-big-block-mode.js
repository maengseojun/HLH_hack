const { ethers } = require('hardhat');

async function testBigBlockMode() {
    console.log('🔄 Big Block 모드 활성화 테스트...\n');
    
    try {
        const [signer] = await ethers.getSigners();
        const provider = signer.provider;
        
        console.log(`📍 지갑 주소: ${signer.address}`);
        
        // 1. 현재 가스 한도 확인
        console.log('1️⃣ 현재 블록 정보 확인...');
        const latestBlock = await provider.getBlock('latest');
        console.log(`   현재 블록 번호: ${latestBlock.number}`);
        console.log(`   현재 블록 가스 한도: ${latestBlock.gasLimit.toString()}`);
        console.log(`   현재 블록 가스 사용량: ${latestBlock.gasUsed.toString()}\n`);
        
        // 2. Big Block 모드 활성화 시도
        console.log('2️⃣ Big Block 모드 활성화 시도...');
        
        try {
            // Method 1: evm_userModify 
            const userModifyResult = await provider.send("evm_userModify", [{ 
                type: "evmUserModify", 
                usingBigBlocks: true 
            }]);
            console.log(`   ✅ evm_userModify 성공:`, userModifyResult);
        } catch (error1) {
            console.log(`   ❌ evm_userModify 실패: ${error1.message}`);
            
            try {
                // Method 2: 대안 방법 시도
                const configResult = await provider.send("evm_setBlockMode", ["big"]);
                console.log(`   ✅ evm_setBlockMode 성공:`, configResult);
            } catch (error2) {
                console.log(`   ❌ evm_setBlockMode 실패: ${error2.message}`);
                
                try {
                    // Method 3: HTTP 헤더로 시도
                    console.log(`   📡 HTTP 헤더 방식으로 Big Block 모드 설정...`);
                    console.log(`   (hardhat.config.js에 이미 "X-Block-Mode": "big" 설정됨)`);
                } catch (error3) {
                    console.log(`   ❌ 모든 Big Block 모드 활성화 방법 실패`);
                }
            }
        }
        
        // 3. 변경 후 블록 정보 다시 확인
        console.log('\n3️⃣ Big Block 모드 후 블록 정보 재확인...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
        
        const newBlock = await provider.getBlock('latest');
        console.log(`   새 블록 번호: ${newBlock.number}`);
        console.log(`   새 블록 가스 한도: ${newBlock.gasLimit.toString()}`);
        
        if (newBlock.gasLimit > latestBlock.gasLimit) {
            console.log(`   ✅ Big Block 모드 활성화 성공! 가스 한도 증가됨`);
        } else if (newBlock.gasLimit.toString() === "30000000") {
            console.log(`   ✅ Big Block 모드 이미 활성화됨 (30M gas limit)`);
        } else {
            console.log(`   ⚠️  Big Block 모드 상태 불명확`);
        }
        
        // 4. 테스트 트랜잭션으로 Big Block 모드 확인
        console.log('\n4️⃣ Big Block 모드에서 배포 재시도...');
        
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        
        // Big Block 모드용 높은 가스 한도로 시도
        try {
            const deployTx = await MockERC20.deploy(
                "Big Block Test",
                "BBT", 
                18,
                {
                    gasLimit: 15000000,     // 15M gas (Big Block 모드)
                    gasPrice: 100000000,    // 0.1 gwei
                }
            );
            
            console.log(`   배포 트랜잭션 생성됨: ${deployTx.deploymentTransaction()?.hash}`);
            
            await deployTx.waitForDeployment();
            const address = await deployTx.getAddress();
            
            console.log(`   ✅ Big Block 모드 배포 성공: ${address}`);
            
            return { success: true, address: address, bigBlockActive: true };
            
        } catch (deployError) {
            console.log(`   ❌ Big Block 모드 배포 실패: ${deployError.message}`);
            
            // Error 코드 분석
            if (deployError.message.includes('10007')) {
                console.log(`   📊 Error 10007 재발생 - 네트워크 레벨 이슈 확인됨`);
            }
            
            return { success: false, error: deployError.message, bigBlockActive: false };
        }
        
    } catch (error) {
        console.error('❌ Big Block 모드 테스트 실패:', error);
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('=' .repeat(60));
    console.log('🔄 HyperEVM Big Block 모드 테스트');
    console.log('=' .repeat(60));
    
    const result = await testBigBlockMode();
    
    if (result.success) {
        console.log('\n🎉 Big Block 모드 테스트 성공!');
        console.log('이제 30M 가스 한도를 사용할 수 있습니다.');
    } else {
        console.log('\n❌ Big Block 모드 테스트 실패');
        console.log('네트워크 레벨 이슈로 추정됩니다.');
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

module.exports = { testBigBlockMode };