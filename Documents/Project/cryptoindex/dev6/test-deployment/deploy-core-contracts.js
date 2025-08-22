// test-deployment/deploy-core-contracts.js
/**
 * Deploy HyperIndex core contracts to testnet
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying HyperIndex Core Contracts to HyperEVM Testnet\n");
  
  try {
    const [deployer] = await ethers.getSigners();
    console.log("👤 Deployer:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Balance:", ethers.formatEther(balance), "HYPE");
    
    if (parseFloat(ethers.formatEther(balance)) < 1) {
      console.log("⚠️ Low balance - might need more HYPE for deployment");
    }
    
    // 1. Deploy MockERC20 tokens for testing
    console.log("\n1. 📦 Deploying Mock ERC20 Tokens...");
    
    // Mock USDC
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    console.log("   Deploying Mock USDC...");
    const mockUSDC = await MockERC20.deploy(
        "Mock USDC", 
        "USDC", 
        6 // decimals
    );
    await mockUSDC.waitForDeployment();
    const usdcAddress = await mockUSDC.getAddress();
    console.log("   ✅ Mock USDC:", usdcAddress);
    
    // Mock WETH
    console.log("   Deploying Mock WETH...");
    const mockWETH = await MockERC20.deploy(
        "Mock WETH", 
        "WETH", 
        18 // decimals
    );
    await mockWETH.waitForDeployment();
    const wethAddress = await mockWETH.getAddress();
    console.log("   ✅ Mock WETH:", wethAddress);
    
    // Mock WBTC
    console.log("   Deploying Mock WBTC...");
    const mockWBTC = await MockERC20.deploy(
        "Mock WBTC", 
        "WBTC", 
        8 // decimals
    );
    await mockWBTC.waitForDeployment();
    const wbtcAddress = await mockWBTC.getAddress();
    console.log("   ✅ Mock WBTC:", wbtcAddress);
    
    // 2. Deploy PriceFeed Mock
    console.log("\n2. 📊 Deploying Mock Price Feed...");
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const mockPriceFeed = await MockPriceFeed.deploy();
    await mockPriceFeed.waitForDeployment();
    const priceFeedAddress = await mockPriceFeed.getAddress();
    console.log("   ✅ Mock PriceFeed:", priceFeedAddress);
    
    // 3. Deploy SecurityManager first (needed for Factory)
    console.log("\n3. 🛡️ Deploying SecurityManager...");
    const SecurityManager = await ethers.getContractFactory("SecurityManager");
    const securityManager = await SecurityManager.deploy(
        priceFeedAddress // only takes price feed address
    );
    await securityManager.waitForDeployment();
    const securityAddress = await securityManager.getAddress();
    console.log("   ✅ SecurityManager:", securityAddress);
    
    // 4. Deploy IndexTokenFactory
    console.log("\n4. 🏭 Deploying IndexTokenFactory...");
    const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
    const indexTokenFactory = await IndexTokenFactory.deploy(
        priceFeedAddress // only takes price feed address
    );
    await indexTokenFactory.waitForDeployment();
    const factoryAddress = await indexTokenFactory.getAddress();
    console.log("   ✅ IndexTokenFactory:", factoryAddress);
    
    // 5. Deploy SmartIndexVault (template)
    console.log("\n5. 🏦 Deploying SmartIndexVault Template...");
    const SmartIndexVault = await ethers.getContractFactory("SmartIndexVault");
    const vaultTemplate = await SmartIndexVault.deploy(
        ethers.ZeroAddress, // template asset (zero for template)
        "HyperIndex Vault Template",
        "HIVT"
    );
    await vaultTemplate.waitForDeployment();
    const vaultAddress = await vaultTemplate.getAddress();
    console.log("   ✅ SmartIndexVault Template:", vaultAddress);
    
    // 6. Setup initial configuration and roles
    console.log("\n6. ⚙️ Initial configuration completed...");
    
    // 7. Test token minting (for deployer only)
    console.log("\n7. 🪙 Minting test tokens to deployer...");
    
    // Note: Tokens already have initial supply, but let's mint some more for testing
    await mockUSDC.mint(deployer.address, ethers.parseUnits("10000", 6)); // 10,000 USDC
    await mockWETH.mint(deployer.address, ethers.parseEther("100")); // 100 WETH  
    await mockWBTC.mint(deployer.address, ethers.parseUnits("10", 8)); // 10 WBTC
    console.log("   ✅ Minted test tokens to deployer");
    
    // 8. Verify deployments
    console.log("\n8. ✅ Verifying deployments...");
    
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
    
    // Test security manager
    const isOperator = await securityManager.hasRole(
        await securityManager.OPERATOR_ROLE(), 
        deployer.address
    );
    console.log(`   🛡️ SecurityManager 권한: ${isOperator ? '✅ Operator' : '❌ Not Operator'}`);
    
    console.log("\n🎉 Core Contract Deployment Completed!");
    console.log("\n📊 Deployment Summary:");
    console.log("   Mock USDC:", usdcAddress);
    console.log("   Mock WETH:", wethAddress);
    console.log("   Mock WBTC:", wbtcAddress);
    console.log("   Price Feed:", priceFeedAddress);
    console.log("   IndexTokenFactory:", factoryAddress);
    console.log("   SecurityManager:", securityAddress);
    console.log("   Vault Template:", vaultAddress);
      
    console.log("\n💡 Next Steps:");
    console.log("   1. Configure LayerZero messaging");
    console.log("   2. Set up 1inch API integration");
    console.log("   3. Test security systems");
    console.log("   4. Run E2E tests");
    
    // Save addresses for later use
    const deploymentInfo = {
      network: "hypervm-testnet",
      chainId: 998,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: {
        MockUSDC: usdcAddress,
        MockWETH: wethAddress,
        MockWBTC: wbtcAddress,
        MockPriceFeed: priceFeedAddress,
        IndexTokenFactory: factoryAddress,
        SecurityManager: securityAddress,
        VaultTemplate: vaultAddress
      }
    };
    
    console.log("\n💾 Saving deployment info...");
    require('fs').writeFileSync(
      'testnet-deployment.json', 
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("   ✅ Saved to testnet-deployment.json");
    
  } catch (error) {
    console.error("\n❌ Deployment failed:");
    console.error("Error:", error.message);
    
    if (error.message.includes("insufficient funds")) {
      console.log("\n💡 Need more HYPE tokens for deployment");
    }
    
    if (error.message.includes("execution reverted")) {
      console.log("\n💡 Contract execution failed - check constructor parameters");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });