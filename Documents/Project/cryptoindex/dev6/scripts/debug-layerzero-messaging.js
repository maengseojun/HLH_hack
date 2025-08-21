const { ethers } = require('hardhat');

/**
 * Debug LayerZero Messaging contract issues step by step
 */

async function debugLayerZeroMessaging() {
    console.log('🔍 LayerZero Messaging 단계별 디버깅\n');
    
    const [deployer, user1] = await ethers.getSigners();
    console.log(`📍 배포자: ${deployer.address}`);
    console.log(`👤 사용자1: ${user1.address}`);
    
    let step = 0;
    
    try {
        // Step 1: Mock Endpoint 배포
        console.log(`${++step}. Mock LayerZero Endpoint V2 배포...`);
        const MockLayerZeroEndpointV2 = await ethers.getContractFactory('MockLayerZeroEndpointV2');
        const mockEndpoint = await MockLayerZeroEndpointV2.deploy();
        await mockEndpoint.waitForDeployment();
        
        const endpointAddress = await mockEndpoint.getAddress();
        console.log(`   ✅ Endpoint: ${endpointAddress}`);
        
        // Step 2: LayerZero Messaging 배포
        console.log(`${++step}. LayerZero Messaging 배포...`);
        const LayerZeroMessaging = await ethers.getContractFactory('LayerZeroMessaging');
        const messaging = await LayerZeroMessaging.deploy(endpointAddress);
        await messaging.waitForDeployment();
        
        const messagingAddress = await messaging.getAddress();
        console.log(`   ✅ Messaging: ${messagingAddress}`);
        
        // Step 3: Role 설정
        console.log(`${++step}. Role 권한 설정...`);
        const MESSAGE_SENDER_ROLE = await messaging.MESSAGE_SENDER_ROLE();
        await messaging.grantRole(MESSAGE_SENDER_ROLE, deployer.address);
        
        const hasRole = await messaging.hasRole(MESSAGE_SENDER_ROLE, deployer.address);
        console.log(`   ✅ MESSAGE_SENDER_ROLE 설정됨: ${hasRole}`);
        
        // Step 4: 체인 설정 확인
        console.log(`${++step}. 체인 설정 확인...`);
        const hyperEvmSupported = await messaging.isChainSupported(998);
        const supportedChains = await messaging.getSupportedChains();
        console.log(`   HyperEVM 지원: ${hyperEvmSupported}`);
        console.log(`   지원 체인 수: ${supportedChains.length}`);
        
        // Step 5: 수수료 추정 테스트
        console.log(`${++step}. 수수료 추정 테스트...`);
        const testPayload = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
            [user1.address, messagingAddress, 1, 1000, 500, Date.now(), 1, 1]
        );
        
        try {
            const [nativeFee, zroFee] = await messaging.estimateMessageFees(testPayload);
            console.log(`   ✅ 수수료 추정 성공: ${ethers.formatEther(nativeFee)} HYPE`);
        } catch (error) {
            console.log(`   ❌ 수수료 추정 실패: ${error.message}`);
            return false;
        }
        
        // Step 6: sendDepositMessage 호출 전 상태 확인
        console.log(`${++step}. sendDepositMessage 호출 전 상태 확인...`);
        const isPaused = await messaging.paused();
        const deployerBalance = await ethers.provider.getBalance(deployer.address);
        console.log(`   Paused 상태: ${isPaused}`);
        console.log(`   배포자 잔액: ${ethers.formatEther(deployerBalance)} HYPE`);
        
        // Step 7: 직접 mock endpoint와 통신 테스트
        console.log(`${++step}. 직접 Mock Endpoint 통신 테스트...`);
        const directPayload = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [12345]);
        const destination = ethers.AbiCoder.defaultAbiCoder().encode(['address'], [messagingAddress]);
        
        try {
            const [directFee] = await mockEndpoint.estimateFees(
                30000, // HyperEVM
                messagingAddress,
                directPayload,
                false,
                "0x"
            );
            
            const directTx = await mockEndpoint.send(
                30000,
                destination,
                directPayload,
                deployer.address,
                ethers.ZeroAddress,
                "0x",
                { value: directFee }
            );
            
            await directTx.wait();
            console.log(`   ✅ 직접 통신 성공`);
        } catch (error) {
            console.log(`   ❌ 직접 통신 실패: ${error.message}`);
            return false;
        }
        
        // Step 8: LayerZero endpoint interface 호환성 테스트
        console.log(`${++step}. LayerZero Endpoint 인터페이스 호환성 테스트...`);
        
        try {
            // Messaging 컨트랙트가 사용하는 것과 동일한 방식으로 호출
            const testDstChainId = 30000;
            const testDestination = ethers.AbiCoder.defaultAbiCoder().encode(['address'], [messagingAddress]);
            const testPayloadForInterface = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [99999]);
            
            const [interfaceFee] = await mockEndpoint.estimateFees(
                testDstChainId,
                messagingAddress,
                testPayloadForInterface,
                false,
                "0x"
            );
            
            console.log(`   수수료 추정: ${ethers.formatEther(interfaceFee)} HYPE`);
            
            // 실제 messaging에서 호출하는 방식대로 테스트
            const interfaceTx = await mockEndpoint.send(
                testDstChainId,
                testDestination,
                testPayloadForInterface,
                deployer.address,
                ethers.ZeroAddress,
                "0x",
                { value: interfaceFee }
            );
            
            const interfaceReceipt = await interfaceTx.wait();
            console.log(`   ✅ 인터페이스 호환성 확인됨`);
            console.log(`   트랜잭션: ${interfaceReceipt.hash}`);
            
        } catch (error) {
            console.log(`   ❌ 인터페이스 호환성 실패: ${error.message}`);
            return false;
        }
        
        // Step 9: sendDepositMessage 실제 호출
        console.log(`${++step}. sendDepositMessage 실제 호출...`);
        
        const vault = messagingAddress;
        const indexTokenId = 1;
        const assets = ethers.parseEther("100");
        const shares = ethers.parseEther("50");
        const testUser = user1.address;
        
        try {
            // 수수료 재추정
            const [msgFee] = await messaging.estimateMessageFees(testPayload);
            const safeFee = (msgFee * 120n) / 100n; // 20% 안전마진
            
            console.log(`   메시지 수수료: ${ethers.formatEther(msgFee)} HYPE`);
            console.log(`   안전 수수료: ${ethers.formatEther(safeFee)} HYPE`);
            
            const sendTx = await messaging.sendDepositMessage(
                vault,
                indexTokenId,
                assets,
                shares,
                testUser,
                { value: safeFee }
            );
            
            const sendReceipt = await sendTx.wait();
            console.log(`   ✅ sendDepositMessage 성공!`);
            console.log(`   트랜잭션: ${sendReceipt.hash}`);
            console.log(`   가스 사용: ${sendReceipt.gasUsed.toString()}`);
            
            // 이벤트 확인
            const events = sendReceipt.logs.map(log => {
                try {
                    const parsed = messaging.interface.parseLog(log);
                    return parsed ? parsed.name : null;
                } catch {
                    try {
                        const parsed = mockEndpoint.interface.parseLog(log);
                        return parsed ? `MockEndpoint.${parsed.name}` : null;
                    } catch {
                        return null;
                    }
                }
            }).filter(Boolean);
            
            console.log(`   발생한 이벤트: ${events.join(', ')}`);
            
            return true;
            
        } catch (error) {
            console.log(`   ❌ sendDepositMessage 실패: ${error.message}`);
            
            // 상세 에러 분석
            if (error.message.includes('insufficient fee')) {
                console.log(`     → 수수료 부족 문제`);
            } else if (error.message.includes('message send failed')) {
                console.log(`     → LayerZero 전송 레벨 실패`);
            } else if (error.message.includes('revert')) {
                console.log(`     → 컨트랙트 revert 발생`);
            } else {
                console.log(`     → 기타 에러`);
            }
            
            return false;
        }
        
    } catch (error) {
        console.error(`❌ Step ${step}에서 실패:`, error.message);
        return false;
    }
}

async function main() {
    console.log('='.repeat(80));
    console.log('🔍 LayerZero Messaging 단계별 디버깅');
    console.log('='.repeat(80));
    
    const success = await debugLayerZeroMessaging();
    
    if (success) {
        console.log('\n✅ 모든 단계 성공! LayerZero Messaging이 정상 동작함');
    } else {
        console.log('\n❌ 디버깅에서 문제 발견됨');
    }
    
    return success;
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { debugLayerZeroMessaging };