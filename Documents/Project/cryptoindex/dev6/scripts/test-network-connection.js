const { ethers } = require('hardhat');

/**
 * HyperEVM 테스트넷 연결 및 계정 상태 확인
 */

async function testNetworkConnection() {
    console.log('🌐 HyperEVM 테스트넷 연결 테스트\n');
    
    try {
        // 네트워크 정보 확인
        const network = await ethers.provider.getNetwork();
        console.log('📍 네트워크 정보:');
        console.log(`   이름: ${network.name}`);
        console.log(`   Chain ID: ${network.chainId}`);
        console.log(`   RPC: ${process.env.HYPEREVM_RPC || "https://rpc.hyperliquid-testnet.xyz/evm"}`);
        
        // 현재 블록 정보
        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);
        
        console.log('\n📊 블록체인 상태:');
        console.log(`   현재 블록: ${blockNumber}`);
        console.log(`   블록 타임스탬프: ${new Date(Number(block.timestamp) * 1000).toISOString()}`);
        console.log(`   가스 한도: ${block.gasLimit.toString()}`);
        
        // 계정 정보 확인
        const [deployer] = await ethers.getSigners();
        const balance = await ethers.provider.getBalance(deployer.address);
        
        console.log('\n👤 계정 정보:');
        console.log(`   주소: ${deployer.address}`);
        console.log(`   잔액: ${ethers.formatEther(balance)} HYPE`);
        console.log(`   잔액(Wei): ${balance.toString()}`);
        
        // 가스 가격 확인
        const gasPrice = await ethers.provider.getFeeData();
        console.log('\n⛽ 가스 정보:');
        console.log(`   Gas Price: ${ethers.formatUnits(gasPrice.gasPrice || 0, 'gwei')} gwei`);
        console.log(`   Max Fee: ${ethers.formatUnits(gasPrice.maxFeePerGas || 0, 'gwei')} gwei`);
        
        // 연결 상태 확인
        if (Number(network.chainId) === 998) {
            console.log('\n✅ HyperEVM 테스트넷 연결 성공!');
            
            if (balance > 0) {
                console.log('✅ 계정에 충분한 HYPE 잔액 확인');
                return { 
                    success: true, 
                    network: network.name,
                    chainId: Number(network.chainId),
                    balance: ethers.formatEther(balance),
                    blockNumber,
                    canDeploy: true
                };
            } else {
                console.log('⚠️  계정 잔액이 부족합니다. Faucet에서 HYPE 토큰을 받으세요.');
                return { 
                    success: true, 
                    network: network.name,
                    chainId: Number(network.chainId),
                    balance: '0',
                    blockNumber,
                    canDeploy: false,
                    warning: 'Insufficient balance'
                };
            }
        } else {
            console.log(`❌ 잘못된 네트워크: Chain ID ${network.chainId} (998 예상)`);
            return { 
                success: false, 
                error: `Wrong network: ${network.chainId}` 
            };
        }
        
    } catch (error) {
        console.error('❌ 네트워크 연결 실패:', error.message);
        return { 
            success: false, 
            error: error.message 
        };
    }
}

async function main() {
    console.log('=' .repeat(80));
    console.log('🌐 HyperEVM 테스트넷 연결 테스트');
    console.log('=' .repeat(80));
    
    const result = await testNetworkConnection();
    
    if (result.success && result.canDeploy) {
        console.log('\n🎯 배포 준비 완료!');
        console.log('다음 단계: 컨트랙트 배포 시작');
        console.log('명령어: npx hardhat run scripts/deploy-testnet-step1.js --network hyperevmTestnet');
    } else if (result.success && !result.canDeploy) {
        console.log('\n⚠️  잔액 부족으로 배포 불가');
        console.log('HyperEVM Faucet에서 HYPE 토큰을 받으세요.');
    } else {
        console.log('\n❌ 네트워크 연결 문제');
        console.log('RPC 설정 및 네트워크 상태를 확인하세요.');
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

module.exports = { testNetworkConnection };