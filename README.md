# HyperIndex (HLH) - Hyperliquid Trading Platform

This is a Next.js project with Privy authentication and Supabase database integration for Hyperliquid trading and index management.

## Conventions

- Development server listens on `http://localhost:3000` (use `npm run dev:local`).
- Avoid emoji or spaced directory names for CI compatibility; prefer kebab-case (see `docs/`).
- Keep `.env*` files private and aligned with `docs/env-schema.md`.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
   - Copy `.env.example` to `.env.local` and fill in the missing keys (see `docs/env-schema.md`)
   - Get Supabase keys from your project dashboard

3. Run the development server:
```bash
npm run dev:local
```

## Environment Variables

Required variables in `.env.local`:

```env
# Privy Configuration
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret

# Supabase Configuration (TO BE FILLED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Application
NEXT_PUBLIC_API_URL=http://localhost:3001/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

## Database Schema

The following tables need to be created in Supabase:

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_type TEXT NOT NULL CHECK (auth_type IN ('email', 'wallet')),
  email TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  wallet_address TEXT,
  wallet_type TEXT,
  privy_user_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE
);
```

### user_sessions
```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,
  privy_access_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_reason TEXT,
  session_type TEXT DEFAULT 'web' CHECK (session_type IN ('web', 'mobile', 'api')),
  device_fingerprint TEXT,
  location_country TEXT,
  location_city TEXT,
  is_suspicious BOOLEAN DEFAULT FALSE,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_metadata JSONB
);
```

### user_wallets
```sql
CREATE TABLE user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  encrypted_private_key TEXT,
  wallet_provider TEXT DEFAULT 'unknown',
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/auth/sync-user` - Sync Privy user to database
- `POST /api/auth/logout` - Logout user
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile

## Features

- ✅ Privy authentication (email + wallet)
- ✅ Supabase database integration
- ✅ User sync between Privy and Supabase
- ✅ JWT token verification
- ✅ Protected API routes
- ✅ Dashboard with user info
- ✅ Multi-wallet support

## Next Steps

1. Get Supabase anon key and service role key from project dashboard
2. Update `.env.local` with the keys
3. Create the database tables in Supabase
4. Test the authentication flow

## Features

- Hyperliquid integration for trading
- Privy authentication (email & wallet)
- Supabase database for user management
- Index management and trading interface
- Real-time portfolio tracking
