# 🚀 Hyperliquid Index Platform

> Production-ready ETF-style crypto index token platform with advanced DeFi features

## 📊 Overview

The Hyperliquid Index Platform is a comprehensive DeFi solution for creating, managing, and trading tokenized index funds. Built with security-first architecture and gas optimization in mind.

## ✨ Key Features

### Core Functionality
- **ERC-20 Index Tokens**: Fully compliant tokenized index funds
- **ERC-4626 Vaults**: Standardized yield-bearing vault implementation
- **Multi-DEX Aggregation**: Optimal routing across Uniswap V3, 1inch, and more
- **MEV Protection**: Advanced sandwich attack and front-running prevention
- **Cross-Chain Support**: LayerZero integration for multi-chain operations

### Security Features
- ✅ **AccessControl**: Role-based permission system
- ✅ **ReentrancyGuard**: Protection against reentrancy attacks
- ✅ **Pausable**: Emergency stop mechanism
- ✅ **Upgradeable**: UUPS proxy pattern support
- ✅ **Slippage Protection**: Dynamic slippage calculation

## 🏗️ Architecture

```
contracts/
├── Core/
│   ├── IndexTokenFactory.sol      # Main factory for index tokens
│   ├── IndexToken.sol              # ERC-20 index token implementation
│   └── RedemptionManager.sol      # Token redemption logic
├── Vaults/
│   ├── SmartIndexVault.sol        # ERC-4626 vault
│   └── SmartIndexVaultV2.sol      # Upgradeable vault
├── DEX/
│   ├── MultiDEXAggregator.sol     # Production DEX aggregator
│   └── SmartAggregator.sol        # Basic aggregator
├── Interfaces/
│   ├── dex/
│   │   ├── IUniswapV3.sol
│   │   └── I1inch.sol
│   └── [other interfaces]
└── Libraries/
    └── PrecisionMath.sol
```

## 🔧 Installation

### Prerequisites
- Node.js v18+
- npm or yarn
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/hyperliquid-index-platform.git
cd hyperliquid-index-platform

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Check coverage
npx hardhat coverage
```

## 🧪 Testing

### Test Coverage
- **Unit Tests**: Core functionality testing
- **Integration Tests**: End-to-end scenarios
- **Security Tests**: Vulnerability testing
- **Gas Optimization Tests**: Performance analysis

```bash
# Run all tests
npm test

# Run specific test suites
npx hardhat test test/security/*.test.js
npx hardhat test test/integration/*.test.js
npx hardhat test test/gas/*.test.js

# Generate gas report
REPORT_GAS=true npx hardhat test

# Check contract sizes
npx hardhat size-contracts
```

### Current Test Coverage
- Line Coverage: ~75%
- Branch Coverage: ~65%
- Function Coverage: ~80%

## 🚀 Deployment

### Local Development
```bash
# Start local node
npx hardhat node

# Deploy to local network
npx hardhat run scripts/deploy-complete.js --network localhost
```

### Testnet Deployment
```bash
# Deploy to Sepolia
npx hardhat run scripts/deploy-complete.js --network ethereumSepolia

# Deploy to Hyperliquid Testnet
npx hardhat run scripts/deploy-complete.js --network hyperevm-testnet
```

### Mainnet Deployment
```bash
# Deploy to mainnet (requires proper configuration)
npx hardhat run scripts/deploy-complete.js --network mainnet

# Verify contracts
npx hardhat verify --network mainnet DEPLOYED_CONTRACT_ADDRESS
```

## 📋 Smart Contract APIs

### IndexTokenFactory

```solidity
// Create new index fund
function createIndexFund(
    string memory name,
    string memory symbol,
    ComponentToken[] memory components
) external returns (bytes32 fundId)

// Issue index tokens
function issueIndexToken(
    bytes32 fundId,
    uint256 amount
) external returns (bool)

// Authorize tokens
function authorizeToken(address token) external
```

### SmartIndexVault (ERC-4626)

```solidity
// Deposit assets for shares
function deposit(uint256 assets, address receiver) 
    external returns (uint256 shares)

// Withdraw assets by burning shares
function withdraw(uint256 assets, address receiver, address owner) 
    external returns (uint256 shares)

// Preview functions
function previewDeposit(uint256 assets) external view returns (uint256)
function previewWithdraw(uint256 assets) external view returns (uint256)
```

### MultiDEXAggregator

```solidity
// Find optimal swap route
function findOptimalRoute(
    address tokenIn,
    address tokenOut,
    uint256 amountIn
) external view returns (DEXType bestDEX, uint256 expectedOut)

// Execute optimized swap
function executeSwap(SwapRequest memory request) 
    external returns (SwapResult memory)
```

## 🔒 Security

### Audit Status
- [x] Internal security review completed
- [x] Slither static analysis passed
- [ ] External audit (pending)
- [ ] Bug bounty program (planned)

### Security Best Practices
- All external calls use `nonReentrant` modifier
- Critical functions have `onlyRole` access control
- Emergency pause functionality implemented
- Comprehensive input validation
- Safe math operations (Solidity 0.8+)

## ⚡ Gas Optimization

### Optimization Techniques
- Struct packing for storage efficiency
- Batch operations support
- Optimized loops with cached lengths
- Minimal storage operations
- Event emission optimization

### Gas Costs (Approximate)
- Create Index Fund: ~250,000 gas
- Token Issuance: ~150,000 gas
- Vault Deposit: ~120,000 gas
- DEX Swap: ~180,000 gas

## 🛠️ Development Tools

### Static Analysis
```bash
# Run Slither
slither . --print human-summary

# Run Mythril
myth analyze contracts/*.sol
```

### Documentation
```bash
# Generate documentation
npx hardhat docgen
```

## 📚 Resources

### Documentation
- [Technical Documentation](./docs/technical.md)
- [API Reference](./docs/api.md)
- [Security Review](./SECURITY_REVIEW_REPORT.md)

### External Links
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [ERC-4626 Standard](https://eips.ethereum.org/EIPS/eip-4626)
- [Uniswap V3 Docs](https://docs.uniswap.org/contracts/v3/overview)
- [1inch API](https://docs.1inch.io/docs/aggregation-protocol/introduction)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details.

### Development Process
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- OpenZeppelin for secure contract libraries
- Hardhat team for the development framework
- Ethereum community for continuous innovation

## 📞 Contact

- **Team**: Crypto Index Platform Team
- **Email**: team@cryptoindex.platform
- **Discord**: [Join our server](https://discord.gg/cryptoindex)
- **Twitter**: [@CryptoIndexPlatform](https://twitter.com/cryptoindexplatform)

---

**⚠️ Disclaimer**: This software is provided "as is", without warranty of any kind. Use at your own risk. Always conduct proper audits before mainnet deployment.
