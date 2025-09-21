import { Router } from 'express';
import { cacheService } from '../cache/cacheService.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    cache: {
      entries: cacheService.size()
    }
  });
});

export { router as healthRouter };
