// HyperIndex K6 E2E 합성 트래픽 테스트
// 목표: 낮은 QPS(0.2~0.5 rps)로 지속 E2E를 돌려 대시보드에 "살아있는 흐름"을 보여주기

import http from 'k6/http';
import { sleep, check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// 커스텀 메트릭
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const positionOpenTime = new Trend('position_open_time');
const positionCloseTime = new Trend('position_close_time');

export const options = {
  // 저강도 지속 트래픽 설정
  vus: 1,                    // 가상 사용자 1명
  duration: '30m',           // 30분간 지속
  thresholds: {
    errors: ['rate<0.02'],   // 에러율 2% 미만
    http_req_duration: ['p(95)<1200'], // p95 < 1.2초
    http_req_duration: ['p(99)<2000'], // p99 < 2.0초
  },
};

const BASE = __ENV.API_BASE_URL || 'http://localhost:3001';
const TOKEN = __ENV.DEMO_TOKEN || 'test_token_for_e2e';
const INDEX_ID = __ENV.TEST_INDEX_ID || 'idx1';

console.log(`K6 합성 트래픽 시작 - BASE: ${BASE}, INDEX: ${INDEX_ID}`);

export default function () {
  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  };
  
  // 고유 키 생성 (이터레이션 + 타임스탬프)
  const uniqueKey = `k6-${__ITER}-${Date.now()}`;
  const closeKey = `${uniqueKey}-close`;
  
  // 테스트 페이로드 (소액으로 제한)
  const openPayload = JSON.stringify({
    symbol: 'BTC-PERP',
    side: 'LONG',
    leverage: 1,
    notionalUsd: 10,        // 소액으로 체인 스팸/잔고 소모 방지
    slippageBps: 30
  });
  
  const closePayload = JSON.stringify({
    symbol: 'BTC-PERP',
    slippageBps: 30
  });

  // 1. Precheck 테스트
  console.log(`[${__ITER}] Precheck 요청...`);
  const startTime = Date.now();
  
  let response = http.post(
    `${BASE}/v1/indexes/${INDEX_ID}/positions/precheck`,
    openPayload,
    { headers }
  );
  
  const precheckSuccess = check(response, {
    'precheck 200': (res) => res.status === 200,
    'precheck response time < 2s': (res) => res.timings.duration < 2000,
  });
  
  if (!precheckSuccess) {
    console.error(`[${__ITER}] Precheck 실패: ${response.status} - ${response.body}`);
    errorRate.add(1);
    return;
  }

  // 2. Position Open 테스트
  console.log(`[${__ITER}] Position Open 요청... (key: ${uniqueKey})`);
  const openStart = Date.now();
  
  response = http.post(
    `${BASE}/v1/indexes/${INDEX_ID}/positions/open`,
    openPayload,
    {
      headers: {
        ...headers,
        'Idempotency-Key': uniqueKey
      }
    }
  );
  
  const openTime = Date.now() - openStart;
  positionOpenTime.add(openTime);
  
  const openSuccess = check(response, {
    'open submitted': (res) => res.status === 200,
    'open has expected response': (res) => /SUBMITTED|PENDING|CONFIRMED/.test(res.body),
    'open response time < 3s': (res) => res.timings.duration < 3000,
  });
  
  if (!openSuccess) {
    console.error(`[${__ITER}] Position Open 실패: ${response.status} - ${response.body}`);
    errorRate.add(1);
    return;
  }

  // 3. Position List 폴링 (최대 10초)
  console.log(`[${__ITER}] Position List 폴링...`);
  let positionFound = false;
  
  for (let i = 0; i < 10; i++) {
    const listResponse = http.get(
      `${BASE}/v1/indexes/${INDEX_ID}/positions`,
      { headers }
    );
    
    if (listResponse.status === 200 && /BTC-PERP/.test(listResponse.body)) {
      console.log(`[${__ITER}] Position 발견! (${i + 1}번째 시도)`);
      positionFound = true;
      break;
    }
    
    sleep(1); // 1초 대기
  }
  
  if (!positionFound) {
    console.warn(`[${__ITER}] Position을 10초 내에 찾지 못함`);
    // 에러로 처리하지 않음 (체인 지연 가능성)
  }

  // 4. Position Close 테스트
  console.log(`[${__ITER}] Position Close 요청... (key: ${closeKey})`);
  const closeStart = Date.now();
  
  response = http.post(
    `${BASE}/v1/indexes/${INDEX_ID}/positions/close`,
    closePayload,
    {
      headers: {
        ...headers,
        'Idempotency-Key': closeKey
      }
    }
  );
  
  const closeTime = Date.now() - closeStart;
  positionCloseTime.add(closeTime);
  
  const closeSuccess = check(response, {
    'close submitted': (res) => res.status === 200,
    'close response time < 3s': (res) => res.timings.duration < 3000,
  });
  
  if (!closeSuccess) {
    console.error(`[${__ITER}] Position Close 실패: ${response.status} - ${response.body}`);
    errorRate.add(1);
    return;
  }

  // 전체 플로우 성공
  const totalTime = Date.now() - startTime;
  responseTime.add(totalTime);
  
  console.log(`[${__ITER}] E2E 플로우 완료 (총 ${totalTime}ms)`);
  errorRate.add(0); // 성공 기록
  
  // 다음 이터레이션 전 대기 (QPS 조절)
  sleep(3); // 3초 대기 = 약 0.33 RPS
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    duration: data.metrics.iteration_duration.values.avg,
    iterations: data.metrics.iterations.values.count,
    error_rate: data.metrics.errors.values.rate,
    response_time_p95: data.metrics.http_req_duration.values['p(95)'],
    response_time_p99: data.metrics.http_req_duration.values['p(99)'],
    position_open_time_avg: data.metrics.position_open_time?.values.avg || 0,
    position_close_time_avg: data.metrics.position_close_time?.values.avg || 0,
    http_reqs: data.metrics.http_reqs.values.count,
    http_req_rate: data.metrics.http_reqs.values.rate,
  };
  
  console.log('\n=== K6 합성 트래픽 테스트 결과 ===');
  console.log(`총 실행 시간: ${(summary.duration / 1000).toFixed(2)}초`);
  console.log(`이터레이션 수: ${summary.iterations}`);
  console.log(`에러율: ${(summary.error_rate * 100).toFixed(2)}%`);
  console.log(`HTTP 요청 수: ${summary.http_reqs}`);
  console.log(`HTTP 요청률: ${summary.http_req_rate.toFixed(2)} req/s`);
  console.log(`응답 시간 P95: ${summary.response_time_p95.toFixed(0)}ms`);
  console.log(`응답 시간 P99: ${summary.response_time_p99.toFixed(0)}ms`);
  console.log(`Position Open 평균: ${summary.position_open_time_avg.toFixed(0)}ms`);
  console.log(`Position Close 평균: ${summary.position_close_time_avg.toFixed(0)}ms`);
  
  return {
    'summary.json': JSON.stringify(summary, null, 2),
  };
}
