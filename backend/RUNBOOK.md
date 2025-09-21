# HyperIndex Backend Runbook

## Quick Start

```bash
# Demo Bearer Token
export DEMO_BEARER_TOKEN="hyperindex-demo-token-2024"

# Start server
npm run dev

# Test endpoints
curl -H "Authorization: Bearer $DEMO_BEARER_TOKEN" http://localhost:3000/v1/assets
curl -H "Idempotency-Key: test-123" -H "Authorization: Bearer $DEMO_BEARER_TOKEN" \
  -d '{"symbol":"ETH-PERP","side":"LONG","leverage":5,"notionalUsd":1000,"slippageBps":50}' \
  http://localhost:3000/v1/indexes/demo/positions/precheck
```

## Architecture Overview

**MVP+ Components:**
- ✅ Idempotency (10min TTL, header-based)
- ✅ Singleflight (1s TTL, prevents concurrent duplicate calls)
- ✅ Nonce serialization (wallet-based queuing)
- ✅ Structured logging (Pino + request correlation)
- ✅ Basic monitoring (6 dashboard tiles)
- ✅ Bearer auth (demo token mode)
- ✅ Rate limiting (5 req/min for positions)

## Monitoring Endpoints

### Dashboard
```bash
curl http://localhost:3000/dashboard
```

**Key Metrics (6 tiles):**
1. **RPS & Average Latency** - Current request rate and response time
2. **p95 Latency** - 95th percentile latency for `/open` and `/close`
3. **Error Rate by Code** - Breakdown by `PRECOMPILE_PARSE_ERROR`, `UPSTREAM_UNAVAILABLE`, etc.
4. **Cache Hit Rate** - Idempotent replay percentage
5. **Transaction Revert Rate** - On-chain transaction failures
6. **Upstream Block Lag** - External service health

### Metrics (Prometheus format)
```bash
curl http://localhost:3000/metrics
```

### Health Check
```bash
curl http://localhost:3000/health
```

## Troubleshooting Guide

### Symptom A: Multiple transactions for same Idempotency-Key

**Check:**
1. Search logs for `idempotent_replay: true` - should appear on subsequent requests
2. Verify singleflight working: Look for concurrent request merging
3. Check cache TTL (default 10 minutes)

**Temporary Fix:**
```bash
# Force 409 for duplicate keys (if cache fails)
# Check middleware/idempotency.ts - lookupIdempotency function
```

**Log Query:**
```bash
# Find requests with same idempotency key
grep "Idempotency-Key: test-123" logs/ | grep -v "idempotent_replay"
```

### Symptom B: Nonce collision errors

**Check:**
1. Verify wallet queue serialization in logs:
   ```json
   {"wallet": "0x123...", "queueLength": 2, "processing": true}
   ```
2. Look for retry backoff (100ms, 200ms, 400ms)
3. Check if multiple wallets in use

**Temporary Fix:**
```bash
# Rate limit same wallet to 429 (Retry-After: 1s)
# Check routes for positionLimiter middleware
```

**Log Query:**
```bash
# Find nonce-related errors
grep "nonce.*conflict\|nonce.*too.*low" logs/
```

### Symptom C: Upstream service unavailable

**Check:**
1. `UPSTREAM_UNAVAILABLE` error count in dashboard
2. Recent block lag metric
3. External service status (Hyperliquid Info API)

**Temporary Fix:**
```bash
# Switch to pre-recorded demo responses
# Check test mocks for backup data
```

**Log Query:**
```bash
# Find upstream failures
grep "UPSTREAM_UNAVAILABLE\|timeout\|5[0-9][0-9]" logs/
```

## Alert Thresholds

### Slack Webhooks (Optional)
Set `SLACK_WEBHOOK` environment variable for notifications:

**Error Rate Alert:**
- Trigger: 5-minute average > 2%
- Action: Check upstream health, verify token validity

**High Latency Alert:**
- Trigger: p95 > 1200ms for 10 minutes
- Action: Check database connections, upstream latency

**Upstream Failure Alert:**
- Trigger: 5+ `UPSTREAM_UNAVAILABLE` in 5 minutes
- Action: Check external service status, consider circuit breaker

## Environment Configuration

### Required
```bash
DEMO_BEARER_TOKEN="your-secret-token"  # Default: hyperindex-demo-token-2024
PORT=3000                              # Default: 3000
NODE_ENV=development                   # production|development|test
```

### Optional
```bash
LOG_LEVEL=info                         # debug|info|warn|error
AUTH_MODE=bearer                       # bearer|jwt (jwt not implemented)
IDEMP_TTL_MS=900000                   # 15 minutes default
SF_TTL_MS=1000                        # 1 second singleflight TTL
SLACK_WEBHOOK=https://hooks.slack.com/...
```

## API Usage Examples

