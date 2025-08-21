// lib/utils/rate-limit.ts
import { NextRequest } from 'next/server';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
}

// In-memory store for development - in production, use Redis or similar
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export async function rateLimit(
  request: NextRequest,
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const key = `${identifier}_${getClientIdentifier(request)}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const resetTime = now + windowMs;

  // Clean up expired entries
  for (const [k, v] of rateLimitStore.entries()) {
    if (v.resetTime < now) {
      rateLimitStore.delete(k);
    }
  }

  const existing = rateLimitStore.get(key);
  
  if (!existing || existing.resetTime < now) {
    // First request in window or window expired
    rateLimitStore.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime: new Date(resetTime)
    };
  }

  if (existing.count >= limit) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetTime: new Date(existing.resetTime)
    };
  }

  // Increment counter
  existing.count++;
  rateLimitStore.set(key, existing);

  return {
    allowed: true,
    remaining: limit - existing.count,
    resetTime: new Date(existing.resetTime)
  };
}

function getClientIdentifier(request: NextRequest): string {
  // Try to get IP address from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  return forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown';
}