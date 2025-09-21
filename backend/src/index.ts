import express from 'express';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { assetsRouter } from './routes/assets.js';
import { healthRouter } from './routes/health.js';
import { basketsRouter } from './routes/baskets.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again later.'
  }
});

app.use('/health', healthRouter);
app.use('/v1/assets', apiLimiter, assetsRouter);
app.use('/v1/baskets', apiLimiter, basketsRouter);

app.use(errorHandler);

const port = config.port;

app.listen(port, () => {
  console.log(`HyperIndex backend listening on port ${port}`);
});

export { app };
