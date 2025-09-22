import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.testnet') });

async function testWalletAndGas() {
  console.log('💰 Testing wallet and gas fees...\n');

  // 환경변수 검증
  if (!process.env.TEST_WALLET_PRIVATE_KEY || process.env.TEST_WALLET_PRIVATE_KEY === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    console.log('❌ TEST_WALLET_PRIVATE_KEY not configured');
    return;
  }

  if (!process.env.HYPEREVM_RPC_URL) {
    console.log('❌ HYPEREVM_RPC_URL not configured');
    return;
  }

  try {
    const provider = new ethers.JsonRpcProvider(process.env.HYPEREVM_RPC_URL);
    const wallet = new ethers.Wallet(process.env.TEST_WALLET_PRIVATE_KEY, provider);

    // 1. 지갑 정보 확인
    const balance = await provider.getBalance(wallet.address);
    console.log('🏛️  Wallet Information:');
    console.log(`   Address: ${wallet.address}`);
    console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);
    console.log(`   Balance Wei: ${balance.toString()}\n`);

    // 2. 가스 정보 확인
    try {
      const feeData = await provider.getFeeData();
      console.log('⛽ Gas Information:');
      console.log(`   Gas Price: ${ethers.formatUnits(feeData.gasPrice || 0n, 'gwei')} gwei`);
      console.log(`   Max Fee Per Gas: ${ethers.formatUnits(feeData.maxFeePerGas || 0n, 'gwei')} gwei`);
      console.log(`   Max Priority Fee: ${ethers.formatUnits(feeData.maxPriorityFeePerGas || 0n, 'gwei')} gwei\n`);
    } catch (e) {
      console.log('⚠️  Could not fetch fee data:', (e as Error).message);
      console.log('   Using fallback gas price from config\n');
    }

    // 3. 간단한 트랜잭션 시뮬레이션 (실제 전송 X)
    const tx = {
      to: wallet.address, // 자기 자신에게
      value: ethers.parseEther('0.001'),
      gasLimit: 21000
    };

    try {
      const estimatedGas = await provider.estimateGas(tx);
      const gasPrice = await provider.getGasPrice();
      const gasCost = estimatedGas * gasPrice;

      console.log('🧾 Transaction Simulation (0.001 ETH to self):');
      console.log(`   Estimated Gas: ${estimatedGas.toString()}`);
      console.log(`   Gas Price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
      console.log(`   Total Gas Cost: ${ethers.formatEther(gasCost)} ETH`);
      console.log(`   Sufficient Balance: ${balance > gasCost ? '✅' : '❌'}`);
      console.log(`   Remaining after tx: ${ethers.formatEther(balance - gasCost - ethers.parseEther('0.001'))} ETH\n`);
    } catch (e) {
      console.log('❌ Gas estimation failed:', (e as Error).message);
      console.log('   This might indicate network issues or incorrect configuration\n');
    }

    // 4. 네트워크 상태 확인
    try {
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      const block = await provider.getBlock(blockNumber);

      console.log('🌐 Network Status:');
      console.log(`   Chain ID: ${network.chainId}`);
      console.log(`   Block Number: ${blockNumber}`);
      console.log(`   Block Timestamp: ${new Date((block?.timestamp || 0) * 1000).toISOString()}`);
      console.log(`   Gas Limit: ${block?.gasLimit.toString()}`);
      console.log(`   Gas Used: ${block?.gasUsed.toString()}\n`);
    } catch (e) {
      console.log('❌ Network status check failed:', (e as Error).message);
    }

    // 5. 잔고 상태 평가
    const balanceEth = Number(ethers.formatEther(balance));
    console.log('💡 Balance Assessment:');
    if (balanceEth === 0) {
      console.log('   ❌ No balance - need testnet ETH');
      console.log('   💡 Get testnet ETH from faucet or bridge');
    } else if (balanceEth < 0.01) {
      console.log('   ⚠️  Low balance - may not be sufficient for multiple transactions');
      console.log('   💡 Consider getting more testnet ETH');
    } else if (balanceEth < 0.1) {
      console.log('   ✅ Moderate balance - good for testing');
    } else {
      console.log('   ✅ Good balance - ready for extensive testing');
    }

  } catch (e) {
    console.log('❌ Wallet test failed:', (e as Error).message);
    console.log('   Check if the private key and RPC URL are correct');
  }
}

if (import.meta.main) {
  testWalletAndGas().catch(console.error);
}

export { testWalletAndGas };