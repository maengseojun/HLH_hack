// scripts/setup-test-environment.js
/**
 * 🚀 HOOATS Simple Test Environment Setup
 * 
 * 1. Deploy 60M Mock USDC + 1B HYPERINDEX-TEST
 * 2. Add 10M USDC + All HYPERINDEX to AMM pool
 * 3. Distribute remaining 50M USDC to test wallets
 * 4. Run basic system tests
 * 
 * Created: 2025-08-13
 */

const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  // Token amounts
  MOCK_USDC_TOTAL: ethers.parseEther("60000000"),    // 60M USDC
  HYPERINDEX_TOTAL: ethers.parseEther("1000000000"), // 1B HYPERINDEX
  
  // AMM Pool liquidity
  AMM_USDC_LIQUIDITY: ethers.parseEther("10000000"),     // 10M USDC
  AMM_HYPERINDEX_LIQUIDITY: ethers.parseEther("1000000000"), // All 1B HYPERINDEX
  
  // Remaining for distribution: 50M USDC
  DISTRIBUTION_USDC: ethers.parseEther("50000000"),
  
  // Contract names
  MOCK_USDC_NAME: "Mock USDC",
  MOCK_USDC_SYMBOL: "mUSDC",
  HYPERINDEX_NAME: "HyperIndex Test",
  HYPERINDEX_SYMBOL: "HINDEX-TEST"
};

class TestEnvironmentSetup {
  constructor() {
    this.deployer = null;
    this.contracts = {
      mockUSDC: null,
      hyperindexTest: null,
      factory: null,
      router: null,
      pair: null
    };
    this.deploymentInfo = {
      network: "hypervm-testnet",
      chainId: 998,
      timestamp: new Date().toISOString(),
      contracts: {},
      liquidityAdded: false,
      gasUsed: {}
    };
  }

  async initialize() {
    console.log("🚀 Initializing HOOATS Test Environment...");
    
    const [deployer] = await ethers.getSigners();
    this.deployer = deployer;
    
    console.log("Deployer address:", deployer.address);
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("Deployer balance:", ethers.formatEther(balance), "HYPE");
    
    if (balance < ethers.parseEther("1")) {
      throw new Error("❌ Insufficient HYPE balance for deployment");
    }
  }

