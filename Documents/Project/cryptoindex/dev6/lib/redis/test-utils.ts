import redis from './client';

// Redis 기본 기능 테스트
export async function testRedisBasicOperations() {
  console.log('🧪 Testing Redis basic operations...');
  
  try {
    // 1. String 테스트
    await redis.set('test:string', 'Hello Redis!', 'EX', 60);
    const stringValue = await redis.get('test:string');
    console.log('✅ String test:', stringValue);
    
    // 2. Hash 테스트 (주문 정보 저장 형태)
    await redis.hset('test:order:123', {
      userId: 'user_456',
      pair: 'HYPERINDEX-USDC',
      side: 'buy',
      price: '1.50000',
      amount: '1000.0',
      status: 'active'
    });
    const orderData = await redis.hgetall('test:order:123');
    console.log('✅ Hash test (order):', orderData);
    
    // 3. Sorted Set 테스트 (오더북 저장 형태)
    await redis.zadd('test:orderbook:bids', 
      150000, 'order_123',  // 가격 1.50000
      149500, 'order_124',  // 가격 1.49500
      151000, 'order_125'   // 가격 1.51000
    );
    
    // 높은 가격순으로 조회 (매수 주문)
    const bids = await redis.zrevrange('test:orderbook:bids', 0, -1, 'WITHSCORES');
    console.log('✅ Sorted Set test (bids):', bids);
    
    // 4. List 테스트 (거래 이력)
    await redis.lpush('test:trades', JSON.stringify({
      tradeId: 'trade_001',
      price: 1.50000,
      amount: 500,
      timestamp: Date.now()
    }));
    const latestTrade = await redis.lrange('test:trades', 0, 0);
    console.log('✅ List test (trades):', JSON.parse(latestTrade[0]));
    
    // 5. 만료 테스트
    await redis.setex('test:expiry', 5, 'This will expire in 5 seconds');
    const ttl = await redis.ttl('test:expiry');
    console.log('✅ Expiry test (TTL):', ttl, 'seconds');
    
    console.log('🎉 All Redis tests passed!');
    return true;
    
  } catch (_error) {
    console.error('❌ Redis test failed:', _error);
    return false;
  }
}

// 오더북 구조 테스트
export async function testOrderbookStructure() {
  console.log('📊 Testing Orderbook structure...');
  
  try {
    const pair = 'HYPERINDEX-USDC';
    
    // 매수 주문 추가 (높은 가격 우선)
    await redis.zadd(`orderbook:${pair}:bids`,
      150000, 'buy_order_1',   // $1.50000
      149500, 'buy_order_2',   // $1.49500
      148000, 'buy_order_3'    // $1.48000
    );
    
    // 매도 주문 추가 (낮은 가격 우선)
    await redis.zadd(`orderbook:${pair}:asks`,
      151000, 'sell_order_1',  // $1.51000
      152000, 'sell_order_2',  // $1.52000
      153000, 'sell_order_3'   // $1.53000
    );
    
    // 최고 매수가 조회
    const bestBid = await redis.zrevrange(`orderbook:${pair}:bids`, 0, 0, 'WITHSCORES');
    console.log('✅ Best Bid:', bestBid[0], '$' + (parseInt(bestBid[1]) / 100000).toFixed(5));
    
    // 최저 매도가 조회
    const bestAsk = await redis.zrange(`orderbook:${pair}:asks`, 0, 0, 'WITHSCORES');
    console.log('✅ Best Ask:', bestAsk[0], '$' + (parseInt(bestAsk[1]) / 100000).toFixed(5));
    
    // 스프레드 계산
    const spread = parseInt(bestAsk[1]) - parseInt(bestBid[1]);
    console.log('✅ Spread:', '$' + (spread / 100000).toFixed(5));
    
    // 전체 오더북 조회 (상위 5개)
    const topBids = await redis.zrevrange(`orderbook:${pair}:bids`, 0, 4, 'WITHSCORES');
    const topAsks = await redis.zrange(`orderbook:${pair}:asks`, 0, 4, 'WITHSCORES');
    
    console.log('📊 Current Orderbook:');
    console.log('Asks (Sell Orders):');
    for (let i = topAsks.length - 1; i >= 0; i -= 2) {
      const price = (parseInt(topAsks[i]) / 100000).toFixed(5);
      console.log(`  ${topAsks[i-1]} @ $${price}`);
    }
    console.log('--- Spread ---');
    console.log('Bids (Buy Orders):');
    for (let i = 0; i < topBids.length; i += 2) {
      const price = (parseInt(topBids[i+1]) / 100000).toFixed(5);
      console.log(`  ${topBids[i]} @ $${price}`);
    }
    
    return true;
    
  } catch (_error) {
    console.error('❌ Orderbook test failed:', _error);
    return false;
  }
}

// Pub/Sub 테스트
export async function testPubSub() {
  console.log('📡 Testing Pub/Sub functionality...');
  
  try {
    const { redisPubSub } = await import('./client');
    
    // 구독자 설정
    const subscriber = redisPubSub.duplicate();
    const publisher = redis;
    
    return new Promise<boolean>((resolve) => {
      let messageReceived = false;
      
      // 메시지 수신 핸들러
      subscriber.on('message', (channel, message) => {
        console.log('✅ Received message:', { channel, message });
        messageReceived = true;
        subscriber.disconnect();
        resolve(true);
      });
      
      // 채널 구독
      subscriber.subscribe('test:updates', (err, count) => {
        if (err) {
          console.error('❌ Subscribe error:', err);
          resolve(false);
          return;
        }
        
        console.log(`📡 Subscribed to ${count} channel(s)`);
        
        // 메시지 발행
        setTimeout(() => {
          publisher.publish('test:updates', JSON.stringify({
            type: 'test_message',
            data: 'Hello Pub/Sub!',
            timestamp: Date.now()
          }));
        }, 100);
        
        // 타임아웃 설정
        setTimeout(() => {
          if (!messageReceived) {
            console.log('❌ Pub/Sub test timeout');
            subscriber.disconnect();
            resolve(false);
          }
        }, 5000);
      });
    });
    
  } catch (_error) {
    console.error('❌ Pub/Sub test failed:', _error);
    return false;
  }
}

// 전체 테스트 실행
export async function runAllRedisTests() {
  console.log('🚀 Starting comprehensive Redis tests...\n');
  
  const tests = [
    { name: 'Basic Operations', fn: testRedisBasicOperations },
    { name: 'Orderbook Structure', fn: testOrderbookStructure },
    { name: 'Pub/Sub Messaging', fn: testPubSub }
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Running: ${test.name}`);
    console.log('='.repeat(50));
    
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
      
      if (result) {
        console.log(`✅ ${test.name} PASSED`);
      } else {
        console.log(`❌ ${test.name} FAILED`);
      }
    } catch (_error) {
      console.error(`❌ ${test.name} ERROR:`, _error);
      results.push({ name: test.name, passed: false });
    }
  }
  
  // 결과 요약
  console.log('\n' + '='.repeat(50));
  console.log('TEST SUMMARY');
  console.log('='.repeat(50));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
  });
  
  console.log(`\n📊 Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Redis is ready for production use.');
  } else {
    console.log('⚠️ Some tests failed. Please check your Redis configuration.');
  }
  
  return passed === total;
}