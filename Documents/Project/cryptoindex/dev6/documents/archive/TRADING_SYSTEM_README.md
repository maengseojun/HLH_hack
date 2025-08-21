# 🚀 Trading System v1 - Documentation

## Overview

The Trading System v1 provides a complete infrastructure for trading index tokens on Hyperliquid network. It integrates with the existing tokenmodule1 to enable real-time trading of index tokens.

## Architecture

```
┌─────────────────┐    ┌──────────────────────┐
│   Frontend UI   │ -> │  Trading API Gateway │
└─────────────────┘    └──────────────────────┘
                                   │
           ┌────────────────────────┼────────────────────────┐
           │                        │                        │
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────┐
│ Order Manager   │    │  Portfolio Manager  │    │  Market Data    │
│ - Order CRUD    │    │  - Balance tracking │    │  - Price feeds  │
│ - Status updates│    │  - P&L calculation  │    │  - Order books  │
└─────────────────┘    └─────────────────────┘    └─────────────────┘
           │                        │                        │
           └────────────────────────┼────────────────────────┘
                                   │
                     ┌─────────────────────┐
                     │  HyperCore Interface │
                     │  - Order execution  │
                     │  - Balance queries  │
                     └─────────────────────┘
                                   │
                        [Hyperliquid Network]
```

## Features

### ✅ Core Features Implemented
- **Order Management**: Market and limit orders
- **Portfolio Tracking**: Real-time positions and P&L
- **Balance Management**: Multi-token balance tracking
- **Market Data**: Price feeds, order books, trading history
- **Security**: Row-level security and authentication
- **Database**: Comprehensive trading schema

### 🔄 Order Flow
1. User creates order via API
2. System validates balance/position
3. Order submitted to HyperCore precompile
4. Real-time order status monitoring
5. Position and balance updates on fill

### 📊 Portfolio Features
- Real-time P&L calculation
- 24h performance tracking
- Asset allocation percentages
- Historical portfolio snapshots

## API Endpoints

### Orders
```typescript
// Create order
POST /api/trading/v1/orders
{
  "tokenAddress": "0x1234...",
  "type": "market",
  "side": "buy", 
  "amount": "10.5"
}

// List orders
GET /api/trading/v1/orders?status=pending&limit=50

// Cancel order
DELETE /api/trading/v1/orders/:orderId
```

### Portfolio
```typescript
// Get portfolio
GET /api/trading/v1/portfolio?includeBalances=true

// Get balances
GET /api/trading/v1/balance?tokenAddress=0x1234...
```

### Market Data
```typescript
// All markets
GET /api/trading/v1/markets

// Specific token
GET /api/trading/v1/markets/MEME_INDEX?includeOrderBook=true
```

## Database Schema

### Key Tables
- **trading_orders**: All user orders
- **trading_positions**: Current positions by user/token
- **user_balances**: Cached token balances
- **market_data_history**: Price history for 24h calculations
- **trade_history**: Completed trade records
- **portfolio_snapshots**: Daily portfolio captures

### Triggers & Functions
- Auto-update `updated_at` timestamps
- Calculate remaining order amounts
- Real-time P&L updates

## Environment Setup

### Required Variables
```env
# Hyperliquid
HYPERLIQUID_RPC_URL=https://api.hyperliquid-testnet.xyz/evm
HYPERCORE_PRECOMPILE_ADDRESS=0x0000000000000000000000000000000000000808

# Testing (remove in production)
TEST_WALLET_PRIVATE_KEY=0x...
```

### Database Migration
```sql
-- Run migration
psql -h your_host -d your_db -f supabase/migrations/20250722_create_trading_system_tables.sql
```

## Integration with tokenmodule1

### Index Token Flow
1. **Token Creation**: tokenmodule1 creates index tokens
2. **Market Listing**: Trading system detects tradeable tokens
3. **Price Discovery**: HyperCore provides real-time prices
4. **Trading**: Users can buy/sell index tokens
5. **Settlement**: Positions updated in real-time

### Shared Components
- Index tokens table (`index_tokens`)
- User authentication (Privy)
- Supabase database

## Testing

### Test Index Tokens
The system comes pre-loaded with test tokens:
- **MEME_INDEX**: Meme coin basket
- **AI_INDEX**: AI token basket  
- **DOG_INDEX**: Dog-themed tokens

### Manual Testing Flow
1. Set up environment variables
2. Run database migration
3. Start the server: `npm run dev`
4. Test endpoints with Postman/curl

### Example Test Order
```bash
curl -X POST http://localhost:3000/api/trading/v1/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenAddress": "0x1234567890123456789012345678901234567890",
    "type": "market",
    "side": "buy",
    "amount": "10"
  }'
```

## Security Considerations

### ⚠️ Development Features (Remove in Production)
- **Dev token bypass**: `dev-token` authentication bypass
- **Test wallet**: Hardcoded private key for testing
- **Debug logging**: Detailed console outputs

### 🔒 Production Security
- Use real wallet connections (WalletConnect/MetaMask)
- Remove development bypasses
- Enable proper rate limiting
- Add input sanitization
- Implement proper error handling

## Performance Optimizations

### Database Indexes
- User-based queries: `user_id` indexes
- Time-based queries: `created_at` indexes  
- Token lookups: `token_address` indexes

### Caching Strategy
- Balance caching in `user_balances`
- Portfolio snapshots for historical data
- Price history for 24h calculations

## Monitoring & Logging

### Key Metrics to Track
- Order success/failure rates
- Order fill times
- API response times
- Database query performance
- WebSocket connection health

### Event Logging
```typescript
// Order events
console.log(`✅ Order created: ${orderId}`);
console.log(`🔄 Order monitoring started: ${orderId}`);
console.log(`✅ Order filled: ${orderId}`);

// Error events
console.error(`❌ Order failed: ${error.message}`);
```

## Future Enhancements (v2)

### Advanced Features
- **Stop-loss orders**: Risk management
- **Portfolio rebalancing**: Automated rebalancing
- **Cross-margin trading**: Leverage support
- **WebSocket API**: Real-time updates
- **Mobile SDK**: React Native support

### Integrations
- **TradingView charts**: Advanced charting
- **DeFi protocols**: Yield farming integration
- **Analytics dashboard**: Trading insights
- **Social trading**: Copy trading features

## Troubleshooting

### Common Issues

#### "Token not found" error
- Ensure token exists in `index_tokens` table
- Check `is_active` and `is_tradeable` flags

#### "HyperCore connection failed"
- Verify `HYPERLIQUID_RPC_URL` is correct
- Check network connectivity
- Ensure precompile address is valid

#### "Insufficient balance" error  
- Check user balance in `user_balances`
- Verify balance sync from blockchain
- Ensure locked balance calculations

### Debug Commands
```bash
# Check database connection
npm run db:status

# Verify environment variables
npm run env:check

# Test HyperCore connection
npm run test:hypercore
```

## Contributing

### Code Style
- Use TypeScript for type safety
- Follow existing naming conventions
- Add comprehensive error handling
- Include JSDoc comments

### Testing
- Write unit tests for core functions
- Add integration tests for API endpoints
- Test with real Hyperliquid testnet
- Validate database constraints

---

## 📞 Support

For technical support or questions about the trading system:
- Create GitHub issues for bugs
- Discord: #dev-trading channel  
- Email: dev@cryptoindex.com

---

**Last Updated**: January 22, 2025  
**Version**: 1.0.0  
**Status**: ✅ Ready for Testing