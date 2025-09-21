import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'hyperindex-backend',
    version: process.env.npm_package_version || '0.1.0',
  },
  transport: process.env.NODE_ENV === 'production' ? undefined : {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname',
    },
  },
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

export type Logger = typeof logger;