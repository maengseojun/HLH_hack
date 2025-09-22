import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.testnet') });

async function testHyperCoreIntegration() {
  console.log('🔗 Testing HyperCore integration...\n');

  // 1. Meta API 호출 테스트
  try {
    console.log('📡 Testing Meta API...');
    const response = await fetch(process.env.HYPERLIQUID_INFO_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ MetaAndAssetCtxs API working');
    console.log(`   Assets: ${data.universe?.length || 0}`);

    if (data.universe && data.universe.length > 0) {
      const btcAsset = data.universe.find((asset: any) => asset.name === 'BTC');
      if (btcAsset) {
        console.log(`   BTC found - Asset ID: ${btcAsset.assetId || 'N/A'}`);
        console.log(`   BTC decimals: ${btcAsset.szDecimals || 'N/A'}`);
      }
      console.log(`   First asset: ${data.universe[0]?.name || 'N/A'}\n`);
    }
  } catch (e) {
    console.log('❌ Meta API failed:', (e as Error).message);
    console.log(`   URL: ${process.env.HYPERLIQUID_INFO_URL}\n`);
  }

  // 2. User State API 테스트 (포지션 조회)
  if (process.env.TEST_WALLET_ADDRESS && process.env.TEST_WALLET_ADDRESS !== '0x0000000000000000000000000000000000000000') {
    try {
      console.log('📊 Testing User State API...');
      const response = await fetch(process.env.HYPERLIQUID_INFO_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clearinghouseState',
          user: process.env.TEST_WALLET_ADDRESS
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ User state API working');
      console.log(`   Cross margin used: ${data.crossMarginSummary?.accountValue || '0'}`);
      console.log(`   Positions: ${data.assetPositions?.length || 0}`);

      if (data.assetPositions && data.assetPositions.length > 0) {
        console.log('   📋 Current positions:');
        data.assetPositions.forEach((pos: any, index: number) => {
          console.log(`     ${index + 1}. ${pos.position?.coin || 'Unknown'}: ${pos.position?.szi || '0'}`);
        });
      }
      console.log('');
    } catch (e) {
      console.log('❌ User State API failed:', (e as Error).message);
      console.log(`   Address: ${process.env.TEST_WALLET_ADDRESS}\n`);
    }
  }

  // 3. Precompile 호출 테스트 (HyperCore에서만 가능)
  if (process.env.HYPERCORE_RPC_URL && process.env.TEST_WALLET_ADDRESS) {
    try {
      console.log('🔧 Testing Precompile calls...');
      const provider = new ethers.JsonRpcProvider(process.env.HYPERCORE_RPC_URL);
      const testAddress = process.env.TEST_WALLET_ADDRESS;

      // 포지션 조회 (user:address, asset:uint32)
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint32'],
        [testAddress, 0] // BTC (assetId=0)
      );

      const result = await provider.call({
        to: '0x0000000000000000000000000000000000000800', // Precompile address
        data
      });

      console.log('✅ Precompile call successful');
      console.log(`   Raw result: ${result}`);

      // 결과 디코딩 시도
      try {
        if (result !== '0x') {
          const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['int64', 'uint32', 'uint64'], result);
          console.log(`   Position size: ${decoded[0]}`);
          console.log(`   Leverage: ${decoded[1]}`);
          console.log(`   Entry notional: ${decoded[2]}`);
        } else {
          console.log('   No position data (empty result)');
        }
      } catch {
        console.log('   (Could not decode - may be empty position or different format)');
      }
      console.log('');
    } catch (e) {
      console.log('❌ Precompile call failed:', (e as Error).message);
      console.log('   This is normal if not connected to HyperCore\n');
    }
  }

  // 4. CoreWriter 호출 준비 테스트 (실제 전송 X)
  if (process.env.CORE_WRITER_ADDRESS &&
      process.env.CORE_WRITER_ADDRESS !== '0x0000000000000000000000000000000000000000' &&
      process.env.TEST_WALLET_PRIVATE_KEY &&
      process.env.TEST_WALLET_PRIVATE_KEY !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
    try {
      console.log('📝 Testing CoreWriter...');
      const provider = new ethers.JsonRpcProvider(process.env.HYPERCORE_RPC_URL!);
      const coreWriterAbi = ['function sendRawAction(bytes data) external'];
      const wallet = new ethers.Wallet(process.env.TEST_WALLET_PRIVATE_KEY, provider);
      const coreWriter = new ethers.Contract(
        process.env.CORE_WRITER_ADDRESS,
        coreWriterAbi,
        wallet
      );

      // CoreWriter 컨트랙트 존재 확인
      const code = await provider.getCode(process.env.CORE_WRITER_ADDRESS);
      if (code === '0x') {
        throw new Error('CoreWriter contract not deployed at specified address');
      }

      // 더미 액션 데이터 (실제로는 전송하지 않음)
      const dummyAction = '0x01000000'; // version + reserved + actionId

      const estimatedGas = await coreWriter.sendRawAction.estimateGas(dummyAction);
      console.log('✅ CoreWriter accessible');
      console.log(`   Contract address: ${process.env.CORE_WRITER_ADDRESS}`);
      console.log(`   Estimated gas for sendRawAction: ${estimatedGas}`);
      console.log('   ⚠️  Note: This is just gas estimation, no transaction sent\n');
    } catch (e) {
      console.log('❌ CoreWriter test failed:', (e as Error).message);
      console.log(`   Address: ${process.env.CORE_WRITER_ADDRESS}\n`);
    }
  } else {
    console.log('⚠️  CoreWriter test skipped - address or private key not configured\n');
  }

  // 5. 전체 연결 상태 요약
  console.log('📋 Integration Summary:');
  console.log('   Info API: Testing market data and user state');
  console.log('   Precompile: Testing direct blockchain state access');
  console.log('   CoreWriter: Testing transaction submission capability');
  console.log('   💡 All components needed for full HyperLiquid integration\n');
}

if (import.meta.main) {
  testHyperCoreIntegration().catch(console.error);
}

export { testHyperCoreIntegration };