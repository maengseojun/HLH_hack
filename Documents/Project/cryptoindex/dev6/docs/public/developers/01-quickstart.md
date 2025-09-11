# Quick Start

This guide will help you get started with HyperIndex in under 5 minutes.

## Prerequisites

Before you begin, ensure you have:

- Node.js v16+ installed
- A Web3 wallet (MetaMask recommended)
- Test tokens from the HyperEVM faucet

## Installation

### Using npm

```bash
npm install @hyperindex/sdk ethers
```

### Using yarn

```bash
yarn add @hyperindex/sdk ethers
```

### Using pnpm

```bash
pnpm add @hyperindex/sdk ethers
```

## Basic Setup

### 1. Import and Initialize

```javascript
import { HyperIndexClient } from '@hyperindex/sdk';
import { ethers } from 'ethers';

// Connect to HyperEVM testnet
const provider = new ethers.JsonRpcProvider('https://rpc.testnet.hyperindex.xyz');

// Initialize with your wallet
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Create client instance
const client = new HyperIndexClient({
    signer,
    network: 'testnet' // or 'mainnet' for production
});
```

### 2. Create Your First Index Token

```javascript
async function createIndexToken() {
    try {
        // Define your index composition
        const indexConfig = {
            name: "My Meme Index",
            symbol: "MMI",
            components: [
                { address: "0x...", weight: 40 }, // DOGE 40%
                { address: "0x...", weight: 35 }, // SHIB 35%
                { address: "0x...", weight: 25 }  // PEPE 25%
            ],
            initialSupply: ethers.parseEther("1000000")
        };

        // Deploy the index token
        const result = await client.createIndexToken(indexConfig);
        
        console.log('Index token created!');
        console.log('Token address:', result.tokenAddress);
        console.log('Transaction hash:', result.txHash);
        
        return result.tokenAddress;
    } catch (error) {
        console.error('Error creating index token:', error);
    }
}

const tokenAddress = await createIndexToken();
```

### 3. Add Liquidity to AMM

```javascript
async function addLiquidity(tokenAddress) {
    // Get USDC address for your network
    const USDC = await client.getUSDCAddress();
    
    // Approve tokens
    await client.approve(tokenAddress, ethers.parseEther("1000"));
    await client.approve(USDC, ethers.parseUnits("1000", 6));
    
    // Add liquidity
    const liquidity = await client.addLiquidity({
        tokenA: tokenAddress,
        tokenB: USDC,
        amountA: ethers.parseEther("1000"),
        amountB: ethers.parseUnits("1000", 6),
        fee: 3000 // 0.3% fee tier
    });
    
    console.log('Liquidity added!');
    console.log('LP Token ID:', liquidity.tokenId);
}

await addLiquidity(tokenAddress);
```

## Common Operations

### Swapping Tokens

```javascript
// Swap USDC for Index Token
async function swapTokens() {
    const amountIn = ethers.parseUnits("100", 6); // 100 USDC
    
    const quote = await client.getQuote({
        tokenIn: USDC,
        tokenOut: tokenAddress,
        amountIn
    });
    
    console.log('Expected output:', ethers.formatEther(quote.amountOut));
    console.log('Price impact:', quote.priceImpact, '%');
    
    if (quote.priceImpact < 1) { // Less than 1% impact
        const swap = await client.swap({
            tokenIn: USDC,
            tokenOut: tokenAddress,
            amountIn,
            minAmountOut: quote.amountOut * 0.99n // 1% slippage
        });
        
        console.log('Swap completed:', swap.txHash);
    }
}
```

### Placing Limit Orders

```javascript
// Place a limit buy order
async function placeLimitOrder() {
    const order = await client.placeLimitOrder({
        token: tokenAddress,
        side: 'buy',
        price: ethers.parseEther("10"), // 10 USDC per token
        amount: ethers.parseEther("100"), // 100 tokens
        expiry: Math.floor(Date.now() / 1000) + 86400 // 24 hours
    });
    
    console.log('Order placed:', order.orderId);
    
    // Check order status
    const status = await client.getOrderStatus(order.orderId);
    console.log('Order status:', status);
}
```

### Minting and Redeeming

```javascript
// Mint index tokens with underlying assets
async function mintIndexTokens() {
    // First, approve all component tokens
    const components = await client.getIndexComponents(tokenAddress);
    
    for (const component of components) {
        await client.approve(component.address, component.requiredAmount);
    }
    
    // Mint tokens
    const mint = await client.mintIndexToken({
        tokenAddress,
        amount: ethers.parseEther("100")
    });
    
    console.log('Minted:', ethers.formatEther(mint.amount), 'tokens');
}

// Redeem index tokens for underlying assets
async function redeemIndexTokens() {
    const redeem = await client.redeemIndexToken({
        tokenAddress,
        amount: ethers.parseEther("100")
    });
    
    console.log('Redeemed components:', redeem.components);
}
```