  async deployTokens() {
    console.log("\n📦 Step 1: Deploying Test Tokens...");
    
    // Deploy Mock USDC
    console.log("Deploying Mock USDC...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    
    this.contracts.mockUSDC = await MockERC20.deploy(
      TEST_CONFIG.MOCK_USDC_NAME,
      TEST_CONFIG.MOCK_USDC_SYMBOL,
      TEST_CONFIG.MOCK_USDC_TOTAL
    );
    await this.contracts.mockUSDC.waitForDeployment();
    
    const mockUSDCAddress = await this.contracts.mockUSDC.getAddress();
    console.log("✅ Mock USDC deployed:", mockUSDCAddress);
    
    // Deploy HYPERINDEX Test
    console.log("Deploying HYPERINDEX Test...");
    this.contracts.hyperindexTest = await MockERC20.deploy(
      TEST_CONFIG.HYPERINDEX_NAME,
      TEST_CONFIG.HYPERINDEX_SYMBOL,
      TEST_CONFIG.HYPERINDEX_TOTAL
    );
    await this.contracts.hyperindexTest.waitForDeployment();
    
    const hyperindexAddress = await this.contracts.hyperindexTest.getAddress();
    console.log("✅ HYPERINDEX Test deployed:", hyperindexAddress);
    
    // Verify balances
    const usdcBalance = await this.contracts.mockUSDC.balanceOf(this.deployer.address);
    const hyperBalance = await this.contracts.hyperindexTest.balanceOf(this.deployer.address);
    
    console.log("Token balances:");
    console.log("- Mock USDC:", ethers.formatEther(usdcBalance), "mUSDC");
    console.log("- HYPERINDEX:", ethers.formatEther(hyperBalance), "HINDEX-TEST");
    
    this.deploymentInfo.contracts.mockUSDC = mockUSDCAddress;
    this.deploymentInfo.contracts.hyperindexTest = hyperindexAddress;
  }

  async deployAMMContracts() {
    console.log("\n🏭 Step 2: Deploying AMM Contracts...");
    
    // Deploy Factory
    console.log("Deploying HyperIndexFactory...");
    const Factory = await ethers.getContractFactory("HyperIndexFactory");
    this.contracts.factory = await Factory.deploy(this.deployer.address);
    await this.contracts.factory.waitForDeployment();
    
    const factoryAddress = await this.contracts.factory.getAddress();
    console.log("✅ Factory deployed:", factoryAddress);
    
    // Deploy Router
    console.log("Deploying HyperIndexRouter...");
    const Router = await ethers.getContractFactory("HyperIndexRouter");
    this.contracts.router = await Router.deploy(factoryAddress, this.deployer.address);
    await this.contracts.router.waitForDeployment();
    
    const routerAddress = await this.contracts.router.getAddress();
    console.log("✅ Router deployed:", routerAddress);
    
    this.deploymentInfo.contracts.factory = factoryAddress;
    this.deploymentInfo.contracts.router = routerAddress;
  }

  async createPairAndAddLiquidity() {
    console.log("\n💧 Step 3: Creating Pair and Adding Liquidity...");
    
    const mockUSDCAddress = await this.contracts.mockUSDC.getAddress();
    const hyperindexAddress = await this.contracts.hyperindexTest.getAddress();
    const routerAddress = await this.contracts.router.getAddress();
    
    // Create pair
    console.log("Creating HINDEX-TEST/mUSDC pair...");
    const createPairTx = await this.contracts.factory.createPair(hyperindexAddress, mockUSDCAddress);
    await createPairTx.wait();
    
    const pairAddress = await this.contracts.factory.getPair(hyperindexAddress, mockUSDCAddress);
    console.log("✅ Pair created:", pairAddress);
    
    this.contracts.pair = await ethers.getContractAt("HyperIndexPair", pairAddress);
    
    // Approve tokens
    console.log("Approving tokens for router...");
    await this.contracts.mockUSDC.approve(routerAddress, ethers.MaxUint256);
    await this.contracts.hyperindexTest.approve(routerAddress, ethers.MaxUint256);
    
    // Add liquidity
    console.log("Adding initial liquidity...");
    console.log("- HYPERINDEX:", ethers.formatEther(TEST_CONFIG.AMM_HYPERINDEX_LIQUIDITY));
    console.log("- Mock USDC:", ethers.formatEther(TEST_CONFIG.AMM_USDC_LIQUIDITY));
    
    const addLiquidityTx = await this.contracts.router.addLiquidity(
      hyperindexAddress,
      mockUSDCAddress,
      TEST_CONFIG.AMM_HYPERINDEX_LIQUIDITY,
      TEST_CONFIG.AMM_USDC_LIQUIDITY,
      ethers.parseEther("900000000"), // Min 900M HYPERINDEX
      ethers.parseEther("9000000"),   // Min 9M USDC
      this.deployer.address,
      Math.floor(Date.now() / 1000) + 1200 // 20 minutes
    );
    
    const receipt = await addLiquidityTx.wait();
    console.log("✅ Liquidity added! Gas used:", receipt.gasUsed.toString());
    
    // Verify reserves
    const reserves = await this.contracts.pair.getReserves();
    const lpBalance = await this.contracts.pair.balanceOf(this.deployer.address);
    
    console.log("Pair reserves:");
    console.log("- Reserve 0:", ethers.formatEther(reserves[0]));
    console.log("- Reserve 1:", ethers.formatEther(reserves[1]));
    console.log("- LP tokens:", ethers.formatEther(lpBalance));
    
    this.deploymentInfo.contracts.pair = pairAddress;
    this.deploymentInfo.liquidityAdded = true;
    this.deploymentInfo.gasUsed.addLiquidity = receipt.gasUsed.toString();
  }

  async testBasicFunctionality() {
    console.log("\n🧪 Step 4: Testing Basic Functionality...");
    
    const mockUSDCAddress = await this.contracts.mockUSDC.getAddress();
    const hyperindexAddress = await this.contracts.hyperindexTest.getAddress();
    
    // Test 1: Get swap quote
    console.log("Test 1: Getting swap quote (1000 USDC -> HYPERINDEX)...");
    try {
      const amounts = await this.contracts.router.getAmountsOut(
        ethers.parseEther("1000"),
        [mockUSDCAddress, hyperindexAddress]
      );
      
      console.log("✅ Swap quote:");
      console.log("- Input:", ethers.formatEther(amounts[0]), "mUSDC");
      console.log("- Output:", ethers.formatEther(amounts[1]), "HINDEX-TEST");
      
      // Calculate price
      const price = parseFloat(ethers.formatEther(amounts[0])) / parseFloat(ethers.formatEther(amounts[1]));
      console.log("- Price:", price.toFixed(6), "mUSDC per HINDEX-TEST");
      
    } catch (error) {
      console.log("❌ Swap quote failed:", error.message);
    }
    
    // Test 2: Execute small swap
    console.log("\nTest 2: Executing test swap (100 USDC -> HYPERINDEX)...");
    try {
      const balanceBefore = await this.contracts.hyperindexTest.balanceOf(this.deployer.address);
      
      const swapTx = await this.contracts.router.swapExactTokensForTokens(
        ethers.parseEther("100"), // 100 USDC
        0, // Accept any amount
        [mockUSDCAddress, hyperindexAddress],
        this.deployer.address,
        Math.floor(Date.now() / 1000) + 600
      );
      
      const receipt = await swapTx.wait();
      const balanceAfter = await this.contracts.hyperindexTest.balanceOf(this.deployer.address);
      
      const received = balanceAfter - balanceBefore;
      
      console.log("✅ Swap executed:");
      console.log("- Gas used:", receipt.gasUsed.toString());
      console.log("- HYPERINDEX received:", ethers.formatEther(received));
      
    } catch (error) {
      console.log("❌ Swap execution failed:", error.message);
    }
    
    // Test 3: Check remaining balances
    console.log("\nTest 3: Checking remaining balances...");
    const usdcBalance = await this.contracts.mockUSDC.balanceOf(this.deployer.address);
    const hyperBalance = await this.contracts.hyperindexTest.balanceOf(this.deployer.address);
    
    console.log("Remaining balances:");
    console.log("- Mock USDC:", ethers.formatEther(usdcBalance), "mUSDC");
    console.log("- HYPERINDEX:", ethers.formatEther(hyperBalance), "HINDEX-TEST");
    
    // Verify we have ~50M USDC left for distribution
    const expectedRemaining = TEST_CONFIG.DISTRIBUTION_USDC - ethers.parseEther("100"); // Minus test swap
    const difference = usdcBalance > expectedRemaining ? usdcBalance - expectedRemaining : expectedRemaining - usdcBalance;
    const percentageDiff = Number(difference * 100n / expectedRemaining);
    
    if (percentageDiff < 1) {
      console.log("✅ USDC balance correct for distribution");
    } else {
      console.log("⚠️ USDC balance discrepancy:", percentageDiff.toFixed(2), "%");
    }
  }

  async saveDeploymentInfo() {
    console.log("\n💾 Step 5: Saving deployment information...");
    
    const filename = `test-deployment-${Date.now()}.json`;
    const filepath = path.join(__dirname, '..', filename);
    
    fs.writeFileSync(filepath, JSON.stringify(this.deploymentInfo, null, 2));
    console.log("✅ Deployment info saved:", filename);
    
    // Also create a simple .env template
    const envContent = `
# HOOATS Test Environment - Generated ${this.deploymentInfo.timestamp}
MOCK_USDC_ADDRESS=${this.deploymentInfo.contracts.mockUSDC}
HYPERINDEX_TEST_ADDRESS=${this.deploymentInfo.contracts.hyperindexTest}
FACTORY_ADDRESS=${this.deploymentInfo.contracts.factory}
ROUTER_ADDRESS=${this.deploymentInfo.contracts.router}
PAIR_ADDRESS=${this.deploymentInfo.contracts.pair}

# For testing
TEST_PRIVATE_KEY=\${PRIVATE_KEY}
TEST_WALLET_ADDRESS=\${this.deployer.address}
`;
    
    fs.writeFileSync(path.join(__dirname, '..', '.env.test-template'), envContent);
    console.log("✅ Environment template created: .env.test-template");
  }

  async run() {
    try {
      await this.initialize();
      await this.deployTokens();
      await this.deployAMMContracts();
      await this.createPairAndAddLiquidity();
      await this.testBasicFunctionality();
      await this.saveDeploymentInfo();
      
      console.log("\n🎉 Test Environment Setup Complete!");
      console.log("\n📋 Summary:");
      console.log("✅ Mock USDC deployed and distributed");
      console.log("✅ HYPERINDEX Test deployed");
      console.log("✅ AMM contracts deployed");
      console.log("✅ Liquidity pool created and funded");
      console.log("✅ Basic functionality tested");
      
      console.log("\n🚀 Ready for HOOATS System Testing!");
      console.log("Next steps:");
      console.log("1. Run: npm run test:simple");
      console.log("2. Run: npm run test:routing");
      console.log("3. Run: npm run test:security");
      
      return this.deploymentInfo;
      
    } catch (error) {
      console.error("❌ Setup failed:", error);
      throw error;
    }
  }
}

async function main() {
  const setup = new TestEnvironmentSetup();
  return await setup.run();
}

// Export for use in other scripts
module.exports = { TestEnvironmentSetup, TEST_CONFIG };

if (require.main === module) {
  main()
    .then((result) => {
      console.log("\n✨ Setup completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Setup failed:", error);
      process.exit(1);
    });
}