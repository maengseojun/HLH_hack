import express from 'express';
import rateLimitImport from 'express-rate-limit';
// Typings for express-rate-limit@7 don't expose a callable default export under NodeNext module resolution.
// Cast here so both CommonJS (default export) and ESM builds work without runtime branching.
const rateLimit = rateLimitImport as unknown as typeof import('express-rate-limit')['rateLimit'];
import { config } from './config.js';
import { assetsRouter } from './routes/assets.js';
import { healthRouter } from './routes/health.js';
import { basketsRouter } from './routes/baskets.js';
import { paymentsRouter } from './routes/payments.js';
import { positionsRouter } from './routes/positions.js';
import { monitoringRouter } from './routes/monitoring.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { idempotencyMiddleware } from './middlewares/idempotency.js';
import { requestContext, attachReqLogger } from './middlewares/requestContext.js';
import { metricsMiddleware } from './middlewares/metricsCollector.js';
import { authBearer, optionalAuth, validateDemoToken } from './middlewares/auth.js';
import { logger } from './infra/logger.js';

const app = express();
app.set('trust proxy', 1);

const allowedOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req.header('Access-Control-Request-Headers') || 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Request parsing
app.use(express.json({ limit: '1mb' }));

// Logging and metrics (apply early)
app.use(requestContext);
app.use(attachReqLogger);
app.use(metricsMiddleware);

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again later.'
  }
});

// Stricter rate limit for position operations
const positionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 5, // 5 requests per minute per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many position requests, please try again later.'
  }
});

// Public routes (no auth required)
app.use('/health', healthRouter);
app.use('/metrics', monitoringRouter);
app.use('/dashboard', monitoringRouter);

// Assets route (optional auth for enhanced features)
app.use('/v1/assets', apiLimiter, optionalAuth, assetsRouter);

// Protected routes (authentication required)
app.use('/v1/baskets', apiLimiter, authBearer, basketsRouter);
app.use('/v1/payments', apiLimiter, authBearer, paymentsRouter);
app.use('/v1/indexes', positionLimiter, authBearer, idempotencyMiddleware, positionsRouter);

// Auth utilities
app.post('/auth/validate', validateDemoToken);

// Error handling (apply last)
app.use(errorHandler);

const port = config.port;

// Avoid starting a listener when running inside serverless platforms (e.g. Vercel).
if (!process.env.VERCEL) {
  app.listen(port, () => {
    logger.info({
      port,
      env: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '0.1.0',
      auth_mode: process.env.AUTH_MODE || 'bearer',
    }, 'HyperIndex backend server started');
  });
}

export { app };
export default app;
