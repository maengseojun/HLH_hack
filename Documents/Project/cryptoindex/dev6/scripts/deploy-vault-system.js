const { ethers, upgrades } = require('hardhat');

async function deployVaultSystem() {
    console.log('🚀 Starting HyperIndex Vault System deployment...');
    
    const [deployer] = await ethers.getSigners();
    console.log('Deploying with account:', deployer.address);
    console.log('Account balance:', ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

    const deploymentConfig = {
        // LayerZero endpoints for different chains
        layerZeroEndpoints: {
            ethereumSepolia: '0x6EDCE65403992e310A62460808c4b910D972f10f',
            arbitrumSepolia: '0x6EDCE65403992e310A62460808c4b910D972f10f',
            polygonAmoy: '0x6EDCE65403992e310A62460808c4b910D972f10f',
            hyperevmTestnet: '0x6EDCE65403992e310A62460808c4b910D972f10f'
        },
        layerZeroEIDs: {
            ethereumSepolia: 40161,
            arbitrumSepolia: 40231,
            polygonAmoy: 40109,
            hyperevmTestnet: 30999
        },
        managementFeeBps: 25,   // 0.25%
        performanceFeeBps: 0,   // 0%
        rebalanceToleranceBps: 300, // 3%
        maxTokens: 20
    };

    const deployments = {};

    try {
        // 1. Deploy HyperIndexVault Implementation
        console.log('\n📋 Deploying HyperIndexVault Implementation...');
        const HyperIndexVault = await ethers.getContractFactory('HyperIndexVault');
        const currentNetwork = await ethers.provider.getNetwork();
        const lzEndpoint = deploymentConfig.layerZeroEndpoints[currentNetwork.name] || 
                          deploymentConfig.layerZeroEndpoints.ethereum;
        
        const vaultImplementation = await HyperIndexVault.deploy(lzEndpoint);
        await vaultImplementation.waitForDeployment();
        
        const vaultImplAddress = await vaultImplementation.getAddress();
        console.log('✅ HyperIndexVault Implementation:', vaultImplAddress);
        deployments.vaultImplementation = vaultImplAddress;

        // 2. Deploy HyperEVM RecordKeeper (only if on HyperEVM)
        if (currentNetwork.name === 'hyperEvm' || currentNetwork.chainId === 40217) {
            console.log('\n📊 Deploying HyperEVM RecordKeeper...');
            const HyperEvmRecordKeeper = await ethers.getContractFactory('HyperEvmRecordKeeper');
            const recordKeeper = await HyperEvmRecordKeeper.deploy(lzEndpoint);
            await recordKeeper.deployed();
            
            console.log('✅ HyperEVM RecordKeeper:', recordKeeper.address);
            deployments.recordKeeper = recordKeeper.address;
        }

        // 3. Deploy Mock MultiChainAggregator (for testing)
        console.log('\n🔄 Deploying Mock MultiChainAggregator...');
        const MockMultiChainAggregator = await ethers.getContractFactory('MockMultiChainAggregator');
        const mockAggregator = await MockMultiChainAggregator.deploy();
        await mockAggregator.deployed();
        
        console.log('✅ Mock MultiChainAggregator:', mockAggregator.address);
        deployments.mockAggregator = mockAggregator.address;

        // 4. Deploy Test Vault Instance
        console.log('\n🏦 Deploying Test Vault Instance...');
        
        // Deploy mock ERC20 for testing
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        const testAsset = await MockERC20.deploy(
            'Test USDC',
            'TUSDC',
            18,
            ethers.utils.parseEther('1000000') // 1M supply
        );
        await testAsset.deployed();
        console.log('✅ Test Asset (TUSDC):', testAsset.address);
        deployments.testAsset = testAsset.address;

        // Deploy additional test tokens for portfolio
        const testTokens = [];
        const tokenNames = ['Test ETH', 'Test BTC', 'Test SOL'];
        const tokenSymbols = ['TETH', 'TBTC', 'TSOL'];
        
        for (let i = 0; i < tokenNames.length; i++) {
            const token = await MockERC20.deploy(
                tokenNames[i],
                tokenSymbols[i],
                18,
                ethers.utils.parseEther('1000000')
            );
            await token.deployed();
            testTokens.push(token.address);
            console.log(`✅ ${tokenNames[i]} (${tokenSymbols[i]}):`, token.address);
        }
        deployments.testTokens = testTokens;

        // Initialize test vault
        const vaultConfig = {
            indexTokenId: 1,
            managementFeeBps: deploymentConfig.managementFeeBps,
            performanceFeeBps: deploymentConfig.performanceFeeBps,
            rebalanceToleranceBps: deploymentConfig.rebalanceToleranceBps,
            hyperEvmEid: deploymentConfig.hyperEvmEid,
            feeRecipient: deployer.address,
            autoRebalanceEnabled: true
        };

        // Equal weights for test tokens (25% each)
        const weights = [2500, 2500, 2500, 2500];
        
        // Create proxy for test vault
        console.log('\n🎯 Initializing Test Vault...');
        const testVault = await upgrades.deployProxy(
            HyperIndexVault,
            [
                testAsset.address,           // asset
                'HyperIndex Test Fund',      // name
                'HITF',                      // symbol
                deployer.address,            // admin
                vaultConfig,                 // config
                testTokens,                  // underlying tokens
                weights,                     // token weights
                mockAggregator.address       // aggregator
            ],
            {
                kind: 'uups',
                constructorArgs: [lzEndpoint]
            }
        );
        await testVault.deployed();
        
        console.log('✅ Test Vault Proxy:', testVault.address);
        deployments.testVault = testVault.address;

        // 5. Setup initial permissions and configuration
        console.log('\n⚙️  Setting up permissions...');
        
        // Grant roles to deployer
        await testVault.grantRole(await testVault.REBALANCER_ROLE(), deployer.address);
        await testVault.grantRole(await testVault.FEE_MANAGER_ROLE(), deployer.address);
        
        console.log('✅ Permissions configured');

        // 6. Contract verification skipped (verify utility not available)
        console.log('\n⚠️  Contract verification skipped');

        // 7. Save deployment info
        const deploymentInfo = {
            network: currentNetwork.name,
            chainId: currentNetwork.chainId,
            deployer: deployer.address,
            timestamp: new Date().toISOString(),
            contracts: deployments,
            config: deploymentConfig,
            gasUsed: 'TBD', // Would need to track gas usage
            layerZeroEndpoint: lzEndpoint
        };

        console.log('\n📄 Deployment Summary:');
        console.table({
            'Network': currentNetwork.name,
            'Chain ID': currentNetwork.chainId,
            'Vault Implementation': deployments.vaultImplementation,
            'Test Vault Proxy': deployments.testVault,
            'Mock Aggregator': deployments.mockAggregator,
            'Test Asset': deployments.testAsset,
            'Record Keeper': deployments.recordKeeper || 'N/A (not HyperEVM)'
        });

        console.log('\n🎉 Deployment completed successfully!');
        
        // Return deployment info for potential use in scripts
        return deploymentInfo;

    } catch (error) {
        console.error('❌ Deployment failed:', error);
        throw error;
    }
}

// Test vault functionality
async function testVaultFunctionality(deploymentInfo) {
    console.log('\n🧪 Testing vault functionality...');
    
    const [deployer, user1] = await ethers.getSigners();
    
    // Get contract instances
    const testAsset = await ethers.getContractAt('MockERC20', deploymentInfo.contracts.testAsset);
    const testVault = await ethers.getContractAt('HyperIndexVault', deploymentInfo.contracts.testVault);
    
    try {
        // Transfer some test assets to user1
        const depositAmount = ethers.utils.parseEther('1000');
        await testAsset.transfer(user1.address, depositAmount.mul(2));
        
        console.log('✅ Transferred test assets to user');
        
        // Test deposit
        await testAsset.connect(user1).approve(testVault.address, depositAmount);
        await testVault.connect(user1).deposit(depositAmount, user1.address);
        
        console.log('✅ Test deposit completed');
        
        // Check vault state
        const totalAssets = await testVault.totalAssets();
        const totalSupply = await testVault.totalSupply();
        const userBalance = await testVault.balanceOf(user1.address);
        
        console.log('📊 Vault State:');
        console.log('   Total Assets:', ethers.utils.formatEther(totalAssets));
        console.log('   Total Supply:', ethers.utils.formatEther(totalSupply));
        console.log('   User Balance:', ethers.utils.formatEther(userBalance));
        
        // Test rebalancing check
        const [needsRebalancing, deviations] = await testVault.needsRebalancing();
        console.log('🔄 Needs Rebalancing:', needsRebalancing);
        
        console.log('✅ All tests passed!');
        
    } catch (error) {
        console.error('❌ Testing failed:', error);
        throw error;
    }
}

// Deploy mock MultiChainAggregator for testing
async function deployMockAggregator() {
    const MockAggregator = `
        // SPDX-License-Identifier: MIT
        pragma solidity ^0.8.17;

        contract MockMultiChainAggregator {
            mapping(uint32 => uint256) public assetPrices;
            
            constructor() {
                // Set some mock prices
                assetPrices[0] = 1e18; // ETH: $1
                assetPrices[1] = 1e18; // BTC: $1  
                assetPrices[2] = 1e18; // SOL: $1
            }
            
            function getAggregatedPrice(uint32 assetIndex) external view returns (
                uint32,
                uint256 weightedPrice,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256[] memory,
                uint256[] memory,
                uint256
            ) {
                return (
                    assetIndex,
                    assetPrices[assetIndex],
                    0, 0, 0, 0,
                    new uint256[](0),
                    new uint256[](0),
                    block.timestamp
                );
            }
        }
    `;
    
    // This would be written to a temporary file and compiled
    return MockAggregator;
}

// Main execution
async function main() {
    const deploymentInfo = await deployVaultSystem();
    
    // Run tests if requested
    if (process.env.RUN_TESTS === 'true') {
        await testVaultFunctionality(deploymentInfo);
    }
    
    return deploymentInfo;
}

// Execute if called directly
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = {
    deployVaultSystem,
    testVaultFunctionality,
    main
};