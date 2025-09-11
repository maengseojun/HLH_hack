# API Reference

## Base URLs

### Production
- REST API: `https://api.hyperindex.xyz`
- WebSocket: `wss://ws.hyperindex.xyz`
- RPC Endpoint: `https://rpc.hyperindex.xyz`

### Testnet
- REST API: `https://api.testnet.hyperindex.xyz`
- WebSocket: `wss://ws.testnet.hyperindex.xyz`
- RPC Endpoint: `https://rpc.testnet.hyperindex.xyz`

## Authentication

### API Key Authentication

Include your API key in the request header:

```bash
curl -H "X-API-Key: your-api-key" https://api.hyperindex.xyz/v1/info
```

### JWT Authentication

For user-specific endpoints:

```bash
curl -H "Authorization: Bearer your-jwt-token" https://api.hyperindex.xyz/v1/user/balances
```

## REST API Endpoints

### Market Data

#### GET /v1/markets

Returns all available markets.

**Response:**
```json
{
  "markets": [
    {
      "symbol": "MMI/USDC",
      "baseToken": "0x...",
      "quoteToken": "0x...",
      "lastPrice": "10.50",
      "volume24h": "1500000",
      "change24h": "5.2"
    }
  ]
}
```

#### GET /v1/markets/{symbol}

Returns detailed information for a specific market.

**Parameters:**
- `symbol` (path): Market symbol (e.g., "MMI/USDC")

**Response:**
```json
{
  "symbol": "MMI/USDC",
  "baseToken": {
    "address": "0x...",
    "name": "Meme Index",
    "symbol": "MMI",
    "decimals": 18
  },
  "quoteToken": {
    "address": "0x...",
    "name": "USD Coin",
    "symbol": "USDC",
    "decimals": 6
  },
  "price": "10.50",
  "volume24h": "1500000",
  "high24h": "11.20",
  "low24h": "9.80",
  "liquidity": {
    "amm": "5000000",
    "orderbook": "3000000"
  }
}
```

#### GET /v1/ticker

Returns ticker data for all markets.

**Query Parameters:**
- `symbols` (optional): Comma-separated list of symbols

**Response:**
```json
{
  "tickers": {
    "MMI/USDC": {
      "bid": "10.45",
      "ask": "10.55",
      "last": "10.50",
      "volume": "150000",
      "timestamp": 1704067200
    }
  }
}
```

### Order Book

#### GET /v1/orderbook/{symbol}

Returns the order book for a specific market.

**Parameters:**
- `symbol` (path): Market symbol
- `depth` (query, optional): Number of price levels (default: 20, max: 100)

**Response:**
```json
{
  "symbol": "MMI/USDC",
  "bids": [
    ["10.45", "1000"],
    ["10.44", "2500"],
    ["10.43", "5000"]
  ],
  "asks": [
    ["10.55", "1500"],
    ["10.56", "3000"],
    ["10.57", "4500"]
  ],
  "timestamp": 1704067200,
  "sequenceNumber": 123456789
}
```

### Trading

#### POST /v1/orders

Place a new order.

**Request Body:**
```json
{
  "symbol": "MMI/USDC",
  "side": "buy",
  "type": "limit",
  "price": "10.40",
  "amount": "100",
  "timeInForce": "GTC",
  "postOnly": false
}
```

**Response:**
```json
{
  "orderId": "ord_1234567890",
  "status": "open",
  "symbol": "MMI/USDC",
  "side": "buy",
  "type": "limit",
  "price": "10.40",
  "amount": "100",
  "filled": "0",
  "remaining": "100",
  "timestamp": 1704067200
}
```

#### GET /v1/orders

Get all open orders.

**Query Parameters:**
- `symbol` (optional): Filter by market symbol
- `status` (optional): Filter by status (open, filled, cancelled)
- `limit` (optional): Number of results (default: 100)

