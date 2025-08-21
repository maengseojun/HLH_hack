// scripts/test-token-linking.js
// Test script for Token Linking system end-to-end flow

/**
 * Test Token Linking Flow:
 * 1. ERC-20 토큰 발행 완료 시뮬레이션 (back_dev1에서 제공)
 * 2. HyperCore 링킹 요청
 * 3. 링킹 진행 상황 모니터링
 * 4. 거래 준비 상태 확인
 * 5. 실제 거래 기능 테스트
 */

const BASE_URL = 'http://localhost:3000/api/trading/v1';

// Mock ERC-20 tokens from back_dev1 (index issuance)
const MOCK_TOKENS = [
  {
    tokenAddress: '0x1234567890123456789012345678901234567890',
    symbol: 'MEME_INDEX',
    name: 'Meme Coin Index Token',
    decimals: 18,
    metadata: {
      totalSupply: '1000000000000000000000000', // 1M tokens
      creator: '0xCreator1234567890123456789012345678901234567890',
      description: 'Index token representing top meme coins'
    }
  },
  {
    tokenAddress: '0x2345678901234567890123456789012345678901',
    symbol: 'DOG_INDEX',
    name: 'Dog Token Index',
    decimals: 18,
    metadata: {
      totalSupply: '500000000000000000000000', // 500K tokens
      creator: '0xCreator2345678901234567890123456789012345678901',
      description: 'Index token for dog-themed cryptocurrencies'
    }
  },
  {
    tokenAddress: '0x3456789012345678901234567890123456789012',
    symbol: 'AI_INDEX',
    name: 'AI Token Index',
    decimals: 18,
    metadata: {
      totalSupply: '2000000000000000000000000', // 2M tokens
      creator: '0xCreator3456789012345678901234567890123456789012',
      description: 'Index token for AI and machine learning projects'
    }
  }
];

class TokenLinkingTester {
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

  async testStep1_RequestTokenLinking() {
    console.log('\n🔄 Step 1: Requesting Token Linking to HyperCore');
    console.log('='.repeat(60));

    const linkingResults = [];

    for (const token of MOCK_TOKENS) {
      try {
        console.log(`\n📝 Linking ${token.symbol} (${token.tokenAddress})`);
        
        const result = await this.makeRequest('/tokens/hypercore-link', 'POST', token);
        
        if (result.success) {
          console.log(`✅ ${token.symbol}: Linking request successful`);
          console.log(`   Status: ${result.data.linkStatus?.linkStatus || 'pending'}`);
          console.log(`   HyperCore Index: ${result.data.linkStatus?.hypercoreAssetIndex || 'TBD'}`);
        } else {
          console.log(`❌ ${token.symbol}: Linking request failed`);
          console.log(`   Error: ${result.error?.message}`);
        }

        linkingResults.push({
          ...token,
          linkingResult: result
        });

        // Wait between requests to avoid overwhelming
        await this.sleep(1000);

      } catch (error) {
        console.log(`❌ ${token.symbol}: Request failed - ${error.message}`);
        linkingResults.push({
          ...token,
          linkingResult: { success: false, error: error.message }
        });
      }
    }

    console.log(`\n📊 Step 1 Summary: ${linkingResults.filter(r => r.linkingResult.success).length}/${MOCK_TOKENS.length} tokens requested successfully`);
    return linkingResults;
  }

  async testStep2_MonitorProgress() {
    console.log('\n🔄 Step 2: Monitoring Linking Progress');
    console.log('='.repeat(60));

    const maxChecks = 10;
    const checkInterval = 3000; // 3 seconds

    for (let check = 1; check <= maxChecks; check++) {
      console.log(`\n📊 Progress Check ${check}/${maxChecks}`);

      try {
        const allTokensStatus = await this.makeRequest('/tokens/hypercore-link');
        
        if (allTokensStatus.success) {
          const { tokens, linkedCount, pendingCount, failedCount } = allTokensStatus.data;
          
          console.log(`📈 Status Summary: ${linkedCount} linked, ${pendingCount} pending, ${failedCount} failed`);

          for (const token of tokens) {
            const statusIcon = {
              'linked': '✅',
              'pending': '🔄',
              'failed': '❌',
              'rejected': '🚫'
            }[token.linkStatus] || '❓';

            console.log(`   ${statusIcon} ${token.symbol}: ${token.linkStatus}`);
            if (token.failureReason) {
              console.log(`      Reason: ${token.failureReason}`);
            }
          }

          // If all tokens are either linked or failed, stop monitoring
          if (pendingCount === 0) {
            console.log('\n🎉 All tokens have completed linking process!');
            return tokens;
          }
        }

      } catch (error) {
        console.log(`❌ Progress check failed: ${error.message}`);
      }

      if (check < maxChecks) {
        console.log(`⏱️ Waiting ${checkInterval/1000} seconds for next check...`);
        await this.sleep(checkInterval);
      }
    }

    console.log('\n⏰ Monitoring timeout reached');
    return null;
  }

