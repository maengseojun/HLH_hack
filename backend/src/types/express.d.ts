import { Logger } from '../infra/logger.js';

declare global {
  namespace Express {
    interface Request {
      log?: Logger;
      requestId?: string;
      traceId?: string;
      userId?: string;
      startTime?: number;
      validated?: {
        body?: any;
        query?: any;
        params?: any;
      };
    }
  }
}

export {};
