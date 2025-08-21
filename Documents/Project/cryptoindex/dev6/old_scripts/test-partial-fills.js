// scripts/test-partial-fills.js
// Test script for Partial Fill precision handling

/**
 * Test Partial Fill Flow:
 * 1. 고급 주문 생성 (limit order)
 * 2. 여러 번의 부분체결 실행
 * 3. Precision 계산 정확성 검증
 * 4. 최종 상태 확인
 */

const BASE_URL = 'http://localhost:3000/api/trading/v1';

class PartialFillTester {
  constructor() {
    this.baseUrl = BASE_URL;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async makeRequest(endpoint, method = 'GET', body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      console.log(`📡 ${method} ${endpoint}`);
      const response = await fetch(url, options);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${data.error?.message || 'Request failed'}`);
      }

      return data;
    } catch (error) {
      console.error(`❌ Request failed: ${error.message}`);
      throw error;
    }
  }

  async testStep1_CreateAdvancedOrder() {
    console.log('\n🔄 Step 1: Creating Advanced Limit Order');
    console.log('='.repeat(60));

    const orderRequest = {
      userId: 'test_user_123',
      tokenAddress: '0x1234567890123456789012345678901234567890',
      type: 'limit',
      side: 'buy',
      amount: '1000.0',
      price: '2.50',
      timeInForce: 'GTC',
      clientOrderId: `test_${Date.now()}`
    };

    try {
      console.log(`📝 Creating limit order:`);
      console.log(`   Type: ${orderRequest.type}`);
      console.log(`   Side: ${orderRequest.side}`);
      console.log(`   Amount: ${orderRequest.amount}`);
      console.log(`   Price: ${orderRequest.price}`);

      const result = await this.makeRequest('/orders/advanced', 'POST', orderRequest);

      if (result.success) {
        console.log(`✅ Order created successfully:`);
        console.log(`   Order ID: ${result.data.orderId}`);
        console.log(`   Client Order ID: ${result.data.clientOrderId}`);
        console.log(`   Status: ${result.data.status}`);

        return {
          orderId: result.data.orderId,
          clientOrderId: result.data.clientOrderId,
          originalAmount: orderRequest.amount,
          price: orderRequest.price
        };
      } else {
        throw new Error(`Order creation failed: ${result.error?.message}`);
      }

    } catch (error) {
      console.error(`❌ Order creation failed: ${error.message}`);
      throw error;
    }
  }

  async testStep2_ExecutePartialFills(orderInfo) {
    console.log('\n🔄 Step 2: Executing Multiple Partial Fills');
    console.log('='.repeat(60));

    const partialFills = [
      { fillAmount: '150.0', executionPrice: '2.48', isMarketMaker: true },
      { fillAmount: '250.5', executionPrice: '2.49', isMarketMaker: false },
      { fillAmount: '100.25', executionPrice: '2.50', isMarketMaker: true },
      { fillAmount: '300.1', executionPrice: '2.51', isMarketMaker: false },
      { fillAmount: '199.15', executionPrice: '2.52', isMarketMaker: false }
    ];

    const fillResults = [];
    let cumulativeFilled = 0;

    for (let i = 0; i < partialFills.length; i++) {
      const fill = partialFills[i];
      
      console.log(`\n📊 Executing fill ${i + 1}/${partialFills.length}:`);
      console.log(`   Fill Amount: ${fill.fillAmount}`);
      console.log(`   Execution Price: ${fill.executionPrice}`);
      console.log(`   Market Maker: ${fill.isMarketMaker}`);

      try {
        const fillRequest = {
          orderId: orderInfo.orderId,
          fillAmount: fill.fillAmount,
          executionPrice: fill.executionPrice,
          isMarketMaker: fill.isMarketMaker
        };

        const result = await this.makeRequest('/orders/partial-fill', 'POST', fillRequest);

        if (result.success) {
          const fillData = result.data.fillExecution;
          cumulativeFilled += parseFloat(fill.fillAmount);

          console.log(`   ✅ Fill executed successfully:`);
          console.log(`      Fill ID: ${fillData.fillId}`);
          console.log(`      Remaining: ${fillData.remainingAmount}`);
          console.log(`      Fill %: ${fillData.fillPercentage.toFixed(4)}%`);
          console.log(`      Fees: ${fillData.fees.total}`);
          console.log(`      Cumulative Filled: ${cumulativeFilled}`);

          fillResults.push({
            fillId: fillData.fillId,
            fillAmount: fill.fillAmount,
            executionPrice: fill.executionPrice,
            remainingAmount: fillData.remainingAmount,
            fillPercentage: fillData.fillPercentage,
            fees: fillData.fees,
            cumulativeFilled
          });

          // Verify precision
          const expectedRemaining = parseFloat(orderInfo.originalAmount) - cumulativeFilled;
          const actualRemaining = parseFloat(fillData.remainingAmount);
          const precisionDiff = Math.abs(expectedRemaining - actualRemaining);

          if (precisionDiff > 0.000001) { // 1e-6 tolerance
            console.warn(`   ⚠️ Precision issue detected:`);
            console.warn(`      Expected remaining: ${expectedRemaining}`);
            console.warn(`      Actual remaining: ${actualRemaining}`);
            console.warn(`      Difference: ${precisionDiff}`);
          } else {
            console.log(`   ✅ Precision check passed`);
          }

        } else {
          console.error(`   ❌ Fill failed: ${result.error?.message}`);
          break;
        }

        // Wait between fills
        await this.sleep(1000);

      } catch (error) {
        console.error(`   ❌ Fill ${i + 1} failed: ${error.message}`);
        break;
      }
    }

    console.log(`\n📊 Step 2 Summary:`);
    console.log(`   Total fills executed: ${fillResults.length}/${partialFills.length}`);
    console.log(`   Total filled amount: ${cumulativeFilled}`);
    console.log(`   Original amount: ${orderInfo.originalAmount}`);
    console.log(`   Remaining: ${parseFloat(orderInfo.originalAmount) - cumulativeFilled}`);

    return fillResults;
  }

  async testStep3_VerifyFillSummary(orderInfo) {
    console.log('\n🔄 Step 3: Verifying Fill Summary');
    console.log('='.repeat(60));

    try {
      const result = await this.makeRequest(`/orders/partial-fill?orderId=${orderInfo.orderId}`);

      if (result.success) {
        const { summary, fills, analytics } = result.data;

        console.log(`📊 Fill Summary:`);
        console.log(`   Order ID: ${summary.orderId}`);
        console.log(`   Total Filled: ${summary.totalFilled}`);
        console.log(`   Total Remaining: ${summary.totalRemaining}`);
        console.log(`   Average Price: ${summary.averagePrice}`);
        console.log(`   Fill Percentage: ${summary.fillPercentage.toFixed(4)}%`);
        console.log(`   Execution Count: ${summary.executionCount}`);
        console.log(`   Total Fees: ${summary.totalFees}`);
        console.log(`   Status: ${summary.status}`);

        console.log(`\n📈 Analytics:`);
        console.log(`   Total Executions: ${analytics.totalExecutions}`);
        console.log(`   Average Fill Size: ${analytics.averageFillSize}`);
        if (analytics.priceRange) {
          console.log(`   Price Range: ${analytics.priceRange.lowest} - ${analytics.priceRange.highest}`);
        }
        console.log(`   Fee Breakdown:`);
        console.log(`     Maker Fees: ${analytics.feeBreakdown.makerFees}`);
        console.log(`     Taker Fees: ${analytics.feeBreakdown.takerFees}`);
        console.log(`     Total Fees: ${analytics.feeBreakdown.totalFees}`);

        console.log(`\n🔍 Individual Fills:`);
        fills.forEach((fill, index) => {
          console.log(`   Fill ${index + 1}:`);
          console.log(`     Amount: ${fill.fillAmount} @ ${fill.executionPrice}`);
          console.log(`     Fee: ${fill.fees.total} (${fill.isMarketMaker ? 'Maker' : 'Taker'})`);
          console.log(`     Time: ${new Date(fill.timestamp).toLocaleString()}`);
        });

        // Precision verification
        const totalFilled = parseFloat(summary.totalFilled);
        const totalRemaining = parseFloat(summary.totalRemaining);
        const originalAmount = parseFloat(orderInfo.originalAmount);
        const calculatedTotal = totalFilled + totalRemaining;
        const precisionDiff = Math.abs(calculatedTotal - originalAmount);

        console.log(`\n🎯 Final Precision Check:`);
        console.log(`   Original Amount: ${originalAmount}`);
        console.log(`   Filled + Remaining: ${calculatedTotal}`);
        console.log(`   Precision Difference: ${precisionDiff}`);

        if (precisionDiff < 0.000001) {
          console.log(`   ✅ Precision check PASSED`);
        } else {
          console.log(`   ❌ Precision check FAILED - difference too large`);
        }

        return {
          summary,
          fills,
          analytics,
          precisionCheck: {
            passed: precisionDiff < 0.000001,
            difference: precisionDiff
          }
        };

      } else {
        throw new Error(`Fill summary retrieval failed: ${result.error?.message}`);
      }

    } catch (error) {
      console.error(`❌ Fill summary verification failed: ${error.message}`);
      throw error;
    }
  }

  async testStep4_FixPrecisionIssues(orderInfo) {
    console.log('\n🔄 Step 4: Testing Precision Fix');
    console.log('='.repeat(60));

    try {
      const result = await this.makeRequest('/orders/precision-fix', 'POST', {
        orderId: orderInfo.orderId
      });

      if (result.success) {
        console.log(`🔧 Precision Fix Result:`);
        console.log(`   Order ID: ${result.data.orderId}`);
        console.log(`   Fixed: ${result.data.fixed}`);
        console.log(`   Details: ${result.data.details}`);
        console.log(`   Message: ${result.data.message}`);

        if (result.data.fixed) {
          console.log(`   ✅ Precision issues were found and fixed`);
        } else {
          console.log(`   ✅ No precision issues found`);
        }

        return result.data;

      } else {
        throw new Error(`Precision fix failed: ${result.error?.message}`);
      }

    } catch (error) {
      console.error(`❌ Precision fix test failed: ${error.message}`);
      throw error;
    }
  }

  async runFullTest() {
    console.log('\n🚀 Starting Partial Fill Precision Test');
    console.log('='.repeat(80));
    console.log('This test verifies that partial fills maintain precision accuracy');
    console.log('and that token unit calculations work correctly.');
    console.log('='.repeat(80));

    try {
      // Step 1: Create advanced order
      const orderInfo = await this.testStep1_CreateAdvancedOrder();
      
      // Step 2: Execute multiple partial fills
      const fillResults = await this.testStep2_ExecutePartialFills(orderInfo);
      
      // Step 3: Verify fill summary and precision
      const verification = await this.testStep3_VerifyFillSummary(orderInfo);
      
      // Step 4: Test precision fix functionality
      const precisionFix = await this.testStep4_FixPrecisionIssues(orderInfo);

      console.log('\n🎊 Partial Fill Precision Test Completed!');
      console.log('='.repeat(80));

      console.log(`📊 Final Results:`);
      console.log(`   Order ID: ${orderInfo.orderId}`);
      console.log(`   Total Fills Executed: ${fillResults.length}`);
      console.log(`   Final Fill Percentage: ${verification.summary.fillPercentage.toFixed(4)}%`);
      console.log(`   Average Execution Price: ${verification.summary.averagePrice}`);
      console.log(`   Total Fees Paid: ${verification.summary.totalFees}`);
      console.log(`   Precision Check: ${verification.precisionCheck.passed ? 'PASSED ✅' : 'FAILED ❌'}`);
      console.log(`   Precision Fix Needed: ${precisionFix.fixed ? 'Yes (Fixed)' : 'No'}`);

      console.log('\n🔗 Key Features Tested:');
      console.log('   ✅ Multi-step partial fills');
      console.log('   ✅ Precision calculation accuracy');
      console.log('   ✅ Average price computation');
      console.log('   ✅ Fee calculation (maker/taker)');
      console.log('   ✅ Remaining amount tracking');
      console.log('   ✅ Order status updates');
      console.log('   ✅ Precision issue detection and fixing');

      if (verification.precisionCheck.passed) {
        console.log('\n🎉 토큰 세부 단위 부분체결 문제가 해결되었습니다!');
      } else {
        console.log('\n⚠️ 일부 precision 문제가 여전히 존재할 수 있습니다.');
      }

    } catch (error) {
      console.log(`\n💥 Test suite failed: ${error.message}`);
    }
  }
}

// Usage instructions
console.log('🧪 Partial Fill Precision Test Suite');
console.log('='.repeat(50));
console.log('To run this test:');
console.log('1. Make sure your development server is running (pnpm run dev)');
console.log('2. Run: node scripts/test-partial-fills.js');
console.log('3. Or use in browser console after importing');
console.log('='.repeat(50));

// If running in Node.js environment
if (typeof window === 'undefined') {
  const tester = new PartialFillTester();
  tester.runFullTest().catch(console.error);
}

// Export for browser usage
if (typeof window !== 'undefined') {
  window.PartialFillTester = PartialFillTester;
}