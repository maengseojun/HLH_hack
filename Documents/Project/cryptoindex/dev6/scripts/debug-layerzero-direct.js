const { ethers } = require('hardhat');

/**
 * Debug script to directly test Mock LayerZero Endpoint
 */

async function debugLayerZeroDirect() {
    console.log('🔍 LayerZero Mock Endpoint 직접 테스트\n');
    
    const [deployer] = await ethers.getSigners();
    console.log(`📍 배포자: ${deployer.address}`);
    
    try {
        // 1. Mock Endpoint 배포
        console.log('1. Mock LayerZero Endpoint V2 배포...');
        const MockLayerZeroEndpointV2 = await ethers.getContractFactory('MockLayerZeroEndpointV2');
        const mockEndpoint = await MockLayerZeroEndpointV2.deploy();
        await mockEndpoint.waitForDeployment();
        
        const endpointAddress = await mockEndpoint.getAddress();
        console.log(`   Endpoint: ${endpointAddress}`);
        
        // 2. 간단한 메시지 페이로드 생성
        const testPayload = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256'],
            [deployer.address, 1000]
        );
        console.log(`   페이로드 크기: ${testPayload.length / 2 - 1} bytes`);
        
        // 3. 수수료 추정
        const [nativeFee, zroFee] = await mockEndpoint.estimateFees(
            30000, // HyperEVM
            deployer.address,
            testPayload,
            false,
            "0x"
        );
        console.log(`   예상 수수료: ${ethers.formatEther(nativeFee)} HYPE`);
        
        // 4. 직접 send 호출 테스트
        console.log('2. 직접 Mock Endpoint send 호출...');
        
        const destination = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address'],
            [deployer.address]
        );
        
        console.log(`   목적지: ${deployer.address}`);
        console.log(`   인코딩된 목적지: ${destination}`);
        console.log(`   페이로드: ${testPayload}`);
        console.log(`   수수료: ${ethers.formatEther(nativeFee)} HYPE`);
        
        const sendTx = await mockEndpoint.send(
            30000, // HyperEVM LZ chain ID
            destination,
            testPayload,
            deployer.address,
            ethers.ZeroAddress,
            "0x",
            { value: nativeFee }
        );
        
        const receipt = await sendTx.wait();
        console.log(`   ✅ 직접 send 성공!`);
        console.log(`   트랜잭션: ${receipt.hash}`);
        console.log(`   가스 사용: ${receipt.gasUsed.toString()}`);
        
        // 이벤트 확인
        const events = receipt.logs.map(log => {
            try {
                return mockEndpoint.interface.parseLog(log);
            } catch {
                return null;
            }
        }).filter(Boolean);
        
        console.log(`   이벤트 수: ${events.length}`);
        events.forEach((event, index) => {
            console.log(`   이벤트 ${index + 1}: ${event.name}`);
        });
        
        return true;
        
    } catch (error) {
        console.error('❌ 직접 테스트 실패:', error.message);
        
        // 상세 에러 분석
        if (error.message.includes('insufficient fee')) {
            console.log('   → 수수료 부족');
        } else if (error.message.includes('destination chain not active')) {
            console.log('   → 목적지 체인 비활성화');
        } else if (error.message.includes('invalid destination')) {
            console.log('   → 잘못된 목적지');
        } else {
            console.log(`   → 기타 에러: ${error.message}`);
        }
        
        return false;
    }
}

async function main() {
    console.log('='.repeat(80));
    console.log('🔍 LayerZero Mock Endpoint 직접 디버깅');
    console.log('='.repeat(80));
    
    const success = await debugLayerZeroDirect();
    
    if (success) {
        console.log('\n✅ 직접 테스트 성공! Mock Endpoint가 정상 동작함');
        console.log('   → 문제는 LayerZero Messaging 컨트랙트에 있을 가능성이 높음');
    } else {
        console.log('\n❌ 직접 테스트 실패! Mock Endpoint에 문제 있음');
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

module.exports = { debugLayerZeroDirect };