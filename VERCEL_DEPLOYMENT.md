# 🚀 Vercel Deployment Checklist - CoreIndex

## 📋 Pre-Deployment Checklist (Go/No-Go)

### ✅ Environment & Configuration
- [ ] `.env.production` configured with production values
- [ ] `vercel.json` configuration in place
- [ ] `next.config.mjs` optimized for production
- [ ] No secrets exposed in client-side code (`NEXT_PUBLIC_*` only for public values)

### ✅ Health & Monitoring
- [ ] `/api/healthz` endpoint responding (Edge runtime)
- [ ] `/api/readyz` endpoint with dependency checks (Node runtime)
- [ ] Smoke test cron job configured (`/api/jobs/smoke`)
- [ ] Structured logging in place with trace IDs

### ✅ Security & Headers
- [ ] Security headers configured (HSTS, X-Frame-Options, etc.)
- [ ] Rate limiting considerations documented
- [ ] No sensitive data in logs or responses
- [ ] Middleware for request tracing and security

### ✅ Performance & Build
- [ ] pnpm-lock.yaml up-to-date with package.json
- [ ] Image domains whitelisted in Next.js config
- [ ] Bundle optimization configured
- [ ] TypeScript and ESLint ignore settings for faster builds

### ✅ API Architecture
- [ ] Backend API integration tested (`NEXT_PUBLIC_API_BASE_URL`)
- [ ] HyperLiquid API integration verified
- [ ] Proper error handling and timeout configurations
- [ ] Idempotency considerations for critical operations

---

## 🔧 Environment Variables Setup

### Required for Production:
```bash
# Core Configuration
NODE_ENV=production
NEXT_PUBLIC_API_BASE_URL=https://your-backend-url.com

# Authentication
DEMO_BEARER_TOKEN=production_demo_token_replace_me

# External APIs
HYPERLIQUID_API_URL=https://api.hyperliquid.xyz
INFO_API_URL=https://api.hyperliquid.xyz/info

# Performance
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
REQUEST_TIMEOUT_MS=30000
```

### Auto-populated by Vercel:
- `VERCEL_ENV` (production/preview/development)
- `VERCEL_GIT_COMMIT_SHA` (for version tracking)
- `VERCEL_URL` (deployment URL)

---

## 🏗️ Architecture Decisions

### API Strategy:
- **Frontend-Only Deployment**: Using Vercel API Routes for proxying
- **External Backend**: CoreIndex backend running separately (recommended)
- **HyperLiquid Integration**: Direct API calls with proper error handling

### Runtime Selection:
- **Edge Functions**: `/api/healthz` (fast startup, limited Node APIs)
- **Serverless Functions**: `/api/readyz`, `/api/jobs/smoke` (full Node.js support)
- **Timeout**: 30 seconds max for serverless functions

---

## 📊 Monitoring & Observability

### Health Endpoints:
- `GET /healthz` - Basic health check (Edge runtime)
- `GET /readyz` - Deep health check with dependencies (Node runtime)
- `GET /api/jobs/smoke?manual=true` - Manual smoke test trigger

### Automated Monitoring:
- **Cron Jobs**: Smoke test every 10 minutes
- **Trace IDs**: Request correlation across services
- **Structured Logging**: JSON format with key fields

### Key Metrics to Monitor:
- Response latencies (p95, p99)
- Error rates by endpoint
- HyperLiquid API response times
- Backend connectivity health

---

## 🛡️ Security Configuration

### Headers Applied:
- `Strict-Transport-Security`: HTTPS enforcement
- `X-Frame-Options: DENY`: Clickjacking protection
- `X-Content-Type-Options: nosniff`: MIME type security
- `Referrer-Policy`: Privacy protection

### API Security:
- Bearer token authentication
- Request timeout protections
- No sensitive data in logs
- Cache-Control headers for API responses

---

## 🔄 Deployment Process

### 1. Commit and Push:
```bash
git add -A
git commit -m "feat: Add production-ready Vercel deployment configuration"
git push origin main
```

### 2. Vercel Setup:
1. Connect GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Set build command: `pnpm build`
4. Set output directory: `.next`

### 3. Post-Deployment Verification:
```bash
# Health checks
curl https://your-domain.vercel.app/healthz
curl https://your-domain.vercel.app/readyz

# Manual smoke test
curl https://your-domain.vercel.app/api/jobs/smoke?manual=true
```

---

## 🚨 Common Deployment Issues

### pnpm lockfile mismatch:
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install --no-frozen-lockfile
git add pnpm-lock.yaml && git commit -m "fix: Update lockfile"
```

### Build timeouts:
- Check TypeScript/ESLint ignore settings
- Verify external package imports
- Review bundle size and optimization

### Runtime errors:
- Check environment variable configuration
- Verify API endpoint connectivity
- Review function timeout settings

---

## 📈 Performance Optimization

### Bundle Optimization:
- Package import optimization for lucide-react, recharts
- Code splitting with webpack configuration
- Image optimization with Next.js Image component

### Caching Strategy:
- API responses: `Cache-Control: no-store` (transaction safety)
- Static assets: Automatic Vercel CDN caching
- Health endpoints: No caching for real-time status

---

## 🎯 Success Criteria

### Deployment Success Indicators:
- [ ] Build completes without errors
- [ ] All health endpoints return 200 OK
- [ ] Smoke test passes (3/3 steps)
- [ ] Frontend loads without console errors
- [ ] Real API integration functional

### Performance Benchmarks:
- Health check response < 500ms
- Page load time < 2 seconds
- API proxy latency < 1 second
- Zero 5xx errors in first hour

---

## 📞 Troubleshooting

### Build Failures:
1. Check pnpm-lock.yaml sync
2. Verify environment variables
3. Review TypeScript errors (if ignore is disabled)

### Runtime Issues:
1. Check Vercel function logs
2. Verify environment variable propagation
3. Test health endpoints manually
4. Check external API connectivity

### Performance Issues:
1. Monitor function execution times
2. Check bundle size analysis
3. Verify CDN cache hit rates
4. Review database/API latency

---

**Ready for deployment! 🚀**