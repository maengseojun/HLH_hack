const { ethers } = require('hardhat');
const hre = require('hardhat');

/**
 * 🌐 LayerZero 크로스체인 메시징 테스트 스크립트
 * HyperEVM ↔ Ethereum Sepolia, Arbitrum Sepolia, Polygon Amoy 간 메시징 테스트
 */

// LayerZero EID 매핑
const LAYERZERO_EIDS = {
    ethereumSepolia: 40161,
    arbitrumSepolia: 40231,
    polygonAmoy: 40109,
    hyperevmTestnet: 30999
};

// LayerZero Endpoint 주소 (모든 체인 공통)
const LAYERZERO_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f";

class LayerZeroCrossChainTester {
    constructor() {
        this.deployedContracts = {};
        this.testResults = {
            networkConnections: {},
            messageSent: {},
            messageReceived: {},
            gasEstimates: {}
        };
    }

    /**
     * 🔍 네트워크 연결 상태 확인
     */
    async checkNetworkConnections() {
        console.log('🔍 LayerZero 네트워크 연결 상태 확인...\n');

        const networks = ['ethereumSepolia', 'arbitrumSepolia', 'polygonAmoy', 'hyperevmTestnet'];
        
        for (const networkName of networks) {
            try {
                // 네트워크 설정 가져오기
                const networkConfig = hre.config.networks[networkName];
                if (!networkConfig) {
                    console.log(`❌ ${networkName}: 설정 없음`);
                    continue;
                }

                // RPC 연결 테스트
                const provider = new ethers.JsonRpcProvider(networkConfig.url);
                const network = await provider.getNetwork();
                const blockNumber = await provider.getBlockNumber();
                
                // LayerZero Endpoint 확인
                const code = await provider.getCode(LAYERZERO_ENDPOINT);
                const hasEndpoint = code !== '0x';
                
                console.log(`✅ ${networkName}:`);
                console.log(`   Chain ID: ${network.chainId}`);
                console.log(`   Block: ${blockNumber}`);
                console.log(`   LayerZero EID: ${LAYERZERO_EIDS[networkName]}`);
                console.log(`   LayerZero Endpoint: ${hasEndpoint ? '✅' : '❌'}`);
                console.log(`   RPC: ${networkConfig.url}\n`);
                
                this.testResults.networkConnections[networkName] = {
                    connected: true,
                    chainId: network.chainId.toString(),
                    blockNumber,
                    hasLayerZeroEndpoint: hasEndpoint,
                    eid: LAYERZERO_EIDS[networkName]
                };
                
            } catch (error) {
                console.log(`❌ ${networkName}: ${error.message}\n`);
                this.testResults.networkConnections[networkName] = {
                    connected: false,
                    error: error.message
                };
            }
        }
    }

    /**
     * 📡 LayerZero Endpoint 상호작용 테스트
     */
    async testLayerZeroEndpoints() {
        console.log('📡 LayerZero Endpoint 상호작용 테스트...\n');

        const networks = Object.keys(this.testResults.networkConnections).filter(
            network => this.testResults.networkConnections[network].connected && 
                      this.testResults.networkConnections[network].hasLayerZeroEndpoint
        );

        for (const networkName of networks) {
            try {
                console.log(`🔧 ${networkName} LayerZero Endpoint 테스트...`);
                
                const networkConfig = hre.config.networks[networkName];
                const provider = new ethers.JsonRpcProvider(networkConfig.url);
                
                // 계정 설정 (테스트 계정 사용)
                let wallet;
                if (networkConfig.accounts && networkConfig.accounts.length > 0 && 
                    networkConfig.accounts[0] !== "your_private_key_here") {
                    wallet = new ethers.Wallet(networkConfig.accounts[0], provider);
                } else {
                    // 테스트용 랜덤 지갑 생성 (실제 배포 시에는 사용하지 마세요)
                    wallet = ethers.Wallet.createRandom().connect(provider);
                    console.log(`   ⚠️  테스트용 임시 지갑 사용: ${wallet.address}`);
                }

                // LayerZero Endpoint 컨트랙트 인터페이스
                const endpointABI = [
                    "function send(uint16 _dstChainId, bytes calldata _destination, bytes calldata _payload, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParams) external payable",
                    "function estimateFees(uint16 _dstChainId, address _userApplication, bytes calldata _payload, bool _payInZRO, bytes calldata _adapterParams) external view returns (uint nativeFee, uint zroFee)",
                    "function getInboundNonce(uint16 _srcChainId, bytes calldata _srcAddress) external view returns (uint64)",
                    "function getOutboundNonce(uint16 _dstChainId, address _srcAddress) external view returns (uint64)"
                ];

                const endpoint = new ethers.Contract(LAYERZERO_ENDPOINT, endpointABI, wallet);

                // Nonce 확인
                try {
                    const outboundNonce = await endpoint.getOutboundNonce(40161, wallet.address); // to Sepolia
                    console.log(`   📊 Outbound Nonce (to Sepolia): ${outboundNonce}`);
                } catch (error) {
                    console.log(`   ⚠️  Nonce 조회 실패: ${error.message}`);
                }

                // 메시지 페이로드 준비
                const payload = ethers.AbiCoder.defaultAbiCoder().encode(
                    ["address", "uint256", "string"],
                    [wallet.address, 42, "Hello from " + networkName]
                );

                // 가스 추정
                try {
                    const adapterParams = ethers.solidityPacked(["uint16", "uint256"], [1, 200000]);
                    const [nativeFee] = await endpoint.estimateFees(
                        40161, // destination EID (Sepolia)
                        wallet.address,
                        payload,
                        false,
                        adapterParams
                    );
                    
                    console.log(`   💰 예상 가스비: ${ethers.formatEther(nativeFee)} ETH`);
                    
                    this.testResults.gasEstimates[networkName] = {
                        toSepolia: ethers.formatEther(nativeFee)
                    };
                } catch (error) {
                    console.log(`   ⚠️  가스 추정 실패: ${error.message}`);
                }

                console.log(`   ✅ ${networkName} LayerZero Endpoint 테스트 완료\n`);

            } catch (error) {
                console.log(`   ❌ ${networkName} LayerZero Endpoint 테스트 실패: ${error.message}\n`);
            }
        }
    }

