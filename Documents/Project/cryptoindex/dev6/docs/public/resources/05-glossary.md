# Glossary

## A

### AMM (Automated Market Maker)
A decentralized exchange protocol that uses mathematical formulas to price assets instead of order books. HyperIndex uses UniswapV3-style concentrated liquidity AMMs.

### API (Application Programming Interface)
A set of protocols and tools for building software applications. HyperIndex provides REST and WebSocket APIs for integration.

### APR (Annual Percentage Rate)
The yearly rate of return earned by liquidity providers, not accounting for compounding.

### APY (Annual Percentage Yield)
The yearly rate of return earned by liquidity providers, accounting for compound interest.

### Arbitrage
The practice of profiting from price differences between markets. Arbitrageurs help keep prices consistent across venues.

## B

### Base Token
In a trading pair, the token being bought or sold (e.g., MMI in MMI/USDC).

### Basket Token
A token representing ownership of multiple underlying assets. Index tokens are a type of basket token.

### Bridge
Infrastructure enabling asset transfers between different blockchains. HyperIndex uses LayerZero for bridging.

## C

### Concentrated Liquidity
A liquidity provision model where LPs can concentrate capital within specific price ranges for higher efficiency.

### Cross-Chain
Operations spanning multiple blockchain networks. HyperIndex supports cross-chain trading and transfers.

## D

### DEX (Decentralized Exchange)
An exchange operating without central authority through smart contracts. HyperIndex is a hybrid DEX.

### DeFi (Decentralized Finance)
Financial services built on blockchain technology without traditional intermediaries.

## E

### ERC-20
The standard interface for fungible tokens on Ethereum and EVM-compatible chains. All HyperIndex tokens are ERC-20 compliant.

### EVM (Ethereum Virtual Machine)
The runtime environment for smart contracts. HyperEVM is EVM-compatible.

## F

### Fee Tier
The percentage fee charged on trades. HyperIndex offers multiple fee tiers (0.05%, 0.30%, 1.00%).

### Front-Running
Executing a transaction ahead of a known pending transaction to profit. HyperIndex implements MEV protection against this.

## G

### Gas
The fee required to execute transactions on the blockchain. Measured in gwei on EVM chains.

### Governance Token
A token giving holders voting rights on protocol decisions. HYPER is HyperIndex's governance token.

## H

### HyperEVM
The high-performance blockchain that HyperIndex is built on, offering 4,000+ TPS with EVM compatibility.

### Hybrid DEX
A decentralized exchange combining multiple trading mechanisms. HyperIndex combines AMM pools with off-chain orderbooks.

## I

### Impermanent Loss
The temporary loss experienced by liquidity providers when token prices change compared to simply holding the tokens.

### Index Token
An ERC-20 token representing a weighted basket of underlying assets, automatically rebalancing to maintain target allocations.

### Intent System
Natural language processing system allowing users to execute complex operations with simple commands.

## L

### LayerZero
Cross-chain messaging protocol used by HyperIndex for omnichain operations.

### Limit Order
An order to buy or sell at a specific price or better. Executed when market conditions are met.

### Liquidity
The availability of assets in a market. Higher liquidity means easier trading with less price impact.

### Liquidity Provider (LP)
Users who deposit tokens into pools to facilitate trading and earn fees.

### LP Token/NFT
Token or NFT representing a liquidity position, entitling the holder to their share of the pool plus fees.

## M

### Market Order
An order executed immediately at the best available price.

### MEV (Maximum Extractable Value)
The maximum value extractable from block production beyond standard rewards. HyperIndex protects against MEV exploitation.

### Minting
Creating new tokens. In HyperIndex, index tokens are minted by depositing underlying assets.

## N

### NAV (Net Asset Value)
The total value of assets in an index token divided by the supply, determining the token's fair value.

### Non-Custodial
A system where users maintain control of their assets. HyperIndex never takes custody of user funds.

## O

