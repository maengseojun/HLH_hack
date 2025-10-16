# Supabase Setup Guide

This guide helps you set up Supabase for the HyperIndex backend.

## Prerequisites

- Supabase account (https://supabase.com)
- Node.js 18+

## Step 1: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in:
   - Project Name: `hyperindex-mvp`
   - Database Password: (generate strong password)
   - Region: Choose closest to your users
4. Wait for project creation (~2 minutes)

## Step 2: Get API Keys

1. Go to Project Settings → API
2. Copy the following:
   - **Project URL**: Your Supabase URL
   - **anon public** key: Public API key
   - **service_role** key: Service role key (⚠️ KEEP SECRET!)

## Step 3: Update Environment Variables

Edit `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Step 4: Run Migrations

### Option A: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref xxxxxxxxxxxxx

# Run migrations
supabase db push
```

### Option B: Using SQL Editor

1. Go to your Supabase Dashboard
2. Click "SQL Editor"
3. Run each migration file in order:
   - `20250120_create_token_tables.sql`
   - `20250120_create_funding_tables.sql`
   - `20250120_create_index_tables.sql`

## Step 5: Verify Setup

```bash
# Start backend
cd backend
pnpm dev

# Test Supabase connection
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "supabase": "connected"
}
```

## Database Schema

### Tables Created

1. **token_holders**: User token balances
2. **token_transactions**: All token operations
3. **funding_rounds**: Investment rounds (Seed/Strategic/Public)
4. **investments**: User investments with vesting
5. **indices**: Index funds (L1/L2/L3)
6. **index_components**: Token components in indices
7. **bonding_curve_params**: L3 bonding curve parameters

### From dev6 (Already exists)

- **users**: User accounts (Privy integration)
- **user_wallets**: EVM wallet addresses

## RLS (Row Level Security)

All tables have RLS enabled with policies:

- **Public Read**: indices, index_components, funding_rounds
- **User Access**: token_holders, investments (own data only)
- **Service Role**: Full access (backend operations)

## Testing

```bash
# Test token operations
curl -X POST http://localhost:3001/v1/token/balance \
  -H "Authorization: Bearer hyperindex-demo-token-2024"

# Test funding rounds
curl http://localhost:3001/v1/token/funding-rounds

# Test indices
curl http://localhost:3001/v1/indexes
```

## Troubleshooting

### Connection Issues

**Error**: `Cannot connect to Supabase`

Solution:
1. Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`
2. Verify project is active in Supabase Dashboard
3. Check network/firewall settings

### Migration Errors

**Error**: `Table already exists`

Solution:
1. Drop existing tables in Supabase SQL Editor
2. Re-run migrations

**Error**: `RLS policy conflict`

Solution:
1. Drop existing policies
2. Re-run migration

### Authentication Issues

**Error**: `JWT expired`

Solution:
1. Generate new service role key from Supabase Dashboard
2. Update `.env` file

## Production Checklist

- [ ] Use strong database password
- [ ] Enable database backups (Settings → Database → Backups)
- [ ] Set up connection pooling (Settings → Database → Connection Pooling)
- [ ] Monitor usage (Dashboard → Usage)
- [ ] Set up alerts (Settings → Notifications)
- [ ] Review RLS policies
- [ ] Enable audit logs
- [ ] Set up read replicas (if needed)

## Support

- Supabase Docs: https://supabase.com/docs
- Discord: https://discord.supabase.com
- GitHub Issues: https://github.com/supabase/supabase/issues

---

*Last Updated: 2025-01-20*
