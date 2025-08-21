const { ethers } = require('hardhat');

/**
 * 🪙 TestHYPE 토큰 배포 및 민트 스크립트
 * HyperEVM 공식 faucet이 작동하지 않을 때 사용
 */

async function deployTestHYPE() {
    console.log('🪙 TestHYPE 토큰 배포 시작...\n');
    
    const [deployer, user1, user2] = await ethers.getSigners();
    console.log('📋 배포 정보:');
    console.log(`   Deployer: ${deployer.address}`);
    console.log(`   Network: ${(await ethers.provider.getNetwork()).name}`);
    console.log(`   Chain ID: ${(await ethers.provider.getNetwork()).chainId}\n`);
    
    // 1. TestHYPE 컨트랙트 배포
    console.log('🚀 TestHYPE 컨트랙트 배포 중...');
    const TestHYPE = await ethers.getContractFactory('TestHYPE');
    const testHYPE = await TestHYPE.deploy();
    await testHYPE.waitForDeployment();
    
    const testHYPEAddress = await testHYPE.getAddress();
    console.log(`✅ TestHYPE 배포 완료: ${testHYPEAddress}`);
    
    // 2. 초기 정보 확인
    const totalSupply = await testHYPE.totalSupply();
    const deployerBalance = await testHYPE.balanceOf(deployer.address);
    const name = await testHYPE.name();
    const symbol = await testHYPE.symbol();
    const decimals = await testHYPE.decimals();
    
    console.log('\n📊 토큰 정보:');
    console.log(`   이름: ${name}`);
    console.log(`   심볼: ${symbol}`);
    console.log(`   데시말: ${decimals}`);
    console.log(`   총 공급량: ${ethers.formatEther(totalSupply)} HYPE`);
    console.log(`   배포자 잔액: ${ethers.formatEther(deployerBalance)} HYPE`);
    
    // 3. 테스트 사용자들에게 토큰 배포
    console.log('\n💰 테스트 사용자들에게 토큰 배포 중...');
    
    const testUsers = [user1.address, user2.address];
    const mintAmount = ethers.parseEther('10000'); // 10,000 HYPE per user
    
    for (const userAddress of testUsers) {
        try {
            const mintTx = await testHYPE.mint(userAddress, mintAmount);
            await mintTx.wait();
            
            const balance = await testHYPE.balanceOf(userAddress);
            console.log(`   ✅ ${userAddress}: ${ethers.formatEther(balance)} HYPE`);
        } catch (error) {
            console.log(`   ❌ ${userAddress}: 민트 실패 - ${error.message}`);
        }
    }
    
    // 4. Faucet 기능 테스트
    console.log('\n🚿 Faucet 기능 테스트...');
    try {
        const faucetTx = await testHYPE.connect(user1).faucet();
        await faucetTx.wait();
        
        const user1Balance = await testHYPE.balanceOf(user1.address);
        console.log(`   ✅ User1 faucet 사용 후 잔액: ${ethers.formatEther(user1Balance)} HYPE`);
    } catch (error) {
        console.log(`   ❌ Faucet 테스트 실패: ${error.message}`);
    }
    
    // 5. 배치 민트 테스트
    console.log('\n🔄 배치 민트 테스트...');
    const batchRecipients = [user1.address, user2.address];
    const batchAmounts = [ethers.parseEther('5000'), ethers.parseEther('3000')];
    
    try {
        const batchTx = await testHYPE.batchMint(batchRecipients, batchAmounts);
        await batchTx.wait();
        console.log('   ✅ 배치 민트 성공');
        
        for (let i = 0; i < batchRecipients.length; i++) {
            const balance = await testHYPE.balanceOf(batchRecipients[i]);
            console.log(`   📊 ${batchRecipients[i]}: ${ethers.formatEther(balance)} HYPE`);
        }
    } catch (error) {
        console.log(`   ❌ 배치 민트 실패: ${error.message}`);
    }
    
    // 6. Mock Provider 잔액 설정 (로컬 네트워크인 경우)
    const network = await ethers.provider.getNetwork();
    if (network.chainId === 31337n) { // Hardhat local network
        console.log('\n⚖️  Mock Provider 잔액 설정 (로컬 네트워크)...');
        
        // ETH 잔액 설정
        const ethAmount = "0x56BC75E2D630FFFFF"; // ~100 ETH
        for (const user of [user1.address, user2.address]) {
            try {
                await ethers.provider.send("hardhat_setBalance", [user, ethAmount]);
                const ethBalance = await ethers.provider.getBalance(user);
                console.log(`   ✅ ${user}: ${ethers.formatEther(ethBalance)} ETH`);
            } catch (error) {
                console.log(`   ❌ ETH 잔액 설정 실패: ${error.message}`);
            }
        }
    }
    
    // 7. 최종 요약
    const finalTotalSupply = await testHYPE.totalSupply();
    console.log('\n📈 최종 토큰 상태:');
    console.log(`   총 공급량: ${ethers.formatEther(finalTotalSupply)} HYPE`);
    console.log(`   컨트랙트 주소: ${testHYPEAddress}`);
    
    // 8. 사용법 가이드
    console.log('\n📋 사용법 가이드:');
    console.log('   🔧 추가 민트:');
    console.log(`      testHYPE.mint("${user1.address}", ethers.parseEther("1000"))`);
    console.log('   🚿 Faucet 사용:');
    console.log(`      testHYPE.connect(user).faucet()`);
    console.log('   ⚡ 긴급 민트:');
    console.log(`      testHYPE.emergencyFaucet("${user1.address}", ethers.parseEther("10000"))`);
    
    // 9. HyperEVM 시뮬레이션을 위한 설정
    if (network.chainId === 31337n) {
        console.log('\n🌐 HyperEVM 시뮬레이션 설정...');
        console.log('   Chain ID를 998로 시뮬레이션하려면:');
        console.log('   hardhat.config.js에서 chainId: 998 설정');
        console.log(`   테스트 RPC: http://localhost:8545`);
        console.log(`   TestHYPE 주소: ${testHYPEAddress}`);
    }
    
    return {
        testHYPE: testHYPEAddress,
        deployer: deployer.address,
        totalSupply: finalTotalSupply.toString(),
        network: network.name,
        chainId: network.chainId.toString()
    };
}

