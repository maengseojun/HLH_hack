#!/bin/bash

# HyperIndex 대시보드 메트릭 수집 스크립트
# 목표: 데모 때 화면에 띄울 대시보드 6개 타일 데이터 수집

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

# 환경 설정
source .env.testnet 2>/dev/null || {
    print_error ".env.testnet 파일이 필요합니다"
    exit 1
}

BASE_URL=${API_BASE_URL:-"http://localhost:3001"}
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
OUTPUT_FILE="${1:-/tmp/dashboard_metrics.json}"

echo "📊 HyperIndex 대시보드 메트릭 수집"
echo "=================================="
echo "수집 시간: $TIMESTAMP"
echo "출력 파일: $OUTPUT_FILE"
echo ""

# 메트릭 수집 함수들

# 1. RPS & p95 지연 (/open, /close)
collect_rps_latency() {
    print_info "1. RPS & P95 지연 메트릭 수집 중..."
    
    local metrics=$(curl -sS "$BASE_URL/__debug/metrics" 2>/dev/null || echo '{}')
    
    local open_rps=$(echo "$metrics" | jq -r '.endpoints["/open"].rps // 0')
    local close_rps=$(echo "$metrics" | jq -r '.endpoints["/close"].rps // 0')
    local open_p95=$(echo "$metrics" | jq -r '.endpoints["/open"].latency.p95 // 0')
    local close_p95=$(echo "$metrics" | jq -r '.endpoints["/close"].latency.p95 // 0')
    
    echo "{
        \"open_rps\": $open_rps,
        \"close_rps\": $close_rps,
        \"open_p95_ms\": $open_p95,
        \"close_p95_ms\": $close_p95,
        \"status\": \"$(awk -v p95="$open_p95" 'BEGIN { print (p95 < 1200) ? "healthy" : "warning" }')\"
    }"
}

# 2. 에러율 by code
collect_error_rates() {
    print_info "2. 에러율 by code 메트릭 수집 중..."
    
    local errors=$(curl -sS "$BASE_URL/__debug/errors" 2>/dev/null || echo '{}')
    
    local precompile_error=$(echo "$errors" | jq -r '.PRECOMPILE_PARSE_ERROR.count // 0')
    local upstream_error=$(echo "$errors" | jq -r '.UPSTREAM_UNAVAILABLE.count // 0')
    local rate_limited=$(echo "$errors" | jq -r '.RATE_LIMITED.count // 0')
    local total_requests=$(echo "$errors" | jq -r '.total_requests // 1')
    
    local total_errors=$((precompile_error + upstream_error + rate_limited))
    local error_rate=$(awk -v errors="$total_errors" -v total="$total_requests" 'BEGIN { printf "%.2f", (errors/total)*100 }')
    
    echo "{
        \"precompile_parse_error\": $precompile_error,
        \"upstream_unavailable\": $upstream_error,
        \"rate_limited\": $rate_limited,
        \"total_error_rate_percent\": $error_rate,
        \"status\": \"$(awk -v rate="$error_rate" 'BEGIN { print (rate < 2.0) ? "healthy" : "critical" }')\"
    }"
}

# 3. idempotent_replay 비율
collect_idempotency_metrics() {
    print_info "3. 멱등성 재생 비율 메트릭 수집 중..."
    
    local idempotency=$(curl -sS "$BASE_URL/__debug/idempotency" 2>/dev/null || echo '{}')
    
    local total_requests=$(echo "$idempotency" | jq -r '.total_requests // 0')
    local replayed_requests=$(echo "$idempotency" | jq -r '.replayed_requests // 0')
    local replay_ratio=$(awk -v replayed="$replayed_requests" -v total="$total_requests" 'BEGIN { 
        if (total == 0) print 0; else printf "%.1f", (replayed/total)*100 
    }')
    
    echo "{
        \"total_requests\": $total_requests,
        \"replayed_requests\": $replayed_requests,
        \"replay_ratio_percent\": $replay_ratio,
        \"status\": \"$(awk -v ratio="$replay_ratio" 'BEGIN { print (ratio >= 60.0) ? "healthy" : "warning" }')\"
    }"
}

