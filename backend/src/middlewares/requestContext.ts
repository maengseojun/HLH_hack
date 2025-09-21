import { NextFunction, Request, Response } from 'express';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { logger } from '../infra/logger.js';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      log?: ReturnType<typeof logger.child>;
      userId?: string; // Will be injected after authentication
      traceId?: string;
    }
  }
}

export const requestContext = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id']?.toString() || randomUUID(),
  customSuccessMessage: (req, res) => {
    const duration = Date.now() - (req as any).startTime;
    return `${req.method} ${req.url} -> ${res.statusCode} (${duration}ms)`;
  },
  customErrorMessage: (req, res, err) => {
    const duration = Date.now() - (req as any).startTime;
    return `${req.method} ${req.url} -> ${res.statusCode} (${duration}ms) ERROR: ${err.message}`;
  },
  customAttributeKeys: {
    req: 'httpReq',
    res: 'httpRes',
    err: 'error',
    responseTime: 'latency_ms',
  },
  autoLogging: {
    ignore: (req) => req.url === '/health' || req.url.startsWith('/metrics'),
  },
});

export function attachReqLogger(req: Request, res: Response, next: NextFunction) {
  req.requestId = (req as any).id;
  req.traceId = req.headers['x-trace-id']?.toString() || req.requestId;
  (req as any).startTime = Date.now();

  req.log = logger.child({
    requestId: req.requestId,
    traceId: req.traceId,
    path: req.path,
    method: req.method,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
  });

  // Add response metadata when request completes
  res.on('finish', () => {
    const duration = Date.now() - (req as any).startTime;
    req.log?.info({
      status: res.statusCode,
      latency_ms: duration,
      contentLength: res.get('content-length'),
    }, 'request completed');
  });

  next();
}