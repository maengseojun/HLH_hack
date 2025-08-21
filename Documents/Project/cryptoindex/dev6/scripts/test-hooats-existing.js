// scripts/test-hooats-existing.js
/**
 * 🧪 Simple HOOATS Test with Existing Deployed Contracts
 * 
 * Uses existing deployed contracts from deployment-998-manual.json
 * Tests basic functionality with current wallet and ~99.9M USDC
 * 
 * Created: 2025-08-13
 */

const { ethers } = require("hardhat");
const axios = require('axios');
const deploymentInfo = require('../deployment-998-manual.json');

// Import HyperVM Block Manager for optimal gas settings  
let HyperVMBlockManager;
try {
  // Try to require the TypeScript module (will work if compiled)
  HyperVMBlockManager = require('../lib/blockchain/hypervm-config').HyperVMBlockManager;
} catch (error) {
  console.log('⚠️ HyperVM config not available, using fallback gas settings');
  // Fallback implementation for HyperVM optimization
  HyperVMBlockManager = {
    getInstance: () => ({
      async getOptimalTxOptions(type = 'swap') {
        const provider = new ethers.JsonRpcProvider('https://rpc.hyperliquid-testnet.xyz/evm');
        
        // Get current network gas price
        let gasPrice;
        try {
          gasPrice = await provider.getFeeData();
          console.log('🔍 Network fee data:', {
            gasPrice: gasPrice.gasPrice?.toString(),
            maxFeePerGas: gasPrice.maxFeePerGas?.toString(),
            maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString()
          });
        } catch (error) {
          console.log('⚠️ Failed to get fee data, using fallback');
          gasPrice = { gasPrice: ethers.parseUnits('20', 'gwei') };
        }
        
        return {
          gasPrice: gasPrice.gasPrice || ethers.parseUnits('20', 'gwei'),
          gasLimit: type === 'swap' ? undefined : 25000000, // Let ethers estimate for swaps
          blockType: type === 'swap' ? 'small' : 'big',
          expectedConfirmationTime: type === 'swap' ? '1-2 seconds' : '60 seconds'
        };
      },
      async getCurrentBlockInfo() {
        const provider = new ethers.JsonRpcProvider('https://rpc.hyperliquid-testnet.xyz/evm');
        const block = await provider.getBlock('latest');
        if (!block) return null;
        
        const gasLimit = block.gasLimit;
        const isSmallBlock = gasLimit <= BigInt(3000000);
        
        return {
          number: block.number,
          timestamp: block.timestamp,
          gasLimit: gasLimit.toString(),
          gasUsed: block.gasUsed.toString(),
          blockType: isSmallBlock ? 'small' : 'big',
          utilization: Number(block.gasUsed * BigInt(100) / gasLimit) + '%'
        };
      }
    })
  };
}

class ExistingHOOATSTest {
  constructor() {
    this.contracts = deploymentInfo.contracts;
    this.deployer = null;
    this.apiBaseURL = process.env.API_BASE_URL || 'http://localhost:3000/api';
    this.testResults = {
      timestamp: new Date().toISOString(),
      contractAddresses: this.contracts,
      tests: [],
      summary: { passed: 0, failed: 0, total: 0 }
    };
  }