**Response:**
```json
{
  "orders": [
    {
      "orderId": "ord_1234567890",
      "symbol": "MMI/USDC",
      "side": "buy",
      "type": "limit",
      "price": "10.40",
      "amount": "100",
      "filled": "50",
      "remaining": "50",
      "status": "open",
      "timestamp": 1704067200
    }
  ]
}
```

#### DELETE /v1/orders/{orderId}

Cancel an order.

**Parameters:**
- `orderId` (path): Order ID to cancel

**Response:**
```json
{
  "orderId": "ord_1234567890",
  "status": "cancelled",
  "cancelledAt": 1704067200
}
```

### Index Tokens

#### GET /v1/indices

Returns all index tokens.

**Response:**
```json
{
  "indices": [
    {
      "address": "0x...",
      "name": "Meme Index",
      "symbol": "MMI",
      "totalSupply": "1000000",
      "nav": "10.50",
      "components": [
        {
          "token": "DOGE",
          "weight": 40,
          "address": "0x..."
        },
        {
          "token": "SHIB",
          "weight": 35,
          "address": "0x..."
        }
      ]
    }
  ]
}
```

#### POST /v1/indices/create

Create a new index token.

**Request Body:**
```json
{
  "name": "My Index",
  "symbol": "MYI",
  "components": [
    {
      "address": "0x...",
      "weight": 50
    },
    {
      "address": "0x...",
      "weight": 50
    }
  ],
  "initialSupply": "1000000"
}
```

**Response:**
```json
{
  "tokenAddress": "0x...",
  "txHash": "0x...",
  "blockNumber": 123456,
  "gasUsed": "500000"
}
```

#### POST /v1/indices/{address}/mint

Mint index tokens.

**Parameters:**
- `address` (path): Index token address

**Request Body:**
```json
{
  "amount": "100"
}
```

**Response:**
```json
{
  "txHash": "0x...",
  "amount": "100",
  "requiredComponents": [
    {
      "token": "DOGE",
      "amount": "40"
    },
    {
      "token": "SHIB",
      "amount": "35"
    }
  ]
}
```

#### POST /v1/indices/{address}/redeem

Redeem index tokens for underlying assets.

**Parameters:**
- `address` (path): Index token address

**Request Body:**
```json
{
  "amount": "100"
}
```

**Response:**
```json
{
  "txHash": "0x...",
  "redeemedComponents": [
    {
      "token": "DOGE",
      "amount": "40"
    },
    {
      "token": "SHIB",
      "amount": "35"
    }
  ]
}
```

### AMM Operations

#### GET /v1/amm/pools

Get all AMM pools.

**Response:**
```json
{
  "pools": [
    {
      "address": "0x...",
      "token0": "MMI",
      "token1": "USDC",
      "reserve0": "10000",
      "reserve1": "100000",
      "fee": 3000,
      "liquidity": "1000000"
    }
  ]
}
```

#### POST /v1/amm/quote

Get a swap quote.

**Request Body:**
```json
{
  "tokenIn": "0x...",
  "tokenOut": "0x...",
  "amountIn": "100"
}
```

**Response:**
```json
{
  "amountOut": "95.5",
  "priceImpact": "0.5",
  "route": [
    {
      "pool": "0x...",
      "tokenIn": "USDC",
      "tokenOut": "MMI",
      "amountIn": "100",
      "amountOut": "95.5"
    }
  ],
  "gasEstimate": "150000"
}
```

#### POST /v1/amm/swap

Execute a swap.

**Request Body:**
```json
{
  "tokenIn": "0x...",
  "tokenOut": "0x...",
  "amountIn": "100",
  "minAmountOut": "95",
  "deadline": 1704067200
}
```

**Response:**
```json
{
  "txHash": "0x...",
  "amountIn": "100",
  "amountOut": "95.5",
  "route": ["USDC", "MMI"],
  "gasUsed": "145000"
}
```

### Account

#### GET /v1/account/balances

Get account balances.

