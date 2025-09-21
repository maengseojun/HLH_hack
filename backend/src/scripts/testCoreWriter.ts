// backend/src/scripts/testCoreWriter.ts
import { coreWriterService, TIF } from '../services/coreWriter.js';
import { ethers } from 'ethers';
import { config } from '../config.js';

async function testPrecompiles() {
  console.log('🔍 Testing HyperLiquid Precompiles...\n');

  try {
    // Test L1 block number
    console.log('📊 Reading L1 block number...');
    const blockNumber = await coreWriterService.readL1BlockNumber();
    console.log(`✅ L1 Block Number: ${blockNumber.toString()}\n`);

    // Test BTC oracle price (asset 0)
    console.log('💰 Reading BTC oracle price...');
    const btcPrice = await coreWriterService.readPerpOraclePrice(0);
    const btcPriceFormatted = coreWriterService.convertPerpPrice(btcPrice, 5);
    console.log(`✅ BTC Oracle Price: $${btcPriceFormatted}\n`);

    // Test spot price for USDC (token 2)
    console.log('💵 Reading USDC spot price...');
    const usdcPrice = await coreWriterService.readSpotPrice(2);
    const usdcPriceFormatted = coreWriterService.convertSpotPrice(usdcPrice, 6);
    console.log(`✅ USDC Spot Price: $${usdcPriceFormatted}\n`);

    // Test reading position for a test address
    const testAddress = config.hypercore.walletPrivateKey ? 
      new ethers.Wallet(config.hypercore.walletPrivateKey).address : 
      '0x0000000000000000000000000000000000000000';
    
    console.log(`📈 Reading BTC position for ${testAddress}...`);
    try {
      const position = await coreWriterService.readPerpPosition(testAddress, 0);
      console.log(`✅ Position - Size: ${position.szi.toString()}, Leverage: ${position.leverage}, Entry: ${position.entryNtl.toString()}\n`);
    } catch (error) {
      console.log(`⚠️ No position found or error: ${error}\n`);
    }

    // Test reading spot balance
    console.log(`💰 Reading USDC balance for ${testAddress}...`);
    try {
      const balance = await coreWriterService.readSpotBalance(testAddress, 2);
      console.log(`✅ USDC Balance: ${balance.toString()}\n`);
    } catch (error) {
      console.log(`⚠️ No balance found or error: ${error}\n`);
    }

  } catch (error) {
    console.error('❌ Error testing precompiles:', error);
  }
}

async function testCoreWriter() {
  console.log('🛠 Testing CoreWriter Actions...\n');
  
  // Note: These are examples that would require actual wallet funding and gas
  console.log('⚠️ CoreWriter tests require funded wallet and gas.');
  console.log('💡 Uncomment the code below to test actual transactions:\n');

  console.log('Example 1: USD Class Transfer (Spot → Perp)');
  console.log(`
// Transfer $10 from Spot to Perp
await coreWriterService.usdClassTransfer({
  ntl: ethers.BigNumber.from("10000000"), // $10 * 10^6
  toPerp: true
});
  `);

  console.log('Example 2: Place Limit Order');
  console.log(`
// Place BTC buy order at $50,000
await coreWriterService.placeLimitOrder({
  asset: 0, // BTC
  isBuy: true,
  limitPx: ethers.BigNumber.from("5000000000000"), // $50,000 * 10^8
  sz: ethers.BigNumber.from("10000000"), // 0.1 BTC * 10^8
  reduceOnly: false,
  tif: TIF.GTC,
  cloid: ethers.BigNumber.from(0)
});
  `);

  console.log('Example 3: Cancel Order');
  console.log(`
// Cancel order by client order ID
await coreWriterService.cancelOrderByCloid(
  0, // BTC asset
  ethers.BigNumber.from("12345") // client order ID
);
  `);

  // Uncomment below to test actual transactions (requires funding)
  /*
  try {
    console.log('🚀 Testing USD Class Transfer...');
    const tx = await coreWriterService.usdClassTransfer({
      ntl: ethers.BigNumber.from("1000000"), // $1 * 10^6
      toPerp: true
    });
    console.log(`✅ Transaction hash: ${tx}`);
  } catch (error) {
    console.error('❌ Error with CoreWriter:', error);
  }
  */
}

async function main() {
  console.log('🚀 HyperLiquid CoreWriter & Precompile Test\n');
  console.log(`📡 RPC URL: ${config.hypercore.rpcUrl}`);
  console.log(`🔑 Wallet: ${new ethers.Wallet(config.hypercore.walletPrivateKey).address}\n`);

  await testPrecompiles();
  await testCoreWriter();

  console.log('✨ Test completed!');
}

main().catch(console.error);