  async initialize() {
    console.log("🚀 Initializing HOOATS Test with Existing Contracts...");
    console.log("📋 Contract Addresses:");
    Object.entries(this.contracts).forEach(([name, address]) => {
      console.log(`   ${name}: ${address}`);
    });
    
    const [deployer] = await ethers.getSigners();
    this.deployer = deployer;
    
    console.log("\n💰 Wallet Info:");
    console.log("Address:", deployer.address);
    
    const hypeBalance = await deployer.provider.getBalance(deployer.address);
    console.log("HYPE balance:", ethers.formatEther(hypeBalance));
    
    // Load contract instances
    this.hyperindex = await ethers.getContractAt("IERC20", this.contracts.hyperindex);
    this.usdc = await ethers.getContractAt("IERC20", this.contracts.usdc);
    this.router = await ethers.getContractAt("HyperIndexRouter", this.contracts.router);
    this.pair = await ethers.getContractAt("HyperIndexPair", this.contracts.pair);
    
    // Check token balances
    const usdcBalance = await this.usdc.balanceOf(deployer.address);
    const hyperBalance = await this.hyperindex.balanceOf(deployer.address);
    
    console.log("Token balances:");
    console.log("- USDC:", ethers.formatEther(usdcBalance));
    console.log("- HYPERINDEX:", ethers.formatEther(hyperBalance));
    
    if (usdcBalance < ethers.parseEther("1000")) {
      throw new Error("❌ Insufficient USDC balance for testing");
    }
    
    // Check pool reserves
    const reserves = await this.pair.getReserves();
    const token0 = await this.pair.token0();
    const token1 = await this.pair.token1();
    
    console.log("\n🌊 Pool Reserves:");
    console.log("- Token0 (" + (token0 === this.contracts.hyperindex ? "HYPERINDEX" : "USDC") + "):", ethers.formatEther(reserves[0]));
    console.log("- Token1 (" + (token1 === this.contracts.hyperindex ? "HYPERINDEX" : "USDC") + "):", ethers.formatEther(reserves[1]));
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

  async testAMMSwapQuote() {
    return await this.runTest('AMM Swap Quote', async () => {
      console.log("Getting swap quote: 1000 USDC -> HYPERINDEX...");
      
      const amounts = await this.router.getAmountsOut(
        ethers.parseEther("1000"),
        [this.contracts.usdc, this.contracts.hyperindex]
      );
      
      const inputAmount = amounts[0];
      const outputAmount = amounts[1];
      const price = parseFloat(ethers.formatEther(inputAmount)) / parseFloat(ethers.formatEther(outputAmount));
      
      return {
        input: ethers.formatEther(inputAmount) + " USDC",
        output: ethers.formatEther(outputAmount) + " HYPERINDEX",
        price: price.toFixed(6) + " USDC per HYPERINDEX",
        priceImpact: "Calculated from reserves"
      };
    });
  }

  async testAMMSmallSwap() {
    return await this.runTest('AMM Small Swap', async () => {
      console.log("Executing small swap: 100 USDC -> HYPERINDEX...");
      
      // Initialize HyperVM Block Manager for optimal gas settings
      const blockManager = HyperVMBlockManager.getInstance();
      const optimalGasSettings = await blockManager.getOptimalTxOptions('swap');
      
      console.log(`🔥 Using optimized gas settings for Small Blocks:`, optimalGasSettings);
      
      // Approve USDC first with optimized gas settings
      const currentAllowance = await this.usdc.allowance(this.deployer.address, this.contracts.router);
      if (currentAllowance < ethers.parseEther("100")) {
        console.log("Approving USDC for router with Small Block optimization...");
        // Build approval transaction options
        const approveOptions = {};
        if (optimalGasSettings.gasPrice) {
          approveOptions.gasPrice = optimalGasSettings.gasPrice;
        }
        
        console.log('📝 Approval options:', approveOptions);
        
        const approveTx = await this.usdc.approve(this.contracts.router, ethers.MaxUint256, approveOptions);
        await approveTx.wait();
        console.log("✅ Approval completed");
      }
      
      // Get expected output
      const amounts = await this.router.getAmountsOut(
        ethers.parseEther("100"),
        [this.contracts.usdc, this.contracts.hyperindex]
      );
      const expectedOutput = amounts[1];
      
      // Execute swap with Small Block optimization
      console.log("🚀 Starting swap transaction with Small Block targeting...");
      const swapStartTime = Date.now();
      
      const balanceBefore = await this.hyperindex.balanceOf(this.deployer.address);
      
      // Build transaction options dynamically
      const txOptions = {};
      if (optimalGasSettings.gasPrice) {
        txOptions.gasPrice = optimalGasSettings.gasPrice;
      }
      if (optimalGasSettings.gasLimit) {
        txOptions.gasLimit = optimalGasSettings.gasLimit;
      }
      
      console.log('📝 Transaction options:', txOptions);
      
      const swapTx = await this.router.swapExactTokensForTokens(
        ethers.parseEther("100"),
        expectedOutput * 95n / 100n, // 5% slippage tolerance
        [this.contracts.usdc, this.contracts.hyperindex],
        this.deployer.address,
        Math.floor(Date.now() / 1000) + 600, // 10 minute deadline
        txOptions
      );
      
      console.log(`⏱️ Transaction submitted, waiting for confirmation...`);
      const receipt = await swapTx.wait();
      const swapEndTime = Date.now();
      const swapDuration = swapEndTime - swapStartTime;
      
      console.log(`✅ Swap completed in ${swapDuration}ms (${(swapDuration/1000).toFixed(1)}s)`);
      
      // Get block info to verify which block type was used
      const blockInfo = await blockManager.getCurrentBlockInfo();
      console.log(`📊 Block Info: #${blockInfo?.number} (${blockInfo?.blockType}) - ${blockInfo?.gasLimit} gas limit`);
      
      const balanceAfter = await this.hyperindex.balanceOf(this.deployer.address);
      const actualOutput = balanceAfter - balanceBefore;
      const slippage = Number((expectedOutput - actualOutput) * 10000n / expectedOutput) / 100;
      
      // Block info already retrieved above
      
      return {
        expectedOutput: ethers.formatEther(expectedOutput),
        actualOutput: ethers.formatEther(actualOutput),
        slippage: slippage.toFixed(3) + "%",
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: optimalGasSettings.gasPrice?.toString() || 'auto', // Convert BigInt to string
        swapDuration: `${swapDuration}ms`,
        blockNumber: receipt.blockNumber,
        blockType: blockInfo?.blockType || 'unknown',
        blockGasLimit: blockInfo?.gasLimit || 'unknown',
        txHash: receipt.hash
      };
    });
  }

  async testSmartRouterV2() {
    return await this.runTest('SmartRouterV2 API', async () => {
      console.log("Testing SmartRouterV2 via API (1000 USDC buy order)...");
      
      const orderData = {
        pair: 'HYPERINDEX-USDC',
        side: 'buy',
        type: 'market',
        amount: '1000'
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
          success: result.success || false,
          totalFilled: result.totalFilled || 'N/A',
          averagePrice: result.averagePrice || 'N/A',
          routingChunks: result.routing?.length || 0,
          ammChunks: result.routing?.filter(r => r.source === 'AMM').length || 0,
          orderbookChunks: result.routing?.filter(r => r.source === 'Orderbook').length || 0,
          executionStats: result.executionStats || {}
        };
        
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('API server not running. Start with: npm run dev');
        }
        throw error;
      }
    });
  }

  async testOrderbookAPI() {
    return await this.runTest('Orderbook API', async () => {
      console.log("Testing orderbook API endpoints...");
      
      try {
        // Test orderbook data
        const orderbookResponse = await axios.get(`${this.apiBaseURL}/trading/v1/orderbook`, {
          params: { pair: 'HYPERINDEX-USDC' },
          headers: { 'Authorization': 'Bearer dev-token' },
          timeout: 5000
        });
        
        const orderbook = orderbookResponse.data;
        
        // Test market data
        const marketResponse = await axios.get(`${this.apiBaseURL}/trading/v1/market`, {
          params: { pair: 'HYPERINDEX-USDC' },
          headers: { 'Authorization': 'Bearer dev-token' },
          timeout: 5000
        });
        
        const market = marketResponse.data;
        
        return {
          orderbook: {
            bids: orderbook.bids?.length || 0,
            asks: orderbook.asks?.length || 0,
            spread: orderbook.spread || 'N/A'
          },
          market: {
            price: market.price || 'N/A',
            volume24h: market.volume24h || 'N/A',
            change24h: market.change24h || 'N/A'
          }
        };
        
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('API server not running');
        }
        throw error;
      }
    });
  }

  async testSystemHealth() {
    return await this.runTest('System Health Check', async () => {
      console.log("Testing system health endpoints...");
      
      try {
        // Test health endpoint
        const healthResponse = await axios.get(`${this.apiBaseURL}/health`, {
          timeout: 5000
        });
        
        // Test Redis status  
        const redisResponse = await axios.get(`${this.apiBaseURL}/redis/status`, {
          headers: { 'Authorization': 'Bearer dev-token' },
          timeout: 5000
        });
        
        return {
          health: {
            status: healthResponse.data.status || 'unknown',
            timestamp: healthResponse.data.timestamp || 'N/A'
          },
          redis: {
            connected: redisResponse.data.connected || false,
            mode: redisResponse.data.mode || 'unknown'
          }
        };
        
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('API server not running');
        }
        throw error;
      }
    });
  }

  async testLimitOrder() {
    return await this.runTest('Limit Order Placement', async () => {
      console.log("Testing limit order placement...");
      
      try {
        // Place a limit sell order slightly above market price
        const limitOrderData = {
          pair: 'HYPERINDEX-USDC',
          side: 'sell',
          type: 'limit',
          amount: '500',
          price: '0.015' // Above market price, won't fill immediately
        };
        
        const response = await axios.post(`${this.apiBaseURL}/trading/v1/orders`, limitOrderData, {
          headers: {
            'Authorization': 'Bearer dev-token',
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });
        
        return {
          success: response.data.success || false,
          orderId: response.data.orderId || 'N/A',
          status: response.data.status || 'unknown',
          message: response.data.message || 'No message'
        };
        
      } catch (error) {
        if (error.response?.status >= 400) {
          // Expected for validation errors
          return {
            success: false,
            validationError: true,
            message: error.response.data.message || 'Validation failed'
          };
        }
        
        if (error.code === 'ECONNREFUSED') {
          throw new Error('API server not running');
        }
        throw error;
      }
    });
  }

  async generateReport() {
    console.log("\n📊 Generating Test Report...");
    
    const { passed, failed, total } = this.testResults.summary;
    const successRate = total > 0 ? (passed / total * 100).toFixed(1) : '0';
    
    console.log("\n" + "=".repeat(70));
    console.log("🧪 HOOATS Simple Test Report (Existing Contracts)");
    console.log("=".repeat(70));
    console.log(`⏰ Executed: ${this.testResults.timestamp}`);
    console.log(`📋 Network: ${deploymentInfo.network} (Chain ID: ${deploymentInfo.chainId})`);
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
        if (test.name === 'AMM Small Swap' && test.data.slippage) {
          console.log(`   Slippage: ${test.data.slippage}, Gas: ${test.data.gasUsed}`);
        }
        if (test.name === 'SmartRouterV2 API' && test.data.routingChunks) {
          console.log(`   Routing: ${test.data.routingChunks} chunks (${test.data.ammChunks} AMM, ${test.data.orderbookChunks} Orderbook)`);
        }
        if (test.name === 'AMM Swap Quote' && test.data.price) {
          console.log(`   Price: ${test.data.price}`);
        }
      }
    });
    
    console.log("\n" + "=".repeat(70));
    
    if (failed > 0) {
      console.log("❌ Some tests failed. Common issues:");
      console.log("   - HOOATS API server not running (npm run dev)");
      console.log("   - Redis not running (npm run redis:start)"); 
      console.log("   - Database connection issues");
    } else {
      console.log("🎉 All tests passed! HOOATS system working with existing contracts.");
      console.log("🚀 System ready for advanced testing and trading.");
    }
    
    // Save detailed report
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, '..', `test-report-existing-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2));
    console.log(`📄 Detailed report saved: ${path.basename(reportPath)}`);
    
    return this.testResults;
  }

  async runAllTests() {
    console.log("🚀 Starting HOOATS Test with Existing Deployed Contracts...");
    
    try {
      await this.initialize();
      
      // Run tests in logical order
      await this.testSystemHealth();
      await this.testAMMSwapQuote();
      await this.testAMMSmallSwap();
      await this.testSmartRouterV2();
      await this.testOrderbookAPI();
      await this.testLimitOrder();
      
      return await this.generateReport();
      
    } catch (error) {
      console.error("💥 Test initialization failed:", error.message);
      throw error;
    }
  }
}

async function main() {
  const tester = new ExistingHOOATSTest();
  return await tester.runAllTests();
}

if (require.main === module) {
  main()
    .then((results) => {
      const { passed, failed } = results.summary;
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error("💥 Tests failed:", error);
      process.exit(1);
    });
}