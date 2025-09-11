# Smart Contracts Overview

## Architecture

HyperIndex protocol consists of modular, upgradeable smart contracts deployed on HyperEVM. The architecture follows best practices for security, gas efficiency, and maintainability.

## Core Contracts

### Index Token Factory

**Address**: `0x1234...5678` (Mainnet) | `0xabcd...efgh` (Testnet)

The factory contract responsible for deploying new index tokens.

```solidity
interface IIndexTokenFactory {
    function createIndexToken(
        string memory name,
        string memory symbol,
        address[] memory components,
        uint256[] memory weights,
        uint256 initialSupply
    ) external returns (address);
    
    function getIndexToken(uint256 tokenId) external view returns (address);
    function getAllIndexTokens() external view returns (address[] memory);
}
```

### Index Token

**Implementation**: OpenZeppelin ERC20 with custom extensions

Each index token is a separate contract implementing:

```solidity
interface IIndexToken is IERC20 {
    // Composition management
    function getComponents() external view returns (address[] memory);
    function getWeights() external view returns (uint256[] memory);
    function updateWeights(uint256[] memory newWeights) external;
    
    // Minting and redemption
    function mint(address to, uint256 amount) external;
    function redeem(address from, uint256 amount) external;
    
    // Rebalancing
    function rebalance() external;
    function canRebalance() external view returns (bool);
    
    // Price oracle
    function getNAV() external view returns (uint256);
}
```

### AMM Router

**Address**: `0x2345...6789` (Mainnet) | `0xbcde...fghi` (Testnet)

Handles routing for optimal trade execution across AMM pools.

```solidity
interface IAMMRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);
    
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);
}
```

### AMM Pair

UniswapV3-style concentrated liquidity pools.

```solidity
interface IAMMPair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
    
    function mint(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount,
        bytes calldata data
    ) external returns (uint256 amount0, uint256 amount1);
    
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
}
```

### Smart Vault

**Address**: `0x3456...789a` (Mainnet) | `0xcdef...ghij` (Testnet)

Non-custodial vault for asset management.

```solidity
interface ISmartVault {
    function deposit(address token, uint256 amount) external;
    function withdraw(address token, uint256 amount) external;
    function getBalance(address user, address token) external view returns (uint256);
    
    // Strategy execution
    function executeStrategy(bytes calldata strategyData) external;
    function emergencyWithdraw() external;
}
```

### Oracle Manager

**Address**: `0x4567...89ab` (Mainnet) | `0xdefg...hijk` (Testnet)

Aggregates price feeds from multiple sources.

```solidity
interface IOracleManager {
    function getPrice(address token) external view returns (uint256);
    function getPrices(address[] memory tokens) external view returns (uint256[] memory);
    function updatePrice(address token, uint256 price) external;
    
    // Oracle sources
    function addOracle(address oracle, uint256 weight) external;
    function removeOracle(address oracle) external;
}
```

## Deployment Addresses

### Mainnet (Chain ID: 998)

| Contract | Address | Version |
|----------|---------|---------|
| IndexTokenFactory | `0x1234...5678` | v1.2.0 |
| AMMRouter | `0x2345...6789` | v1.2.0 |
| SmartVault | `0x3456...789a` | v1.1.0 |
| OracleManager | `0x4567...89ab` | v1.0.0 |
| SecurityManager | `0x5678...9abc` | v1.0.0 |
| USDC | `0x6789...abcd` | - |

### Testnet (Chain ID: 997)

| Contract | Address | Version |
|----------|---------|---------|
| IndexTokenFactory | `0xabcd...efgh` | v1.2.0 |
| AMMRouter | `0xbcde...fghi` | v1.2.0 |
| SmartVault | `0xcdef...ghij` | v1.1.0 |
| OracleManager | `0xdefg...hijk` | v1.0.0 |
| SecurityManager | `0xefgh...ijkl` | v1.0.0 |
| USDC | `0xfghi...jklm` | - |

## Security Features

### Access Control

All admin functions use OpenZeppelin's AccessControl:

