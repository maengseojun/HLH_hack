# Frequently Asked Questions

## General

### What is HyperIndex?

HyperIndex is a hybrid decentralized exchange protocol on HyperEVM that combines automated market making (AMM) with off-chain orderbook technology to enable efficient trading of meme coin index tokens.

### What makes HyperIndex different from other DEXs?

HyperIndex uniquely combines:
- **Hybrid Trading**: Both AMM pools and orderbook for optimal execution
- **Index Tokens**: Native support for basket tokens tracking multiple assets
- **Performance**: 4,000+ TPS through 2025 research implementations
- **Cross-Chain**: Native LayerZero integration for omnichain operations

### Is HyperIndex decentralized?

Yes, HyperIndex is fully non-custodial. Users maintain control of their assets at all times through smart contracts. The protocol cannot access or freeze user funds.

### What blockchain does HyperIndex run on?

HyperIndex is built on HyperEVM, a high-performance EVM-compatible blockchain. We also support cross-chain operations to Ethereum, BSC, Polygon, and Arbitrum through LayerZero.

## Index Tokens

### What are index tokens?

Index tokens are ERC-20 tokens that represent a basket of underlying assets. For example, a Meme Index token might track DOGE (40%), SHIB (35%), and PEPE (25%).

### How are index tokens created?

Index tokens are created through our factory contract. You specify:
- Token name and symbol
- Component tokens and their weights
- Initial supply

The protocol automatically deploys the token and creates an AMM pool.

### Can I create my own index?

Yes, anyone can create custom index tokens through our interface or directly via smart contracts. There's a small creation fee to prevent spam.

### How often do indices rebalance?

Indices rebalance when:
- Weight deviation exceeds 5% from target
- 24 hours have passed since last rebalance
- Manual trigger by token creator or governance

### What are the fees for index tokens?

- **Creation**: 0.1 ETH one-time fee
- **Minting**: 0.1% of minted value
- **Redemption**: 0.1-1% based on amount
- **Trading**: Standard AMM/orderbook fees apply

## Trading

### How do I trade on HyperIndex?

1. Connect your wallet
2. Select the tokens to swap
3. Enter the amount
4. Review the quote and price impact
5. Confirm the transaction

The protocol automatically routes through AMM pools or orderbook for best execution.

### What are the trading fees?

- **AMM Pools**: 0.05%, 0.30%, or 1.00% depending on pair
- **Orderbook**: 0.10% maker, 0.15% taker
- **Cross-chain**: Additional bridge fees apply

### What is slippage?

Slippage is the difference between expected and executed price due to market movement. You can set slippage tolerance in settings (default 0.5%).

### Can I place limit orders?

Yes, HyperIndex supports limit orders through the off-chain orderbook. Set your price and amount, and the order executes when market conditions are met.

### What is MEV protection?

MEV (Maximum Extractable Value) protection prevents sandwich attacks and front-running through:
- Commit-reveal order submission
- Private mempool
- Fair sequencing

## Liquidity Provision

### How do I provide liquidity?

1. Select a pool or create new one
2. Choose your price range (for concentrated liquidity)
3. Deposit equal value of both tokens
4. Receive LP NFT representing your position

### What are the risks of providing liquidity?

- **Impermanent Loss**: Value change vs holding tokens directly
- **Price Range**: Concentrated liquidity only earns fees when price is in range
- **Smart Contract Risk**: Potential bugs or exploits

### How are LP rewards calculated?

Rewards depend on:
- Your share of the pool
- Trading volume
- Fee tier
- Price range efficiency

### Can I remove liquidity anytime?

Yes, liquidity can be removed at any time by burning your LP position. You receive your share of the pool plus accumulated fees.

## Cross-Chain

### Which chains are supported?

- HyperEVM (native)
- Ethereum
- Binance Smart Chain
- Polygon
- Arbitrum
- Optimism (coming soon)

### How long do cross-chain transfers take?

- **HyperEVM ↔ Ethereum**: 2-5 minutes
- **HyperEVM ↔ BSC**: 1-3 minutes
- **HyperEVM ↔ Polygon**: 1-2 minutes
- **HyperEVM ↔ Arbitrum**: 30-60 seconds

