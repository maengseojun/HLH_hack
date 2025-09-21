import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/httpError.js';

const DEMO_BEARER_TOKEN = process.env.DEMO_BEARER_TOKEN || 'hyperindex-demo-token-2024';
const AUTH_MODE = process.env.AUTH_MODE || 'bearer';

export function authBearer(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      req.log?.warn({ ip: req.ip }, 'Missing or invalid Authorization header');
      throw new AppError(401, {
        code: 'UNAUTHORIZED',
        message: 'Bearer token required'
      });
    }

    const token = authHeader.slice('Bearer '.length).trim();

    if (AUTH_MODE === 'bearer') {
      if (!token || token !== DEMO_BEARER_TOKEN) {
        req.log?.warn({
          ip: req.ip,
          tokenLength: token?.length || 0
        }, 'Invalid bearer token');
        throw new AppError(401, {
          code: 'UNAUTHORIZED',
          message: 'Invalid bearer token'
        });
      }

      // For demo purposes, set a static user ID
      req.userId = 'demo-user';
      req.log = req.log?.child({ userId: req.userId });

      req.log?.info('Bearer authentication successful');
      return next();
    }

    // Future: Add JWT support here
    if (AUTH_MODE === 'jwt') {
      throw new AppError(501, {
        code: 'AUTH_MODE_NOT_IMPLEMENTED',
        message: 'JWT authentication not yet implemented'
      });
    }

    throw new AppError(500, {
      code: 'AUTH_MISCONFIGURATION',
      message: 'Invalid AUTH_MODE configuration'
    });

  } catch (error: any) {
    if (error instanceof AppError) {
      return next(error);
    }

    req.log?.error({ err: error }, 'Authentication error');
    return next(new AppError(500, {
      code: 'AUTH_ERROR',
      message: 'Authentication service error'
    }));
  }
}

// Optional authentication - allows both authenticated and anonymous access
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    // No auth provided, continue as anonymous
    req.log?.info('Request proceeding without authentication');
    return next();
  }

  // Auth provided, validate it
  authBearer(req, res, next);
}

// Demo token validation endpoint
export function validateDemoToken(req: Request, res: Response) {
  const token = req.body?.token;

  if (!token) {
    return res.status(400).json({
      valid: false,
      error: 'Token required'
    });
  }

  const isValid = token === DEMO_BEARER_TOKEN;

  req.log?.info({
    tokenValid: isValid,
    tokenLength: token.length
  }, 'Demo token validation');

  res.json({
    valid: isValid,
    expiresAt: isValid ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null, // 24 hours
    scopes: isValid ? ['positions:read', 'positions:write', 'payments:write'] : [],
  });
}