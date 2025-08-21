const { ethers } = require('hardhat');

// LayerZero Endpoint addresses for testnet
const LAYERZERO_ENDPOINTS = {
    // Mainnets
    ethereum: '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675',
    arbitrum: '0x3c2269811836af69497E5F486A85D7316753cf62',
    polygon: '0x3c2269811836af69497E5F486A85D7316753cf62',
    bsc: '0x3c2269811836af69497E5F486A85D7316753cf62',
    
    // Testnets
    sepolia: '0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1',
    arbitrumSepolia: '0x6EDCE65403992e310A62460808c4b910D972f10f',
    polygonMumbai: '0x6Fcb97553D41516Cb228ac03FdC8B9a0a9df04A1',
    bscTestnet: '0x6Fcb97553D41516Cb228ac03FdC8B9a0a9df04A1',
    
    // HyperEVM (추정 - 실제 주소 확인 필요)
    hyperEvmTestnet: '0x1a44076050125825900e736c501f859c50fE728c',
    hyperEvmMainnet: '0x1a44076050125825900e736c501f859c50fE728c'
};

// LayerZero Chain IDs (EIDs)
const LAYERZERO_EIDS = {
    ethereum: 30101,
    arbitrum: 30110,
    polygon: 30109,
    bsc: 30102,
    
    sepolia: 40161,
    arbitrumSepolia: 40231,
    polygonMumbai: 40109,
    bscTestnet: 40102,
    
    hyperEvmTestnet: 40217, // 추정
    hyperEvmMainnet: 30217   // 추정
};

async function verifyLayerZeroEndpoints() {
    console.log('🔍 Verifying LayerZero Endpoints...\n');
    
    const currentNetwork = await ethers.provider.getNetwork();
    console.log(`Current Network: ${currentNetwork.name} (Chain ID: ${currentNetwork.chainId})\n`);
    
    // Check if we can connect to LayerZero endpoint
    const networkKey = currentNetwork.chainId === 998 ? 'hyperEvmTestnet' : 'sepolia';
    const endpointAddress = LAYERZERO_ENDPOINTS[networkKey];
    const eid = LAYERZERO_EIDS[networkKey];
    
    console.log(`LayerZero Endpoint: ${endpointAddress}`);
    console.log(`LayerZero EID: ${eid}\n`);
    
    try {
        // Try to get code at the endpoint address
        const code = await ethers.provider.getCode(endpointAddress);
        
        if (code === '0x') {
            console.log('❌ No contract found at LayerZero endpoint address');
            console.log('⚠️  This might be because:');
            console.log('   - HyperEVM testnet LayerZero endpoint is not deployed yet');
            console.log('   - The endpoint address is incorrect');
            console.log('   - Network connection issues\n');
        } else {
            console.log('✅ Contract found at LayerZero endpoint address');
            console.log(`   Code length: ${code.length} bytes\n`);
            
            // Try to interact with the endpoint
            const endpointABI = [
                "function getInboundNonce(uint16 _srcChainId, bytes calldata _srcAddress) external view returns (uint64)",
                "function getOutboundNonce(uint16 _dstChainId, address _srcAddress) external view returns (uint64)",
                "function estimateFees(uint16 _dstChainId, address _userApplication, bytes calldata _payload, bool _payInZRO, bytes calldata _adapterParams) external view returns (uint nativeFee, uint zroFee)"
            ];
            
            const endpoint = new ethers.Contract(endpointAddress, endpointABI, ethers.provider);
            
            // Test basic functionality
            try {
                const [deployer] = await ethers.getSigners();
                const nonce = await endpoint.getOutboundNonce(40161, deployer.address); // Sepolia
                console.log(`✅ Outbound nonce to Sepolia: ${nonce}`);
            } catch (error) {
                console.log(`⚠️  Could not query outbound nonce: ${error.message}`);
            }
        }
    } catch (error) {
        console.log(`❌ Error checking LayerZero endpoint: ${error.message}\n`);
    }
    
    // Display all available endpoints
    console.log('📋 Available LayerZero Endpoints:\n');
    console.log('MAINNETS:');
    Object.entries(LAYERZERO_ENDPOINTS).forEach(([network, address]) => {
        if (!network.includes('Testnet') && !network.includes('Sepolia') && !network.includes('Mumbai')) {
            const eid = LAYERZERO_EIDS[network];
            console.log(`  ${network.padEnd(15)}: ${address} (EID: ${eid})`);
        }
    });
    
    console.log('\nTESTNETS:');
    Object.entries(LAYERZERO_ENDPOINTS).forEach(([network, address]) => {
        if (network.includes('Testnet') || network.includes('Sepolia') || network.includes('Mumbai')) {
            const eid = LAYERZERO_EIDS[network];
            console.log(`  ${network.padEnd(15)}: ${address} (EID: ${eid})`);
        }
    });
    
    console.log('\n⚠️  Note: HyperEVM LayerZero addresses are estimated and need verification');
    console.log('🔗 Check official LayerZero documentation for accurate addresses');
}

async function testCrossChainMessage() {
    console.log('\n🧪 Testing Cross-Chain Message Preparation...\n');
    
    try {
        // This would be used in actual cross-chain messaging
        const messagePayload = ethers.AbiCoder.defaultAbiCoder().encode(
            ['uint256', 'uint256', 'address'],
            [1, ethers.parseEther('100'), '0x1234567890123456789012345678901234567890']
        );
        
        console.log(`Message payload: ${messagePayload}`);
        console.log(`Payload length: ${messagePayload.length} bytes`);
        
        // Estimate fees for cross-chain message
        const adapterParams = ethers.solidityPacked(['uint16', 'uint256'], [1, 200000]); // version 1, gas limit
        
        console.log(`Adapter params: ${adapterParams}`);
        console.log('✅ Cross-chain message preparation successful');
    } catch (error) {
        console.log(`⚠️  Cross-chain message preparation failed: ${error.message}`);
    }
}

async function main() {
    await verifyLayerZeroEndpoints();
    await testCrossChainMessage();
    
    console.log('\n📝 Next Steps:');
    console.log('1. Verify HyperEVM LayerZero endpoint address with HyperEVM team');
    console.log('2. Get testnet tokens from HyperEVM faucet');
    console.log('3. Update .env file with your private key');
    console.log('4. Test contract compilation and deployment');
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
    LAYERZERO_ENDPOINTS,
    LAYERZERO_EIDS,
    verifyLayerZeroEndpoints,
    testCrossChainMessage
};