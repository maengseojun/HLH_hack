#!/bin/bash

# Phase 1 Test Runner
# Run migrations and execute Phase 1 tests

set -e # Exit on error

echo "🚀 Phase 1: Funding Round Migration & Tests"
echo "============================================"

cd /Users/maengseojun/Documents/Project/HyperIndex/HI/backend

# Step 1: Apply migrations
echo ""
echo "📦 Step 1: Applying migrations..."
npx supabase db push

# Step 2: Run tests
echo ""
echo "🧪 Step 2: Running Phase 1 tests..."
npx tsx tests/fundingRound.phase1.test.ts

echo ""
echo "✅ Phase 1 complete!"
