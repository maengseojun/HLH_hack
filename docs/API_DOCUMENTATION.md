# 📚 HyperIndex API 문서

> **Version**: 1.0.0  
> **Base URL**: `http://localhost:3001/api/v1` (Development)  
> **Production URL**: `https://api.hyperindex.io/v1`  
> **Last Updated**: 2025-10-04

---

## 📋 목차

1. [개요](#개요)
2. [인증](#인증)
3. [공통 응답 형식](#공통-응답-형식)
4. [에러 코드](#에러-코드)
5. [Rate Limiting](#rate-limiting)
6. [엔드포인트](#엔드포인트)
   - [Health & Status](#health--status)
   - [Trading](#trading)
   - [Portfolio](#portfolio)
   - [AMM](#amm)
   - [Index Tokens](#index-tokens)
   - [HyperCore](#hypercore)

---

## 개요

HyperIndex API는 RESTful 아키텍처를 따르며, JSON 형식으로 데이터를 주고받습니다.

### 기본 정보
- **Protocol**: HTTPS (프로덕션), HTTP (개발)
- **Content-Type**: `application/json`
- **Character Encoding**: UTF-8
- **Rate Limit**: 100 requests/minute (인증된 사용자)

### API 특징
- ✅ RESTful 설계
- ✅ JWT 기반 인증
- ✅ Redis 캐싱 (60초 TTL)
- ✅ 요청/응답 검증 (Zod)
- ✅ 에러 핸들링 표준화

---

## 인증

### JWT Bearer Token

모든 보호된 엔드포인트는 JWT 토큰이 필요합니다.

#### 헤더 형식
```http
Authorization: Bearer <your_jwt_token>
```

#### 토큰 획득 방법
1. Privy를 통한 월렛 연동
2. 서명 검증 후 JWT 발급
3. 토큰 유효기간: 24시간

#### 예시
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
     https://api.hyperindex.io/v1/portfolio
```

### 인증 에러
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "code": "AUTH_001"
}
```

---

## 공통 응답 형식

### 성공 응답
```json
{
  "success": true,
  "data": {
    // 실제 데이터
  },
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

### 에러 응답
```json
{
  "success": false,
  "error": "Error Type",
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

### 페이지네이션 응답
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## 에러 코드

### HTTP 상태 코드
| 코드 | 의미 | 설명 |
|------|------|------|
| 200 | OK | 요청 성공 |
| 201 | Created | 리소스 생성 성공 |
| 400 | Bad Request | 잘못된 요청 |
| 401 | Unauthorized | 인증 실패 |
| 403 | Forbidden | 권한 없음 |
| 404 | Not Found | 리소스 없음 |
| 429 | Too Many Requests | Rate limit 초과 |
| 500 | Internal Server Error | 서버 오류 |
| 503 | Service Unavailable | 서비스 이용 불가 |

### 커스텀 에러 코드
| 코드 | 설명 |
|------|------|
| AUTH_001 | 유효하지 않은 토큰 |
| AUTH_002 | 토큰 만료 |
| AUTH_003 | 권한 부족 |
| TRADE_001 | 슬리피지 초과 |
| TRADE_002 | 유동성 부족 |
| TRADE_003 | 최소 금액 미달 |
| POOL_001 | 풀을 찾을 수 없음 |
| POOL_002 | 유동성 추가 실패 |
| TOKEN_001 | 토큰 발행 실패 |
| CACHE_001 | 캐시 오류 |
| HYPERCORE_001 | HyperCore 통신 실패 |

---

## Rate Limiting

### 제한 사항
- **인증된 사용자**: 100 requests/minute
- **비인증 사용자**: 20 requests/minute
- **특정 엔드포인트**: 별도 제한 있음

### Rate Limit 헤더
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1696410000
```

### Rate Limit 초과 시
```json
{
  "success": false,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 60 seconds.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

---

## 엔드포인트

---

## Health & Status

### GET /health
서버 상태 확인

#### 설명
서버, Redis, HyperCore 연결 상태를 확인합니다.

#### 인증
불필요 (공개 엔드포인트)

#### 요청
```bash
curl http://localhost:3001/api/v1/health
```

#### 응답 (200 OK)
```json
{
  "status": "ok",
  "timestamp": "2025-10-04T12:00:00.000Z",
  "uptime": 3600,
  "services": {
    "redis": "connected",
    "hypercore": "connected",
    "memory": {
      "used": "128 MB",
      "total": "256 MB"
    }
  }
}
```

#### 응답 (503 Service Unavailable)
```json
{
  "status": "degraded",
  "timestamp": "2025-10-04T12:00:00.000Z",
  "services": {
    "redis": "disconnected",
    "hypercore": "connected",
    "memory": {
      "used": "128 MB",
      "total": "256 MB"
    }
  }
}
```

---

### GET /status
서비스 상세 상태

#### 인증
불필요

#### 요청
```bash
curl http://localhost:3001/api/v1/status
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "environment": "development",
    "blockchain": {
      "network": "HyperVM Testnet",
      "chainId": 998,
      "blockNumber": 1234567
    },
    "cache": {
      "status": "connected",
      "hitRate": "85%",
      "keys": 42
    }
  }
}
```

---

## Trading

### POST /trading/swap
토큰 스왑 실행

#### 설명
AMM을 통해 토큰을 교환합니다.

#### 인증
필요 (Bearer Token)

#### Rate Limit
10 requests/minute

#### 요청 본문
```json
{
  "tokenIn": "0x1234567890abcdef1234567890abcdef12345678",
  "tokenOut": "0xabcdef1234567890abcdef1234567890abcdef12",
  "amountIn": "1000000000000000000",
  "minAmountOut": "950000000000000000",
  "deadline": 1696410000,
  "slippageTolerance": 0.5
}
```

#### 요청 필드
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| tokenIn | string | ✅ | 입금할 토큰 주소 |
| tokenOut | string | ✅ | 받을 토큰 주소 |
| amountIn | string | ✅ | 입금 금액 (wei) |
| minAmountOut | string | ✅ | 최소 수령 금액 (wei) |
| deadline | number | ✅ | 트랜잭션 마감 시간 (Unix timestamp) |
| slippageTolerance | number | ❌ | 슬리피지 허용 범위 (%, 기본: 0.5) |

#### 응답 (200 OK)
```json
{
  "success": true,
  "data": {
    "txHash": "0xabcd1234...",
    "amountIn": "1000000000000000000",
    "amountOut": "980000000000000000",
    "executionPrice": "0.98",
    "priceImpact": "0.15%",
    "fee": "3000000000000000",
    "timestamp": "2025-10-04T12:00:00.000Z"
  }
}
```

#### 에러 예시 (400 Bad Request)
```json
{
  "success": false,
  "error": "Slippage Exceeded",
  "message": "Expected output: 980000000000000000, but minimum is 950000000000000000",
  "code": "TRADE_001"
}
```

#### 예시
```bash
curl -X POST http://localhost:3001/api/v1/trading/swap \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "0x1234...",
    "tokenOut": "0xabcd...",
    "amountIn": "1000000000000000000",
    "minAmountOut": "950000000000000000",
    "deadline": 1696410000
  }'
```

---

### GET /trading/quote
스왑 견적 조회

#### 설명
실제 스왑 없이 예상 결과를 조회합니다.

#### 인증
불필요 (캐시됨)

#### 쿼리 파라미터
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| tokenIn | string | ✅ | 입금할 토큰 주소 |
| tokenOut | string | ✅ | 받을 토큰 주소 |
| amountIn | string | ✅ | 입금 금액 (wei) |

#### 요청
```bash
curl "http://localhost:3001/api/v1/trading/quote?tokenIn=0x1234...&tokenOut=0xabcd...&amountIn=1000000000000000000"
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "data": {
    "amountIn": "1000000000000000000",
    "amountOut": "980000000000000000",
    "executionPrice": "0.98",
    "priceImpact": "0.15%",
    "fee": "3000000000000000",
    "route": [
      "0x1234567890abcdef1234567890abcdef12345678",
      "0xabcdef1234567890abcdef1234567890abcdef12"
    ],
    "estimatedGas": "150000"
  },
  "cached": true,
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

---

### GET /trading/history
거래 내역 조회

#### 인증
필요

#### 쿼리 파라미터
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| address | string | ✅ | 지갑 주소 |
| page | number | ❌ | 페이지 번호 (기본: 1) |
| limit | number | ❌ | 페이지당 개수 (기본: 20) |
| startDate | string | ❌ | 시작일 (ISO 8601) |
| endDate | string | ❌ | 종료일 (ISO 8601) |

#### 요청
```bash
curl "http://localhost:3001/api/v1/trading/history?address=0x1234...&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "txHash": "0xabcd1234...",
      "type": "swap",
      "tokenIn": {
        "address": "0x1234...",
        "symbol": "USDC",
        "amount": "1000"
      },
      "tokenOut": {
        "address": "0xabcd...",
        "symbol": "ETH",
        "amount": "0.5"
      },
      "timestamp": "2025-10-04T12:00:00.000Z",
      "status": "confirmed"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## Portfolio

### GET /portfolio/:address
포트폴리오 조회

#### 설명
특정 주소의 전체 포트폴리오를 조회합니다.

#### 인증
필요

#### 경로 파라미터
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| address | string | 지갑 주소 |

#### 요청
```bash
curl http://localhost:3001/api/v1/portfolio/0x1234567890abcdef1234567890abcdef12345678 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "data": {
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "totalValue": "50000.00",
    "totalValueChange24h": "+5.2%",
    "assets": [
      {
        "token": {
          "address": "0xabcd...",
          "symbol": "ETH",
          "name": "Ethereum",
          "decimals": 18
        },
        "balance": "10000000000000000000",
        "balanceFormatted": "10.0",
        "value": "25000.00",
        "price": "2500.00",
        "priceChange24h": "+3.5%"
      },
      {
        "token": {
          "address": "0x1234...",
          "symbol": "USDC",
          "name": "USD Coin",
          "decimals": 6
        },
        "balance": "25000000000",
        "balanceFormatted": "25000.0",
        "value": "25000.00",
        "price": "1.00",
        "priceChange24h": "0.0%"
      }
    ],
    "indexTokens": [
      {
        "address": "0xindex1...",
        "name": "AI Index",
        "balance": "100000000000000000000",
        "balanceFormatted": "100.0",
        "value": "10000.00",
        "nav": "100.00"
      }
    ]
  },
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

---

### GET /portfolio/:address/performance
포트폴리오 성과 분석

#### 인증
필요

#### 쿼리 파라미터
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| period | string | ❌ | 기간 (24h, 7d, 30d, 1y, all) |

#### 요청
```bash
curl "http://localhost:3001/api/v1/portfolio/0x1234.../performance?period=30d" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "data": {
    "period": "30d",
    "startValue": "45000.00",
    "endValue": "50000.00",
    "absoluteReturn": "5000.00",
    "percentageReturn": "+11.11%",
    "bestDay": {
      "date": "2025-09-15",
      "return": "+8.5%"
    },
    "worstDay": {
      "date": "2025-09-22",
      "return": "-3.2%"
    },
    "chartData": [
      {
        "date": "2025-09-04",
        "value": "45000.00"
      },
      {
        "date": "2025-09-05",
        "value": "46200.00"
      }
    ]
  }
}
```

---

## AMM

### GET /amm/pairs
유동성 풀 목록 조회

#### 인증
불필요 (캐시됨)

#### 쿼리 파라미터
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| page | number | ❌ | 페이지 번호 |
| limit | number | ❌ | 페이지당 개수 |
| sortBy | string | ❌ | 정렬 기준 (tvl, volume, apr) |

#### 요청
```bash
curl "http://localhost:3001/api/v1/amm/pairs?sortBy=tvl&limit=10"
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "address": "0xpair1...",
      "token0": {
        "address": "0xtoken0...",
        "symbol": "ETH",
        "name": "Ethereum"
      },
      "token1": {
        "address": "0xtoken1...",
        "symbol": "USDC",
        "name": "USD Coin"
      },
      "reserve0": "100000000000000000000",
      "reserve1": "250000000000",
      "tvl": "500000.00",
      "volume24h": "50000.00",
      "fee": "0.3%",
      "apr": "15.5%"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50
  }
}
```

---

### GET /amm/pair/:address
특정 풀 상세 정보

#### 인증
불필요 (캐시됨)

#### 경로 파라미터
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| address | string | 페어 컨트랙트 주소 |

#### 요청
```bash
curl http://localhost:3001/api/v1/amm/pair/0xpair1234...
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "data": {
    "address": "0xpair1234...",
    "token0": {
      "address": "0xtoken0...",
      "symbol": "ETH",
      "name": "Ethereum",
      "decimals": 18
    },
    "token1": {
      "address": "0xtoken1...",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6
    },
    "reserves": {
      "reserve0": "100000000000000000000",
      "reserve1": "250000000000",
      "lastUpdate": "2025-10-04T12:00:00.000Z"
    },
    "price": {
      "token0": "2500.00",
      "token1": "0.0004"
    },
    "liquidity": {
      "totalSupply": "5000000000000000000000",
      "tvl": "500000.00"
    },
    "volume": {
      "24h": "50000.00",
      "7d": "300000.00",
      "30d": "1200000.00"
    },
    "fees": {
      "rate": "0.3%",
      "24h": "150.00"
    }
  },
  "cached": true
}
```

---

### POST /amm/add-liquidity
유동성 추가

#### 인증
필요

#### Rate Limit
5 requests/minute

#### 요청 본문
```json
{
  "pairAddress": "0xpair1234...",
  "amount0": "1000000000000000000",
  "amount1": "2500000000",
  "minLiquidity": "50000000000000000000",
  "deadline": 1696410000
}
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "data": {
    "txHash": "0xtx1234...",
    "liquidityMinted": "50123456789012345678",
    "amount0": "1000000000000000000",
    "amount1": "2500000000",
    "share": "0.5%",
    "timestamp": "2025-10-04T12:00:00.000Z"
  }
}
```

---

### POST /amm/remove-liquidity
유동성 제거

#### 인증
필요

#### 요청 본문
```json
{
  "pairAddress": "0xpair1234...",
  "liquidity": "50000000000000000000",
  "minAmount0": "950000000000000000",
  "minAmount1": "2375000000",
  "deadline": 1696410000
}
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "data": {
    "txHash": "0xtx5678...",
    "amount0": "1000000000000000000",
    "amount1": "2500000000",
    "liquidityBurned": "50000000000000000000",
    "timestamp": "2025-10-04T12:00:00.000Z"
  }
}
```

---

## Index Tokens

### GET /index-tokens
인덱스 토큰 목록

#### 인증
불필요 (캐시됨)

#### 요청
```bash
curl http://localhost:3001/api/v1/index-tokens
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "address": "0xindex1...",
      "name": "AI Index",
      "symbol": "AI-IDX",
      "description": "Top AI-related tokens",
      "totalSupply": "1000000000000000000000000",
      "nav": "100.00",
      "navChange24h": "+2.5%",
      "tvl": "10000000.00",
      "components": [
        {
          "token": {
            "address": "0xtoken1...",
            "symbol": "TOKEN1",
            "name": "Token 1"
          },
          "weight": 40.0,
          "balance": "400000000000000000000000"
        },
        {
          "token": {
            "address": "0xtoken2...",
            "symbol": "TOKEN2",
            "name": "Token 2"
          },
          "weight": 30.0,
          "balance": "300000000000000000000000"
        }
      ]
    }
  ]
}
```

---

### POST /index-tokens/mint
인덱스 토큰 발행

#### 설명
기초 자산을 입금하고 인덱스 토큰을 발행받습니다.

#### 인증
필요

#### 요청 본문
```json
{
  "indexToken": "0xindex1...",
  "amountOut": "100000000000000000000",
  "maxAmountsIn": [
    "40000000000000000000",
    "30000000000000000000",
    "30000000000000000000"
  ],
  "deadline": 1696410000
}
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "data": {
    "txHash": "0xtxmint...",
    "indexTokenMinted": "100000000000000000000",
    "amountsIn": [
      "40000000000000000000",
      "30000000000000000000",
      "30000000000000000000"
    ],
    "totalCost": "100.00",
    "timestamp": "2025-10-04T12:00:00.000Z"
  }
}
```

---

### POST /index-tokens/redeem
인덱스 토큰 상환

#### 설명
인덱스 토큰을 반환하고 기초 자산을 받습니다.

#### 인증
필요

#### 요청 본문
```json
{
  "indexToken": "0xindex1...",
  "amount": "100000000000000000000",
  "minAmountsOut": [
    "38000000000000000000",
    "28500000000000000000",
    "28500000000000000000"
  ],
  "deadline": 1696410000
}
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "data": {
    "txHash": "0xtxredeem...",
    "indexTokenBurned": "100000000000000000000",
    "amountsOut": [
      "40000000000000000000",
      "30000000000000000000",
      "30000000000000000000"
    ],
    "totalValue": "100.00",
    "timestamp": "2025-10-04T12:00:00.000Z"
  }
}
```

---

## HyperCore

### POST /hypercore/action
HyperCore 액션 전송

#### 설명
HyperCore L1에 직접 액션을 전송합니다.

#### 인증
필요 (높은 권한 요구)

#### Rate Limit
1 request/second

#### 요청 본문
```json
{
  "action": "SWAP",
  "data": {
    "tokenA": "0xtoken1...",
    "tokenB": "0xtoken2...",
    "amount": "1000000000000000000"
  },
  "signature": "0xsignature..."
}
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "data": {
    "txHash": "0xhypercore...",
    "l1Hash": "0xl1hash...",
    "status": "pending",
    "timestamp": "2025-10-04T12:00:00.000Z"
  }
}
```

---

### GET /hypercore/status/:txHash
HyperCore 트랜잭션 상태 조회

#### 인증
불필요

#### 경로 파라미터
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| txHash | string | 트랜잭션 해시 |

#### 요청
```bash
curl http://localhost:3001/api/v1/hypercore/status/0xtx1234...
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "data": {
    "txHash": "0xtx1234...",
    "l1Hash": "0xl1hash...",
    "status": "confirmed",
    "confirmations": 12,
    "blockNumber": 1234567,
    "timestamp": "2025-10-04T12:00:00.000Z"
  }
}
```

---

## WebSocket API (향후 구현 예정)

### 실시간 가격 피드
```javascript
const ws = new WebSocket('wss://api.hyperindex.io/v1/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'prices',
    pairs: ['0xpair1...', '0xpair2...']
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Price update:', data);
};
```

### 실시간 거래 알림
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'trades',
  address: '0x1234...'
}));
```

---

## 부록

### A. 요청 예시 (cURL)

#### 토큰 스왑
```bash
curl -X POST http://localhost:3001/api/v1/trading/swap \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "0x1234567890abcdef1234567890abcdef12345678",
    "tokenOut": "0xabcdef1234567890abcdef1234567890abcdef12",
    "amountIn": "1000000000000000000",
    "minAmountOut": "950000000000000000",
    "deadline": 1696410000
  }'
```

#### 포트폴리오 조회
```bash
curl http://localhost:3001/api/v1/portfolio/0x1234... \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### B. 요청 예시 (JavaScript/TypeScript)

```typescript
// API 클라이언트
class HyperIndexAPI {
  private baseURL = 'http://localhost:3001/api/v1';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return response.json();
  }

  async swap(params: SwapParams) {
    return this.request('/trading/swap', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getPortfolio(address: string) {
    return this.request(`/portfolio/${address}`);
  }

  async getQuote(tokenIn: string, tokenOut: string, amountIn: string) {
    const query = new URLSearchParams({ tokenIn, tokenOut, amountIn });
    return this.request(`/trading/quote?${query}`);
  }
}

// 사용 예시
const api = new HyperIndexAPI('your_jwt_token');

const result = await api.swap({
  tokenIn: '0x1234...',
  tokenOut: '0xabcd...',
  amountIn: '1000000000000000000',
  minAmountOut: '950000000000000000',
  deadline: Math.floor(Date.now() / 1000) + 3600,
});

console.log('Swap result:', result);
```

---

### C. 환경별 Base URL

| 환경 | Base URL | 설명 |
|------|----------|------|
| 로컬 개발 | `http://localhost:3001/api/v1` | 로컬 Docker 환경 |
| 개발 서버 | `https://dev-api.hyperindex.io/v1` | 개발 서버 |
| 스테이징 | `https://staging-api.hyperindex.io/v1` | 스테이징 환경 |
| 프로덕션 | `https://api.hyperindex.io/v1` | 실제 운영 환경 |

---

### D. Postman Collection

Postman Collection을 다운로드하여 사용할 수 있습니다:

[Download Postman Collection](#) (향후 제공 예정)

---

## 📞 지원

### 문의
- **이메일**: dev@hyperindex.io
- **Discord**: [HyperIndex Community](https://discord.gg/hyperindex)
- **GitHub Issues**: [github.com/hyperindex/issues](https://github.com/hyperindex/issues)

### 변경사항
API 변경사항은 [CHANGELOG.md](./CHANGELOG.md)를 참조하세요.

---

**Last Updated**: 2025-10-04  
**API Version**: 1.0.0