```solidity
bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
```

### Pausability

Critical functions can be paused in emergencies:

```solidity
modifier whenNotPaused() {
    require(!paused(), "Contract is paused");
    _;
}
```

### Reentrancy Protection

All external calls use OpenZeppelin's ReentrancyGuard:

```solidity
modifier nonReentrant() {
    require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
    _status = _ENTERED;
    _;
    _status = _NOT_ENTERED;
}
```

### Time Locks

Administrative actions have mandatory time delays:

```solidity
uint256 public constant TIMELOCK_DURATION = 48 hours;

function scheduleUpgrade(address newImplementation) external onlyAdmin {
    upgradeTimestamp = block.timestamp + TIMELOCK_DURATION;
    pendingImplementation = newImplementation;
}
```

## Gas Optimization

### Batch Operations

Support for batch transactions to save gas:

```solidity
function batchSwap(SwapData[] calldata swaps) external {
    for (uint256 i = 0; i < swaps.length; i++) {
        _executeSwap(swaps[i]);
    }
}
```

### Storage Optimization

Efficient packing of storage variables:

```solidity
struct TokenInfo {
    address tokenAddress;    // 20 bytes
    uint96 weight;          // 12 bytes - fits in single slot
}
```

### Assembly Optimizations

Critical paths use inline assembly:

```solidity
function _efficientTransfer(address token, address to, uint256 amount) private {
    assembly {
        let success := call(gas(), token, 0, 0, 0x44, 0, 0)
        if iszero(success) { revert(0, 0) }
    }
}
```

## Upgrade Pattern

### Proxy Implementation

Uses OpenZeppelin's TransparentUpgradeableProxy:

```solidity
contract IndexTokenFactoryV2 is IndexTokenFactoryV1 {
    // New functionality
    function newFeature() external {
        // Implementation
    }
    
    // Storage gap for future upgrades
    uint256[50] private __gap;
}
```

### Upgrade Process

1. Deploy new implementation
2. Schedule upgrade with timelock
3. Wait for timelock duration
4. Execute upgrade
5. Verify new functionality

## Events

### Core Events

```solidity
event IndexTokenCreated(address indexed token, address indexed creator);
event Swap(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
event LiquidityAdded(address indexed provider, uint256 amount0, uint256 amount1);
event Rebalance(address indexed token, uint256 timestamp);
```

## Integration Examples

### Creating an Index Token

```javascript
const factory = await ethers.getContractAt('IIndexTokenFactory', FACTORY_ADDRESS);

const tx = await factory.createIndexToken(
    "Meme Index",
    "MEME",
    [DOGE_ADDRESS, SHIB_ADDRESS],
    [50, 50],
    ethers.parseEther("1000000")
);

const receipt = await tx.wait();
const tokenAddress = receipt.events[0].args.token;
```

### Swapping Tokens

```javascript
const router = await ethers.getContractAt('IAMMRouter', ROUTER_ADDRESS);

await router.swapExactTokensForTokens(
    ethers.parseUnits("100", 6), // 100 USDC
    ethers.parseEther("9"),       // Min 9 index tokens
    [USDC_ADDRESS, INDEX_TOKEN_ADDRESS],
    userAddress,
    Math.floor(Date.now() / 1000) + 3600
);
```

## Audits

All contracts have been audited by:

- **CertiK**: [View Report](https://github.com/hyperindex/audits/certik.pdf)
- **Quantstamp**: [View Report](https://github.com/hyperindex/audits/quantstamp.pdf)
- **Trail of Bits**: [View Report](https://github.com/hyperindex/audits/trail-of-bits.pdf)

## Bug Bounty

We maintain an active bug bounty program:

- **Critical**: Up to $100,000
- **High**: Up to $25,000
- **Medium**: Up to $5,000
- **Low**: Up to $1,000

Report vulnerabilities to: security@hyperindex.xyz

## License

All smart contracts are open source under MIT License.

Source code: [github.com/hyperindex/contracts](https://github.com/hyperindex/contracts)
