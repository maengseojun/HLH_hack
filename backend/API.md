# HyperIndex API Documentation

## Base URL
```
http://localhost:3001
```

## Authentication

All protected endpoints require a Bearer token:

```bash
Authorization: Bearer hyperindex-demo-token-2024
```

---

## 📊 Balance Endpoints

### GET /v1/balance
Get all token balances for the authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "token": "0x1111111111111111111111111111111111111111",
      "symbol": "USDC",
      "balance": "1000.00",
      "balanceUsd": "1000.00"
    },
    {
      "token": "0x2222222222222222222222222222222222222222",
      "symbol": "HYPE",
      "balance": "500.00",
      "balanceUsd": "750.00"
    }
  ]
}
```

---

### GET /v1/balance/:tokenAddress
Get balance for a specific token.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "0x1111111111111111111111111111111111111111",
    "symbol": "USDC",
    "balance": "1000.00",
    "balanceUsd": "1000.00"
  }
}
```

---

### GET /v1/balance/portfolio/value
Get total portfolio value in USD.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalValueUsd": "1750.00"
  }
}
```

---

## 💱 Trading Endpoints

### POST /v1/trading/swap
Execute an AMM swap.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "fromToken": "0x1111111111111111111111111111111111111111",
  "toToken": "0x2222222222222222222222222222222222222222",
  "amount": "100.00",
  "slippage": 200
}
```

**Parameters:**
- `fromToken` (string, required): Source token address
- `toToken` (string, required): Destination token address
- `amount` (string, required): Amount to swap
- `slippage` (number, optional): Slippage tolerance in basis points (default: 200 = 2%)

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "swap-1234567890-abc123",
    "fromToken": "0x1111111111111111111111111111111111111111",
    "toToken": "0x2222222222222222222222222222222222222222",
    "fromAmount": "100.00",
    "toAmount": "150.00",
    "executionPrice": "1.5",
    "slippage": "0.05",
    "fee": "0.30",
    "timestamp": 1672531200000
  }
}
```

---

### POST /v1/trading/orders
Create a new order.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body (Market Order):**
```json
{
  "pair": "HYPE/USDC",
  "side": "buy",
  "type": "market",
  "amount": "100.00"
}
```

**Request Body (Limit Order):**
```json
{
  "pair": "HYPE/USDC",
  "side": "sell",
  "type": "limit",
  "amount": "50.00",
  "price": "1.55"
}
```

**Parameters:**
- `pair` (string, required): Trading pair (e.g., "HYPE/USDC")
- `side` (string, required): "buy" or "sell"
- `type` (string, required): "market" or "limit"
- `amount` (string, required): Order amount
- `price` (string, required for limit orders): Limit price

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "order-1234567890-abc123",
    "userId": "demo-user",
    "pair": "HYPE/USDC",
    "side": "buy",
    "type": "market",
    "amount": "100.00",
    "filledAmount": "100.00",
    "status": "filled",
    "createdAt": 1672531200000,
    "updatedAt": 1672531200000
  }
}
```

---

### GET /v1/trading/orders
Get user's orders.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (string, optional): Filter by status ("pending", "filled", "partial", "cancelled")

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "order-1",
      "userId": "demo-user",
      "pair": "HYPE/USDC",
      "side": "buy",
      "type": "market",
      "amount": "100",
      "filledAmount": "100",
      "status": "filled",
      "createdAt": 1672527600000,
      "updatedAt": 1672527600000
    }
  ]
}
```

---

### DELETE /v1/trading/orders/:orderId
Cancel an order.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "order-1234567890-abc123",
    "status": "cancelled",
    "updatedAt": 1672531200000
  }
}
```

---

### GET /v1/trading/pools/:pair
Get AMM pool information.

**Parameters:**
- `pair` (string, required): Trading pair (e.g., "HYPE/USDC")

**Response:**
```json
{
  "success": true,
  "data": {
    "pair": "HYPE/USDC",
    "token0": "HYPE",
    "token1": "USDC",
    "reserve0": "1000000",
    "reserve1": "1500000",
    "totalLiquidity": "1224744.87",
    "fee": "0.003",
    "volume24h": "50000"
  }
}
```

