const TTL_MS = 15_000;

type Entry<T> = {
  value: T;
  ts: number;
};

const cache = new Map<string, Entry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, { value, ts: Date.now() });
}
