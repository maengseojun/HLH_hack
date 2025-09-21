import NodeCache from 'node-cache';
import { config } from '../config.js';

type CacheEntry<T> = {
  value: T;
  createdAt: number;
  expiresAt: number;
  staleExpiresAt: number;
  ttlMs: number;
};

type GetOptions = {
  allowStale?: boolean;
};

export type CacheMeta<T> = {
  value: T;
  isStale: boolean;
  ageMs: number;
  ttlMs: number;
  expiresAt: number;
  staleExpiresAt: number;
};

const cache = new NodeCache({
  stdTTL: 0,
  checkperiod: Math.max(60, Math.ceil(config.cache.ttlSeconds / 2)),
  useClones: false
});

export class CacheService {
  constructor(private readonly defaultTtl = config.cache.ttlSeconds) {}

  set<T>(key: string, value: T, ttlSeconds = this.defaultTtl, options: { staleSeconds?: number } = {}): void {
    const ttl = Math.max(1, ttlSeconds);
    const now = Date.now();
    const ttlMs = ttl * 1000;
    const expiresAt = now + ttlMs;
    const staleTtlSeconds = Math.max(options.staleSeconds ?? config.cache.staleSeconds, 0);
    const staleExpiresAt = expiresAt + staleTtlSeconds * 1000;
    const keepAliveSeconds = ttl + staleTtlSeconds;

    cache.set<CacheEntry<T>>(key, { value, createdAt: now, expiresAt, staleExpiresAt, ttlMs }, keepAliveSeconds);
  }

  get<T>(key: string, options: GetOptions = {}): T | undefined {
    const meta = this.getWithMeta<T>(key);
    if (!meta) return undefined;

    if (!meta.isStale) {
      return meta.value;
    }

    if (options.allowStale) {
      return meta.value;
    }

    cache.del(key);
    return undefined;
  }

  getWithMeta<T>(key: string): CacheMeta<T> | undefined {
    const entry = cache.get<CacheEntry<T>>(key);
    if (!entry) return undefined;

    const now = Date.now();

    if (entry.staleExpiresAt <= now) {
      cache.del(key);
      return undefined;
    }

    const isStale = entry.expiresAt <= now;
    const ageMs = now - entry.createdAt;

    return {
      value: entry.value,
      isStale,
      ageMs,
      ttlMs: entry.ttlMs,
      expiresAt: entry.expiresAt,
      staleExpiresAt: entry.staleExpiresAt,
    };
  }

  has(key: string): boolean {
    const entry = cache.get<CacheEntry<unknown>>(key);
    if (!entry) return false;
    if (entry.expiresAt > Date.now()) return true;
    cache.del(key);
    return false;
  }

  delete(key: string): void {
    cache.del(key);
  }

  clear(): void {
    cache.flushAll();
  }

  size(): number {
    return cache.keys().length;
  }
}

export const cacheService = new CacheService();
