import type { RequestHandler } from 'express';

declare module '../dist/index.js' {
  const app: RequestHandler;
  export { app };
  export default app;
}
