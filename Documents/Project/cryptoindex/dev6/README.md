# HyperIndex - Hybrid DEX for Meme Coin Index Trading

**A hybrid decentralized exchange combining AMM liquidity with off-chain orderbook for trading meme coin index tokens on HyperEVM**

## 🚀 **Features**

- **📈 Meme Coin Index**: Track DOGE, PEPE, SHIB and more without holding tokens
- **🔄 Hybrid Trading**: AMM pools + CEX-style orderbook in one platform
- **⚡ HyperEVM Native**: No expensive Dutch Auction required
- **🔐 Privy Authentication**: Email OTP and wallet-based login
- **📊 Real-time Oracles**: Chainlink price feeds for accurate index valuation
- **💡 Smart Router**: Automatic best price execution across AMM and orderbook
- **🛡 Security**: Session-based trading with JWT authentication

## 🛠 **Tech Stack**

- **Blockchain**: HyperEVM (EVM-compatible Layer 1)
- **Smart Contracts**: Solidity (AMM, Index Token, Router)
- **Frontend**: Next.js 14, TypeScript, TailwindCSS
- **Trading Engine**: Hybrid AMM + Off-chain Orderbook
- **Price Oracles**: Chainlink for external meme coin prices
- **Authentication**: Privy (Email OTP + Wallet)
- **Database**: Supabase (PostgreSQL) for orderbook
- **Real-time**: WebSocket for live updates
- **UI Components**: Radix UI + shadcn/ui

## 🚀 **Quick Start**

### 1. Clone and Install
```bash
git clone <repository-url>
cd cryptoindex
npm install
```

### 2. Environment Setup
```bash
# Copy example environment file
cp .env.example .env

# Add your environment variables:
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Database Setup
```bash
# Run the database schema
# Execute supabase/schema.sql in your Supabase SQL editor
```

### 4. Run Development Server
```bash
npm run dev
# Visit http://localhost:3000
```

## 🔐 **Authentication Flow**

### Email OTP Login
1. User visits `/privy-login`
2. Enters email address
3. Receives OTP code via email
4. Enters OTP to complete login
5. Embedded wallet automatically created

### Wallet Login
1. User visits `/privy-login`
2. Clicks "Connect Wallet"
3. Connects with MetaMask/WalletConnect
4. Signs authentication message
5. Logged in with wallet address

## 📋 **API Routes**

### Authentication
- `POST /api/auth/sync-user` - Sync user data to Supabase
- `POST /api/auth/logout` - Logout user
- `GET /api/health` - Health check

### User Management
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile

## 🧪 **Testing**

### Web Browser Testing
1. Visit **http://localhost:3000**
2. Click "Login" button
3. Choose Email OTP or Wallet login
4. Complete authentication
5. Access dashboard

### API Testing
```bash
# Health check
curl http://localhost:3000/api/health

# Test authenticated endpoint (requires login)
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/user/profile
```

## 🛡 **Security Features**

### Privy-Based Authentication
- **JWT Verification**: Only tokens issued by Privy are accepted
- **User Identification**: RLS based on `privy_user_id`
- **Auto Expiration**: Automatic logout on token expiry
- **Rate Limiting**: Built-in protection against abuse

### Multi-Layer Security
- **Middleware**: Primary verification at request level
- **RLS**: Secondary verification at database row level
- **Anonymous Trading**: No KYC required for privacy

## 🔧 **Troubleshooting**

### Common Issues

**1. Authentication Errors**
```bash
# Check Privy configuration
echo $NEXT_PUBLIC_PRIVY_APP_ID
```

**2. Database Connection Failed**
```bash
# Test Supabase connection
curl http://localhost:3000/api/health
```

**3. User Sync Issues**
```bash
# Check server logs
npm run dev
# Look for sync-user API responses
```

### Development Logs
```bash
# Detailed logging
LOG_LEVEL=debug npm run dev

# Error logging only
LOG_LEVEL=error npm run dev
```

## 📞 **Support & Documentation**

- **Privy Documentation**: https://docs.privy.io
- **Supabase Documentation**: https://supabase.com/docs
- **Project Issues**: GitHub Issues
- **Next.js Documentation**: https://nextjs.org/docs

## 🎯 **Project Status**

### ✅ **Completed Features**
- Email OTP Authentication
- Wallet Connection Support
- User Management System
- Database Security (RLS)
- JWT Middleware Protection
- Anonymous P2P Trading Ready

### 🔄 **Ready for Extension**
- Multi-wallet Support
- 2FA Integration
- Advanced Trading Features
- Mobile App Integration

---

**🚀 Next-generation hybrid DEX combining the best of AMM and orderbook trading!**

*Built on HyperEVM for high-performance meme coin index trading without Dutch Auction costs*
