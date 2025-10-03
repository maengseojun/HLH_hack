import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';
const inServerless = Boolean(process.env.VERCEL);

const transport = !isProd && !inServerless ? {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'yyyy-mm-dd HH:MM:ss',
    ignore: 'pid,hostname',
  },
} : undefined;

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'hyperindex-backend',
    version: process.env.npm_package_version || '0.1.0',
  },
  // Pretty transport is only available for local runs; disable on Vercel/serverless.
  transport,
  formatters: {
    level: (label) => ({ level: label }),
  },
});

export type Logger = typeof logger;
