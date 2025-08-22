// deploy-remaining.js
/**
 * Deploy remaining contracts with known previous deployments
 */

const { ethers } = require("hardhat");

async function main() {
    console.log("🔄 Continuing HyperIndex Core Contracts Deployment...");
    
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} HYPE`);
    
    // Use latest deployed addresses (from previous successful deployment)
    const deployedContracts = {
        mockUSDC: "0x22188e16527bC31851794cC18885e38AA833b5b7",
        mockWETH: "0x6D63730DCB829E3998C0CC541D8a33b0Bd601FeC", 
        mockWBTC: "0xDe29a8757F99cfC824888A55Dec1eB39Cd30B077",
        mockPriceFeed: "0x96D50eb4D1AC1D0Db1938De1Cf7f70666bc8D56e",
        securityManager: "0x6655F1E8A6406Ce64fD35a94826B384f432eEFd7"
    };
    
    console.log("\n📝 Using previously deployed contracts:");
    console.log(`   Mock USDC: ${deployedContracts.mockUSDC}`);
    console.log(`   Mock WETH: ${deployedContracts.mockWETH}`);
    console.log(`   Mock WBTC: ${deployedContracts.mockWBTC}`);
    console.log(`   Mock PriceFeed: ${deployedContracts.mockPriceFeed}`);
    console.log(`   SecurityManager: ${deployedContracts.securityManager}`);
    
    try {
        // Deploy IndexTokenFactory
        console.log("\n🏭 Deploying IndexTokenFactory...");
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        const indexTokenFactory = await IndexTokenFactory.deploy(deployedContracts.mockPriceFeed);
        await indexTokenFactory.waitForDeployment();
        deployedContracts.factory = await indexTokenFactory.getAddress();
        console.log(`   ✅ IndexTokenFactory: ${deployedContracts.factory}`);
        
        // Deploy SmartIndexVault Template
        console.log("\n🏦 Deploying SmartIndexVault Template...");
        const SmartIndexVault = await ethers.getContractFactory("SmartIndexVault");
        const vaultTemplate = await SmartIndexVault.deploy(
            ethers.ZeroAddress, // template asset (zero for template)
            "HyperIndex Vault Template",
            "HIVT"
        );
        await vaultTemplate.waitForDeployment();
        deployedContracts.vaultTemplate = await vaultTemplate.getAddress();
        console.log(`   ✅ SmartIndexVault Template: ${deployedContracts.vaultTemplate}`);
        
        // Initial configuration
        console.log("\n⚙️ Initial configuration...");
        
        // Get contract instances
        const mockUSDC = await ethers.getContractAt("MockERC20", deployedContracts.mockUSDC);
        const mockWETH = await ethers.getContractAt("MockERC20", deployedContracts.mockWETH);
        const mockWBTC = await ethers.getContractAt("MockERC20", deployedContracts.mockWBTC);
        const mockPriceFeed = await ethers.getContractAt("MockPriceFeed", deployedContracts.mockPriceFeed);
        
        // Mint test tokens
        console.log("   🪙 Minting test tokens...");
        await mockUSDC.mint(deployer.address, ethers.parseUnits("10000", 6)); // 10,000 USDC
        await mockWETH.mint(deployer.address, ethers.parseEther("100")); // 100 WETH  
        await mockWBTC.mint(deployer.address, ethers.parseUnits("10", 8)); // 10 WBTC
        console.log("   ✅ Test tokens minted");
        
        // Verify deployments
        console.log("\n✅ Verifying deployments...");
        
        // Test price feed
        const testPrice = await mockPriceFeed.getPrice(0);
        console.log(`   📊 USDC 가격: $${ethers.formatUnits(testPrice, 18)}`);
        
        // Test token balances
        const usdcBalance = await mockUSDC.balanceOf(deployer.address);
        const wethBalance = await mockWETH.balanceOf(deployer.address);
        const wbtcBalance = await mockWBTC.balanceOf(deployer.address);
        
        console.log(`   💵 USDC 잔액: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
        console.log(`   💵 WETH 잔액: ${ethers.formatEther(wethBalance)} WETH`);
        console.log(`   💵 WBTC 잔액: ${ethers.formatUnits(wbtcBalance, 8)} WBTC`);
        
        console.log("\n🎉 Core Contract Deployment Completed!");
        console.log("\n📊 Complete Deployment Summary:");
        Object.keys(deployedContracts).forEach(key => {
            console.log(`   ${key}: ${deployedContracts[key]}`);
        });
        
        // Save deployment info
        const deploymentInfo = {
            network: "hypervm-testnet",
            chainId: 998,
            deployer: deployer.address,
            timestamp: new Date().toISOString(),
            contracts: deployedContracts
        };
        
        console.log("\n💾 Saving deployment info...");
        require('fs').writeFileSync(
            'testnet-deployment.json', 
            JSON.stringify(deploymentInfo, null, 2)
        );
        console.log("   ✅ Saved to testnet-deployment.json");
        
        console.log("\n💡 Next Steps:");
        console.log("   1. Configure LayerZero messaging");
        console.log("   2. Set up 1inch API integration");  
        console.log("   3. Test security systems");
        console.log("   4. Run E2E tests");
        
    } catch (error) {
        console.error("\n❌ Deployment failed:", error.message);
        
        if (error.message.includes("insufficient funds")) {
            console.log("\n💡 Need more HYPE tokens for deployment");
        }
        
        if (error.message.includes("execution reverted")) {
            console.log("\n💡 Contract execution failed - check constructor parameters");
        }
        
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });