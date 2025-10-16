#!/bin/bash
# Phase 1: Setup and Test - 서버 실행 & API 확인

echo "🚀 Phase 1: Backend Setup & Testing"
echo "====================================="
echo ""

# 현재 디렉토리 확인
cd /Users/maengseojun/Documents/Project/HyperIndex/HI/backend

# Step 1: 의존성 설치
echo "📦 Step 1: Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
  echo "❌ npm install failed"
  exit 1
fi

echo "✅ Dependencies installed!"
echo ""

# Step 2: Supabase 상태 확인
echo "🔍 Step 2: Checking Supabase status..."
supabase status

if [ $? -ne 0 ]; then
  echo "⚠️  Supabase not running. Starting..."
  supabase start
fi

echo "✅ Supabase is running!"
echo ""

# Step 3: 간단한 연결 테스트
echo "🧪 Step 3: Testing Supabase connection..."
export SUPABASE_URL='http://localhost:54321'
export SUPABASE_SERVICE_ROLE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
node scripts/test-simple.js

if [ $? -ne 0 ]; then
  echo "❌ Supabase connection test failed"
  exit 1
fi

echo ""
echo "🎉 Phase 1 Complete!"
echo ""
echo "Next steps:"
echo "  1. Start server: npm run dev"
echo "  2. Test APIs in another terminal:"
echo "     curl http://localhost:3001/api/v1/indexes"
echo "     curl http://localhost:3001/api/v1/indexes/11111111-1111-1111-1111-111111111111"
echo ""