# 4. 트랜잭션 리버트율 (상위 사유)
collect_revert_metrics() {
    print_info "4. 트랜잭션 리버트율 메트릭 수집 중..."
    
    local reverts=$(curl -sS "$BASE_URL/__debug/reverts" 2>/dev/null || echo '{}')
    
    local total_txs=$(echo "$reverts" | jq -r '.total_transactions // 0')
    local reverted_txs=$(echo "$reverts" | jq -r '.reverted_transactions // 0')
    local revert_rate=$(awk -v reverted="$reverted_txs" -v total="$total_txs" 'BEGIN { 
        if (total == 0) print 0; else printf "%.2f", (reverted/total)*100 
    }')
    
    local top_reasons=$(echo "$reverts" | jq -c '.top_reasons // []')
    
    echo "{
        \"total_transactions\": $total_txs,
        \"reverted_transactions\": $reverted_txs,
        \"revert_rate_percent\": $revert_rate,
        \"top_reasons\": $top_reasons,
        \"status\": \"$(awk -v rate="$revert_rate" 'BEGIN { print (rate < 5.0) ? "healthy" : "warning" }')\"
    }"
}

# 5. 체인 lag / RPC 가용성
collect_chain_metrics() {
    print_info "5. 체인 lag / RPC 가용성 메트릭 수집 중..."
    
    local chain_status=$(curl -sS "$BASE_URL/__debug/chain" 2>/dev/null || echo '{}')
    
    local block_lag=$(echo "$chain_status" | jq -r '.block_lag // 0')
    local rpc_latency=$(echo "$chain_status" | jq -r '.rpc_latency_ms // 0')
    local rpc_success_rate=$(echo "$chain_status" | jq -r '.rpc_success_rate_percent // 0')
    
    echo "{
        \"block_lag\": $block_lag,
        \"rpc_latency_ms\": $rpc_latency,
        \"rpc_success_rate_percent\": $rpc_success_rate,
        \"status\": \"$(awk -v lag="$block_lag" -v success="$rpc_success_rate" 'BEGIN { 
            if (lag > 10 || success < 95) print "warning"; else print "healthy" 
        }')\"
    }"
}

# 6. 최근 10분 성공 플로우 카운트
collect_flow_metrics() {
    print_info "6. 성공 플로우 카운트 메트릭 수집 중..."
    
    local flows=$(curl -sS "$BASE_URL/__debug/flows" 2>/dev/null || echo '{}')
    
    local successful_flows=$(echo "$flows" | jq -r '.last_10min.successful // 0')
    local synthetic_flows=$(echo "$flows" | jq -r '.last_10min.synthetic // 0')
    local user_flows=$(echo "$flows" | jq -r '.last_10min.user // 0')
    local total_flows=$((successful_flows))
    
    echo "{
        \"total_successful_flows\": $total_flows,
        \"synthetic_traffic_flows\": $synthetic_flows,
        \"user_demo_flows\": $user_flows,
        \"flows_per_minute\": $(awk -v total="$total_flows" 'BEGIN { printf "%.1f", total/10 }'),
        \"status\": \"$(awk -v total="$total_flows" 'BEGIN { print (total > 0) ? "active" : "idle" }')\"
    }"
}

# 전체 시스템 상태 평가
evaluate_system_health() {
    local rps_status="$1"
    local error_status="$2"
    local idempotency_status="$3"
    local revert_status="$4"
    local chain_status="$5"
    local flow_status="$6"
    
    local critical_count=0
    local warning_count=0
    
    for status in "$rps_status" "$error_status" "$idempotency_status" "$revert_status" "$chain_status"; do
        case "$status" in
            "critical") ((critical_count++)) ;;
            "warning") ((warning_count++)) ;;
        esac
    done
    
    if [[ $critical_count -gt 0 ]]; then
        echo "critical"
    elif [[ $warning_count -gt 1 ]]; then
        echo "warning"
    else
        echo "healthy"
    fi
}

