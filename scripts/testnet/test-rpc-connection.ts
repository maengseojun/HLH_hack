import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.testnet') });

async function testRpcConnections() {
  console.log('🧪 Testing RPC connections...\n');

  // 1. HyperEVM 연결 테스트
  try {
    const hyperEvmProvider = new ethers.JsonRpcProvider(process.env.HYPEREVM_RPC_URL);
    const network = await hyperEvmProvider.getNetwork();
    const blockNumber = await hyperEvmProvider.getBlockNumber();
    console.log('✅ HyperEVM connected');
    console.log(`   Chain ID: ${network.chainId}`);
    console.log(`   Latest block: ${blockNumber}`);
    console.log(`   RPC URL: ${process.env.HYPEREVM_RPC_URL}\n`);
  } catch (e) {
    console.log('❌ HyperEVM connection failed:', (e as Error).message);
    console.log(`   RPC URL: ${process.env.HYPEREVM_RPC_URL}\n`);
  }

  // 2. HyperCore 연결 테스트
  try {
    const hyperCoreProvider = new ethers.JsonRpcProvider(process.env.HYPERCORE_RPC_URL);
    const network = await hyperCoreProvider.getNetwork();
    const blockNumber = await hyperCoreProvider.getBlockNumber();
    console.log('✅ HyperCore connected');
    console.log(`   Chain ID: ${network.chainId}`);
    console.log(`   Latest block: ${blockNumber}`);

    // CoreWriter 존재 확인
    if (process.env.CORE_WRITER_ADDRESS && process.env.CORE_WRITER_ADDRESS !== '0x0000000000000000000000000000000000000000') {
      const coreWriterCode = await hyperCoreProvider.getCode(process.env.CORE_WRITER_ADDRESS);
      console.log(`   CoreWriter deployed: ${coreWriterCode !== '0x' ? '✅' : '❌'}`);
    }
    console.log(`   RPC URL: ${process.env.HYPERCORE_RPC_URL}\n`);
  } catch (e) {
    console.log('❌ HyperCore connection failed:', (e as Error).message);
    console.log(`   RPC URL: ${process.env.HYPERCORE_RPC_URL}\n`);
  }

  // 3. HyperLiquid Info API 테스트
  try {
    const response = await fetch(process.env.HYPERLIQUID_INFO_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ HyperLiquid Info API connected');
    console.log(`   Assets available: ${data.universe?.length || 0}`);
    console.log(`   API URL: ${process.env.HYPERLIQUID_INFO_URL}\n`);

    if (data.universe && data.universe.length > 0) {
      console.log('📋 Sample Assets:');
      data.universe.slice(0, 3).forEach((asset: any, index: number) => {
        console.log(`   ${index + 1}. ${asset.name} (${asset.szDecimals} decimals)`);
      });
      console.log('');
    }
  } catch (e) {
    console.log('❌ Info API connection failed:', (e as Error).message);
    console.log(`   API URL: ${process.env.HYPERLIQUID_INFO_URL}\n`);
  }

  // 4. 네트워크 호환성 확인
  console.log('🔧 Configuration check:');
  console.log(`   Expected Chain ID: ${process.env.CHAIN_ID}`);
  console.log(`   Gas Limit: ${process.env.GAS_LIMIT}`);
  console.log(`   Gas Price: ${process.env.GAS_PRICE} wei\n`);
}

if (import.meta.main) {
  testRpcConnections().catch(console.error);
}

export { testRpcConnections };