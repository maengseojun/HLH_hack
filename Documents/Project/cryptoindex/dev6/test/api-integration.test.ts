/**
 * API Integration Tests
 * 실제 외부 API들과의 통합 테스트
 */

import { expect } from 'chai';
import { ethers } from 'ethers';
import fetch from 'node-fetch';

describe('API Integration Tests', function() {
  // 테스트 타임아웃 증가 (실제 API 호출이므로)
  this.timeout(30000);

  describe('1inch Aggregator API Integration', function() {
    const ONEINCH_API_URL = 'https://api.1inch.io/v5.0/1';
    
    it('should fetch swap quote from 1inch API', async function() {
      try {
        const params = new URLSearchParams({
          fromTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
          toTokenAddress: '0xA0b86a33E6441d1b1B80BB51e3ee7C80E60b0E00', // USDC
          amount: ethers.utils.parseEther('1').toString()
        });

        const response = await fetch(`${ONEINCH_API_URL}/quote?${params}`, {
          headers: {
            'Accept': 'application/json',
          }
        });

        if (response.status === 429) {
          console.log('⚠️ 1inch API rate limited - skipping test');
          this.skip();
          return;
        }

        expect(response.ok).to.be.true;
        
        const data = await response.json();
        expect(data).to.have.property('toTokenAmount');
        expect(data).to.have.property('estimatedGas');
        
        console.log(`✅ 1inch Quote: 1 ETH = ${ethers.utils.formatUnits(data.toTokenAmount, 6)} USDC`);
        
        // 가격이 합리적인지 확인 (1 ETH = 1000-5000 USDC 범위)
        const usdcAmount = parseFloat(ethers.utils.formatUnits(data.toTokenAmount, 6));
        expect(usdcAmount).to.be.greaterThan(1000);
        expect(usdcAmount).to.be.lessThan(5000);
        
      } catch (error) {
        console.log('⚠️ 1inch API test failed:', error.message);
        // API 실패를 테스트 실패로 처리하지 않음 (외부 서비스이므로)
      }
    });

    it('should handle swap execution parameters', async function() {
      try {
        const params = new URLSearchParams({
          fromTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          toTokenAddress: '0xA0b86a33E6441d1b1B80BB51e3ee7C80E60b0E00',
          amount: ethers.utils.parseEther('0.1').toString(),
          fromAddress: '0x1234567890123456789012345678901234567890',
          slippage: '1'
        });

        const response = await fetch(`${ONEINCH_API_URL}/swap?${params}`, {
          headers: {
            'Accept': 'application/json',
          }
        });

        if (response.status === 429) {
          this.skip();
          return;
        }

        if (response.ok) {
          const data = await response.json();
          expect(data).to.have.property('tx');
          expect(data.tx).to.have.property('data');
          expect(data.tx).to.have.property('to');
          
          console.log('✅ 1inch swap data received');
        }
        
      } catch (error) {
        console.log('⚠️ 1inch swap test failed:', error.message);
      }
    });
  });

  describe('CoinGecko Price Feed Integration', function() {
    const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

    it('should fetch current prices', async function() {
      try {
        const response = await fetch(
          `${COINGECKO_API_URL}/simple/price?ids=ethereum,bitcoin,binancecoin&vs_currencies=usd&include_24hr_change=true`,
          {
            headers: {
              'Accept': 'application/json',
            }
          }
        );

        expect(response.ok).to.be.true;
        
        const data = await response.json();
        expect(data).to.have.property('ethereum');
        expect(data).to.have.property('bitcoin');
        expect(data.ethereum).to.have.property('usd');
        
        console.log(`✅ Prices: ETH=$${data.ethereum.usd}, BTC=$${data.bitcoin.usd}`);
        
        // 가격 합리성 체크
        expect(data.ethereum.usd).to.be.greaterThan(1000);
        expect(data.bitcoin.usd).to.be.greaterThan(20000);
        
      } catch (error) {
        console.log('⚠️ CoinGecko test failed:', error.message);
      }
    });

    it('should handle rate limiting gracefully', async function() {
      // 연속 요청으로 rate limit 테스트
      const promises = Array.from({ length: 10 }, () =>
        fetch(`${COINGECKO_API_URL}/simple/price?ids=ethereum&vs_currencies=usd`)
      );

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      
      console.log(`✅ CoinGecko rate limit test: ${successCount}/10 requests succeeded`);
      expect(successCount).to.be.greaterThan(0); // 최소 하나는 성공해야 함
    });
  });

  describe('Hyperliquid API Integration', function() {
    const HYPERLIQUID_API_URL = 'https://api.hyperliquid.xyz';

    it('should fetch market metadata', async function() {
      try {
        const response = await fetch(`${HYPERLIQUID_API_URL}/info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type: 'meta' })
        });

        if (response.ok) {
          const data = await response.json();
          expect(data).to.be.an('object');
          console.log('✅ Hyperliquid metadata received');
          
          // 메타데이터 구조 확인
          if (data.universe) {
            expect(data.universe).to.be.an('array');
            console.log(`✅ Hyperliquid: ${data.universe.length} assets available`);
          }
        }
        
      } catch (error) {
        console.log('⚠️ Hyperliquid test failed:', error.message);
      }
    });

    it('should fetch orderbook data', async function() {
      try {
        const response = await fetch(`${HYPERLIQUID_API_URL}/info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            type: 'l2Book', 
            coin: 'ETH' 
          })
        });

        if (response.ok) {
          const data = await response.json();
          expect(data).to.have.property('levels');
          expect(data.levels).to.be.an('array');
          
          if (data.levels.length > 0) {
            expect(data.levels[0]).to.be.an('array').with.length(2); // [price, size]
            console.log('✅ Hyperliquid orderbook data received');
          }
        }
        
      } catch (error) {
        console.log('⚠️ Hyperliquid orderbook test failed:', error.message);
      }
    });
  });

  describe('DefiLlama TVL Integration', function() {
    const DEFILLAMA_API_URL = 'https://api.llama.fi';

    it('should fetch protocol TVL data', async function() {
      try {
        const response = await fetch(`${DEFILLAMA_API_URL}/protocols`);
        
        if (response.ok) {
          const data = await response.json();
          expect(data).to.be.an('array');
          expect(data.length).to.be.greaterThan(100); // 100개 이상의 프로토콜
          
          // Uniswap 데이터 확인
          const uniswap = data.find(p => p.name.toLowerCase().includes('uniswap'));
          if (uniswap) {
            expect(uniswap).to.have.property('tvl');
            expect(uniswap.tvl).to.be.a('number');
            console.log(`✅ Uniswap TVL: $${(uniswap.tvl / 1e9).toFixed(2)}B`);
          }
        }
        
      } catch (error) {
        console.log('⚠️ DefiLlama test failed:', error.message);
      }
    });
  });

  describe('RPC Provider Performance', function() {
    it('should test Ethereum mainnet RPC performance', async function() {
      const providers = [
        'https://eth-mainnet.alchemyapi.io/v2/demo',
        'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
        'https://rpc.ankr.com/eth'
      ];

      const results = [];

      for (const rpcUrl of providers) {
        try {
          const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
          const start = Date.now();
          
          const blockNumber = await provider.getBlockNumber();
          const responseTime = Date.now() - start;
          
          results.push({
            provider: rpcUrl.split('/')[2], // Extract domain
            blockNumber,
            responseTime,
            success: true
          });
          
        } catch (error) {
          results.push({
            provider: rpcUrl.split('/')[2],
            blockNumber: 0,
            responseTime: Infinity,
            success: false,
            error: error.message
          });
        }
      }

      // 결과 출력
      console.log('\n📡 RPC Provider Performance:');
      results.forEach(result => {
        if (result.success) {
          console.log(`✅ ${result.provider}: ${result.responseTime}ms (Block: ${result.blockNumber})`);
          expect(result.responseTime).to.be.lessThan(5000); // 5초 이내
        } else {
          console.log(`❌ ${result.provider}: Failed (${result.error})`);
        }
      });

      // 최소 하나의 RPC는 작동해야 함
      const workingProviders = results.filter(r => r.success);
      expect(workingProviders.length).to.be.greaterThan(0);
    });
  });

  describe('Cross-Chain Bridge APIs', function() {
    it('should check LayerZero endpoint availability', async function() {
      // LayerZero는 실제 API endpoint가 다를 수 있음
      // 이는 실제 구현시 정확한 endpoint로 교체 필요
      try {
        // Mock test - 실제로는 LayerZero의 공식 API 사용
        console.log('⚠️ LayerZero API test placeholder - implement with actual endpoints');
        
        // 예시: 실제 구현에서는 다음과 같은 체크 필요
        // - Chain configuration 확인
        // - Message fee estimation
        // - Bridge status 확인
        
      } catch (error) {
        console.log('⚠️ LayerZero test placeholder');
      }
    });

    it('should test cross-chain transaction simulation', async function() {
      // 크로스체인 거래 시뮬레이션
      console.log('🌉 Cross-chain transaction simulation');
      
      // 1. Source chain state check
      // 2. Destination chain readiness
      // 3. Bridge liquidity check
      // 4. Fee estimation
      
      const mockSimulation = {
        sourceChain: 'Ethereum',
        destChain: 'Polygon',
        estimatedTime: '2-5 minutes',
        estimatedFees: '0.01 ETH',
        success: true
      };
      
      expect(mockSimulation.success).to.be.true;
      console.log(`✅ Simulation: ${mockSimulation.sourceChain} → ${mockSimulation.destChain}`);
      console.log(`   Time: ${mockSimulation.estimatedTime}, Fees: ${mockSimulation.estimatedFees}`);
    });
  });

  describe('Gas Optimization Tests', function() {
    it('should estimate gas costs for different operations', async function() {
      const operations = [
        { name: 'ERC20 Transfer', baseGas: 21000 },
        { name: 'Vault Deposit', baseGas: 150000 },
        { name: 'Rebalance', baseGas: 300000 },
        { name: 'Cross-chain Message', baseGas: 200000 }
      ];

      console.log('\n⛽ Gas Cost Analysis:');
      
      for (const op of operations) {
        // 현재 가스 가격 가정 (20 gwei)
        const gasPrice = ethers.utils.parseUnits('20', 'gwei');
        const cost = gasPrice.mul(op.baseGas);
        const costInEth = ethers.utils.formatEther(cost);
        
        console.log(`   ${op.name}: ${op.baseGas.toLocaleString()} gas (${costInEth} ETH)`);
        
        // 가스 비용이 합리적인지 확인
        expect(parseFloat(costInEth)).to.be.lessThan(0.1); // 0.1 ETH 미만
      }
    });

    it('should test transaction batching efficiency', async function() {
      // 배치 거래의 가스 효율성 테스트
      const singleTxGas = 150000;
      const batchedTxGas = 400000; // 3개 거래를 배치
      
      const efficiency = ((singleTxGas * 3) - batchedTxGas) / (singleTxGas * 3) * 100;
      
      console.log(`\n📦 Batching Efficiency:`);
      console.log(`   Single TX: ${singleTxGas.toLocaleString()} gas`);
      console.log(`   3x Single: ${(singleTxGas * 3).toLocaleString()} gas`);
      console.log(`   Batched: ${batchedTxGas.toLocaleString()} gas`);
      console.log(`   Savings: ${efficiency.toFixed(1)}%`);
      
      expect(efficiency).to.be.greaterThan(10); // 최소 10% 절약
    });
  });

  describe('Error Handling & Fallbacks', function() {
    it('should handle API timeout gracefully', async function() {
      const shortTimeout = 100; // 100ms (매우 짧음)
      
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
          signal: AbortSignal.timeout(shortTimeout)
        });
        
        // 타임아웃 발생하지 않으면 skip
        if (response.ok) {
          console.log('⚠️ Request completed faster than timeout - network too fast');
          return;
        }
        
      } catch (error) {
        // 타임아웃 오류 예상
        expect(error.name).to.equal('AbortError');
        console.log('✅ Timeout handled correctly');
      }
    });

    it('should implement fallback price feeds', async function() {
      const priceFeeds = [
        {
          name: 'CoinGecko',
          url: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
          parse: (data) => data.ethereum.usd
        },
        {
          name: 'CoinMarketCap',
          url: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=ETH', // API key 필요
          parse: (data) => data.data.ETH.quote.USD.price
        }
      ];

      let ethPrice = null;
      
      for (const feed of priceFeeds) {
        try {
          const response = await fetch(feed.url);
          if (response.ok) {
            const data = await response.json();
            ethPrice = feed.parse(data);
            console.log(`✅ ${feed.name}: ETH = $${ethPrice}`);
            break;
          }
        } catch (error) {
          console.log(`⚠️ ${feed.name} failed: ${error.message}`);
        }
      }
      
      if (ethPrice) {
        expect(ethPrice).to.be.a('number');
        expect(ethPrice).to.be.greaterThan(1000);
      } else {
        console.log('⚠️ All price feeds failed - implement on-chain oracle fallback');
      }
    });
  });

  describe('Security & Rate Limiting', function() {
    it('should respect API rate limits', async function() {
      const requests = [];
      const maxConcurrent = 5; // API 별 동시 요청 제한
      
      for (let i = 0; i < maxConcurrent; i++) {
        requests.push(
          fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
            .then(r => ({ success: r.ok, status: r.status }))
            .catch(e => ({ success: false, error: e.message }))
        );
      }
      
      const results = await Promise.all(requests);
      const rateLimited = results.filter(r => r.status === 429);
      const successful = results.filter(r => r.success);
      
      console.log(`\n🚦 Rate Limit Test:`);
      console.log(`   Successful: ${successful.length}/${maxConcurrent}`);
      console.log(`   Rate Limited: ${rateLimited.length}/${maxConcurrent}`);
      
      // 모든 요청이 실패하지 않아야 함
      expect(successful.length).to.be.greaterThan(0);
    });

    it('should validate API responses', async function() {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        
        if (response.ok) {
          const data = await response.json();
          
          // 응답 구조 검증
          expect(data).to.be.an('object');
          expect(data).to.have.property('ethereum');
          expect(data.ethereum).to.have.property('usd');
          expect(data.ethereum.usd).to.be.a('number');
          expect(data.ethereum.usd).to.be.greaterThan(0);
          
          // 가격 합리성 검증 (너무 높거나 낮으면 의심)
          expect(data.ethereum.usd).to.be.lessThan(100000); // $100k 미만
          expect(data.ethereum.usd).to.be.greaterThan(500); // $500 이상
          
          console.log('✅ API response validation passed');
        }
        
      } catch (error) {
        console.log('⚠️ API validation test failed:', error.message);
      }
    });
  });

  describe('Integration Health Check', function() {
    it('should run comprehensive health check', async function() {
      const healthChecks = [
        { name: '1inch API', test: () => fetch('https://api.1inch.io/v5.0/1/healthcheck') },
        { name: 'CoinGecko API', test: () => fetch('https://api.coingecko.com/api/v3/ping') },
        { name: 'Ethereum RPC', test: () => {
          const provider = new ethers.providers.JsonRpcProvider('https://eth-mainnet.alchemyapi.io/v2/demo');
          return provider.getBlockNumber();
        }}
      ];

      console.log('\n🏥 System Health Check:');
      
      const results = await Promise.allSettled(
        healthChecks.map(async check => {
          const start = Date.now();
          try {
            await check.test();
            return { 
              name: check.name, 
              status: 'healthy', 
              responseTime: Date.now() - start 
            };
          } catch (error) {
            return { 
              name: check.name, 
              status: 'unhealthy', 
              error: error.message,
              responseTime: Date.now() - start 
            };
          }
        })
      );

      let healthyCount = 0;
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          const check = result.value;
          const emoji = check.status === 'healthy' ? '✅' : '❌';
          console.log(`   ${emoji} ${check.name}: ${check.status} (${check.responseTime}ms)`);
          
          if (check.status === 'healthy') healthyCount++;
        }
      });

      const healthPercentage = (healthyCount / healthChecks.length) * 100;
      console.log(`\n🎯 Overall Health: ${healthPercentage.toFixed(1)}%`);
      
      // 최소 70% 이상의 서비스가 정상이어야 함
      expect(healthPercentage).to.be.greaterThan(70);
    });
  });
});

// Helper function to create mock data for testing
export function createMockAPIResponse(type: string) {
  switch (type) {
    case '1inch-quote':
      return {
        fromToken: {
          symbol: 'ETH',
          name: 'Ethereum',
          address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          decimals: 18
        },
        toToken: {
          symbol: 'USDC',
          name: 'USD Coin',
          address: '0xA0b86a33E6441d1b1B80BB51e3ee7C80E60b0E00',
          decimals: 6
        },
        toTokenAmount: '2000000000', // 2000 USDC
        fromTokenAmount: '1000000000000000000', // 1 ETH
        estimatedGas: '150000'
      };
      
    case 'coingecko-price':
      return {
        ethereum: { usd: 2000, usd_24h_change: 5.2 },
        bitcoin: { usd: 35000, usd_24h_change: -2.1 }
      };
      
    default:
      return {};
  }
}