async function setupHyperEVMSimulation() {
    console.log('\n🔮 HyperEVM 시뮬레이션 환경 설정...');
    
    // 로컬 네트워크에서 Chain ID를 998로 시뮬레이션
    try {
        await ethers.provider.send("hardhat_reset", [{
            forking: {
                jsonRpcUrl: "https://rpc.hyperliquid-testnet.xyz/evm", // 실제로는 작동하지 않지만 시뮬레이션용
                enabled: false
            },
            chains: {
                998: {
                    hardfork: "shanghai",
                    chainId: 998
                }
            }
        }]);
        console.log('   ✅ HyperEVM Chain ID 시뮬레이션 설정 완료');
    } catch (error) {
        console.log('   ⚠️  Chain ID 시뮬레이션 설정 건너뜀:', error.message);
    }
}

// 메인 실행 함수
async function main() {
    try {
        console.log('=' * 60);
        console.log('🪙 TestHYPE 토큰 배포 & 테스트 환경 설정');
        console.log('=' * 60);
        
        const deploymentInfo = await deployTestHYPE();
        
        // HyperEVM 시뮬레이션 설정 (선택사항)
        // await setupHyperEVMSimulation();
        
        console.log('\n🎉 TestHYPE 배포 및 설정 완료!');
        console.log('\n🎯 다음 단계:');
        console.log('1. IndexTokenFactory에서 TestHYPE를 기본 토큰으로 사용');
        console.log('2. 크로스체인 메시징 테스트');
        console.log('3. 전체 HyperIndex 워크플로우 검증');
        
        return deploymentInfo;
        
    } catch (error) {
        console.error('❌ TestHYPE 배포 실패:', error);
        throw error;
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = {
    deployTestHYPE,
    setupHyperEVMSimulation,
    main
};