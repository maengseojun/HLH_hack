#!/bin/bash
# API Test Script - GET APIs (Supabase)

echo "🧪 Testing GET APIs (Supabase)"
echo "=============================="
echo ""

BASE_URL="http://localhost:3001/api/v1"

# Test 1: Get all indexes
echo "Test 1: GET /indexes"
echo "---"
curl -s "$BASE_URL/indexes" | jq '.' || curl -s "$BASE_URL/indexes"
echo ""
echo ""

# Test 2: Get specific index by ID
echo "Test 2: GET /indexes/:id"
echo "---"
curl -s "$BASE_URL/indexes/11111111-1111-1111-1111-111111111111" | jq '.' || curl -s "$BASE_URL/indexes/11111111-1111-1111-1111-111111111111"
echo ""
echo ""

# Test 3: Get index by symbol
echo "Test 3: GET /indexes/symbol/:symbol"
echo "---"
curl -s "$BASE_URL/indexes/symbol/TEST-INDEX" | jq '.' || curl -s "$BASE_URL/indexes/symbol/TEST-INDEX"
echo ""
echo ""

# Test 4: Get index stats
echo "Test 4: GET /indexes/:id/stats"
echo "---"
curl -s "$BASE_URL/indexes/11111111-1111-1111-1111-111111111111/stats" | jq '.' || curl -s "$BASE_URL/indexes/11111111-1111-1111-1111-111111111111/stats"
echo ""
echo ""

# Test 5: Get L3 indexes only
echo "Test 5: GET /indexes?layer=L3"
echo "---"
curl -s "$BASE_URL/indexes?layer=L3" | jq '.' || curl -s "$BASE_URL/indexes?layer=L3"
echo ""
echo ""

echo "✅ All GET API tests completed!"
echo ""
echo "Note: If you see HTML or errors, make sure the server is running:"
echo "  npm run dev"
