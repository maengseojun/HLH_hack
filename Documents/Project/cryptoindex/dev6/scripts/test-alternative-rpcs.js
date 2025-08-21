const { ethers } = require('hardhat');

async function testAlternativeRPCs() {
    console.log('🌐 대안 RPC 엔드포인트 테스트...\n');
    
    // 알려진 대안 RPC 엔드포인트들
    const alternativeRPCs = [
        {
            name: "HyperLiquid Official 1",
            url: "https://rpc.hyperliquid-testnet.xyz/evm",
            description: "현재 사용 중"
        },
        {
            name: "HyperLiquid Official 2", 
            url: "https://api.hyperliquid-testnet.xyz/evm",
            description: "이전에 404 에러 발생"
        },
        {
            name: "HyperLiquid Alternative",
            url: "https://testnet-rpc.hyperliquid.xyz/evm",
            description: "대안 엔드포인트"
        },
        {
            name: "HyperLiquid Public",
            url: "https://hyperliquid-testnet.drpc.org",
            description: "dRPC 제공"
        },
        {
            name: "QuickNode Style",
            url: "https://rpc.quicknode.pro/hyperliquid-testnet",
            description: "QuickNode 스타일"
        }
    ];
    
    const workingRPCs = [];
    
    for (const rpc of alternativeRPCs) {
        console.log(`🔍 ${rpc.name} 테스트...`);
        console.log(`   URL: ${rpc.url}`);
        console.log(`   설명: ${rpc.description}`);
        
        try {
            // 커스텀 provider 생성
            const provider = new ethers.JsonRpcProvider(rpc.url);
            
            // 기본 연결 테스트
            const network = await provider.getNetwork();
            const blockNumber = await provider.getBlockNumber();
            
            if (network.chainId.toString() === '998') {
                console.log(`   ✅ 연결 성공! Chain ID: ${network.chainId}, Block: ${blockNumber}`);
                
                // 가스 한도 확인
                const latestBlock = await provider.getBlock('latest');
                console.log(`   ⛽ 가스 한도: ${latestBlock.gasLimit.toString()}`);
                
                if (latestBlock.gasLimit.toString() === "30000000") {
                    console.log(`   🎯 Big Block 모드 (30M gas)!`);
                } else if (latestBlock.gasLimit.toString() === "2000000") {
                    console.log(`   📦 Small Block 모드 (2M gas)`);
                }
                
                workingRPCs.push({
                    ...rpc,
                    gasLimit: latestBlock.gasLimit.toString(),
                    blockNumber: blockNumber,
                    working: true
                });
                
                // 간단한 배포 테스트
                console.log(`   🧪 간단 배포 테스트...`);
                
                // 개인키로 지갑 생성
                const privateKey = process.env.PRIVATE_KEY;
                if (privateKey && privateKey !== "your_private_key_here") {
                    const wallet = new ethers.Wallet(privateKey, provider);
                    
                    // MockERC20 factory 생성
                    const MockERC20 = await ethers.getContractFactory('MockERC20');
                    const factory = new ethers.ContractFactory(
                        MockERC20.interface,
                        MockERC20.bytecode,
                        wallet
                    );
                    
                    try {
                        const gasLimit = latestBlock.gasLimit.toString() === "30000000" ? 15000000 : 1500000;
                        
                        const deployTx = await factory.deploy(
                            "RPC Test Token",
                            "RTT",
                            18,
                            {
                                gasLimit: gasLimit,
                                gasPrice: 100000000,
                            }
                        );
                        
                        console.log(`   📤 배포 트랜잭션: ${deployTx.deploymentTransaction()?.hash}`);
                        
                        await deployTx.waitForDeployment();
                        const address = await deployTx.getAddress();
                        
                        console.log(`   🎉 배포 성공: ${address}`);
                        workingRPCs[workingRPCs.length - 1].deploymentSuccess = true;
                        workingRPCs[workingRPCs.length - 1].contractAddress = address;
                        
                    } catch (deployError) {
                        console.log(`   ❌ 배포 실패: ${deployError.message}`);
                        workingRPCs[workingRPCs.length - 1].deploymentSuccess = false;
                        workingRPCs[workingRPCs.length - 1].deploymentError = deployError.message;
                    }
                }
                
            } else {
                console.log(`   ❌ 잘못된 네트워크: Chain ID ${network.chainId}`);
            }
            
        } catch (error) {
            console.log(`   ❌ 연결 실패: ${error.message}`);
        }
        
        console.log(''); // 빈 줄
    }
    
    return workingRPCs;
}

async function main() {
    console.log('=' .repeat(80));
    console.log('🌐 HyperEVM 대안 RPC 엔드포인트 테스트');
    console.log('=' .repeat(80));
    
    const workingRPCs = await testAlternativeRPCs();
    
    console.log('\n📊 테스트 결과 요약:');
    console.log('=' .repeat(80));
    
    if (workingRPCs.length > 0) {
        console.table(workingRPCs.map(rpc => ({
            Name: rpc.name,
            URL: rpc.url,
            'Gas Limit': rpc.gasLimit,
            'Block Number': rpc.blockNumber,
            'Deploy Success': rpc.deploymentSuccess || false,
            'Contract Address': rpc.contractAddress || 'N/A'
        })));
        
        const successfulDeployments = workingRPCs.filter(rpc => rpc.deploymentSuccess);
        
        if (successfulDeployments.length > 0) {
            console.log(`\n🎉 ${successfulDeployments.length}개의 RPC에서 배포 성공!`);
            console.log('추천 RPC 엔드포인트:');
            successfulDeployments.forEach(rpc => {
                console.log(`- ${rpc.name}: ${rpc.url}`);
            });
        } else {
            console.log('\n⚠️  모든 RPC에서 배포 실패 - 네트워크 레벨 이슈 확인됨');
        }
    } else {
        console.log('❌ 작동하는 대안 RPC를 찾을 수 없습니다.');
    }
    
    return workingRPCs;
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { testAlternativeRPCs };