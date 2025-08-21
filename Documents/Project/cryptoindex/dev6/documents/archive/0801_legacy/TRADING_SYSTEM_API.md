# HyperIndex Trading System API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Trading APIs](#trading-apis)
4. [Market Data APIs](#market-data-apis)
5. [User Management APIs](#user-management-apis)
6. [Admin APIs](#admin-apis)
7. [WebSocket APIs](#websocket-apis)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)
10. [SDK Examples](#sdk-examples)

---

## Overview

The HyperIndex Trading System API provides comprehensive access to:
- **Hybrid order execution** (AMM + Orderbook)
- **Real-time market data**
- **User account management**
- **Trading history and analytics**
- **System administration**

### Base URL
```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

### Content Type
All API requests should use `Content-Type: application/json`

---

## Authentication

### JWT Token Authentication
All protected endpoints require a valid Privy JWT token in the Authorization header.

```http
Authorization: Bearer <privy_jwt_token>
```

### Development Mode
For testing purposes, use the development token:

```http
Authorization: Bearer dev-token
```

### Token Validation
The API validates JWT tokens using Privy's verification system and extracts user information.

---

## Trading APIs

### V2 Trading Endpoints (Recommended)

#### POST /api/trading/v2/orders
Create a new order using the V2 Smart Router with chunk-based processing.

**Request Body:**
```json
{
  "pair": "HYPERINDEX-USDC",
  "type": "market" | "limit",
  "side": "buy" | "sell",
  "amount": "1000.50",
  "price": "1.05" // Required for limit orders
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "uuid-order-id",
    "pair": "HYPERINDEX-USDC",
    "side": "buy",
    "type": "market",
    "amount": "1000.50",
    "price": "1.02",
    "status": "filled",
    "timestamp": 1704067200000
  },
  "routing": {
    "totalFilled": "1000.50",
    "averagePrice": "1.02",
    "executionStats": {
      "totalChunks": 3,
      "ammChunks": 2,
      "orderbookChunks": 1,
      "iterations": 3
    }
  },
  "fills": [
    {
      "source": "AMM",
      "amount": "500.00",
      "price": "1.01",
      "priceImpact": 0.02,
      "ammReservesBefore": {"reserveA": 1000000, "reserveB": 1000000},
      "ammReservesAfter": {"reserveA": 999500, "reserveB": 1000505}
    },
    {
      "source": "Orderbook",
      "amount": "500.50",
      "price": "1.03",
      "orderId": "match-order-id"
    }
  ],
  "summary": {
    "totalFilled": "1000.50",
    "averagePrice": "1.02",
    "totalChunks": 3,
    "ammChunks": 2,
    "orderbookChunks": 1,
    "iterations": 3
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Limit price crosses market price",
  "details": {
    "limitPrice": "1.10",
    "marketPrice": "1.05",
    "side": "sell"
  }
}
```

### V1 Trading Endpoints (Legacy)

#### POST /api/trading/v1/orders
Create an order using the V1 Smart Router.

**Request Body:**
```json
{
  "pair": "HYPERINDEX-USDC",
  "type": "market",
  "side": "buy",
  "amount": 1000,
  "price": 1.05 // Optional for market orders
}
```

#### GET /api/trading/v1/orders
Get user's order history.

**Query Parameters:**
- `limit`: Number of orders (default: 50, max: 200)
- `offset`: Pagination offset (default: 0)
- `pair`: Filter by trading pair
- `status`: Filter by status (active, filled, cancelled, partial)

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "id": "uuid",
      "pair": "HYPERINDEX-USDC",
      "side": "buy",
      "type": "limit",
      "amount": "1000.00",
      "price": "1.05",
      "filled": "500.00",
      "remaining": "500.00",
      "status": "partial",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

#### GET /api/trading/v1/trades
Get user's trade history.

**Query Parameters:**
- `limit`: Number of trades (default: 50, max: 200)
- `offset`: Pagination offset
- `pair`: Filter by trading pair
- `from`: Start date (ISO 8601)
- `to`: End date (ISO 8601)

**Response:**
```json
{
  "success": true,
  "trades": [
    {
      "id": "uuid",
      "pair": "HYPERINDEX-USDC",
      "side": "buy",
      "amount": "100.00",
      "price": "1.02",
      "source": "AMM",
      "fee": "0.30",
      "priceImpact": 0.01,
      "executed_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Performance Testing

#### GET/POST /api/trading/simulator
Mass order simulator for performance testing.

**POST Request Body:**
```json
{
  "totalOrders": 10000,
  "ordersPerSecond": 900,
  "batchSize": 50,
  "orderTypes": {
    "market": 0.7,
    "limit": 0.3
  },
  "sides": {
    "buy": 0.5,
    "sell": 0.5
  },
  "useV2Router": true
}
```

**Response:**
```json
{
  "success": true,
  "results": {
    "totalOrders": 10000,
    "successfulOrders": 9850,
    "failedOrders": 150,
    "averageLatency": 45,
    "peakTPS": 920,
    "duration": 11.2,
    "errorBreakdown": {
      "timeout": 100,
      "validation": 30,
      "system": 20
    }
  }
}
```

---

## Market Data APIs

#### GET /api/trading/v1/market
Get market data for a trading pair.

**Query Parameters:**
- `pair`: Trading pair (default: "HYPERINDEX-USDC")

**Response:**
```json
{
  "success": true,
  "market": {
    "pair": "HYPERINDEX-USDC",
    "lastPrice": "1.02",
    "priceChange24h": 0.05,
    "volume24h": "150000.00",
    "high24h": "1.10",
    "low24h": "0.95",
    "timestamp": 1704067200000
  },
  "amm": {
    "spotPrice": "1.02",
    "reserveA": 999500,
    "reserveB": 1000510,
    "tvl": "2045020.00",
    "fee": 0.003
  }
}
```

#### GET /api/trading/v1/orderbook
Get current orderbook snapshot.

**Query Parameters:**
- `pair`: Trading pair
- `depth`: Number of price levels (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "orderbook": {
    "pair": "HYPERINDEX-USDC",
    "bids": [
      {
        "price": "1.01",
        "amount": "500.00",
        "orders": 3
      }
    ],
    "asks": [
      {
        "price": "1.03",
        "amount": "750.00",
        "orders": 5
      }
    ],
    "lastUpdate": 1704067200000
  }
}
```

---

## User Management APIs

#### POST /api/auth/sync-user
Sync Privy user to Supabase database.

**Request Body:**
```json
{
  "privyUserId": "privy-user-id",
  "authType": "email" | "wallet",
  "email": "user@example.com", // Required for email auth
  "walletAddress": "0x..." // Required for wallet auth
}
```

#### GET /api/user/profile
Get user profile information.

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "walletAddress": "0x...",
    "authType": "email",
    "createdAt": "2024-01-01T00:00:00Z",
    "balances": {
      "HYPERINDEX": {
        "available": "1000.00",
        "locked": "500.00"
      },
      "USDC": {
        "available": "5000.00",
        "locked": "0.00"
      }
    }
  }
}
```

#### PUT /api/user/profile
Update user profile.

**Request Body:**
```json
{
  "displayName": "John Doe",
  "preferences": {
    "defaultSlippage": 3,
    "notifications": true
  }
}
```

---

## Admin APIs

### Token Management

#### POST /api/admin/tokens
Add supported token.

**Request Body:**
```json
{
  "address": "0x...",
  "symbol": "USDC",
  "decimals": 6,
  "name": "USD Coin"
}
```

#### DELETE /api/admin/tokens/:address
Remove supported token.

### AMM Pool Management

#### POST /api/admin/amm/pools
Initialize AMM pool.

**Request Body:**
```json
{
  "pair": "HYPERINDEX-USDC",
  "reserveA": 1000000,
  "reserveB": 1000000,
  "fee": 0.003
}
```

#### PUT /api/admin/amm/pools/:pair/liquidity
Add liquidity to pool.

**Request Body:**
```json
{
  "amountA": 100000,
  "amountB": 100000
}
```

### Settlement Management

#### GET /api/admin/settlement/queue
Get pending settlements.

**Response:**
```json
{
  "success": true,
  "queue": [
    {
      "tradeId": "uuid",
      "buyer": "0x...",
      "seller": "0x...",
      "status": "pending",
      "queuedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /api/admin/settlement/process
Process settlement queue.

---

## WebSocket APIs

### Connection
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
```

### Subscriptions

#### Subscribe to Orderbook Updates
```json
{
  "type": "subscribe",
  "channel": "orderbook",
  "pair": "HYPERINDEX-USDC"
}
```

#### Subscribe to Trade Feed
```json
{
  "type": "subscribe",
  "channel": "trades",
  "pair": "HYPERINDEX-USDC"
}
```

### Message Formats

#### Orderbook Update
```json
{
  "type": "orderbook_update",
  "pair": "HYPERINDEX-USDC",
  "data": {
    "bids": [{"price": "1.01", "amount": "500.00"}],
    "asks": [{"price": "1.03", "amount": "750.00"}]
  },
  "timestamp": 1704067200000
}
```

#### Trade Update
```json
{
  "type": "trade_executed",
  "pair": "HYPERINDEX-USDC",
  "data": {
    "id": "uuid",
    "price": "1.02",
    "amount": "100.00",
    "side": "buy",
    "source": "AMM"
  },
  "timestamp": 1704067200000
}
```

---

## Error Handling

### HTTP Status Codes
- `200`: Success
- `400`: Bad Request (validation error)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error

### Error Response Format
```json
{
  "success": false,
  "error": "Human readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error context"
  },
  "timestamp": 1704067200000
}
```

### Common Error Codes
- `INVALID_PAIR`: Trading pair not supported
- `INSUFFICIENT_BALANCE`: Not enough balance for order
- `PRICE_CROSSES_MARKET`: Limit price crosses current market price
- `ORDER_TOO_SMALL`: Order amount below minimum
- `SYSTEM_MAINTENANCE`: System temporarily unavailable

---

## Rate Limiting

### Default Limits
- **Trading APIs**: 100 requests/minute per user
- **Market Data**: 1000 requests/minute per IP
- **Admin APIs**: 50 requests/minute per admin

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1704067260
```

### Development Mode
Rate limiting is disabled when `DISABLE_RATE_LIMIT=true`

---

## SDK Examples

### JavaScript/TypeScript

#### Initialize Client
```typescript
import { HyperIndexAPI } from '@hyperindex/sdk';

const client = new HyperIndexAPI({
  baseURL: 'http://localhost:3000/api',
  authToken: 'your-privy-jwt-token'
});
```

#### Place Market Order
```typescript
const order = await client.trading.v2.createOrder({
  pair: 'HYPERINDEX-USDC',
  type: 'market',
  side: 'buy',
  amount: '1000'
});

console.log('Order executed:', order.summary);
```

#### Subscribe to Market Data
```typescript
const ws = client.websocket.connect();

ws.subscribe('orderbook', 'HYPERINDEX-USDC', (update) => {
  console.log('Best bid:', update.data.bids[0]);
  console.log('Best ask:', update.data.asks[0]);
});
```

### Python

#### Initialize Client
```python
from hyperindex import HyperIndexAPI

client = HyperIndexAPI(
    base_url='http://localhost:3000/api',
    auth_token='your-privy-jwt-token'
)
```

#### Place Limit Order
```python
order = client.trading.v2.create_order(
    pair='HYPERINDEX-USDC',
    type='limit',
    side='sell',
    amount='500',
    price='1.05'
)

print(f"Order placed: {order['order']['id']}")
```

### cURL Examples

#### Create Market Order
```bash
curl -X POST http://localhost:3000/api/trading/v2/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "pair": "HYPERINDEX-USDC",
    "type": "market",
    "side": "buy",
    "amount": "1000"
  }'
```

#### Get Order History
```bash
curl -X GET "http://localhost:3000/api/trading/v1/orders?limit=10&pair=HYPERINDEX-USDC" \
  -H "Authorization: Bearer dev-token"
```

#### Get Market Data
```bash
curl -X GET "http://localhost:3000/api/trading/v1/market?pair=HYPERINDEX-USDC" \
  -H "Authorization: Bearer dev-token"
```

---

## Testing Endpoints

### Health Checks
```bash
# System health
curl http://localhost:3000/api/health

# Redis health
curl http://localhost:3000/api/redis/health

# Database schema
curl http://localhost:3000/api/debug/schema
```

### Test Pages
- `/test-trading`: Basic V1 trading interface
- `/test-hybrid-trading`: V1 hybrid system test
- `/test-hybrid-trading-v2`: V2 hybrid system test (recommended)
- `/trading-simulator`: Performance testing interface
- `/testnet`: Real blockchain integration test

---

## Performance Metrics

### Expected Response Times
- **Order Creation**: < 1000ms (V2), < 500ms (V1)
- **Market Data**: < 100ms
- **Order History**: < 200ms
- **WebSocket Latency**: < 50ms

### Throughput Capabilities
- **Order Processing**: 900+ orders/second
- **Database Writes**: 1000+ records/second (batched)
- **Redis Operations**: 10,000+ ops/second

---

## Migration Guide

### V1 to V2 Trading API

**V1 (Legacy):**
```javascript
const response = await fetch('/api/trading/v1/orders', {
  method: 'POST',
  body: JSON.stringify({
    pair: 'HYPERINDEX-USDC',
    type: 'market',
    side: 'buy',
    amount: 1000 // number
  })
});
```

**V2 (Recommended):**
```javascript
const response = await fetch('/api/trading/v2/orders', {
  method: 'POST',
  body: JSON.stringify({
    pair: 'HYPERINDEX-USDC',
    type: 'market',
    side: 'buy',
    amount: '1000' // string for precision
  })
});
```

### Key Differences
1. **String amounts**: V2 uses strings for decimal precision
2. **Chunk processing**: V2 automatically chunks large orders
3. **Enhanced routing**: V2 has smarter AMM/Orderbook selection
4. **Better analytics**: V2 provides detailed execution statistics

---

*This API documentation is continuously updated. For the latest changes, refer to the inline code comments and test the endpoints directly.*