---

## 📈 Index (Layer) Endpoints

### GET /v1/indexes
Get all indices, optionally filtered by layer.

**Query Parameters:**
- `layer` (string, optional): Filter by layer ("L1", "L2", "L3")

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "l1-major-index",
      "layer": "L1",
      "symbol": "HI-MAJOR",
      "name": "HyperCore Major Index",
      "description": "Broad market index tracking top 50 HyperCore tokens",
      "components": [
        {
          "symbol": "TOKEN1",
          "address": "0x0000000000000000000000000000000000000001",
          "weight": 0.02
        }
      ],
      "managementFee": 0.007,
      "status": "active",
      "createdAt": 1672531200000,
      "updatedAt": 1672531200000,
      "totalValueLocked": "5000000",
      "holders": 250,
      "volume24h": "100000"
    }
  ],
  "count": 1
}
```

---

### GET /v1/indexes/:indexId
Get index by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "l1-major-index",
    "layer": "L1",
    "symbol": "HI-MAJOR",
    "name": "HyperCore Major Index",
    "components": [...],
    "managementFee": 0.007,
    "status": "active",
    "totalValueLocked": "5000000"
  }
}
```

---

### GET /v1/indexes/symbol/:symbol
Get index by symbol.

**Example:**
```bash
GET /v1/indexes/symbol/HI-MAJOR
```

**Response:** Same as GET /v1/indexes/:indexId

---

### GET /v1/indexes/:indexId/stats
Get index statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "indexId": "l1-major-index",
    "symbol": "HI-MAJOR",
    "name": "HyperCore Major Index",
    "layer": "L1",
    "price": "125.50",
    "tvl": "5000000",
    "holders": 250,
    "volume24h": "100000",
    "components": 50,
    "status": "active"
  }
}
```

---

### POST /v1/indexes
Create a new index.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body (Layer 3 Example):**
```json
{
  "layer": "L3",
  "symbol": "HI-DEFI",
  "name": "DeFi Themed Index",
  "description": "Index tracking DeFi tokens on HyperCore",
  "components": [
    {
      "symbol": "UNISWAP",
      "address": "0x1111111111111111111111111111111111111111",
      "weight": 0.5
    },
    {
      "symbol": "AAVE",
      "address": "0x2222222222222222222222222222222222222222",
      "weight": 0.5
    }
  ],
  "bondingCurveParams": {
    "initialPrice": 1.0,
    "targetMarketCap": 1000000,
    "k": 0.001
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "l3-1672531200000-abc123",
    "layer": "L3",
    "symbol": "HI-DEFI",
    "name": "DeFi Themed Index",
    "description": "Index tracking DeFi tokens on HyperCore",
    "components": [...],
    "managementFee": 0.02,
    "performanceFee": 0.2,
    "status": "active",
    "createdAt": 1672531200000,
    "bondingCurve": {
      "params": {
        "initialPrice": 1.0,
        "targetMarketCap": 1000000,
        "k": 0.001
      },
      "currentPrice": 1.0,
      "currentMarketCap": 0,
      "totalRaised": 0,
      "progress": 0
    }
  }
}
```

---

### PUT /v1/indexes/:indexId/components
Update index components (rebalancing).

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "components": [
    {
      "symbol": "TOKEN1",
      "address": "0x1111111111111111111111111111111111111111",
      "weight": 0.6
    },
    {
      "symbol": "TOKEN2",
      "address": "0x2222222222222222222222222222222222222222",
      "weight": 0.4
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "l3-1672531200000-abc123",
    "components": [...],
    "updatedAt": 1672531200000
  }
}
```

---

### GET /v1/indexes/layers/:layer/config
Get layer configuration.

**Example:**
```bash
GET /v1/indexes/layers/L3/config
```

