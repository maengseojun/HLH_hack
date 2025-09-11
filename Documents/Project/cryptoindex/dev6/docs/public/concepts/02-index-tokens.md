# Index Tokens

## Introduction

Index tokens are ERC-20 compliant tokens that represent a basket of underlying assets, specifically designed for tracking meme coin portfolios. Each index token provides exposure to multiple assets through a single, tradeable token.

## Token Standard

### ERC-20 Compliance

All index tokens implement the standard ERC-20 interface:

```solidity
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}
```

### Extended Functionality

Index tokens include additional features specific to index management:

```solidity
interface IIndexToken is IERC20 {
    // Index composition
    function getComponents() external view returns (address[] memory);
    function getWeights() external view returns (uint256[] memory);
    
    // Minting and redemption
    function mint(address to, uint256 amount) external;
    function redeem(address from, uint256 amount) external;
    
    // Rebalancing
    function rebalance() external;
    function lastRebalanceTime() external view returns (uint256);
}
```

## Token Creation Process

### 1. Deployment

Index tokens are created through the IndexTokenFactory contract:

```javascript
const tx = await factory.createIndexToken({
    name: "Meme Coin Index",
    symbol: "MEME",
    components: [DOGE, SHIB, PEPE],
    weights: [40, 35, 25], // Percentage weights
    initialSupply: ethers.parseEther("1000000")
});
```

### 2. Initial Configuration

Upon deployment, the following configurations are set:

- **Name & Symbol**: Token identification
- **Components**: Underlying assets tracked
- **Weights**: Target allocation percentages
- **Decimals**: Standard 18 decimals
- **Initial Supply**: Minted to deployer

### 3. AMM Pool Creation

Automatically creates a liquidity pool for immediate trading:

```javascript
await router.createPool({
    tokenA: indexToken.address,
    tokenB: USDC.address,
    fee: 3000, // 0.3% fee tier
    sqrtPriceX96: encodePriceSqrt(1, 1)
});
```

## Composition Management

### Component Selection

Index tokens can track various meme coins:

| Component | Symbol | Weight Range | Oracle Source |
|-----------|--------|--------------|---------------|
| Dogecoin | DOGE | 20-50% | Chainlink |
| Shiba Inu | SHIB | 15-40% | Chainlink |
| Pepe | PEPE | 10-30% | Chainlink |
| Floki | FLOKI | 5-20% | Chainlink |
| Bonk | BONK | 5-15% | Pyth |

### Weight Calculation

Weights are calculated based on:

1. **Market Capitalization**: Primary factor (60% influence)
2. **Trading Volume**: Secondary factor (30% influence)
3. **Community Metrics**: Tertiary factor (10% influence)

```javascript
function calculateWeight(component) {
    const marketCapWeight = component.marketCap / totalMarketCap * 0.6;
    const volumeWeight = component.volume / totalVolume * 0.3;
    const communityWeight = component.communityScore / totalScore * 0.1;
    
    return marketCapWeight + volumeWeight + communityWeight;
}
```

## Minting and Redemption

### Minting Process

Users can mint new index tokens by depositing the underlying assets:

```javascript
// Approve component tokens
await DOGE.approve(indexToken.address, dogeAmount);
await SHIB.approve(indexToken.address, shibAmount);
await PEPE.approve(indexToken.address, pepeAmount);

// Mint index tokens
await indexToken.mint(userAddress, indexAmount);
```

### Redemption Process

Index tokens can be redeemed for the underlying assets:

```javascript
// Redeem index tokens for components
await indexToken.redeem(indexAmount);
// User receives proportional amounts of DOGE, SHIB, PEPE
```

### Redemption Fees

| Redemption Amount | Fee Percentage |
|------------------|----------------|
| < 100 tokens | 1.0% |
| 100-1,000 tokens | 0.5% |
| 1,000-10,000 tokens | 0.3% |
| > 10,000 tokens | 0.1% |

## Rebalancing Mechanism

### Automatic Rebalancing

Index tokens automatically rebalance to maintain target weights:

```javascript
// Rebalancing triggered when:
// 1. Weight deviation > 5% from target
// 2. Time since last rebalance > 24 hours
// 3. Manual trigger by governance

if (shouldRebalance()) {
    await indexToken.rebalance();
}
```

### Rebalancing Strategy

1. **Calculate Current Weights**: Fetch current component values
2. **Determine Trades**: Calculate required buys/sells
3. **Execute Atomically**: Perform all trades in single transaction
4. **Update Weights**: Store new weights on-chain

## Price Calculation

### Net Asset Value (NAV)

The index token price is determined by the total value of underlying assets:

```javascript
function calculateNAV() {
    let totalValue = 0;
    
    for (let i = 0; i < components.length; i++) {
        const componentPrice = await oracle.getPrice(components[i]);
        const componentAmount = await getComponentBalance(components[i]);
        totalValue += componentPrice * componentAmount;
    }
    
    return totalValue / totalSupply;
}
```

### Price Feeds

Price data is sourced from multiple oracles:

- **Primary**: Chainlink price feeds
- **Secondary**: Pyth Network
- **Fallback**: TWAP from AMM pools

## Trading

### AMM Trading

Index tokens can be traded on AMM pools:

```javascript
// Swap USDC for Index Token
await router.swapExactTokensForTokens(
    usdcAmount,
    minIndexTokens,
    [USDC.address, indexToken.address],
    userAddress,
    deadline
);
```

### Orderbook Trading

Advanced traders can use limit orders:

```javascript
// Place limit order
await orderbook.placeLimitOrder({
    token: indexToken.address,
    side: "buy",
    price: ethers.parseEther("10"),
    amount: ethers.parseEther("100"),
    expiry: timestamp + 86400
});
```

## Security Considerations

### Supply Controls

- **Maximum Supply**: Capped at creation
- **Minting Restrictions**: Only through collateralization
- **Burn Mechanism**: Deflationary during redemption

### Access Control

- **Admin Functions**: Multi-sig protected
- **Pause Mechanism**: Emergency circuit breaker
- **Upgrade Path**: Time-locked and governance approved

## Integration Examples

### Web3 Integration

```javascript
import { IndexToken } from '@hyperindex/sdk';

const indexToken = new IndexToken(tokenAddress, signer);

// Get token information
const name = await indexToken.name();
const symbol = await indexToken.symbol();
const components = await indexToken.getComponents();

// Perform operations
await indexToken.mint(amount);
await indexToken.redeem(amount);
await indexToken.transfer(recipient, amount);
```

### Smart Contract Integration

```solidity
import "@hyperindex/contracts/interfaces/IIndexToken.sol";

contract MyDeFiProtocol {
    IIndexToken public indexToken;
    
    function depositIndex(uint256 amount) external {
        indexToken.transferFrom(msg.sender, address(this), amount);
        // Additional logic
    }
    
    function withdrawIndex(uint256 amount) external {
        indexToken.transfer(msg.sender, amount);
        // Additional logic
    }
}
```

## Conclusion

Index tokens provide a simple, efficient way to gain exposure to diversified meme coin portfolios. Through the combination of ERC-20 compliance, automated rebalancing, and hybrid trading mechanisms, they offer both accessibility for retail users and sophistication for institutional traders.
