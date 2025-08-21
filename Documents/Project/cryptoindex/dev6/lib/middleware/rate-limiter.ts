import { Redis } from 'ioredis';
import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number;      // 시간 창 (밀리초)
  maxRequests: number;   // 최대 요청 수
  keyPrefix?: string;    // Redis 키 접두사
  skipSuccessfulRequests?: boolean; // 성공한 요청만 카운트
  skipFailedRequests?: boolean;     // 실패한 요청 제외
}

export class RateLimiter {
  private redis: Redis;
  private config: RateLimitConfig;

  constructor(redis: Redis, config: RateLimitConfig) {
    this.redis = redis;
    this.config = {
      keyPrefix: 'rate_limit:',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config
    };
  }

  /**
   * 요청 제한 체크
   */
  async checkLimit(identifier: string): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetAt: Date;
  }> {
    // 개발/테스트 환경에서는 rate limiting 완전 비활성화
    if (process.env.NODE_ENV === 'development' || process.env.DISABLE_RATE_LIMIT === 'true') {
      return {
        allowed: true,
        limit: 999999999,
        remaining: 999999999,
        resetAt: new Date(Date.now() + this.config.windowMs)
      };
    }

    const key = `${this.config.keyPrefix}${identifier}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Redis 파이프라인으로 원자적 처리
    const pipeline = this.redis.pipeline();
    
    // 오래된 요청 제거
    pipeline.zremrangebyscore(key, '-inf', windowStart);
    
    // 현재 요청 추가
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // 현재 창의 요청 수 확인
    pipeline.zcard(key);
    
    // TTL 설정 (창 크기만큼)
    pipeline.expire(key, Math.ceil(this.config.windowMs / 1000));
    
    const results = await pipeline.exec();
    
    if (!results) {
      throw new Error('Rate limit check failed');
    }

    const requestCount = results[2][1] as number;
    const allowed = requestCount <= this.config.maxRequests;
    
    // 제한 초과 시 현재 요청 제거
    if (!allowed) {
      await this.redis.zrem(key, `${now}-${Math.random()}`);
    }

    return {
      allowed,
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - requestCount),
      resetAt: new Date(now + this.config.windowMs)
    };
  }

  /**
   * 특정 식별자의 제한 리셋
   */
  async reset(identifier: string): Promise<void> {
    const key = `${this.config.keyPrefix}${identifier}`;
    await this.redis.del(key);
  }

  /**
   * 현재 사용량 조회
   */
  async getUsage(identifier: string): Promise<{
    count: number;
    resetAt: Date;
  }> {
    const key = `${this.config.keyPrefix}${identifier}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // 현재 창의 요청 수 확인
    const count = await this.redis.zcount(key, windowStart, '+inf');

    return {
      count,
      resetAt: new Date(now + this.config.windowMs)
    };
  }
}

/**
 * API 라우트용 미들웨어 생성
 */
export function createRateLimitMiddleware(
  redis: Redis,
  config: RateLimitConfig & {
    identifierExtractor?: (req: NextRequest) => string;
    onLimitReached?: (req: NextRequest, identifier: string) => void;
  }
) {
  const limiter = new RateLimiter(redis, config);

  return async function rateLimitMiddleware(req: NextRequest) {
    // 식별자 추출 (기본: IP 주소)
    const identifier = config.identifierExtractor
      ? config.identifierExtractor(req)
      : req.ip || req.headers.get('x-forwarded-for') || 'unknown';

    const result = await limiter.checkLimit(identifier);

    if (!result.allowed) {
      // 제한 도달 시 콜백 실행
      if (config.onLimitReached) {
        config.onLimitReached(req, identifier);
      }

      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again at ${result.resetAt.toISOString()}`,
          limit: result.limit,
          remaining: result.remaining,
          resetAt: result.resetAt
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetAt.getTime().toString(),
            'Retry-After': Math.ceil((result.resetAt.getTime() - Date.now()) / 1000).toString()
          }
        }
      );
    }

    // 요청 허용
    return null;
  };
}

/**
 * 사용자별 Rate Limiter
 */
export class UserRateLimiter extends RateLimiter {
  constructor(redis: Redis, config: Omit<RateLimitConfig, 'keyPrefix'>) {
    super(redis, {
      ...config,
      keyPrefix: 'rate_limit:user:'
    });
  }

  async checkUserLimit(userId: string, endpoint?: string): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetAt: Date;
  }> {
    const identifier = endpoint ? `${userId}:${endpoint}` : userId;
    return this.checkLimit(identifier);
  }
}

/**
 * API 엔드포인트별 Rate Limiter
 */
export class EndpointRateLimiter extends RateLimiter {
  constructor(redis: Redis, config: Omit<RateLimitConfig, 'keyPrefix'>) {
    super(redis, {
      ...config,
      keyPrefix: 'rate_limit:endpoint:'
    });
  }

  async checkEndpointLimit(endpoint: string, identifier: string): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetAt: Date;
  }> {
    return this.checkLimit(`${endpoint}:${identifier}`);
  }
}

/**
 * 거래 전용 Rate Limiter (더 엄격한 제한)
 */
export class TradingRateLimiter extends RateLimiter {
  private orderLimiter: RateLimiter;
  private cancelLimiter: RateLimiter;

  constructor(redis: Redis) {
    // 일반 거래 제한 - 트레이딩용으로 대폭 완화
    super(redis, {
      windowMs: 60 * 1000,     // 1분
      maxRequests: 50000,      // 분당 50,000회 (대폭 증가)
      keyPrefix: 'rate_limit:trading:'
    });

    // 주문 생성 제한 - 트레이딩용으로 대폭 완화
    this.orderLimiter = new RateLimiter(redis, {
      windowMs: 60 * 1000,     // 1분
      maxRequests: 10000,      // 분당 10,000회 (대폭 증가)
      keyPrefix: 'rate_limit:order_create:'
    });

    // 주문 취소 제한 - 트레이딩용으로 대폭 완화
    this.cancelLimiter = new RateLimiter(redis, {
      windowMs: 60 * 1000,     // 1분
      maxRequests: 10000,      // 분당 10,000회 (대폭 증가)
      keyPrefix: 'rate_limit:order_cancel:'
    });
  }

  async checkOrderCreateLimit(userId: string) {
    return this.orderLimiter.checkLimit(userId);
  }

  async checkOrderCancelLimit(userId: string) {
    return this.cancelLimiter.checkLimit(userId);
  }

  async checkGeneralTradingLimit(userId: string) {
    return this.checkLimit(userId);
  }
}