## Using the Intent System

The intent system allows natural language interactions:

```javascript
async function executeIntent() {
    const intent = await client.executeIntent(
        "Create a meme index with 1000 USDC"
    );
    
    console.log('Intent processed!');
    console.log('Actions taken:', intent.actions);
    console.log('Result:', intent.result);
}

// More examples
await client.executeIntent("Buy 100 MMI tokens with USDC");
await client.executeIntent("Add liquidity to MMI/USDC pool");
await client.executeIntent("Rebalance my index token");
```

## WebSocket Subscriptions

Subscribe to real-time updates:

```javascript
// Connect to WebSocket
const ws = client.connectWebSocket();

// Subscribe to price updates
ws.subscribe('price', tokenAddress, (data) => {
    console.log('Price update:', data.price);
});

// Subscribe to orderbook updates
ws.subscribe('orderbook', tokenAddress, (data) => {
    console.log('Best bid:', data.bids[0]);
    console.log('Best ask:', data.asks[0]);
});

// Subscribe to trades
ws.subscribe('trades', tokenAddress, (trade) => {
    console.log('New trade:', trade);
});
```

## Error Handling

Always implement proper error handling:

```javascript
try {
    const result = await client.swap({...});
} catch (error) {
    if (error.code === 'INSUFFICIENT_LIQUIDITY') {
        console.error('Not enough liquidity for this trade');
    } else if (error.code === 'SLIPPAGE_EXCEEDED') {
        console.error('Price moved too much, try increasing slippage');
    } else if (error.code === 'INSUFFICIENT_BALANCE') {
        console.error('Not enough tokens in wallet');
    } else {
        console.error('Unknown error:', error);
    }
}
```

## Testing on Testnet

### Get Test Tokens

```javascript
// Request test tokens from faucet
async function getTestTokens() {
    const faucet = await client.requestFromFaucet({
        address: await signer.getAddress(),
        tokens: ['USDC', 'ETH']
    });
    
    console.log('Test tokens received!');
    console.log('Transaction:', faucet.txHash);
}
```

### Testnet Endpoints

- RPC: `https://rpc.testnet.hyperindex.xyz`
- WebSocket: `wss://ws.testnet.hyperindex.xyz`
- API: `https://api.testnet.hyperindex.xyz`
- Explorer: `https://explorer.testnet.hyperindex.xyz`

## Complete Example

Here's a complete example that creates an index token and adds liquidity:

```javascript
import { HyperIndexClient } from '@hyperindex/sdk';
import { ethers } from 'ethers';

async function main() {
    // Setup
    const provider = new ethers.JsonRpcProvider('https://rpc.testnet.hyperindex.xyz');
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const client = new HyperIndexClient({ signer, network: 'testnet' });
    
    // Create index token
    const index = await client.createIndexToken({
        name: "Test Meme Index",
        symbol: "TMI",
        components: [
            { address: "0x...", weight: 50 },
            { address: "0x...", weight: 50 }
        ],
        initialSupply: ethers.parseEther("1000000")
    });
    
    console.log('Index token created:', index.tokenAddress);
    
    // Add liquidity
    const USDC = await client.getUSDCAddress();
    
    await client.approve(index.tokenAddress, ethers.parseEther("1000"));
    await client.approve(USDC, ethers.parseUnits("1000", 6));
    
    const liquidity = await client.addLiquidity({
        tokenA: index.tokenAddress,
        tokenB: USDC,
        amountA: ethers.parseEther("1000"),
        amountB: ethers.parseUnits("1000", 6),
        fee: 3000
    });
    
    console.log('Liquidity added, LP Token:', liquidity.tokenId);
    
    // Place a limit order
    const order = await client.placeLimitOrder({
        token: index.tokenAddress,
        side: 'buy',
        price: ethers.parseEther("1"),
        amount: ethers.parseEther("100"),
        expiry: Math.floor(Date.now() / 1000) + 86400
    });
    
    console.log('Order placed:', order.orderId);
}

main().catch(console.error);
```

## Next Steps

- Read the [SDK Documentation](./02-sdk.md) for detailed API reference
- Explore [Smart Contract Integration](./04-contract-integration.md)
- Join our [Discord](https://discord.gg/hyperindex) for support
- Check out [example projects](https://github.com/hyperindex/examples)

## Support

If you encounter any issues:

1. Check the [FAQ](../support/faq.md)
2. Search [GitHub Issues](https://github.com/hyperindex/sdk/issues)
3. Ask in [Discord #dev-support](https://discord.gg/hyperindex)
4. Email: dev@hyperindex.xyz