  async testStep3_VerifySpotReadiness() {
    console.log('\n🔄 Step 3: Verifying Spot Trading Readiness');
    console.log('='.repeat(60));

    try {
      const readinessReport = await this.makeRequest('/tokens/spot-readiness?type=report');
      
      if (readinessReport.success) {
        const report = readinessReport.data.report;
        
        console.log('\n📋 Spot Trading Readiness Report:');
        console.log(`   Total Tokens: ${report.summary.totalTokens}`);
        console.log(`   Ready for Trading: ${report.summary.readyTokens}`);
        console.log(`   Need Attention: ${report.summary.needingAttention}`);
        console.log(`   Failed Linking: ${report.summary.failedLinking}`);

        if (report.ready.length > 0) {
          console.log('\n✅ Ready for Trading:');
          for (const token of report.ready) {
            console.log(`   🎯 ${token.symbol} (Index: ${token.hypercoreIndex})`);
            console.log(`      Price: $${token.priceUsd || 'N/A'}`);
            console.log(`      Status: Linked ✅ | PriceFeed ✅ | Bridge ✅ | SpotTrading ✅`);
          }
        }

        if (report.needingAttention.length > 0) {
          console.log('\n⚠️ Tokens Needing Attention:');
          for (const token of report.needingAttention) {
            console.log(`   🔧 ${token.symbol} (Index: ${token.hypercoreIndex})`);
            console.log(`      Issues: ${token.issues.join(', ')}`);
          }
        }

        if (report.failed.length > 0) {
          console.log('\n❌ Failed Tokens:');
          for (const token of report.failed) {
            console.log(`   💥 ${token.symbol}: ${token.issues.join(', ')}`);
          }
        }

        return report;
      }

    } catch (error) {
      console.log(`❌ Readiness verification failed: ${error.message}`);
    }

    return null;
  }

  async testStep4_TestSpotTrading() {
    console.log('\n🔄 Step 4: Testing Spot Trading Functionality');
    console.log('='.repeat(60));

    try {
      // Get ready tokens first
      const readyTokens = await this.makeRequest('/tokens/spot-readiness?type=ready');
      
      if (!readyTokens.success || readyTokens.data.tokens.length === 0) {
        console.log('⚠️ No tokens ready for spot trading test');
        return;
      }

      for (const token of readyTokens.data.tokens) {
        console.log(`\n🧪 Testing ${token.symbol} (${token.tokenAddress})`);

        try {
          const testResult = await this.makeRequest('/tokens/spot-test', 'POST', {
            tokenAddress: token.tokenAddress,
            testAmount: '1.0'
          });

          if (testResult.success) {
            const result = testResult.data.testResult;
            
            console.log(`   Overall Success: ${result.success ? '✅' : '❌'}`);
            console.log(`   Can Buy: ${result.canBuy ? '✅' : '❌'}`);
            console.log(`   Can Sell: ${result.canSell ? '✅' : '❌'}`);
            console.log(`   Bridge Deposit: ${result.bridgeDeposit ? '✅' : '❌'}`);
            console.log(`   Bridge Withdraw: ${result.bridgeWithdraw ? '✅' : '❌'}`);

            if (result.errors.length > 0) {
              console.log(`   Errors: ${result.errors.join(', ')}`);
            }

            if (result.success) {
              console.log(`   🎉 ${token.symbol} is fully ready for spot trading!`);
            }
          }

        } catch (error) {
          console.log(`   ❌ Test failed: ${error.message}`);
        }

        await this.sleep(1000);
      }

    } catch (error) {
      console.log(`❌ Spot trading test failed: ${error.message}`);
    }
  }

  async runFullTest() {
    console.log('\n🚀 Starting Token Linking End-to-End Test');
    console.log('='.repeat(80));
    console.log('This test simulates the complete flow from ERC-20 token issuance');
    console.log('to HyperCore linking and spot trading readiness verification.');
    console.log('='.repeat(80));

    try {
      // Step 1: Request token linking
      const linkingResults = await this.testStep1_RequestTokenLinking();
      
      // Step 2: Monitor progress
      const finalStatus = await this.testStep2_MonitorProgress();
      
      // Step 3: Verify readiness
      const readinessReport = await this.testStep3_VerifySpotReadiness();
      
      // Step 4: Test functionality
      await this.testStep4_TestSpotTrading();

      console.log('\n🎊 Token Linking End-to-End Test Completed!');
      console.log('='.repeat(80));

      if (readinessReport) {
        console.log(`📊 Final Results:`);
        console.log(`   ${readinessReport.summary.readyTokens} tokens ready for spot trading`);
        console.log(`   ${readinessReport.summary.needingAttention} tokens need attention`);
        console.log(`   ${readinessReport.summary.failedLinking} tokens failed linking`);
      }

      console.log('\n🔗 Next Steps:');
      console.log('   1. Ready tokens can be used in the trading system');
      console.log('   2. Check tokens needing attention and retry if needed');
      console.log('   3. Investigate and fix any failed tokens');

    } catch (error) {
      console.log(`\n💥 Test suite failed: ${error.message}`);
    }
  }
}

// Usage instructions
console.log('🧪 Token Linking Test Suite');
console.log('='.repeat(50));
console.log('To run this test:');
console.log('1. Make sure your development server is running (npm run dev)');
console.log('2. Run: node scripts/test-token-linking.js');
console.log('3. Or use in browser console after importing');
console.log('='.repeat(50));

// If running in Node.js environment
if (typeof window === 'undefined') {
  const tester = new TokenLinkingTester();
  tester.runFullTest().catch(console.error);
}

// Export for browser usage
if (typeof window !== 'undefined') {
  window.TokenLinkingTester = TokenLinkingTester;
  window.MOCK_TOKENS = MOCK_TOKENS;
}