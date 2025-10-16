import { Router } from 'express';
import { metricsCollector } from '../middlewares/metricsCollector.js';

export const monitoringRouter = Router();

monitoringRouter.get('/', (_req, res) => {
  const metrics = metricsCollector.getMetrics();
  res.json({
    timestamp: new Date().toISOString(),
    metrics,
  });
});

monitoringRouter.get('/dashboard', (_req, res) => {
  const dashboard = metricsCollector.getDashboardData();
  res.json({
    timestamp: new Date().toISOString(),
    ...dashboard,
  });
});
