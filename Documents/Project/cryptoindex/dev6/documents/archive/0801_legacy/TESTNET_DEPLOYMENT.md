# 🚀 HyperEVM Testnet Deployment Guide

This guide walks you through deploying the HyperIndex AMM system to HyperEVM testnet.

## Prerequisites

### 1. Set up Testnet Wallet
- Create a new MetaMask wallet (or use a dedicated testnet wallet)
- **⚠️ NEVER use your mainnet wallet private key!**
- Export the private key for deployment

### 2. Add HyperEVM Testnet to MetaMask
```
Network Name: HyperEVM Testnet
RPC URL: https://api.hyperliquid-testnet.xyz/evm
Chain ID: 998
Currency Symbol: HYPE
Block Explorer: https://explorer.hyperliquid-testnet.xyz
```

### 3. Get Testnet HYPE
- Visit: https://faucet.hyperliquid-testnet.xyz
- Request testnet HYPE tokens
- You need at least 0.1 HYPE for deployment

## Deployment Steps

### Step 1: Environment Setup
1. Copy the example environment file:
```bash
cp .env.testnet.example .env.local
```

2. Fill in your private key in `.env.local`:
```bash
PRIVATE_KEY=your_testnet_private_key_here
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Deploy to Testnet
```bash
npx hardhat run scripts/deploy-testnet.js --network hypervm-testnet
```

### Step 4: Verify Deployment
The script will output:
- Contract addresses
- Explorer links
- Environment variables to add to `.env.local`

Example output:
```
🎉 Deployment Completed Successfully!
================================================
📝 Next Steps:
1. Update your .env.local with the contract addresses above
2. Get testnet tokens from the faucet
3. Test the AMM functionality
4. Start the Next.js app and connect your wallet

🔗 Useful Links:
- Explorer: https://explorer.hyperliquid-testnet.xyz/address/0x...
- HYPERINDEX Token: https://explorer.hyperliquid-testnet.xyz/address/0x...
- Liquidity Pool: https://explorer.hyperliquid-testnet.xyz/address/0x...
```

### Step 5: Update Environment Variables
Add the generated contract addresses to your `.env.local`:
```bash
NEXT_PUBLIC_HYPERINDEX_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_USDC_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_AMM_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_AMM_ROUTER_ADDRESS=0x...
NEXT_PUBLIC_HYPERINDEX_USDC_PAIR=0x...
```

## What Gets Deployed

### 1. HYPERINDEX Token
- **Supply**: 100M tokens
- **Decimals**: 18
- **Symbol**: HYPERINDEX

### 2. Mock USDC Token
- **Supply**: 100M tokens (mintable)
- **Decimals**: 6 (like real USDC)
- **Features**: Built-in faucet function

### 3. AMM Factory
- Creates and manages liquidity pairs
- Fee collection mechanism

### 4. AMM Router
- Handles swaps and liquidity operations
- Price calculation and slippage protection

### 5. Initial Liquidity Pool
- **Pair**: HYPERINDEX-USDC
- **Initial Liquidity**: 1M HYPERINDEX + 1M USDC
- **Starting Price**: 1 HYPERINDEX = 1 USDC

## Testing the Deployment

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Connect Wallet
- Open http://localhost:3000
- Connect your testnet wallet
- Switch to HyperEVM Testnet

### 3. Get Testnet Tokens
```javascript
// Call the USDC faucet
const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
await usdcContract.faucet(); // Get 10,000 USDC
```

### 4. Test AMM Functions
- Add liquidity
- Swap tokens
- Remove liquidity
- Check transaction on explorer

## Troubleshooting

### Common Issues

#### 1. "Insufficient funds for gas"
- **Solution**: Get more testnet HYPE from the faucet
- **Minimum**: 0.1 HYPE for deployment

#### 2. "Network connection error"
- **Solution**: Check RPC URL and internet connection
- **Alternative RPC**: Try backup RPC if available

#### 3. "Contract verification failed"
- **Solution**: This is normal for testnet, contracts still work
- **Note**: Verification on testnet explorers may not always work

#### 4. "Transaction reverted"
- **Solution**: Check gas limits and contract state
- **Debug**: Use hardhat console for debugging

### Getting Help

1. **Check Explorer**: Verify transactions on https://explorer.hyperliquid-testnet.xyz
2. **Console Logs**: Check browser console for error messages
3. **Hardhat Console**: Use `npx hardhat console --network hypervm-testnet`

## Next Steps

After successful deployment:

1. **Frontend Integration**: Update UI to use real contracts
2. **Wallet Integration**: Test with MetaMask/WalletConnect
3. **Trading System**: Connect off-chain orderbook with on-chain AMM
4. **Monitoring**: Set up transaction indexing and monitoring
5. **Testing**: Comprehensive testing of all features

## Security Notes

- ⚠️ **Testnet Only**: These contracts are for testing only
- ⚠️ **Private Keys**: Never commit private keys to git
- ⚠️ **Testnet Tokens**: Have no real value
- ⚠️ **Reset Warning**: Testnet may reset, redeploy if needed

## Contract Verification (Optional)

If you want to verify contracts on the explorer:

```bash
npx hardhat verify --network hypervm-testnet DEPLOYED_CONTRACT_ADDRESS
```

Note: Verification may not work on all testnet explorers.