### Oracle
A service providing external data to smart contracts. HyperIndex uses Chainlink and other oracles for price feeds.

### Order Book
A list of buy and sell orders for an asset. HyperIndex maintains an off-chain orderbook alongside AMM pools.

## P

### Pair
A trading market between two tokens (e.g., MMI/USDC).

### Pool
A smart contract holding reserves of two tokens for AMM trading.

### Price Impact
The effect of a trade on the market price, expressed as a percentage.

## Q

### Quote Token
In a trading pair, the token used for pricing (e.g., USDC in MMI/USDC).

## R

### Rebalancing
Adjusting index token holdings to maintain target weight allocations.

### Redemption
Converting index tokens back into underlying assets.

### Router
Smart contract that finds optimal paths for trades across multiple pools.

## S

### Sandwich Attack
A type of MEV where attackers place orders before and after a target transaction. HyperIndex protects against this.

### Slippage
The difference between expected and executed price due to market movement during transaction processing.

### Smart Contract
Self-executing code on the blockchain that automatically enforces agreement terms.

### Swap
Exchanging one token for another.

## T

### TVL (Total Value Locked)
The total value of assets deposited in a protocol.

### TWAP (Time-Weighted Average Price)
Average price of an asset over a specific time period, used for oracle price feeds.

### Tick
Price points in concentrated liquidity pools where liquidity can be added or removed.

## U

### USDC (USD Coin)
A stablecoin pegged to the US dollar, commonly used as the quote currency in HyperIndex.

## V

### Vault
Smart contract holding and managing user assets. HyperIndex vaults are non-custodial.

### Vectorized Processing
Performance optimization technique using SIMD instructions for parallel processing. Implemented in HyperIndex for 65% latency reduction.

### Volume
The total amount of trading activity in a given period.

## W

### Wallet
Software or hardware for storing and managing cryptocurrency. HyperIndex supports MetaMask, WalletConnect, and others.

### Weight
The percentage allocation of a component in an index token.

### WebSocket
Protocol for real-time bidirectional communication. Used for live price and order updates.

## X

### X96
A fixed-point number format used in UniswapV3 for precise price calculations.

## Y

### Yield
Returns generated from providing liquidity or holding tokens.

## Z

### Zero-Knowledge Proof
Cryptographic method for proving knowledge without revealing the information itself. Used in some HyperIndex privacy features.

---

## Protocol-Specific Terms

### HyperIndex Client
The JavaScript/TypeScript SDK for interacting with HyperIndex protocol.

### Tri-Layered Sharding
HyperIndex's scaling solution dividing operations across transaction, data, and location layers.

### CrossLink Framework
HyperIndex's cross-chain execution system enabling 5-second inter-blockchain operations.

### Intent Solver
The engine that translates natural language commands into blockchain transactions.

### Smart Router
HyperIndex's routing algorithm that finds optimal paths across AMM and orderbook.

### Index Factory
The smart contract responsible for deploying new index tokens.

### Meme Index
An index token tracking popular meme coins like DOGE, SHIB, and PEPE.

## Trading Terms

### Ask
The lowest price a seller is willing to accept.

### Bid
The highest price a buyer is willing to pay.

### Spread
The difference between bid and ask prices.

### Depth
The amount of liquidity available at different price levels.

### Maker
A trader who provides liquidity by placing limit orders.

### Taker
A trader who removes liquidity by filling existing orders.

## Technical Terms

### ABI (Application Binary Interface)
The interface between smart contracts and applications.

### RPC (Remote Procedure Call)
Protocol for requesting services from a remote computer. Used to interact with blockchain nodes.

### IPFS (InterPlanetary File System)
Distributed storage system sometimes used for protocol metadata.

### Gwei
A denomination of ETH used for gas prices (1 gwei = 0.000000001 ETH).

### Nonce
A number used once to prevent replay attacks in transactions.

### Mainnet
The primary production blockchain network.

### Testnet
A test blockchain network for development and testing.
