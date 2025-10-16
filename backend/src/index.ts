import express from 'express';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { monitoringRouter } from './routes/monitoring.js';
import { tradingRouter } from './routes/trading.js';
import { balanceRouter } from './routes/balance.js';
import { indexRouter } from './routes/indexes.js';
import { bondingCurveRouter } from './routes/bondingCurve.js';
import { tokenRouter } from './routes/token.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { requestContext, attachReqLogger } from './middlewares/requestContext.js';
import { metricsMiddleware } from './middlewares/metricsCollector.js';
import { authBearer, optionalAuth } from './middlewares/auth.js';
import { protectTradingRoutes } from './middlewares/circuitBreaker.js';
import { logger } from './infra/logger.js';

const app = express();

// Request parsing
app.use(express.json({ limit: '1mb' }));

// Logging and metrics (apply early)
app.use(requestContext);
app.use(attachReqLogger);
app.use(metricsMiddleware);

// Circuit breaker protection (before rate limiting)
app.use(protectTradingRoutes);

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

// Stricter rate limit for trading operations
const tradingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10, // 10 requests per minute
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many trading requests, please try again later.'
  }
});

// Public routes (no auth required)
app.use('/health', healthRouter);
app.use('/metrics', monitoringRouter);
app.use('/dashboard', monitoringRouter);

// Protected routes (authentication required)
app.use('/v1/balance', apiLimiter, authBearer, balanceRouter);
app.use('/v1/trading', tradingLimiter, authBearer, tradingRouter);

// Index routes (some public, some protected)
// GET requests are public (optional auth)
// POST/PUT use optional auth (layer-specific validation in service)
app.use('/v1/indexes', apiLimiter, optionalAuth, indexRouter);

// Bonding curve routes (L3 indices)
// GET requests are public, POST requires auth
app.use('/v1/bonding-curve', apiLimiter, (req, res, next) => {
  if (req.method === 'GET') {
    return next(); // Public access for quotes and info
  }
  return authBearer(req, res, next);
}, bondingCurveRouter);

// Token routes (Native token)
// GET metrics/funding rounds are public, other operations require auth
app.use('/v1/token', apiLimiter, (req, res, next) => {
  const publicPaths = ['/metrics', '/funding-rounds', '/fees/stats', '/buyback/stats', '/buyback/schedule'];
  const isPublic = publicPaths.some(path => req.path.startsWith(path)) && req.method === 'GET';
  
  if (isPublic) {
    return next();
  }
  return authBearer(req, res, next);
}, tokenRouter);

// Error handling (apply last)
app.use(errorHandler);

const port = config.port;

app.listen(port, () => {
  logger.info({
    port,
    env: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '0.1.0',
    auth_mode: process.env.AUTH_MODE || 'bearer',
  }, 'HyperIndex backend server started');
  
  logger.info('📊 Index routes initialized with default L1 index');
  logger.info('🔐 Circuit breaker protection enabled');
  logger.info('📈 Bonding curve system ready for L3 indices');
  logger.info('💎 Native token (HI) system initialized');
  logger.info('💰 Funding rounds active (Seed/Strategic/Public)');
});

export { app };