### What are bridge fees?

Bridge fees vary by chain and amount:
- Base fee: $5-20
- Percentage fee: 0.1-0.5%
- Gas fees on destination chain

### Is bridging safe?

Yes, we use LayerZero's battle-tested infrastructure with:
- Oracle and relayer validation
- Multi-sig security
- Proof of reserves

## Security

### Has HyperIndex been audited?

Yes, by multiple firms:
- CertiK
- Quantstamp
- Trail of Bits

All audit reports are publicly available.

### What happens if there's a bug?

We have multiple safeguards:
- Bug bounty program (up to $100k)
- Emergency pause mechanism
- Insurance fund
- Time-locked upgrades

### How are my funds protected?

- **Non-custodial**: You control your keys
- **Audited contracts**: Multiple security reviews
- **Open source**: Publicly verifiable code
- **Multi-sig admin**: No single point of failure

### What is the emergency pause?

In case of critical issues, authorized guardians can pause protocol functions. This prevents deposits/trades but always allows withdrawals.

## Technical

### What wallets are supported?

- MetaMask
- WalletConnect
- Coinbase Wallet
- Rainbow
- Embedded wallets (via Privy)

### What are the system requirements?

- Modern browser (Chrome, Firefox, Safari, Edge)
- Web3 wallet installed
- JavaScript enabled

### Is there an API?

Yes, we provide:
- REST API for market data and trading
- WebSocket for real-time updates
- Smart contract ABIs for direct integration

### Where can I find developer documentation?

- [Developer Docs](../developers/01-quickstart.md)
- [API Reference](../developers/03-api-reference.md)
- [GitHub](https://github.com/hyperindex)

## Governance

### How does governance work?

Token holders can:
- Propose protocol changes
- Vote on proposals
- Manage treasury
- Set protocol parameters

### What can governance control?

- Fee structures
- New asset listings
- Protocol upgrades
- Treasury allocation
- Emergency actions

### How do I participate in governance?

1. Hold HYPER governance tokens
2. Delegate voting power (self-delegation allowed)
3. Vote on active proposals
4. Create proposals (with sufficient tokens)

## Troubleshooting

### Transaction failed

Common causes:
- Insufficient gas
- Slippage too low
- Token approval needed
- Network congestion

Try increasing gas and slippage settings.

### Can't connect wallet

- Check network (should be HyperEVM)
- Clear browser cache
- Try different browser
- Update wallet extension

### Price impact too high

Large trades relative to liquidity cause high impact. Try:
- Reducing trade size
- Using limit orders
- Waiting for more liquidity

### Order not executing

Limit orders execute when:
- Market price reaches your limit
- Sufficient liquidity available
- Order hasn't expired

Check order status in the orders tab.

## Support

### How do I get help?

- Discord: [discord.gg/hyperindex](https://discord.gg/hyperindex)
- Telegram: [t.me/hyperindex](https://t.me/hyperindex)
- Email: support@hyperindex.xyz
- GitHub Issues: For technical problems

### How do I report a bug?

- **Critical**: security@hyperindex.xyz
- **Non-critical**: GitHub issues
- **Feature requests**: Discord #suggestions

### Where can I learn more?

- [Documentation](../README.md)
- [Blog](https://blog.hyperindex.xyz)
- [YouTube](https://youtube.com/@hyperindex)
- [Twitter](https://twitter.com/hyperindex)

## Fees Summary

| Operation | Fee |
|-----------|-----|
| Index Creation | 0.1 ETH |
| Index Minting | 0.1% |
| Index Redemption | 0.1-1% |
| AMM Swap | 0.05-1% |
| Orderbook Trade | 0.1-0.15% |
| Cross-chain Transfer | 0.1-0.5% + gas |
| Liquidity Add/Remove | 0% |

## Network Information

### Mainnet
- Chain ID: 998
- RPC: https://rpc.hyperindex.xyz
- Explorer: https://explorer.hyperindex.xyz

### Testnet
- Chain ID: 997
- RPC: https://rpc.testnet.hyperindex.xyz
- Explorer: https://explorer.testnet.hyperindex.xyz
- Faucet: https://faucet.testnet.hyperindex.xyz
