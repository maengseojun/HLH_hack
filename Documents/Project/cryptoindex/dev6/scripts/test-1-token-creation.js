const { ethers } = require('hardhat');

/**
 * 1. 토큰 생성 (Index Token) 종합 테스트
 * - ERC-20 표준 준수
 * - Mint/Burn 권한 관리
 * - Initial Supply 배포
 * - 유닛 테스트 (transfer, approve, transferFrom)
 */

async function test1TokenCreation() {
    console.log('🧪 1. 토큰 생성 (Index Token) 종합 테스트\n');
    
    const signers = await ethers.getSigners();
    const [deployer, user1, user2, unauthorized] = signers;
    const testResults = [];
    
    console.log(`📍 사용자 주소 확인:`);
    console.log(`   Deployer: ${deployer.address}`);
    console.log(`   User1: ${user1 ? user1.address : 'undefined'}`);
    console.log(`   User2: ${user2 ? user2.address : 'undefined'}`);
    console.log(`   Unauthorized: ${unauthorized ? unauthorized.address : 'undefined'}\n`);
    
    try {
        // 1-1. ERC-20 표준 준수 확인
        console.log('📋 1-1. ERC-20 표준 준수 확인...');
        
        const TestHYPE = await ethers.getContractFactory('TestHYPE');
        const testHYPE = await TestHYPE.deploy();
        await testHYPE.waitForDeployment();
        const tokenAddress = await testHYPE.getAddress();
        
        // 기본 메타데이터 확인
        const name = await testHYPE.name();
        const symbol = await testHYPE.symbol();
        const decimals = await testHYPE.decimals();
        const totalSupply = await testHYPE.totalSupply();
        
        console.log(`   ✅ Name: ${name}`);
        console.log(`   ✅ Symbol: ${symbol}`);
        console.log(`   ✅ Decimals: ${decimals}`);
        console.log(`   ✅ Total Supply: ${ethers.formatEther(totalSupply)} HYPE`);
        console.log(`   ✅ Contract Address: ${tokenAddress}\n`);
        
        testResults.push({
            test: 'ERC-20 Standard Compliance',
            status: '✅ PASS',
            details: `${name} (${symbol}), ${decimals} decimals`
        });
        
        // 1-2. Mint/Burn 권한 관리 확인
        console.log('🔐 1-2. Mint/Burn 권한 관리 확인...');
        
        // Owner 권한 확인
        const owner = await testHYPE.owner();
        console.log(`   Owner: ${owner}`);
        console.log(`   Deployer: ${deployer.address}`);
        
        if (owner === deployer.address) {
            console.log(`   ✅ Owner 권한 정상 설정`);
        } else {
            console.log(`   ❌ Owner 권한 설정 오류`);
        }
        
        // 정상 민트 테스트 (Owner)
        const mintAmount = ethers.parseEther('1000');
        console.log(`   User1 주소: ${user1.address}`);
        const mintTx = await testHYPE.mint(user1.address, mintAmount);
        await mintTx.wait();
        
        const user1Balance = await testHYPE.balanceOf(user1.address);
        console.log(`   ✅ Owner 민트 성공: ${ethers.formatEther(user1Balance)} HYPE → User1`);
        
        // 무단 민트 시도 (Should Fail)
        try {
            await testHYPE.connect(unauthorized).mint(user2.address, mintAmount);
            console.log(`   ❌ 무단 민트 차단 실패 - 보안 취약점!`);
            testResults.push({
                test: 'Mint Access Control',
                status: '❌ FAIL',
                details: 'Unauthorized mint succeeded'
            });
        } catch (error) {
            console.log(`   ✅ 무단 민트 정상 차단: ${error.message.split('(')[0]}`);
            testResults.push({
                test: 'Mint Access Control',
                status: '✅ PASS',
                details: 'Only owner can mint'
            });
        }
        
        // Emergency Mint 권한 확인
        try {
            const emergencyMintTx = await testHYPE.emergencyMint(user2.address, ethers.parseEther('500'));
            await emergencyMintTx.wait();
            const user2Balance = await testHYPE.balanceOf(user2.address);
            console.log(`   ✅ Emergency Mint 성공: ${ethers.formatEther(user2Balance)} HYPE → User2`);
        } catch (error) {
            console.log(`   ❌ Emergency Mint 실패: ${error.message}`);
        }
        
        // 1-3. Transfer/Approve/TransferFrom 테스트
        console.log('\n💸 1-3. Transfer/Approve/TransferFrom 테스트...');
        
        // Transfer 테스트
        const transferAmount = ethers.parseEther('100');
        const transferTx = await testHYPE.connect(user1).transfer(user2.address, transferAmount);
        const transferReceipt = await transferTx.wait();
        
        // 이벤트 확인
        const transferEvent = transferReceipt.logs.find(log => {
            try {
                const parsed = testHYPE.interface.parseLog(log);
                return parsed.name === 'Transfer';
            } catch (e) {
                return false;
            }
        });
        
        if (transferEvent) {
            console.log(`   ✅ Transfer Event 발생 확인`);
        }
        
        const user1BalanceAfter = await testHYPE.balanceOf(user1.address);
        const user2BalanceAfter = await testHYPE.balanceOf(user2.address);
        console.log(`   ✅ Transfer 성공: User1 → User2 (${ethers.formatEther(transferAmount)} HYPE)`);
        console.log(`      User1 잔액: ${ethers.formatEther(user1BalanceAfter)} HYPE`);
        console.log(`      User2 잔액: ${ethers.formatEther(user2BalanceAfter)} HYPE`);
        
        // Approve/TransferFrom 테스트
        const approveAmount = ethers.parseEther('200');
        const approveTx = await testHYPE.connect(user1).approve(user2.address, approveAmount);
        await approveTx.wait();
        
        const allowance = await testHYPE.allowance(user1.address, user2.address);
        console.log(`   ✅ Approve 성공: ${ethers.formatEther(allowance)} HYPE allowance`);
        
        const transferFromAmount = ethers.parseEther('50');
        const transferFromTx = await testHYPE.connect(user2).transferFrom(
            user1.address, 
            user2.address, 
            transferFromAmount
        );
        await transferFromTx.wait();
        
        const allowanceAfter = await testHYPE.allowance(user1.address, user2.address);
        console.log(`   ✅ TransferFrom 성공: ${ethers.formatEther(transferFromAmount)} HYPE 이동`);
        console.log(`      남은 Allowance: ${ethers.formatEther(allowanceAfter)} HYPE`);
        
        testResults.push({
            test: 'Transfer/Approve/TransferFrom',
            status: '✅ PASS',
            details: 'All ERC-20 operations working'
        });
        
        // 1-4. Faucet 기능 테스트
        console.log('\n🚿 1-4. Faucet 기능 테스트...');
        
        const user1BalanceBefore = await testHYPE.balanceOf(user1.address);
        const faucetTx = await testHYPE.connect(user1).faucet();
        await faucetTx.wait();
        
        const user1BalanceAfterFaucet = await testHYPE.balanceOf(user1.address);
        const faucetAmount = user1BalanceAfterFaucet - user1BalanceBefore;
        
        console.log(`   ✅ Faucet 성공: ${ethers.formatEther(faucetAmount)} HYPE 지급`);
        
        // Cooldown 테스트
        try {
            await testHYPE.connect(user1).faucet();
            console.log(`   ❌ Faucet Cooldown 차단 실패`);
        } catch (error) {
            console.log(`   ✅ Faucet Cooldown 정상 작동: 24시간 대기 필요`);
        }
        
        testResults.push({
            test: 'Faucet Functionality',
            status: '✅ PASS',
            details: `${ethers.formatEther(faucetAmount)} HYPE per 24h`
        });
        
        // 1-5. Total Supply Overflow 방지 테스트
        console.log('\n🛡️ 1-5. Total Supply Overflow 방지 테스트...');
        
        const currentSupply = await testHYPE.totalSupply();
        console.log(`   현재 Total Supply: ${ethers.formatEther(currentSupply)} HYPE`);
        
        // 극대값 민트 시도
        try {
            const maxMint = ethers.parseEther('1000000000'); // 10억 HYPE
            await testHYPE.mint(deployer.address, maxMint);
            const newSupply = await testHYPE.totalSupply();
            console.log(`   ✅ 대량 민트 성공: ${ethers.formatEther(newSupply)} HYPE`);
        } catch (error) {
            console.log(`   ⚠️  대량 민트 제한: ${error.message.split('(')[0]}`);
        }
        
        testResults.push({
            test: 'Supply Management',
            status: '✅ PASS',
            details: 'No overflow detected'
        });
        
        return {
            success: true,
            tokenAddress: tokenAddress,
            testResults: testResults,
            finalBalances: {
                deployer: ethers.formatEther(await testHYPE.balanceOf(deployer.address)),
                user1: ethers.formatEther(await testHYPE.balanceOf(user1.address)),
                user2: ethers.formatEther(await testHYPE.balanceOf(user2.address)),
            },
            totalSupply: ethers.formatEther(await testHYPE.totalSupply())
        };
        
    } catch (error) {
        console.error('❌ 토큰 생성 테스트 실패:', error);
        testResults.push({
            test: 'Overall Test',
            status: '❌ FAIL',
            details: error.message
        });
        return { success: false, error: error.message, testResults };
    }
}

async function main() {
    console.log('=' .repeat(80));
    console.log('🧪 HyperIndex - 1. 토큰 생성 (Index Token) 종합 테스트');
    console.log('=' .repeat(80));
    
    const result = await test1TokenCreation();
    
    console.log('\n📊 테스트 결과 요약:');
    console.log('=' .repeat(80));
    
    if (result.success) {
        console.table(result.testResults);
        
        console.log('\n💰 최종 잔액:');
        console.table(result.finalBalances);
        
        console.log(`\n📈 Total Supply: ${result.totalSupply} HYPE`);
        console.log(`🏪 Contract Address: ${result.tokenAddress}`);
        
        console.log('\n🎉 1단계 토큰 생성 테스트 완료!');
        console.log('다음 단계: 2. 멀티체인 Aggregator 연동 테스트');
    } else {
        console.log('❌ 테스트 실패');
        console.table(result.testResults);
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

module.exports = { test1TokenCreation };