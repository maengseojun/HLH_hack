const { ethers } = require('hardhat');

async function manualDeployTest() {
    console.log('🔧 수동 트랜잭션 파라미터 배포 테스트...\n');
    
    try {
        const [deployer] = await ethers.getSigners();
        const provider = deployer.provider;
        
        console.log(`📍 Deployer: ${deployer.address}`);
        
        // 네트워크 상태 확인
        const nonce = await provider.getTransactionCount(deployer.address);
        const gasPrice = await provider.getFeeData();
        
        console.log(`📊 Nonce: ${nonce}`);
        console.log(`⛽ Suggested Gas Price: ${gasPrice.gasPrice}`);
        console.log(`⛽ Max Fee: ${gasPrice.maxFeePerGas}`);
        console.log(`⛽ Priority Fee: ${gasPrice.maxPriorityFeePerGas}\n`);
        
        // MockERC20 컨트랙트 bytecode 가져오기
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        
        // 생성자 파라미터 인코딩
        const constructorArgs = ["Manual Test Token", "MTT", 18];
        const deployData = MockERC20.bytecode + MockERC20.interface.encodeDeploy(constructorArgs).slice(2);
        
        console.log('1️⃣ Legacy 트랜잭션 시도...');
        
        // Legacy 트랜잭션 (Type 0)
        const legacyTx = {
            to: null,
            data: deployData,
            gasLimit: 1500000,        // 1.5M
            gasPrice: 100000000,      // 0.1 gwei (매우 낮게)
            nonce: nonce,
            chainId: 998
        };
        
        try {
            const signedTx = await deployer.signTransaction(legacyTx);
            console.log(`   서명된 트랜잭션: ${signedTx.slice(0, 66)}...`);
            
            const txResponse = await provider.broadcastTransaction(signedTx);
            console.log(`   트랜잭션 해시: ${txResponse.hash}`);
            
            const receipt = await txResponse.wait();
            console.log(`✅ Legacy 배포 성공!`);
            console.log(`   Contract Address: ${receipt.contractAddress}`);
            console.log(`   Gas Used: ${receipt.gasUsed}`);
            
            return { success: true, address: receipt.contractAddress, type: 'legacy' };
            
        } catch (legacyError) {
            console.log(`   ❌ Legacy 실패: ${legacyError.message}`);
        }
        
        console.log('\n2️⃣ EIP-1559 트랜잭션 시도...');
        
        // EIP-1559 트랜잭션 (Type 2)
        const eip1559Tx = {
            to: null,
            data: deployData,
            gasLimit: 1500000,
            maxFeePerGas: 200000000,        // 0.2 gwei
            maxPriorityFeePerGas: 50000000, // 0.05 gwei
            nonce: nonce,
            type: 2,
            chainId: 998
        };
        
        try {
            const txResponse = await deployer.sendTransaction(eip1559Tx);
            console.log(`   트랜잭션 해시: ${txResponse.hash}`);
            
            const receipt = await txResponse.wait();
            console.log(`✅ EIP-1559 배포 성공!`);
            console.log(`   Contract Address: ${receipt.contractAddress}`);
            console.log(`   Gas Used: ${receipt.gasUsed}`);
            
            return { success: true, address: receipt.contractAddress, type: 'eip1559' };
            
        } catch (eip1559Error) {
            console.log(`   ❌ EIP-1559 실패: ${eip1559Error.message}`);
        }
        
        console.log('\n3️⃣ 최소 Gas로 시도...');
        
        // 최소 gas 트랜잭션
        const minGasTx = {
            to: null,
            data: deployData,
            gasLimit: 800000,      // 800K (최소)
            gasPrice: 1,           // 1 wei (극단적으로 낮음)
            nonce: nonce,
            chainId: 998
        };
        
        try {
            const txResponse = await deployer.sendTransaction(minGasTx);
            console.log(`   트랜잭션 해시: ${txResponse.hash}`);
            
            const receipt = await txResponse.wait();
            console.log(`✅ 최소 Gas 배포 성공!`);
            console.log(`   Contract Address: ${receipt.contractAddress}`);
            console.log(`   Gas Used: ${receipt.gasUsed}`);
            
            return { success: true, address: receipt.contractAddress, type: 'minimal' };
            
        } catch (minGasError) {
            console.log(`   ❌ 최소 Gas 실패: ${minGasError.message}`);
        }
        
        return { success: false, message: 'All transaction types failed' };
        
    } catch (error) {
        console.error('❌ 수동 배포 실패:', error);
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('=' .repeat(70));
    console.log('🔧 HyperEVM 수동 트랜잭션 배포 테스트');
    console.log('=' .repeat(70));
    
    const result = await manualDeployTest();
    
    if (result.success) {
        console.log(`\n🎉 수동 배포 성공! (방식: ${result.type})`);
        console.log(`Contract Address: ${result.address}`);
    } else {
        console.log('\n❌ 모든 수동 배포 방식 실패');
        console.log('HyperEVM Error 10007은 네트워크 레벨 이슈로 보입니다.');
        console.log('Arbitrum Sepolia로 이동하여 테스트를 계속합니다.');
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

module.exports = { manualDeployTest };