**Response:**
```json
{
  "balances": [
    {
      "token": "MMI",
      "address": "0x...",
      "balance": "1000",
      "locked": "100",
      "available": "900"
    },
    {
      "token": "USDC",
      "address": "0x...",
      "balance": "5000",
      "locked": "0",
      "available": "5000"
    }
  ]
}
```

#### GET /v1/account/positions

Get all positions.

**Response:**
```json
{
  "positions": [
    {
      "pool": "0x...",
      "tokenId": 123,
      "liquidity": "1000",
      "token0": "MMI",
      "token1": "USDC",
      "amount0": "100",
      "amount1": "1000",
      "fees0": "0.5",
      "fees1": "5"
    }
  ]
}
```

#### GET /v1/account/history

Get transaction history.

**Query Parameters:**
- `type` (optional): Filter by type (swap, add_liquidity, remove_liquidity, mint, redeem)
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "transactions": [
    {
      "txHash": "0x...",
      "type": "swap",
      "tokenIn": "USDC",
      "tokenOut": "MMI",
      "amountIn": "100",
      "amountOut": "95.5",
      "timestamp": 1704067200,
      "status": "confirmed"
    }
  ],
  "total": 250,
  "offset": 0,
  "limit": 100
}
```

## WebSocket API

### Connection

Connect to the WebSocket endpoint:

```javascript
const ws = new WebSocket('wss://ws.hyperindex.xyz');

ws.on('open', () => {
    // Authenticate
    ws.send(JSON.stringify({
        type: 'auth',
        apiKey: 'your-api-key'
    }));
});
```

### Subscriptions

#### Price Updates

```javascript
// Subscribe
ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'price',
    symbol: 'MMI/USDC'
}));

// Message format
{
    "channel": "price",
    "symbol": "MMI/USDC",
    "price": "10.50",
    "timestamp": 1704067200
}
```

#### Order Book Updates

```javascript
// Subscribe
ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'orderbook',
    symbol: 'MMI/USDC',
    depth: 10
}));

// Message format
{
    "channel": "orderbook",
    "symbol": "MMI/USDC",
    "bids": [["10.45", "1000"]],
    "asks": [["10.55", "1500"]],
    "sequenceNumber": 123456789
}
```

#### Trade Stream

```javascript
// Subscribe
ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'trades',
    symbol: 'MMI/USDC'
}));

// Message format
{
    "channel": "trades",
    "symbol": "MMI/USDC",
    "price": "10.50",
    "amount": "100",
    "side": "buy",
    "timestamp": 1704067200,
    "tradeId": "trd_123456"
}
```

## Error Codes

| Code | Description | Action |
|------|-------------|--------|
| 400 | Bad Request | Check request parameters |
| 401 | Unauthorized | Check API key or JWT token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 429 | Rate Limited | Reduce request frequency |
| 500 | Internal Error | Retry with exponential backoff |
| 503 | Service Unavailable | Service temporarily down |

## Rate Limits

### REST API
- Public endpoints: 100 requests/minute
- Authenticated endpoints: 300 requests/minute
- Trading endpoints: 60 orders/minute

### WebSocket
- 10 connections per IP
- 100 subscriptions per connection
- 1000 messages/minute per connection

## SDK Libraries

Official SDKs are available for:

- [JavaScript/TypeScript](https://github.com/hyperindex/sdk-js)
- [Python](https://github.com/hyperindex/sdk-python)
- [Go](https://github.com/hyperindex/sdk-go)
- [Rust](https://github.com/hyperindex/sdk-rust)

## Changelog

### v1.2.0 (2025-01-15)
- Added batch order endpoints
- Improved WebSocket performance
- New index rebalancing endpoints

### v1.1.0 (2024-12-01)
- Cross-chain trading support
- Enhanced order types
- Historical data endpoints

### v1.0.0 (2024-10-15)
- Initial API release
- Core trading functionality
- Index token operations
