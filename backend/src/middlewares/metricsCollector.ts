import { Request, Response, NextFunction } from 'express';

// Simple in-memory metrics store for MVP
// In production, this would be replaced with Prometheus, StatsD, etc.
interface Metrics {
  requests: {
    total: number;
    by_route: Record<string, number>;
    by_status: Record<string, number>;
    by_method: Record<string, number>;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
    samples: number;
  };
  errors: {
    total: number;
    by_code: Record<string, number>;
    rate_5m: number;
  };
  idempotency: {
    cache_hits: number;
    cache_misses: number;
    hit_rate: number;
  };
  upstream: {
    calls: number;
    failures: number;
    avg_latency: number;
  };
}

class MetricsCollector {
  private metrics: Metrics = {
    requests: {
      total: 0,
      by_route: {},
      by_status: {},
      by_method: {},
    },
    latency: {
      p50: 0,
      p95: 0,
      p99: 0,
      samples: 0,
    },
    errors: {
      total: 0,
      by_code: {},
      rate_5m: 0,
    },
    idempotency: {
      cache_hits: 0,
      cache_misses: 0,
      hit_rate: 0,
    },
    upstream: {
      calls: 0,
      failures: 0,
      avg_latency: 0,
    },
  };

  private errorTimestamps: number[] = [];
  private latencySamples: number[] = [];
  private readonly MAX_LATENCY_SAMPLES = 1000;
  private readonly ERROR_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  recordRequest(method: string, route: string, status: number, latency: number) {
    this.metrics.requests.total++;
    this.metrics.requests.by_method[method] = (this.metrics.requests.by_method[method] || 0) + 1;
    this.metrics.requests.by_route[route] = (this.metrics.requests.by_route[route] || 0) + 1;
    this.metrics.requests.by_status[status.toString()] = (this.metrics.requests.by_status[status.toString()] || 0) + 1;

    // Record latency
    this.recordLatency(latency);

    // Record errors
    if (status >= 400) {
      this.recordError(status.toString());
    }
  }

  recordError(code: string) {
    this.metrics.errors.total++;
    this.metrics.errors.by_code[code] = (this.metrics.errors.by_code[code] || 0) + 1;
    this.errorTimestamps.push(Date.now());

    // Calculate 5-minute error rate
    this.calculateErrorRate();
  }

  recordLatency(latency: number) {
    this.latencySamples.push(latency);

    // Keep only recent samples
    if (this.latencySamples.length > this.MAX_LATENCY_SAMPLES) {
      this.latencySamples = this.latencySamples.slice(-this.MAX_LATENCY_SAMPLES);
    }

    // Calculate percentiles
    this.calculateLatencyPercentiles();
  }

  recordIdempotencyHit() {
    this.metrics.idempotency.cache_hits++;
    this.updateIdempotencyRate();
  }

  recordIdempotencyMiss() {
    this.metrics.idempotency.cache_misses++;
    this.updateIdempotencyRate();
  }

  recordUpstreamCall(success: boolean, latency?: number) {
    this.metrics.upstream.calls++;
    if (!success) {
      this.metrics.upstream.failures++;
    }
    if (latency) {
      // Simple moving average for upstream latency
      const total = this.metrics.upstream.calls;
      this.metrics.upstream.avg_latency = ((this.metrics.upstream.avg_latency * (total - 1)) + latency) / total;
    }
  }

  private calculateLatencyPercentiles() {
    if (this.latencySamples.length === 0) return;

    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const len = sorted.length;

    this.metrics.latency.p50 = sorted[Math.floor(Math.min(len - 1, len * 0.5))];
    this.metrics.latency.p95 = sorted[Math.floor(Math.min(len - 1, len * 0.95))];
    this.metrics.latency.p99 = sorted[Math.floor(Math.min(len - 1, len * 0.99))];
    this.metrics.latency.samples = len;
  }

  private calculateErrorRate() {
    const now = Date.now();
    // Remove errors older than 5 minutes
    this.errorTimestamps = this.errorTimestamps.filter(ts => now - ts < this.ERROR_WINDOW_MS);
    this.metrics.errors.rate_5m = (this.errorTimestamps.length / (this.ERROR_WINDOW_MS / 1000)) * 60; // errors per minute
  }

  private updateIdempotencyRate() {
    const total = this.metrics.idempotency.cache_hits + this.metrics.idempotency.cache_misses;
    this.metrics.idempotency.hit_rate = total > 0 ? (this.metrics.idempotency.cache_hits / total) * 100 : 0;
  }

  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  getDashboardData() {
    return {
      summary: {
        total_requests: this.metrics.requests.total,
        error_rate_5m: this.metrics.errors.rate_5m,
        avg_latency: this.latencySamples.length > 0 ?
          this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length : 0,
        idempotency_hit_rate: this.metrics.idempotency.hit_rate,
      },
      latency: {
        p50: this.metrics.latency.p50,
        p95: this.metrics.latency.p95,
        p99: this.metrics.latency.p99,
      },
      errors: this.metrics.errors.by_code,
      routes: this.metrics.requests.by_route,
      upstream: {
        success_rate: this.metrics.upstream.calls > 0 ?
          ((this.metrics.upstream.calls - this.metrics.upstream.failures) / this.metrics.upstream.calls) * 100 : 100,
        avg_latency: this.metrics.upstream.avg_latency,
      },
    };
  }

  reset() {
    this.metrics = {
      requests: { total: 0, by_route: {}, by_status: {}, by_method: {} },
      latency: { p50: 0, p95: 0, p99: 0, samples: 0 },
      errors: { total: 0, by_code: {}, rate_5m: 0 },
      idempotency: { cache_hits: 0, cache_misses: 0, hit_rate: 0 },
      upstream: { calls: 0, failures: 0, avg_latency: 0 },
    };
    this.errorTimestamps = [];
    this.latencySamples = [];
  }
}

export const metricsCollector = new MetricsCollector();

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  res.on('finish', () => {
    const latency = Date.now() - startTime;
    const route = req.route?.path || req.path;

    metricsCollector.recordRequest(req.method, route, res.statusCode, latency);

    req.log?.info({
      latency_ms: latency,
      status: res.statusCode,
      route,
      method: req.method,
    }, 'request metrics recorded');
  });

  next();
}
