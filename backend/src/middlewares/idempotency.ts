import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

type CacheEntry = {
  ts: number;
  status: number;
  body: any;
  headers?: Record<string, string>;
};

type InflightEntry = {
  promise: Promise<{ status: number; body: any; headers?: Record<string, string> }>;
  resolve: (value: { status: number; body: any; headers?: Record<string, string> }) => void;
  reject: (error: any) => void;
};

const idemCache = new Map<string, CacheEntry>();
const inflight = new Map<string, InflightEntry>();
const IDEM_TTL = 10 * 60 * 1000; // 10 minutes

function generateCacheKey(req: Request): string {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  if (!idempotencyKey) {
    return '';
  }

  // Include method, path, and body hash for uniqueness
  const bodyHash = crypto.createHash('sha256')
    .update(JSON.stringify(req.body) || '')
    .digest('hex');

  return `${idempotencyKey}:${req.method}:${req.path}:${bodyHash}`;
}

function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of idemCache.entries()) {
    if (now - entry.ts > IDEM_TTL) {
      idemCache.delete(key);
    }
  }
}

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const cacheKey = generateCacheKey(req);

  // If no idempotency key, proceed normally
  if (!cacheKey) {
    return next();
  }

  cleanupExpiredEntries();

  const now = Date.now();
  const cached = idemCache.get(cacheKey);

  // Return cached response if available and fresh
  if (cached && now - cached.ts < IDEM_TTL) {
    const responseBody = { ...cached.body, idempotent_replay: true };
    if (cached.headers) {
      Object.entries(cached.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    res.status(cached.status).json(responseBody);
    return;
  }

  // Check if request is already in flight
  const inflightEntry = inflight.get(cacheKey);
  if (inflightEntry) {
    // Wait for the in-flight request to complete
    inflightEntry.promise
      .then(({ status, body, headers }) => {
        const responseBody = { ...body, idempotent_replay: true };
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            res.setHeader(key, value);
          });
        }
        res.status(status).json(responseBody);
      })
      .catch((error) => {
        // If the original request failed, pass the error to this request too
        next(error);
      });
    return;
  }

  // Create new in-flight entry
  let resolveInflight: (value: any) => void;
  let rejectInflight: (error: any) => void;

  const inflightPromise = new Promise<{ status: number; body: any; headers?: Record<string, string> }>((resolve, reject) => {
    resolveInflight = resolve;
    rejectInflight = reject;
  });

  inflight.set(cacheKey, {
    promise: inflightPromise,
    resolve: resolveInflight!,
    reject: rejectInflight!,
  });

  // Override res.json to capture the response
  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);
  let responseStatus = 200;
  let responseHeaders: Record<string, string> = {};

  res.status = function(code: number) {
    responseStatus = code;
    return originalStatus(code);
  };

  res.json = function(body: any) {
    // Capture response headers
    const headerNames = res.getHeaderNames();
    headerNames.forEach(name => {
      const value = res.getHeader(name);
      if (typeof value === 'string') {
        responseHeaders[name] = value;
      }
    });

    // Cache the response
    idemCache.set(cacheKey, {
      ts: Date.now(),
      status: responseStatus,
      body,
      headers: responseHeaders,
    });

    // Resolve inflight promise
    const inflightEntry = inflight.get(cacheKey);
    if (inflightEntry) {
      inflightEntry.resolve({ status: responseStatus, body, headers: responseHeaders });
      inflight.delete(cacheKey);
    }

    return originalJson(body);
  };

  // Handle errors
  const originalNext = next;
  next = function(error?: any) {
    if (error) {
      const inflightEntry = inflight.get(cacheKey);
      if (inflightEntry) {
        inflightEntry.reject(error);
        inflight.delete(cacheKey);
      }
    }
    originalNext(error);
  };

  next();
}