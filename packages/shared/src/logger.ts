/**
 * Structured Logging Utility
 * Uses Pino for fast, structured JSON logging
 */

import pino from 'pino';

export interface LogContext {
  merchantId?: string;
  userId?: string;
  requestId?: string;
  correlationId?: string;
  [key: string]: any;
}

// Create logger instance
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Log rotation: Use pino/file transport in production for file rotation
  // In production, configure external log rotation (logrotate, etc.)
  // For now, logs go to stdout/stderr (handled by process manager)
});

/**
 * Create a child logger with context
 */
export function createLogger(context: LogContext = {}) {
  return logger.child(context);
}

/**
 * Helper functions for common log operations
 */
export const log = {
  debug: (message: string, context?: LogContext) => {
    logger.debug(context || {}, message);
  },
  info: (message: string, context?: LogContext) => {
    logger.info(context || {}, message);
  },
  warn: (message: string, context?: LogContext) => {
    logger.warn(context || {}, message);
  },
  error: (message: string, error?: Error | unknown, context?: LogContext) => {
    const errorContext: LogContext = {
      ...context,
    };

    if (error instanceof Error) {
      errorContext.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error) {
      errorContext.error = error;
    }

    logger.error(errorContext, message);
  },
};

export default logger;
