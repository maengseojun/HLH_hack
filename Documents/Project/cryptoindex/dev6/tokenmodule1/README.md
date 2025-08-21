# Token Module v1.0

## Overview
Hyperliquid-native index token factory for creating and managing tokenized crypto index funds with real asset custody.

## Key Features
- **Real Asset Custody**: Institutions deposit actual tokens as collateral
- **HyperEVM + HyperCore Architecture**: Dual environment support
- **ERC-20 Standard**: With HyperCore expansion capability
- **USDC-based NAV**: Real-time calculation
- **Hyperliquid Price Feed**: Instant price updates via precompile
- **Permission-based Recipe Creation**: Authorized institutions only

## Smart Contracts

### Core Contracts
- `IndexTokenFactory.sol` - Main factory contract for custody and token issuance
- `IndexToken.sol` - Individual ERC-20 index token contracts
- `MockERC20.sol` - Test token for development

### Interfaces
- `IIndexTokenFactory.sol` - Factory interface
- `IIndexToken.sol` - Index token interface
- `IL1Read.sol` - Hyperliquid precompile interface

## Architecture Flow

1. **Recipe Creation**: Authorized institutions create index fund recipes
2. **Asset Deposit**: Institutions deposit real tokens to factory contract
3. **Token Issuance**: Platform admin issues ERC-20 index tokens
4. **NAV Calculation**: Real-time USDC-based valuation using Hyperliquid prices
5. **Fee Management**: Automated annual management fee collection

## Key Functions

### IndexTokenFactory.sol
- `createIndexFund()` - Create new index fund recipe (RECIPE_CREATOR_ROLE)
- `depositComponentTokens()` - Deposit real assets as collateral
- `issueIndexToken()` - Issue ERC-20 tokens (PLATFORM_ADMIN_ROLE)
- `calculateNAV()` - Real-time NAV calculation in USDC
- `collectManagementFee()` - Automated fee collection

## Security Features
- Role-based access control (OpenZeppelin AccessControl)
- Reentrancy protection
- Safe token transfers
- Minimum fund value requirements
- Asset authorization whitelist

## Configuration
- Annual Management Fee: 0.5%
- Issuance Fee: 0.1%
- Maximum Components: 10 per fund
- Minimum Fund Value: 1,000 USDC

## Deployment
1. Deploy IndexTokenFactory with fee recipient address
2. Grant RECIPE_CREATOR_ROLE to authorized institutions
3. Authorize component tokens for use in funds
4. Configure fee parameters as needed

## Testing
```bash
npm test
```

## License
MIT