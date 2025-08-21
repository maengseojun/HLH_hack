import { Redis } from 'ioredis';
import { RedisFallbackClient } from './fallback-client';

let redisClient: Redis | RedisFallbackClient | null = null;
let useFallback = false;

/**
 * Redis 클라이언트 싱글톤 인스턴스 (Fallback 지원)
 */
export function getRedisClient(): Redis | RedisFallbackClient {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisPassword = process.env.REDIS_PASSWORD || 'hyperindex_secure_password';
    
    try {
      console.log('🔌 Attempting to connect to Redis at:', redisUrl);
      console.log('🔑 Using Redis password:', redisPassword ? '[HIDDEN]' : 'none');
      
      redisClient = new Redis(redisUrl, {
        password: redisPassword,
        maxRetriesPerRequest: 2, // Reduced for faster fallback
        retryStrategy: (times) => {
          if (times > 2) return null; // Stop retrying after 2 attempts
          const delay = Math.min(times * 50, 1000);
          return delay;
        },
        reconnectOnError: (err) => {
          console.error('❌ Redis reconnect error:', err);
          // Switch to fallback on persistent errors
          if (!useFallback) {
            console.log('🔄 Switching to fallback mode due to error...');
            useFallback = true;
            redisClient = new RedisFallbackClient();
          }
          return false;
        },
        // Performance optimizations
        enableReadyCheck: true,
        enableOfflineQueue: false, // Disabled for faster error detection
        lazyConnect: true, // Enable lazy connection
        
        // 빌드 시 연결 오류 방지
        connectOnStartup: false,
        
        // Connection pool settings
        connectionName: 'hyperindex-trading',
        
        // Reduced timeouts for faster fallback
        connectTimeout: 3000,
        commandTimeout: 2000,
        
        // Logging (development only)
        showFriendlyErrorStack: process.env.NODE_ENV !== 'production'
      });

      // Connection event handlers
      redisClient.on('connect', () => {
        console.log('📡 Redis connected successfully');
        useFallback = false;
      });

      redisClient.on('ready', () => {
        console.log('✅ Redis ready for operations');
        useFallback = false;
      });

      redisClient.on('error', (err) => {
        console.error('❌ Redis error:', err);
        if (!useFallback) {
          console.log('🔄 Switching to fallback mode...');
          useFallback = true;
          redisClient = new RedisFallbackClient();
        }
      });

      redisClient.on('close', () => {
        console.log('🔌 Redis connection closed');
        if (!useFallback) {
          console.log('🔄 Switching to fallback mode...');
          useFallback = true;
          redisClient = new RedisFallbackClient();
        }
      });

      redisClient.on('reconnecting', (delay) => {
        console.log(`🔄 Redis reconnecting in ${delay}ms`);
      });

      // 빌드 시에는 연결 테스트를 시도하지 않음
      if (process.env.NODE_ENV !== 'production' || process.env.REDIS_ENABLED === 'true') {
        // Test connection immediately with timeout
        Promise.race([
          (redisClient as Redis).ping(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 1000))
        ]).catch((error) => {
          console.error('❌ Initial Redis ping failed:', _error);
          console.log('🔄 Using fallback mode from start...');
          useFallback = true;
          redisClient = new RedisFallbackClient();
        });
      } else {
        console.log('🔄 Using fallback mode from start...');
        useFallback = true;
        redisClient = new RedisFallbackClient();
      }

    } catch (_error) {
      console.error('❌ Failed to create Redis client:', _error);
      console.log('🔄 Using fallback mode...');
      useFallback = true;
      redisClient = new RedisFallbackClient();
    }
  }

  return redisClient;
}

/**
 * Redis 연결 해제
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('✅ Redis connection closed gracefully');
  }
}

/**
 * Fallback 모드 여부 확인
 */
export function isUsingFallback(): boolean {
  return useFallback;
}

/**
 * Redis 헬스 체크 (Fallback 지원)
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedisClient();
    
    if (useFallback && 'getStatus' in client) {
      return true; // Fallback mode is always "healthy"
    }
    
    if ('ping' in client) {
      const result = await client.ping();
      return result === 'PONG';
    }
    
    return false;
  } catch (_error) {
    console.error('Redis health check failed:', _error);
    return false;
  }
}

/**
 * Redis 연결 정보 가져오기
 */
export async function getRedisInfo(): Promise<{
  connected: boolean;
  memory: string;
  clients: number;
  uptime: number;
} | null> {
  try {
    const client = getRedisClient();
    const info = await client.info();
    
    // 정보 파싱
    const lines = info.split('\r\n');
    const data: Record<string, string> = {};
    
    lines.forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          data[key] = value;
        }
      }
    });

    return {
      connected: true,
      memory: data['used_memory_human'] || '0',
      clients: parseInt(data['connected_clients'] || '0'),
      uptime: parseInt(data['uptime_in_seconds'] || '0')
    };
  } catch (_error) {
    console.error('Failed to get Redis info:', _error);
    return null;
  }
}

/**
 * Redis 키 패턴으로 삭제 (개발용)
 */
export async function deleteKeysByPattern(pattern: string): Promise<number> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Pattern deletion not allowed in production');
  }

  const client = getRedisClient();
  let deletedCount = 0;
  let cursor = '0';

  do {
    const [newCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = newCursor;

    if (keys && keys.length > 0) {
      deletedCount += keys.length;
      await client.del(...keys);
    }
  } while (cursor !== '0');

  return deletedCount;
}

/**
 * Redis 전체 초기화 (테스트용)
 */
export async function flushRedis(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Flush not allowed in production');
  }

  const client = getRedisClient();
  await client.flushdb();
  console.log('⚠️ Redis database flushed');
}

// Legacy exports for compatibility (deprecated - use getRedisClient() instead)
export const redis = getRedisClient;
export const redisPubSub = getRedisClient;