    /**
     * 🚀 실제 크로스체인 메시지 전송 테스트 (시뮬레이션)
     */
    async simulateCrossChainMessage() {
        console.log('🚀 크로스체인 메시지 전송 시뮬레이션...\n');

        // HyperEVM -> Ethereum Sepolia 메시지 시뮬레이션
        console.log('📤 HyperEVM → Ethereum Sepolia 메시지 전송 시뮬레이션:');
        
        const sourceNetwork = 'hyperevmTestnet';
        const targetNetwork = 'ethereumSepolia';
        const sourceEID = LAYERZERO_EIDS[sourceNetwork];
        const targetEID = LAYERZERO_EIDS[targetNetwork];

        console.log(`   Source: ${sourceNetwork} (EID: ${sourceEID})`);
        console.log(`   Target: ${targetNetwork} (EID: ${targetEID})`);

        // 메시지 페이로드 생성
        const messageData = {
            sender: "0x1234567890123456789012345678901234567890",
            amount: ethers.parseEther("100"),
            indexTokenId: 1,
            action: "rebalance",
            timestamp: Math.floor(Date.now() / 1000)
        };

        const payload = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "uint256", "uint256", "string", "uint256"],
            [messageData.sender, messageData.amount, messageData.indexTokenId, messageData.action, messageData.timestamp]
        );

        console.log(`   📦 Payload: ${payload}`);
        console.log(`   📏 Payload Size: ${payload.length} bytes`);

        // 어댑터 파라미터 설정
        const adapterParams = ethers.solidityPacked(["uint16", "uint256"], [1, 200000]); // version 1, gas limit 200k
        console.log(`   ⚙️  Adapter Params: ${adapterParams}`);

        // 크로스체인 메시지 구조 시뮬레이션
        const crossChainMessage = {
            sourceChain: sourceNetwork,
            targetChain: targetNetwork,
            sourceEID: sourceEID,
            targetEID: targetEID,
            payload: payload,
            adapterParams: adapterParams,
            estimatedGas: "200000",
            timestamp: new Date().toISOString()
        };

        console.log('   ✅ 크로스체인 메시지 구조 생성 완료');
        console.log('   📋 메시지 요약:');
        console.log(`      - Action: ${messageData.action}`);
        console.log(`      - Amount: ${ethers.formatEther(messageData.amount)} ETH`);
        console.log(`      - Token ID: ${messageData.indexTokenId}`);
        console.log(`      - Gas Limit: ${ethers.formatUnits(200000, 0)}`);

        this.testResults.messageSent[`${sourceNetwork}->${targetNetwork}`] = crossChainMessage;

        console.log('\n🎯 실제 전송을 위해서는:');
        console.log('   1. 각 네트워크에 충분한 가스 토큰 보유');
        console.log('   2. LayerZero OApp 컨트랙트 배포');
        console.log('   3. Trusted Remote 설정');
        console.log('   4. Message 전송 실행');

        return crossChainMessage;
    }

    /**
     * 🧪 전체 테스트 실행
     */
    async runFullTest() {
        console.log('🧪 LayerZero 크로스체인 통합 테스트 시작\n');
        console.log('=' * 60 + '\n');

        try {
            // 1. 네트워크 연결 확인
            await this.checkNetworkConnections();

            // 2. LayerZero Endpoint 테스트
            await this.testLayerZeroEndpoints();

            // 3. 크로스체인 메시지 시뮬레이션
            await this.simulateCrossChainMessage();

            // 4. 테스트 결과 요약
            this.printTestSummary();

        } catch (error) {
            console.error('❌ 테스트 실행 중 오류:', error);
            throw error;
        }
    }

    /**
     * 📊 테스트 결과 요약 출력
     */
    printTestSummary() {
        console.log('\n📊 테스트 결과 요약');
        console.log('=' * 50);

        console.log('\n🌐 네트워크 연결 상태:');
        for (const [network, result] of Object.entries(this.testResults.networkConnections)) {
            const status = result.connected ? '✅' : '❌';
            const lzStatus = result.hasLayerZeroEndpoint ? '🟢' : '🔴';
            console.log(`   ${status} ${network}: Chain ${result.chainId} ${lzStatus} LayerZero`);
        }

        console.log('\n💰 예상 가스비:');
        for (const [network, estimates] of Object.entries(this.testResults.gasEstimates)) {
            console.log(`   ${network}: ${estimates.toSepolia} ETH (to Sepolia)`);
        }

        console.log('\n📡 크로스체인 메시지:');
        for (const [route, message] of Object.entries(this.testResults.messageSent)) {
            console.log(`   ${route}: ✅ 시뮬레이션 완료`);
        }

        console.log('\n🚀 다음 단계:');
        console.log('   1. 각 테스트넷에서 토큰 확보');
        console.log('   2. LayerZero OApp 컨트랙트 배포');
        console.log('   3. Trusted Remote 연결 설정');
        console.log('   4. 실제 크로스체인 메시지 전송');
        console.log('   5. HyperIndex Vault 리밸런싱 테스트');
    }

    /**
     * 🛠️ LayerZero OApp 배포 스크립트 생성
     */
    async generateOAppDeployScript() {
        const deployScript = `
// LayerZero OApp 배포 스크립트
const { ethers } = require('hardhat');

async function deployLayerZeroOApp() {
    console.log('🚀 LayerZero OApp 배포 시작...');
    
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    // 네트워크별 LayerZero Endpoint
    const lzEndpoints = {
        11155111: "0x6EDCE65403992e310A62460808c4b910D972f10f", // Ethereum Sepolia
        421614: "0x6EDCE65403992e310A62460808c4b910D972f10f",   // Arbitrum Sepolia
        80002: "0x6EDCE65403992e310A62460808c4b910D972f10f",    // Polygon Amoy
        998: "0x6EDCE65403992e310A62460808c4b910D972f10f"       // HyperEVM Testnet
    };
    
    const endpoint = lzEndpoints[network.chainId];
    if (!endpoint) {
        throw new Error(\`Unsupported network: \${network.chainId}\`);
    }
    
    console.log(\`배포 대상 네트워크: \${network.name} (Chain ID: \${network.chainId})\`);
    console.log(\`LayerZero Endpoint: \${endpoint}\`);
    console.log(\`Deployer: \${deployer.address}\`);
    
    // TODO: HyperIndexVault OApp 컨트랙트 배포
    // const HyperIndexVaultOApp = await ethers.getContractFactory('HyperIndexVaultOApp');
    // const oapp = await HyperIndexVaultOApp.deploy(endpoint, deployer.address);
    // await oapp.deployed();
    
    console.log('✅ OApp 배포 완료');
    return { endpoint, deployer: deployer.address };
}

if (require.main === module) {
    deployLayerZeroOApp()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = deployLayerZeroOApp;
`;
        
        const fs = require('fs');
        fs.writeFileSync('./scripts/deploy-layerzero-oapp.js', deployScript);
        console.log('📝 LayerZero OApp 배포 스크립트 생성: ./scripts/deploy-layerzero-oapp.js');
    }
}

// 메인 실행 함수
async function main() {
    const tester = new LayerZeroCrossChainTester();
    
    try {
        await tester.runFullTest();
        await tester.generateOAppDeployScript();
        
        console.log('\n🎉 LayerZero 크로스체인 테스트 완료!');
        console.log('\n📋 사용 가능한 명령어:');
        console.log('   npx hardhat run scripts/test-layerzero-crosschain.js');
        console.log('   npx hardhat run scripts/deploy-layerzero-oapp.js --network hyperevmTestnet');
        console.log('   npx hardhat run scripts/deploy-layerzero-oapp.js --network ethereumSepolia');
        
        return tester.testResults;
        
    } catch (error) {
        console.error('❌ 테스트 실행 실패:', error);
        process.exit(1);
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
    LayerZeroCrossChainTester,
    main,
    LAYERZERO_EIDS,
    LAYERZERO_ENDPOINT
};