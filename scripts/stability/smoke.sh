#!/bin/bash

# HyperIndex 스모크 테스트 스크립트
# 목표: 실제 테스트넷에서 open→list→close가 1회라도 성공하는지, 60초 내 결정

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

echo "🔥 HyperIndex 스모크 테스트 시작"
echo "=================================="

# 환경변수 설정
source .env.testnet 2>/dev/null || {
    print_error ".env.testnet 파일이 필요합니다"
    exit 1
}

TOKEN=${DEMO_TOKEN:-"test_token_for_e2e"}
BASE=${API_BASE_URL:-"http://localhost:3001"}
IDX=${TEST_INDEX_ID:-"idx1"}

print_info "설정 확인:"
print_info "  토큰: $TOKEN"
print_info "  베이스 URL: $BASE"
print_info "  인덱스 ID: $IDX"

# 타임스탬프 생성
TIMESTAMP=$(date +%s)
SMOKE_KEY="smoke-$TIMESTAMP"
CLOSE_KEY="smoke-close-$TIMESTAMP"

print_status "1단계: Precheck 테스트"
# Precheck 호출
print_info "Precheck API 호출..."
PRECHECK_RESPONSE=$(curl -sS -w "\nSTATUS:%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -X POST "$BASE/v1/indexes/$IDX/positions/precheck" \
    -d '{
        "symbol": "BTC-PERP",
        "side": "LONG", 
        "leverage": 3,
        "notionalUsd": 50,
        "slippageBps": 50
    }' 2>/dev/null || echo "ERROR")

if [[ "$PRECHECK_RESPONSE" == *"STATUS:200"* ]]; then
    print_status "Precheck 성공"
    echo "$PRECHECK_RESPONSE" | head -n -1 | jq '.' 2>/dev/null || echo "$PRECHECK_RESPONSE"
else
    print_error "Precheck 실패: $PRECHECK_RESPONSE"
    exit 1
fi

print_status "2단계: Position Open 테스트"
# Position Open 호출
print_info "Position Open API 호출..."
OPEN_RESPONSE=$(curl -sS -w "\nSTATUS:%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $SMOKE_KEY" \
    -X POST "$BASE/v1/indexes/$IDX/positions/open" \
    -d '{
        "symbol": "BTC-PERP",
        "side": "LONG",
        "leverage": 3, 
        "notionalUsd": 50,
        "slippageBps": 50
    }' 2>/dev/null || echo "ERROR")

if [[ "$OPEN_RESPONSE" == *"STATUS:200"* ]]; then
    print_status "Position Open 성공"
    echo "$OPEN_RESPONSE" | head -n -1 | jq '.' 2>/dev/null || echo "$OPEN_RESPONSE"
else
    print_error "Position Open 실패: $OPEN_RESPONSE"
    exit 1
fi

print_status "3단계: Position List 폴링 (30초 대기)"
# 30초 폴링 (500ms 간격, 총 60회)
FOUND=false
for i in {1..60}; do
    print_info "폴링 시도 $i/60..."
    LIST_RESPONSE=$(curl -sS -w "\nSTATUS:%{http_code}" \
        -H "Authorization: Bearer $TOKEN" \
        "$BASE/v1/indexes/$IDX/positions" 2>/dev/null || echo "ERROR")
    
    if [[ "$LIST_RESPONSE" == *"STATUS:200"* ]]; then
        # BTC-PERP 포지션이 있는지 확인
        if echo "$LIST_RESPONSE" | grep -q "BTC-PERP"; then
            print_status "BTC-PERP 포지션 발견!"
            FOUND=true
            break
        fi
    fi
    
    sleep 0.5
done

if [ "$FOUND" = false ]; then
    print_error "30초 내에 포지션을 찾을 수 없습니다"
    exit 1
fi

print_status "4단계: Position Close 테스트"
# Position Close 호출
print_info "Position Close API 호출..."
CLOSE_RESPONSE=$(curl -sS -w "\nSTATUS:%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $CLOSE_KEY" \
    -X POST "$BASE/v1/indexes/$IDX/positions/close" \
    -d '{
        "symbol": "BTC-PERP",
        "slippageBps": 50
    }' 2>/dev/null || echo "ERROR")

if [[ "$CLOSE_RESPONSE" == *"STATUS:200"* ]]; then
    print_status "Position Close 성공"
    echo "$CLOSE_RESPONSE" | head -n -1 | jq '.' 2>/dev/null || echo "$CLOSE_RESPONSE"
else
    print_error "Position Close 실패: $CLOSE_RESPONSE"
    exit 1
fi

# 최종 확인
print_status "5단계: 최종 상태 확인"
sleep 2
FINAL_LIST=$(curl -sS -H "Authorization: Bearer $TOKEN" \
    "$BASE/v1/indexes/$IDX/positions" 2>/dev/null || echo "ERROR")

if [[ "$FINAL_LIST" != *"BTC-PERP"* ]]; then
    print_status "포지션이 성공적으로 정리되었습니다"
else
    print_warning "포지션이 아직 정리되지 않았을 수 있습니다"
fi

print_status "🎉 스모크 테스트 완료!"
echo "총 소요 시간: $(($(date +%s) - $TIMESTAMP))초"
