const { ethers } = require('hardhat');

async function checkArbitrumBalance() {
    console.log('🔍 Arbitrum Sepolia 잔액 확인...\n');
    
    try {
        const [signer] = await ethers.getSigners();
        const provider = signer.provider;
        
        console.log(`📍 지갑 주소: ${signer.address}`);
        
        // 네트워크 정보 확인
        const network = await provider.getNetwork();
        console.log(`📊 Chain ID: ${network.chainId}`);
        console.log(`🔗 Network Name: ${network.name || 'unknown'}`);
        
        // 블록 높이 확인
        const blockNumber = await provider.getBlockNumber();
        console.log(`📦 최신 블록: ${blockNumber}`);
        
        // 잔액 확인
        const balance = await provider.getBalance(signer.address);
        console.log(`💰 ETH 잔액: ${ethers.formatEther(balance)} ETH`);
        
        if (balance > 0) {
            console.log(`🎉 토큰 보유 확인! 배포 진행 가능`);
            return true;
        } else {
            console.log(`⚠️  잔액이 부족합니다. Faucet에서 토큰을 받아주세요.`);
            return false;
        }
        
    } catch (error) {
        console.error('❌ 테스트 실패:', error.message);
        return false;
    }
}

async function main() {
    const result = await checkArbitrumBalance();
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

module.exports = { checkArbitrumBalance };