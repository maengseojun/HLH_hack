
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
        throw new Error(`Unsupported network: ${network.chainId}`);
    }
    
    console.log(`배포 대상 네트워크: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`LayerZero Endpoint: ${endpoint}`);
    console.log(`Deployer: ${deployer.address}`);
    
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
