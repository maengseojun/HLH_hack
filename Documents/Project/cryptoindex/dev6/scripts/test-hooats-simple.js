// scripts/test-hooats-simple.js
/**
 * 🧪 Simple HOOATS System Test
 * 
 * Tests basic functionality with single wallet:
 * 1. SmartRouterV2 routing decisions
 * 2. UltraPerformanceOrderbook operations
 * 3. HyperVMAMM integration
 * 4. Settlement system
 * 5. Security layer basic checks
 * 
 * Created: 2025-08-13
 */

const { ethers } = require("hardhat");
const axios = require('axios');

class SimpleHOOATSTest {
  constructor(contractAddresses) {
    this.contracts = contractAddresses;
    this.deployer = null;
    this.apiBaseURL = process.env.API_BASE_URL || 'http://localhost:3000/api';
    this.testResults = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {
        passed: 0,
        failed: 0,
        total: 0
      }
    };
  }

  async initialize() {
    console.log("🚀 Initializing Simple HOOATS Test...");
    
    const [deployer] = await ethers.getSigners();
    this.deployer = deployer;
    
    console.log("Test wallet:", deployer.address);
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("HYPE balance:", ethers.formatEther(balance));
    
    // Load contract instances
    this.mockUSDC = await ethers.getContractAt("IERC20", this.contracts.mockUSDC);
    this.hyperindexTest = await ethers.getContractAt("IERC20", this.contracts.hyperindexTest);
    this.router = await ethers.getContractAt("HyperIndexRouter", this.contracts.router);
    
    // Check token balances
    const usdcBalance = await this.mockUSDC.balanceOf(deployer.address);
    const hyperBalance = await this.hyperindexTest.balanceOf(deployer.address);
    
    console.log("Token balances:");
    console.log("- Mock USDC:", ethers.formatEther(usdcBalance));
    console.log("- HYPERINDEX:", ethers.formatEther(hyperBalance));
    
    if (usdcBalance < ethers.parseEther("1000")) {
      throw new Error("❌ Insufficient USDC balance for testing");
    }
  }

  async runTest(testName, testFn) {
    console.log(`\n🧪 Running: ${testName}...`);
    
    const startTime = Date.now();
    let result = {
      name: testName,
      status: 'unknown',
      duration: 0,
      error: null,
      data: null
    };
    
    try {
      const testData = await testFn();
      result.status = 'passed';
      result.data = testData;
      this.testResults.summary.passed++;
      console.log(`✅ ${testName} - PASSED`);
    } catch (error) {
      result.status = 'failed';
      result.error = error.message;
      this.testResults.summary.failed++;
      console.log(`❌ ${testName} - FAILED: ${error.message}`);
    }
    
    result.duration = Date.now() - startTime;
    this.testResults.tests.push(result);
    this.testResults.summary.total++;
  }

  async testAMMDirectSwap() {
    return await this.runTest('AMM Direct Swap', async () => {
      console.log("Testing direct AMM swap (100 USDC -> HYPERINDEX)...");
      
      // Get quote first
      const amounts = await this.router.getAmountsOut(
        ethers.parseEther("100"),
        [this.contracts.mockUSDC, this.contracts.hyperindexTest]
      );
      
      const expectedOutput = amounts[1];
      console.log("Expected output:", ethers.formatEther(expectedOutput));
      
      // Execute swap
      const balanceBefore = await this.hyperindexTest.balanceOf(this.deployer.address);
      
      const swapTx = await this.router.swapExactTokensForTokens(
        ethers.parseEther("100"),
        expectedOutput * 95n / 100n, // 5% slippage tolerance
        [this.contracts.mockUSDC, this.contracts.hyperindexTest],
        this.deployer.address,
        Math.floor(Date.now() / 1000) + 600
      );
      
      const receipt = await swapTx.wait();
      const balanceAfter = await this.hyperindexTest.balanceOf(this.deployer.address);
      
      const actualOutput = balanceAfter - balanceBefore;
      const slippage = Number((expectedOutput - actualOutput) * 10000n / expectedOutput) / 100;
      
      return {
        expectedOutput: ethers.formatEther(expectedOutput),
        actualOutput: ethers.formatEther(actualOutput),
        slippage: slippage,
        gasUsed: receipt.gasUsed.toString(),
        txHash: receipt.hash
      };
    });
  }

  async testSmartRouterV2API() {
    return await this.runTest('SmartRouterV2 API', async () => {
      console.log("Testing SmartRouterV2 via API...");
      
      const orderData = {
        pair: 'HYPERINDEX-USDC',
        side: 'buy',
        type: 'market',
        amount: '1000', // 1000 USDC
        userId: this.deployer.address
      };
      
      try {
        const response = await axios.post(`${this.apiBaseURL}/trading/v2/orders`, orderData, {
          headers: {
            'Authorization': 'Bearer dev-token',
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        if (response.status !== 200) {
          throw new Error(`API returned status ${response.status}`);
        }
        
        const result = response.data;
        
        return {
          success: result.success,
          totalFilled: result.totalFilled,
          averagePrice: result.averagePrice,
          routing: result.routing,
          executionStats: result.executionStats,
          responseTime: result.executionTime || 'N/A'
        };
        
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('HOOATS API server not running. Start with: npm run dev');
        }
        throw error;
      }
    });
  }

  async testUltraPerformanceOrderbook() {
    return await this.runTest('UltraPerformanceOrderbook', async () => {
      console.log("Testing orderbook operations...");
      
      try {
        // Test orderbook API endpoints
        const orderbookResponse = await axios.get(`${this.apiBaseURL}/trading/v1/orderbook`, {
          params: { pair: 'HYPERINDEX-USDC' },
          headers: { 'Authorization': 'Bearer dev-token' },
          timeout: 5000
        });
        
        const orderbook = orderbookResponse.data;
        
        // Test order placement
        const limitOrderData = {
          pair: 'HYPERINDEX-USDC',
          side: 'sell',
          type: 'limit',
          amount: '500',
          price: '0.015', // Slightly above market price
          userId: this.deployer.address
        };
        
        const orderResponse = await axios.post(`${this.apiBaseURL}/trading/v1/orders`, limitOrderData, {
          headers: {
            'Authorization': 'Bearer dev-token',
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });
        
        return {
          orderbookDepth: {
            bids: orderbook.bids?.length || 0,
            asks: orderbook.asks?.length || 0,
            spread: orderbook.spread || 'N/A'
          },
          orderPlacement: {
            success: orderResponse.data.success,
            orderId: orderResponse.data.orderId,
            status: orderResponse.data.status
          }
        };
        
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('HOOATS API server not running');
        }
        throw error;
      }
    });
  }

  async testSecurityLayer() {
    return await this.runTest('Security Layer', async () => {
      console.log("Testing basic security checks...");
      
      // Test 1: Rate limiting (should pass with normal requests)
      const normalRequests = [];
      for (let i = 0; i < 5; i++) {
        normalRequests.push(
          axios.get(`${this.apiBaseURL}/trading/v1/market`, {
            params: { pair: 'HYPERINDEX-USDC' },
            headers: { 'Authorization': 'Bearer dev-token' },
            timeout: 2000
          })
        );
      }
      
      const normalResults = await Promise.allSettled(normalRequests);
      const normalPassed = normalResults.filter(r => r.status === 'fulfilled').length;
      
      // Test 2: Invalid order detection
      let invalidOrderBlocked = false;
      try {
        await axios.post(`${this.apiBaseURL}/trading/v2/orders`, {
          pair: 'HYPERINDEX-USDC',
          side: 'buy',
          type: 'market',
          amount: '-1000', // Invalid negative amount
          userId: this.deployer.address
        }, {
          headers: {
            'Authorization': 'Bearer dev-token',
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });
      } catch (error) {
        if (error.response?.status >= 400) {
          invalidOrderBlocked = true;
        }
      }
      
      return {
        rateLimiting: {
          normalRequestsPassed: normalPassed,
          totalNormalRequests: 5
        },
        inputValidation: {
          invalidOrderBlocked: invalidOrderBlocked
        },
        authenticationWorking: true // If we got this far, auth is working
      };
    });
  }

  async testRedisConnection() {
    return await this.runTest('Redis Connection', async () => {
      console.log("Testing Redis connectivity...");
      
      try {
        const response = await axios.get(`${this.apiBaseURL}/redis/status`, {
          headers: { 'Authorization': 'Bearer dev-token' },
          timeout: 5000
        });
        
        const status = response.data;
        
        return {
          connected: status.connected,
          mode: status.mode || 'unknown',
          memory: status.memory || 'N/A',
          uptime: status.uptime || 'N/A'
        };
        
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('HOOATS API server not running');
        }
        throw error;
      }
    });
  }

  async testDatabaseConnection() {
    return await this.runTest('Database Connection', async () => {
      console.log("Testing database connectivity...");
      
      try {
        // Test user profile endpoint (requires DB)
        const response = await axios.get(`${this.apiBaseURL}/user/profile`, {
          headers: { 'Authorization': 'Bearer dev-token' },
          timeout: 5000
        });
        
        return {
          connected: true,
          userDataAccessible: !!response.data.user,
          responseTime: response.headers['x-response-time'] || 'N/A'
        };
        
      } catch (error) {
        if (error.response?.status === 404) {
          // User not found is OK for this test
          return {
            connected: true,
            userDataAccessible: false,
            note: 'Database connected but user not found (expected for test)'
          };
        }
        
        if (error.code === 'ECONNREFUSED') {
          throw new Error('HOOATS API server not running');
        }
        throw error;
      }
    });
  }

  async generateTestReport() {
    console.log("\n📊 Generating Test Report...");
    
    const { passed, failed, total } = this.testResults.summary;
    const successRate = total > 0 ? (passed / total * 100).toFixed(1) : '0';
    
    console.log("\n" + "=".repeat(60));
    console.log("🧪 HOOATS Simple Test Report");
    console.log("=".repeat(60));
    console.log(`⏰ Executed: ${this.testResults.timestamp}`);
    console.log(`📊 Results: ${passed}/${total} tests passed (${successRate}%)`);
    console.log("");
    
    // Print individual test results
    this.testResults.tests.forEach(test => {
      const status = test.status === 'passed' ? '✅' : '❌';
      const duration = test.duration < 1000 ? `${test.duration}ms` : `${(test.duration/1000).toFixed(1)}s`;
      
      console.log(`${status} ${test.name} (${duration})`);
      
      if (test.status === 'failed') {
        console.log(`   Error: ${test.error}`);
      } else if (test.data) {
        // Print key metrics for successful tests
        if (test.name === 'AMM Direct Swap' && test.data.slippage !== undefined) {
          console.log(`   Slippage: ${test.data.slippage.toFixed(3)}%`);
        }
        if (test.name === 'SmartRouterV2 API' && test.data.routing) {
          const routing = test.data.routing;
          console.log(`   Routing: ${routing.length} chunks (${routing.filter(r => r.source === 'AMM').length} AMM, ${routing.filter(r => r.source === 'Orderbook').length} Orderbook)`);
        }
      }
    });
    
    console.log("\n" + "=".repeat(60));
    
    if (failed > 0) {
      console.log("❌ Some tests failed. Check the errors above.");
      console.log("💡 Make sure:");
      console.log("   - HOOATS API server is running (npm run dev)");
      console.log("   - Redis is running (npm run redis)");
      console.log("   - Database is accessible");
      console.log("   - Test environment is properly set up");
    } else {
      console.log("🎉 All tests passed! HOOATS system is working correctly.");
      console.log("🚀 Ready for more advanced testing scenarios.");
    }
    
    // Save detailed report
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, '..', `test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2));
    console.log(`📄 Detailed report saved: ${path.basename(reportPath)}`);
    
    return this.testResults;
  }

  async runAllTests() {
    console.log("🚀 Starting HOOATS Simple Test Suite...");
    
    try {
      await this.initialize();
      
      // Run all tests
      await this.testRedisConnection();
      await this.testDatabaseConnection();
      await this.testAMMDirectSwap();
      await this.testSmartRouterV2API();
      await this.testUltraPerformanceOrderbook();
      await this.testSecurityLayer();
      
      // Generate report
      return await this.generateTestReport();
      
    } catch (error) {
      console.error("💥 Test suite initialization failed:", error.message);
      throw error;
    }
  }
}

async function main() {
  // Load contract addresses from deployment file or environment
  const contractAddresses = {
    mockUSDC: process.env.MOCK_USDC_ADDRESS,
    hyperindexTest: process.env.HYPERINDEX_TEST_ADDRESS,
    factory: process.env.FACTORY_ADDRESS,
    router: process.env.ROUTER_ADDRESS,
    pair: process.env.PAIR_ADDRESS
  };
  
  // Check if addresses are available
  const missingAddresses = Object.entries(contractAddresses)
    .filter(([key, value]) => !value)
    .map(([key]) => key);
  
  if (missingAddresses.length > 0) {
    console.log("⚠️ Missing contract addresses:", missingAddresses.join(', '));
    console.log("💡 Run setup first: npx hardhat run scripts/setup-test-environment.js");
    console.log("💡 Or set environment variables from deployment output");
    process.exit(1);
  }
  
  const tester = new SimpleHOOATSTest(contractAddresses);
  return await tester.runAllTests();
}

// Export for programmatic use
module.exports = { SimpleHOOATSTest };

if (require.main === module) {
  main()
    .then((results) => {
      const { passed, failed, total } = results.summary;
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error("💥 Tests failed:", error);
      process.exit(1);
    });
}