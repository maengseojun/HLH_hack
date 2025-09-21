type RetryFn<T> = () => Promise<T>;

export interface RetryOptions {
  retries?: number;
  minDelayMs?: number;
  factor?: number;
  shouldRetry?: (err: unknown) => boolean;
}

const defaultShouldRetry = (err: unknown): boolean => {
  const status = (err as any)?.response?.status;
  if (typeof status === 'number') {
    if (status === 429) return true;
    if (status >= 500 && status <= 599) return true;
    return false;
  }
  return true; // 네트워크 에러 등
};

export async function withRetry<T>(fn: RetryFn<T>, opts: RetryOptions = {}): Promise<T> {
  const { retries = 3, minDelayMs = 250, factor = 2, shouldRetry = defaultShouldRetry } = opts;

  let attempt = 0;
  let delay = minDelayMs;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt >= retries || !shouldRetry(err)) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, delay))); // next attempt
      delay *= factor;
    }
  }
}
