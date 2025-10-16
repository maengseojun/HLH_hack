import { NextFunction, Request, Response } from 'express';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { logger } from '../infra/logger.js';

const requestIdHeader = 'x-request-id';
const traceIdHeader = 'x-trace-id';

export const requestContext = (pinoHttp as unknown as typeof pinoHttp.default)({
  logger,
  genReqId: (req) => req.headers[requestIdHeader]?.toString() || randomUUID(),
  customSuccessMessage: (req, res, responseTime) => {
    const url = (req as Request).originalUrl ?? req.url ?? '';
    const duration = typeof responseTime === 'number' ? Math.round(responseTime) : 0;
    return `${req.method} ${url} -> ${res.statusCode} (${duration}ms)`;
  },
  customErrorMessage: (req, res, err) => {
    const duration = typeof (req as Request).startTime === 'number'
      ? Date.now() - (req as Request).startTime!
      : 0;
    const url = (req as Request).originalUrl ?? req.url ?? '';
    return `${req.method} ${url} -> ${res.statusCode} (${duration}ms) ERROR: ${err.message}`;
  },
  customAttributeKeys: {
    req: 'httpReq',
    res: 'httpRes',
    err: 'error',
    responseTime: 'latency_ms',
  },
  autoLogging: {
    ignore: (req) => {
      const url = (req as Request).url ?? '';
      return url === '/health' || url.startsWith('/metrics');
    },
  },
});

export function attachReqLogger(req: Request, res: Response, next: NextFunction) {
  req.requestId = (req as any).id ?? randomUUID();
  const traceHeader = req.headers[traceIdHeader];
  req.traceId = Array.isArray(traceHeader) ? traceHeader[0] : traceHeader ?? req.requestId;
  req.startTime = Date.now();

  req.log = logger.child({
    requestId: req.requestId,
    traceId: req.traceId,
    path: req.path,
    method: req.method,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.socket.remoteAddress,
  });

  // Add response metadata when request completes
  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : undefined;
    req.log?.info({
      status: res.statusCode,
      latency_ms: duration,
      contentLength: res.get('content-length'),
    }, 'request completed');
  });

  next();
}