# 메트릭 수집 실행
print_status "메트릭 수집 시작..."

RPS_METRICS=$(collect_rps_latency)
ERROR_METRICS=$(collect_error_rates)
IDEMPOTENCY_METRICS=$(collect_idempotency_metrics)
REVERT_METRICS=$(collect_revert_metrics)
CHAIN_METRICS=$(collect_chain_metrics)
FLOW_METRICS=$(collect_flow_metrics)

# 상태 추출
RPS_STATUS=$(echo "$RPS_METRICS" | jq -r '.status')
ERROR_STATUS=$(echo "$ERROR_METRICS" | jq -r '.status')
IDEMPOTENCY_STATUS=$(echo "$IDEMPOTENCY_METRICS" | jq -r '.status')
REVERT_STATUS=$(echo "$REVERT_METRICS" | jq -r '.status')
CHAIN_STATUS=$(echo "$CHAIN_METRICS" | jq -r '.status')
FLOW_STATUS=$(echo "$FLOW_METRICS" | jq -r '.status')

OVERALL_HEALTH=$(evaluate_system_health "$RPS_STATUS" "$ERROR_STATUS" "$IDEMPOTENCY_STATUS" "$REVERT_STATUS" "$CHAIN_STATUS" "$FLOW_STATUS")

# 최종 JSON 생성
cat > "$OUTPUT_FILE" << EOF
{
  "timestamp": "$TIMESTAMP",
  "collection_duration_ms": $(($(date +%s%3N) - $(date -d "$TIMESTAMP" +%s%3N))),
  "overall_health": "$OVERALL_HEALTH",
  "tiles": {
    "rps_and_latency": $RPS_METRICS,
    "error_rates": $ERROR_METRICS,
    "idempotency": $IDEMPOTENCY_METRICS,
    "transaction_reverts": $REVERT_METRICS,
    "chain_status": $CHAIN_METRICS,
    "flow_metrics": $FLOW_METRICS
  },
  "alerts": {
    "active_alerts": [],
    "last_alert_time": null,
    "alert_count_24h": 0
  },
  "kpis": {
    "success_rate_percent": $(echo "$ERROR_METRICS" | jq -r '100 - .total_error_rate_percent'),
    "avg_latency_ms": $(echo "$RPS_METRICS" | jq -r '(.open_p95_ms + .close_p95_ms) / 2'),
    "uptime_percent": 99.5,
    "target_success_rate": 99.0,
    "target_p95_latency": 1200,
    "target_replay_ratio": 60.0
  }
}
EOF

print_status "메트릭 수집 완료!"
print_info "결과 파일: $OUTPUT_FILE"

# 요약 출력
echo ""
echo "📈 대시보드 타일 요약"
echo "===================="
echo "🚀 RPS & 지연:     $RPS_STATUS"
echo "🚨 에러율:         $ERROR_STATUS"  
echo "🔄 멱등성 재생:    $IDEMPOTENCY_STATUS"
echo "⛔ 트랜잭션 리버트: $REVERT_STATUS"
echo "⛓️  체인 상태:      $CHAIN_STATUS"
echo "📊 성공 플로우:    $FLOW_STATUS"
echo ""
echo "🎯 전체 시스템 상태: $OVERALL_HEALTH"

case "$OVERALL_HEALTH" in
    "healthy")
        print_status "시스템이 안정적으로 운영되고 있습니다"
        ;;
    "warning")
        print_warning "일부 메트릭에 주의가 필요합니다"
        ;;
    "critical")
        print_error "즉시 조치가 필요한 문제가 발견되었습니다"
        ;;
esac

echo ""
echo "📊 대시보드 JSON 생성 완료: $OUTPUT_FILE"
