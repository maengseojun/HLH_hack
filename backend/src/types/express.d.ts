declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      traceId?: string;
      user?: { id: string; email?: string };
      userId?: string;
      startTime?: number;
      log?: import('pino').Logger;
    }
  }
}

export {};