**Response:**
```json
{
  "success": true,
  "data": {
    "layer": "L3",
    "minComponents": 2,
    "maxComponents": 20,
    "tradingMechanism": "bonding-curve",
    "managementFee": 0.02,
    "rebalancingFrequency": "user-controlled",
    "permissionless": true
  }
}
```

---

## 🏥 Health & Monitoring

### GET /health
Check server health.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "service": "hyperindex-backend",
  "version": "0.1.0"
}
```

---

### GET /metrics
Get detailed metrics.

**Response:**
```json
{
  "timestamp": "2025-01-01T00:00:00.000Z",
  "metrics": {
    "requests": {
      "total": 1000,
      "by_route": {
        "/v1/trading/orders": 500
      },
      "by_status": {
        "200": 950,
        "400": 30,
        "500": 20
      }
    },
    "latency": {
      "p50": 50,
      "p95": 200,
      "p99": 500
    }
  }
}
```

---

### GET /dashboard
Get metrics dashboard data.

**Response:**
```json
{
  "timestamp": "2025-01-01T00:00:00.000Z",
  "summary": {
    "total_requests": 1000,
    "error_rate_5m": 2.5,
    "avg_latency": 75,
    "idempotency_hit_rate": 15.5
  },
  "latency": {
    "p50": 50,
    "p95": 200,
    "p99": 500
  },
  "errors": {
    "400": 30,
    "500": 20
  }
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Amount must be greater than 0",
    "details": {}
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `BAD_REQUEST` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `INSUFFICIENT_FUNDS` | 400 | Not enough balance |
| `WEIGHT_SUM_INVALID` | 400 | Index weights don't sum to 1.0 |
| `UPSTREAM_UNAVAILABLE` | 503 | External service unavailable |

---

## Rate Limits

- **General API**: 100 requests per minute
- **Trading**: 10 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1672531260000
```

---

## Testing with cURL

### Get All Indices
```bash
curl -X GET http://localhost:3001/v1/indexes
```

### Get Layer 3 Indices Only
```bash
curl -X GET "http://localhost:3001/v1/indexes?layer=L3"
```

### Get Index Stats
```bash
curl -X GET http://localhost:3001/v1/indexes/l1-major-index/stats
```

### Create Layer 3 Index
```bash
curl -X POST http://localhost:3001/v1/indexes \
  -H "Authorization: Bearer hyperindex-demo-token-2024" \
  -H "Content-Type: application/json" \
  -d '{
    "layer": "L3",
    "symbol": "HI-GAMING",
    "name": "Gaming Index",
    "description": "Gaming tokens index",
    "components": [
      {
        "symbol": "AXS",
        "address": "0x1111111111111111111111111111111111111111",
        "weight": 0.5
      },
      {
        "symbol": "SAND",
        "address": "0x2222222222222222222222222222222222222222",
        "weight": 0.5
      }
    ],
    "bondingCurveParams": {
      "initialPrice": 1.0,
      "targetMarketCap": 500000,
      "k": 0.001
    }
  }'
```

### Get Balance
```bash
curl -X GET http://localhost:3001/v1/balance \
  -H "Authorization: Bearer hyperindex-demo-token-2024"
```

### Execute Swap
```bash
curl -X POST http://localhost:3001/v1/trading/swap \
  -H "Authorization: Bearer hyperindex-demo-token-2024" \
  -H "Content-Type: application/json" \
  -d '{
    "fromToken": "0x1111111111111111111111111111111111111111",
    "toToken": "0x2222222222222222222222222222222222222222",
    "amount": "100.00"
  }'
```

### Create Market Order
```bash
curl -X POST http://localhost:3001/v1/trading/orders \
  -H "Authorization: Bearer hyperindex-demo-token-2024" \
  -H "Content-Type: application/json" \
  -d '{
    "pair": "HYPE/USDC",
    "side": "buy",
    "type": "market",
    "amount": "100.00"
  }'
```

---

## WebSocket Support (Coming Soon)

Real-time updates for:
- Price feeds
- Order updates
- Balance changes
- Index price updates

---

*Last Updated: 2025-01-XX*