### Authentication
```bash
# Validate token
curl -X POST http://localhost:3000/auth/validate \
  -d '{"token":"hyperindex-demo-token-2024"}'

# Response: {"valid": true, "expiresAt": "...", "scopes": [...]}
```

### Position Management
```bash
# Pre-check (no state change)
curl -H "Authorization: Bearer $TOKEN" \
  -d '{"symbol":"BTC-PERP","side":"LONG","leverage":5,"notionalUsd":1000,"slippageBps":50}' \
  http://localhost:3000/v1/indexes/demo/positions/precheck

# Open position (idempotent)
curl -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: unique-id-$(date +%s)" \
  -d '{"symbol":"BTC-PERP","side":"LONG","leverage":5,"notionalUsd":1000,"slippageBps":50}' \
  http://localhost:3000/v1/indexes/demo/positions/open

# Close position (idempotent)
curl -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: close-$(date +%s)" \
  -d '{"symbol":"BTC-PERP","closePercent":100,"slippageBps":50}' \
  http://localhost:3000/v1/indexes/demo/positions/close
```

### Error Handling
```bash
# Duplicate idempotency key (returns cached response)
curl -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: same-key" \
  -d '{"symbol":"ETH-PERP","side":"LONG","leverage":5,"notionalUsd":1000,"slippageBps":50}' \
  http://localhost:3000/v1/indexes/demo/positions/open

# Response includes: "idempotent_replay": true

# Rate limiting (429 Too Many Requests)
# Exceeding 5 requests/minute to position endpoints
for i in {1..6}; do
  curl -H "Authorization: Bearer $TOKEN" \
    http://localhost:3000/v1/indexes/demo/positions/precheck
done
```

## Testing

### Unit Tests
```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm test -- unit-meta      # Specific test file
```

### E2E Tests
```bash
npm run test -- e2e-positions  # Position flow tests
```

**Test Coverage:**
- Idempotency (5 concurrent requests)
- Nonce serialization (3 different amounts)
- Error handling (invalid symbols, malformed requests)
- Happy path (precheck → open → close → verify)

## Performance Benchmarks

### Expected Latencies (p95)
- `/health`: < 10ms
- `/v1/assets`: < 300ms (with upstream cache)
- `/positions/precheck`: < 500ms
- `/positions/open`: < 1200ms (including on-chain submission)

### Rate Limits
- General API: 100 req/hour per IP
- Position operations: 5 req/minute per IP
- Demo token: No user-based limits (IP-based only)

## Log Structure

**Request Logs:**
```json
{
  "level": "info",
  "service": "hyperindex-backend",
  "requestId": "uuid-v4",
  "traceId": "header-or-requestId",
  "method": "POST",
  "path": "/v1/indexes/demo/positions/open",
  "userId": "demo-user",
  "latency_ms": 456,
  "status": 200,
  "idempotent_replay": false
}
```

**Error Logs:**
```json
{
  "level": "error",
  "service": "hyperindex-backend",
  "requestId": "uuid-v4",
  "error": {
    "code": "UPSTREAM_UNAVAILABLE",
    "message": "Hyperliquid API timeout",
    "details": {...}
  }
}
```

## Deployment Checklist

### Pre-deployment
- [ ] Set production `DEMO_BEARER_TOKEN`
- [ ] Configure `LOG_LEVEL=warn` for production
- [ ] Set up log aggregation (ELK/Fluentd)
- [ ] Configure Slack webhook for alerts
- [ ] Test idempotency with production load

### Post-deployment
- [ ] Verify `/health` returns 200
- [ ] Check dashboard shows expected metrics
- [ ] Test authentication with production token
- [ ] Confirm rate limiting works
- [ ] Validate upstream connectivity

## Security Notes

### Demo Token Security
- Default token is for hackathon demo only
- Generate cryptographically strong token for production:
  ```bash
  openssl rand -base64 32
  ```

### Log Security
- Bearer tokens are never logged
- Only token length is logged for debugging
- Request/response bodies are logged for non-sensitive endpoints

### Rate Limiting
- IP-based rate limiting prevents abuse
- Position operations have stricter limits
- Consider adding user-based quotas for production

## Backup & Recovery

### State Recovery
- Idempotency cache is in-memory (lost on restart)
- Position state is on-chain (recoverable)
- Payment intents stored in database (if implemented)

### Disaster Recovery
1. **Service Down**: Deploy to backup instance, update DNS
2. **Database Issues**: Use read-only mode, defer writes
3. **Upstream Failure**: Use cached responses, fallback to demo data
4. **Memory Issues**: Restart service (idempotency cache will rebuild)

---

**For emergency support during hackathon demo, check:**
1. Dashboard alerts at `/dashboard`
2. Recent error logs
3. Upstream service health
4. Authentication token validity