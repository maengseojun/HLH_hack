const { ethers } = require('hardhat');

async function checkHyperEVMBalance() {
    console.log('🔍 HyperEVM Testnet 연결 및 잔액 확인...\n');
    
    try {
        // HyperEVM 테스트넷 RPC들 시도
        const rpcUrls = [
            "https://api.hyperliquid-testnet.xyz/evm",
            "https://rpc.hyperliquid-testnet.xyz/evm", 
            "https://api.hyperliquid.xyz/evm"
        ];
        
        const [signer] = await ethers.getSigners();
        console.log(`📍 지갑 주소: ${signer.address}`);
        
        for (const rpcUrl of rpcUrls) {
            try {
                console.log(`\n🌐 RPC 테스트: ${rpcUrl}`);
                
                // 커스텀 provider 생성
                const provider = new ethers.JsonRpcProvider(rpcUrl);
                
                // 네트워크 정보 확인
                const network = await provider.getNetwork();
                console.log(`   ✅ 네트워크 연결 성공`);
                console.log(`   📊 Chain ID: ${network.chainId}`);
                console.log(`   🔗 Network Name: ${network.name || 'unknown'}`);
                
                // 블록 높이 확인
                const blockNumber = await provider.getBlockNumber();
                console.log(`   📦 최신 블록: ${blockNumber}`);
                
                // 잔액 확인
                const balance = await provider.getBalance(signer.address);
                console.log(`   💰 HYPE 잔액: ${ethers.formatEther(balance)} HYPE`);
                
                if (balance > 0) {
                    console.log(`   🎉 토큰 보유 확인! 이 RPC로 배포 진행 가능`);
                    return {
                        rpcUrl: rpcUrl,
                        chainId: network.chainId.toString(),
                        balance: balance.toString(),
                        blockNumber: blockNumber,
                        address: signer.address
                    };
                }
                
            } catch (error) {
                console.log(`   ❌ 연결 실패: ${error.message}`);
            }
        }
        
        console.log('\n⚠️  모든 RPC에서 연결 실패 또는 잔액 0');
        return null;
        
    } catch (error) {
        console.error('❌ 테스트 실패:', error.message);
        return null;
    }
}

async function testHyperEVMTransaction() {
    console.log('\n🧪 HyperEVM 트랜잭션 테스트...');
    
    try {
        const [signer] = await ethers.getSigners();
        
        // 간단한 self-transfer 테스트
        const tx = {
            to: signer.address,
            value: ethers.parseEther('0.001'), // 0.001 HYPE
            gasLimit: 21000
        };
        
        console.log('📤 테스트 트랜잭션 전송 중...');
        const sentTx = await signer.sendTransaction(tx);
        console.log(`   Tx Hash: ${sentTx.hash}`);
        
        console.log('⏳ 트랜잭션 확인 대기 중...');
        const receipt = await sentTx.wait();
        console.log(`   ✅ 트랜잭션 확인됨! Block: ${receipt.blockNumber}`);
        console.log(`   ⛽ Gas Used: ${receipt.gasUsed}`);
        
        return receipt;
        
    } catch (error) {
        console.log(`   ❌ 트랜잭션 실패: ${error.message}`);
        return null;
    }
}

async function main() {
    console.log('=' * 60);
    console.log('🏁 HyperEVM Testnet 연결 테스트');
    console.log('=' * 60);
    
    const connectionResult = await checkHyperEVMBalance();
    
    if (connectionResult && connectionResult.balance !== '0') {
        console.log('\n🎯 연결 성공! 배포 준비 완료');
        
        // 간단한 트랜잭션 테스트
        await testHyperEVMTransaction();
        
        console.log('\n📋 배포 가능한 환경 정보:');
        console.table({
            'RPC URL': connectionResult.rpcUrl,
            'Chain ID': connectionResult.chainId, 
            'Address': connectionResult.address,
            'Balance': `${ethers.formatEther(connectionResult.balance)} HYPE`,
            'Block': connectionResult.blockNumber
        });
        
        console.log('\n🚀 다음 명령어로 배포 진행:');
        console.log('npx hardhat run scripts/simple-arbitrum-deploy.js --network hyperevmTestnet');
        console.log('npx hardhat run scripts/deploy-test-hype.js --network hyperevmTestnet');
        
    } else {
        console.log('\n💡 HyperEVM 연결 실패 시 대안:');
        console.log('1. 다른 RPC 엔드포인트 시도');
        console.log('2. Arbitrum Sepolia에서 테스트');
        console.log('3. 로컬 환경에서 TestHYPE 사용');
    }
    
    return connectionResult;
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { checkHyperEVMBalance, testHyperEVMTransaction };