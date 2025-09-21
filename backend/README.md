# HyperIndex Backend

HyperLiquid와 HyperCore를 연동한 인덱스 펀드 플랫폼의 백엔드 API (테스트넷 환경)

## 설정

### 환경변수 설정

`.env` 파일을 생성하고 다음 값들을 설정하세요:

```bash
# HyperCore (TestnetEVM) RPC URL
HYPERCORE_RPC_URL=https://testnet.hypercore.hyperliquid.xyz

# Hyperunit / Hyperliquid 테스트넷 API 엔드포인트
HYPERLIQUID_API_URL=https://api.testnet.hyperliquid.xyz

# 서비스 지갑 (읽기 전용) 프라이빗 키
HYPERCORE_WALLET_KEY=0xYOUR_TESTNET_PRIVATE_KEY

# (Optional) REST info 콜용 기본 URL
INFO_API_URL=https://api.testnet.hyperliquid.xyz/info

# 캐시 및 요청 타임아웃
CACHE_TTL_SECONDS=60
CACHE_STALE_TTL=180
REQUEST_TIMEOUT_MS=10000
HYPERCORE_TIMEOUT=30000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100

# Express 서버 포트
PORT=3000
```

### 개발 서버 실행

```bash
cd backend
npm install
npm run dev
```

## API 엔드포인트

### Assets
- `GET /assets` - 전체 자산 목록 조회
- `GET /assets/:symbol` - 특정 자산 상세 정보 (온체인 데이터 포함)
- `GET /assets/:symbol/onchain` - 온체인 데이터만 조회
- `GET /assets/:symbol/candles?interval=1h|7d|1d` - 캔들 데이터 조회 (사전 정의된 3개 프리셋)

### Baskets
- `POST /baskets/calculate` - 자산 바스켓 성과 계산 (interval 프리셋: `1h`, `7d`, `1d`)

### Health
- `GET /health` - 서버 상태 확인

## 테스트

서버 실행 후 다음 API들로 테스트:

```bash
# 헬스 체크
curl http://localhost:3000/health

# 전체 자산 목록
curl http://localhost:3000/assets

# BTC 자산 정보
curl http://localhost:3000/assets/BTC

# BTC 온체인 데이터만
curl http://localhost:3000/assets/BTC/onchain

# BTC 7일 차트 (1d 캔들, 7일 범위)
curl "http://localhost:3000/assets/BTC-PERP/candles?interval=7d"

# 바스켓 계산 (7일 프리셋)
curl -X POST "http://localhost:3000/baskets/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "assets": [
      { "symbol": "BTC-PERP", "weight": 0.5, "position": "long", "leverage": 2 },
      { "symbol": "ETH-PERP", "weight": 0.5, "position": "short", "leverage": 2 }
    ],
    "interval": "7d"
  }'
```

추가로 빠른 회귀 검증은 다음 스크립트로 수행할 수 있습니다:

```bash
npm run smoke
```

## 기능

- HyperLiquid 테스트넷 API를 통한 실시간 자산 데이터 조회
- HyperCore 테스트넷 연동 및 온체인 데이터 조회
- 캔들 차트 데이터 조회 (1h/24h, 1d/7d, 1d/30d 프리셋)
- 메모리 캐싱 + Stale-While-Revalidate(SWR) (TTL 만료 후에도 즉시 응답)
- Rate limiting
- 에러 핸들링 및 로깅
- 재시도 로직 및 inflight 요청 관리
