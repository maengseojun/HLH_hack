import { Router } from 'express';
import { metricsCollector } from '../middlewares/metricsCollector.js';
import { logger } from '../infra/logger.js';

export const monitoringRouter = Router();

// Basic health check
monitoringRouter.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '0.1.0',
  });
});

// Metrics endpoint (Prometheus-style)
monitoringRouter.get('/metrics', (req, res) => {
  const metrics = metricsCollector.getMetrics();

  // Simple text format for now (can be extended to Prometheus format)
  const textMetrics = [
    `# HELP http_requests_total Total number of HTTP requests`,
    `# TYPE http_requests_total counter`,
    `http_requests_total ${metrics.requests.total}`,
    '',
    `# HELP http_request_duration_seconds HTTP request latency`,
    `# TYPE http_request_duration_seconds histogram`,
    `http_request_duration_seconds{quantile="0.5"} ${metrics.latency.p50 / 1000}`,
    `http_request_duration_seconds{quantile="0.95"} ${metrics.latency.p95 / 1000}`,
    `http_request_duration_seconds{quantile="0.99"} ${metrics.latency.p99 / 1000}`,
    '',
    `# HELP http_errors_total Total number of HTTP errors`,
    `# TYPE http_errors_total counter`,
    `http_errors_total ${metrics.errors.total}`,
    '',
    `# HELP http_error_rate_5m HTTP error rate over 5 minutes`,
    `# TYPE http_error_rate_5m gauge`,
    `http_error_rate_5m ${metrics.errors.rate_5m}`,
    '',
    `# HELP idempotency_cache_hit_rate Idempotency cache hit rate`,
    `# TYPE idempotency_cache_hit_rate gauge`,
    `idempotency_cache_hit_rate ${metrics.idempotency.hit_rate}`,
    '',
    `# HELP upstream_calls_total Total upstream API calls`,
    `# TYPE upstream_calls_total counter`,
    `upstream_calls_total ${metrics.upstream.calls}`,
    '',
    `# HELP upstream_failures_total Total upstream API failures`,
    `# TYPE upstream_failures_total counter`,
    `upstream_failures_total ${metrics.upstream.failures}`,
    '',
    `# HELP upstream_duration_seconds Average upstream call duration`,
    `# TYPE upstream_duration_seconds gauge`,
    `upstream_duration_seconds ${metrics.upstream.avg_latency / 1000}`,
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(textMetrics);
});

// Dashboard data endpoint (JSON format for internal dashboards)
monitoringRouter.get('/dashboard', (req, res) => {
  const dashboardData = metricsCollector.getDashboardData();

  res.json({
    timestamp: new Date().toISOString(),
    data: dashboardData,
    alerts: generateAlerts(dashboardData),
  });
});

// Simple alerting logic
function generateAlerts(data: any) {
  const alerts = [];

  // Error rate alert (>2%)
  if (data.summary.error_rate_5m > 2) {
    alerts.push({
      level: 'warning',
      message: `High error rate: ${data.summary.error_rate_5m.toFixed(2)} errors/min (threshold: 2/min)`,
      metric: 'error_rate_5m',
      value: data.summary.error_rate_5m,
      threshold: 2,
    });
  }

  // High latency alert (p95 > 1200ms)
  if (data.latency.p95 > 1200) {
    alerts.push({
      level: 'warning',
      message: `High p95 latency: ${data.latency.p95}ms (threshold: 1200ms)`,
      metric: 'latency_p95',
      value: data.latency.p95,
      threshold: 1200,
    });
  }

  // Upstream failure rate alert (success rate < 95%)
  if (data.upstream.success_rate < 95) {
    alerts.push({
      level: 'critical',
      message: `Low upstream success rate: ${data.upstream.success_rate.toFixed(1)}% (threshold: 95%)`,
      metric: 'upstream_success_rate',
      value: data.upstream.success_rate,
      threshold: 95,
    });
  }

  return alerts;
}

// Log aggregation endpoint
monitoringRouter.get('/logs', (req, res) => {
  const level = req.query.level as string || 'info';
  const limit = parseInt(req.query.limit as string) || 100;

  // In a real implementation, this would query a log aggregation system
  // For MVP, we'll return a simple response
  res.json({
    message: 'Log aggregation endpoint - integrate with your log storage system',
    query: { level, limit },
    suggestion: 'Use ELK stack, Fluentd, or similar for production log aggregation',
  });
});

// Manual metrics reset (useful for testing)
monitoringRouter.post('/metrics/reset', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not allowed in production' });
  }

  metricsCollector.reset();
  logger.info('Metrics manually reset');

  res.json({
    message: 'Metrics reset successfully',
    timestamp: new Date().toISOString(),
  });
});