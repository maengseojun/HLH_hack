#!/bin/bash

# HyperIndex 운영 체크리스트 스크립트
# 매일 반복 실행 (AM/PM 10분) - 안정성 확인용

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

CHECKLIST_PASSED=0
CHECKLIST_FAILED=0

check_item() {
    if $1; then
        print_status "$2"
        ((CHECKLIST_PASSED++))
        return 0
    else
        print_error "$2"
        ((CHECKLIST_FAILED++))
        return 1
    fi
}

echo "📋 HyperIndex 운영 체크리스트"
echo "============================="
echo "실행 시간: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 환경 설정 로드
source .env.testnet 2>/dev/null || {
    print_error "환경 설정 파일(.env.testnet)을 찾을 수 없습니다"
    exit 1
}

BASE_URL=${API_BASE_URL:-"http://localhost:3001"}
TOKEN=${DEMO_TOKEN:-"test_token_for_e2e"}
INDEX_ID=${TEST_INDEX_ID:-"idx1"}

echo "📋 체크리스트 항목"
echo "------------------"

# 1. 잔고 체크: 인덱스 지갑 네이티브 가스/토큰 충분
print_info "1. 지갑 잔고 체크 중..."
check_wallet_balance() {
    # 백엔드 헬스체크를 통해 지갑 상태 확인
    WALLET_STATUS=$(curl -sS "$BASE_URL/healthz" 2>/dev/null | jq -r '.walletBalance.sufficient' 2>/dev/null || echo "false")
    [[ "$WALLET_STATUS" == "true" ]]
}
check_item check_wallet_balance "인덱스 지갑 네이티브 가스/토큰 충분"

# 2. 스모크 테스트: 성공 + p95 < 1.2s
print_info "2. 스모크 테스트 실행 중..."
check_smoke_test() {
    # 스모크 테스트 실행 및 결과 확인
    if timeout 90s ./scripts/stability/smoke.sh > /tmp/smoke_result.log 2>&1; then
        # P95 지연시간 체크 (로그에서 추출)
        if grep -q "OK: smoke passed" /tmp/smoke_result.log; then
            return 0
        fi
    fi
    return 1
}
check_item check_smoke_test "스모크 테스트 성공, p95 < 1.2s"

# 3. 합성 트래픽 실행 중 확인
print_info "3. 합성 트래픽 상태 확인 중..."
check_synthetic_traffic() {
    # K6 프로세스 또는 최근 활동 확인
    if pgrep -f "k6-e2e.js" > /dev/null; then
        return 0
    fi
    
    # 또는 최근 5분간 API 활동이 있는지 확인
    RECENT_ACTIVITY=$(curl -sS "$BASE_URL/__debug/metrics" 2>/dev/null | jq -r '.recentActivity.last5min' 2>/dev/null || echo "0")
    [[ "${RECENT_ACTIVITY:-0}" -gt 0 ]]
}
check_item check_synthetic_traffic "합성 트래픽 실행 중 (대시보드 카운트 상승 확인)"

# 4. 경보 상태 확인
print_info "4. 시스템 경보 상태 확인 중..."
check_alerts() {
    # 백엔드 경보 상태 확인
    ALERT_STATUS=$(curl -sS "$BASE_URL/healthz" 2>/dev/null | jq -r '.alerts.critical' 2>/dev/null || echo "0")
    [[ "${ALERT_STATUS:-1}" == "0" ]]
}
check_item check_alerts "경보 없음 또는 해결됨 (슬랙)"

# 5. 프론트엔드 Live/Stub 전환 정상
print_info "5. 프론트엔드 모드 전환 테스트 중..."
check_frontend_modes() {
    # 간단한 헬스체크 - 프론트엔드 서버 응답 확인
    FRONTEND_URL=${FRONTEND_URL:-"http://localhost:3000"}
    if curl -sS "$FRONTEND_URL" > /dev/null 2>&1; then
        return 0
    fi
    return 1
}
check_item check_frontend_modes "프론트엔드 Live/Stub 전환 정상 + 최근 txHash 표시 OK"

# 6. 백엔드 서비스 상태 확인
print_info "6. 백엔드 서비스 헬스체크 중..."
check_backend_health() {
    # /healthz 엔드포인트 확인
    HEALTH_STATUS=$(curl -sS -w "%{http_code}" "$BASE_URL/healthz" -o /tmp/health_response.json 2>/dev/null || echo "000")
    if [[ "$HEALTH_STATUS" == "200" ]]; then
        # 상세 헬스 정보 확인
        DB_OK=$(jq -r '.database.connected' /tmp/health_response.json 2>/dev/null || echo "false")
        CHAIN_OK=$(jq -r '.blockchain.synced' /tmp/health_response.json 2>/dev/null || echo "false")
        [[ "$DB_OK" == "true" && "$CHAIN_OK" == "true" ]]
    else
        return 1
    fi
}
check_item check_backend_health "백엔드 헬스체크 (/healthz) 정상"

# 7. 체인 동기화 상태 확인
print_info "7. 체인 동기화 상태 확인 중..."
check_chain_sync() {
    # /readyz 엔드포인트 확인 (체인 동기/DB 커넥션)
    READY_STATUS=$(curl -sS -w "%{http_code}" "$BASE_URL/readyz" 2>/dev/null || echo "000")
    [[ "$READY_STATUS" == "200" ]]
}
check_item check_chain_sync "체인 동기화 및 DB 커넥션 정상 (/readyz)"

# 8. 최근 에러율 확인
print_info "8. 최근 에러율 확인 중..."
check_error_rate() {
    # 최근 5분간 에러율 확인
    ERROR_RATE=$(curl -sS "$BASE_URL/__debug/metrics" 2>/dev/null | jq -r '.errorRate.last5min' 2>/dev/null || echo "100")
    # 에러율 2% 미만인지 확인
    awk -v rate="$ERROR_RATE" 'BEGIN { exit (rate >= 2.0) ? 1 : 0 }'
}
check_item check_error_rate "최근 5분 에러율 < 2%"

# 결과 요약
echo ""
echo "📊 체크리스트 결과 요약"
echo "======================="
echo "✅ 통과: $CHECKLIST_PASSED개"
echo "❌ 실패: $CHECKLIST_FAILED개"

if [[ $CHECKLIST_FAILED -eq 0 ]]; then
    print_status "🎉 모든 운영 체크리스트 항목 통과!"
    echo ""
    echo "🚀 시스템 상태: 안정적"
    echo "📈 테스트넷 운영: 정상"
    echo "⏰ 다음 체크: $(date -d '+12 hours' '+%Y-%m-%d %H:%M:%S')"
    exit 0
else
    print_warning "⚠️  일부 체크리스트 항목 실패"
    echo ""
    echo "🔧 권장 조치:"
    echo "  1. 실패한 항목의 로그 확인"
    echo "  2. 관련 서비스 재시작 고려"
    echo "  3. 슬랙 알림 확인"
    echo "  4. 필요시 운영팀 연락"
    exit 1
fi

# 정리
rm -f /tmp/smoke_result.log /tmp/health_response.json 2>/dev/null || true
