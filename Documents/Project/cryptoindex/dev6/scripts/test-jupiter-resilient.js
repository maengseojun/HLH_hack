#!/usr/bin/env node
// scripts/test-jupiter-resilient.js
/**
 * Test Jupiter Resilient Client
 * Tests fallback endpoints, caching, and error handling
 */

require('dotenv').config();
const { jupiterClient } = require('../lib/dex/jupiter-resilient.js');

async function testJupiterResilience() {
  console.log('🧪 Testing Jupiter Resilient Client');
  console.log('=' .repeat(50));

  // Test 1: Health Check
  console.log('\n📊 1. Health Check across all endpoints...');
  try {
    const health = await jupiterClient.healthCheck();
    console.log(`Overall Status: ${health.overall ? '✅ HEALTHY' : '❌ DEGRADED'}`);
    
    health.endpoints.forEach(endpoint => {
      if (endpoint.status === 'ok') {
        console.log(`  ✅ ${endpoint.url} - ${endpoint.responseTime}ms`);
      } else {
        console.log(`  ❌ ${endpoint.url} - ${endpoint.error}`);
      }
    });
  } catch (error) {
    console.error('Health check error:', error.message);
  }

  // Test 2: Token List
  console.log('\n🪙 2. Testing token list retrieval...');
  try {
    const tokensResult = await jupiterClient.getTokens();
    if (tokensResult.success) {
      console.log(`✅ Token list retrieved via: ${tokensResult.usedEndpoint}`);
      console.log(`📊 Found ${Array.isArray(tokensResult.data) ? tokensResult.data.length : 'unknown'} tokens`);
    } else {
      console.log(`❌ Token list failed: ${tokensResult.error}`);
    }
  } catch (error) {
    console.error('Token list error:', error.message);
  }

  // Test 3: Quote Request (SOL to USDC)
  console.log('\n💱 3. Testing quote request (1 SOL → USDC)...');
  try {
    const quoteRequest = {
      inputMint: 'So11111111111111111111111111111111111111112', // SOL
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      amount: 1000000000, // 1 SOL (1e9 lamports)
      slippageBps: 50
    };

    const quoteResult = await jupiterClient.getQuote(quoteRequest);
    
    if (quoteResult.success) {
      console.log(`✅ Quote retrieved via: ${quoteResult.usedEndpoint}`);
      if (quoteResult.retryAttempt > 1) {
        console.log(`🔄 Required ${quoteResult.retryAttempt} attempts`);
      }
      
      if (quoteResult.data) {
        console.log(`📊 Output: ${quoteResult.data.outAmount || 'N/A'}`);
        console.log(`📊 Price Impact: ${quoteResult.data.priceImpactPct || 'N/A'}%`);
      }
    } else {
      console.log(`❌ Quote failed: ${quoteResult.error}`);
    }
  } catch (error) {
    console.error('Quote error:', error.message);
  }

  // Test 4: Cache Test (repeat same request)
  console.log('\n📋 4. Testing cache functionality...');
  try {
    const startTime = Date.now();
    const cachedResult = await jupiterClient.getQuote({
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: 1000000000,
      slippageBps: 50
    });
    const endTime = Date.now();

    if (cachedResult.success) {
      console.log(`✅ Cached request completed in ${endTime - startTime}ms`);
      if (cachedResult.usedEndpoint === 'cache') {
        console.log('📋 Used cached data successfully');
      } else {
        console.log(`🌐 Fresh data from: ${cachedResult.usedEndpoint}`);
      }
    }
  } catch (error) {
    console.error('Cache test error:', error.message);
  }

  // Test 5: Cache Stats
  console.log('\n📈 5. Cache statistics...');
  const stats = jupiterClient.getCacheStats();
  console.log(`📋 Cache entries: ${stats.size}`);
  console.log(`🌐 Available endpoints: ${stats.endpoints.length}`);
  console.log(`⏰ Cache timeout: ${stats.cacheTimeout / 1000 / 60} minutes`);

  // Test 6: Invalid Request (Error Handling)
  console.log('\n❌ 6. Testing error handling with invalid request...');
  try {
    const invalidResult = await jupiterClient.getQuote({
      inputMint: 'invalid_mint_address',
      outputMint: 'also_invalid',
      amount: 100,
      slippageBps: 50
    });

    if (!invalidResult.success) {
      console.log(`✅ Error handled gracefully: ${invalidResult.error}`);
    } else {
      console.log('⚠️ Unexpected success with invalid data');
    }
  } catch (error) {
    console.log(`✅ Exception caught: ${error.message}`);
  }

  console.log('\n🎯 Jupiter Resilience Test Complete!');
  console.log('=' .repeat(50));
}

// Run the test
if (require.main === module) {
  testJupiterResilience().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testJupiterResilience };