/**
 * Structured Logger Service
 * Winston integration với JSON output, request tracking, performance logging
 */

import winston, { Logger }from 'winston';

// Logger configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

/**
 * Create logger instance
 */
function createLogger(): Logger {
  const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    defaultMeta: { service: 'pharma-dna' },
    transports: [
      // Console output
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, ...meta }) => {
            const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp}[${level}]: ${message}${metaStr}`;
          })
        ),
      }),

      // File output - all logs
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880,
        maxFiles: 5,
      }),

      // File output - errors only
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880,
        maxFiles: 5,
      }),
    ],
  });

  return logger;
}

// Singleton instance
let loggerInstance: Logger | null = null;

/**
 * Get logger instance (singleton)
 */
export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = createLogger();
  }
  return loggerInstance;
}

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/**
 * Structured logging context
 */
export interface LogContext {
  requestId?: string;
  userId?: string;
  email?: string;
  role?: string;
  ip?: string;
  userAgent?: string;
  duration?: number;
  statusCode?: number;
  endpoint?: string;
  method?: string;
  [key: string]: any;
}

/**
 * Log error
 */
export function logError(message: string, error?: Error | any, context?: LogContext) {
  const logger = getLogger();
  logger.error(message, {
    ...context,
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
    }: error,
  });
}

/**
 * Log warning
 */
export function logWarn(message: string, context?: LogContext) {
  const logger = getLogger();
  logger.warn(message, context);
}

/**
 * Log info
 */
export function logInfo(message: string, context?: LogContext) {
  const logger = getLogger();
  logger.info(message, context);
}

/**
 * Log debug
 */
export function logDebug(message: string, context?: LogContext) {
  const logger = getLogger();
  logger.debug(message, context);
}

/**
 * Log API request
 */
export function logRequest(context: {
  requestId: string;
  method: string;
  endpoint: string;
  ip: string;
  userAgent?: string;
}) {
  logDebug(`API Request: ${context.method} ${context.endpoint}`, context);
}

/**
 * Log API response
 */
export function logResponse(context: {
  requestId: string;
  statusCode: number;
  duration: number;
  endpoint: string;
  method: string;
  userId?: string;
  error?: string;
}) {
  const level = context.statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
  const message = `API Response: ${context.method}${context.endpoint} - ${context.statusCode} (${context.duration}ms)`;
  
  if (level === LogLevel.WARN) {
    logWarn(message, context);
  } else {
    logInfo(message, context);
  }
}

/**
 * Log database query
 */
export function logQuery(context: {
  requestId: string;
  query: string;
  duration: number;
  rowCount?: number;
  error?: string;
}) {
  const isSlowQuery = context.duration > 1000;
  const level = context.error ? LogLevel.ERROR : isSlowQuery ? LogLevel.WARN : LogLevel.DEBUG;
  const message = `Database Query (${context.duration}ms)`;
  
  const logData = {
    ...context,
    query: context.query.substring(0, 200),
    slow: isSlowQuery,
  };

  if (level === LogLevel.ERROR) {
    logError(message, new Error(context.error), logData);
  } else if (level === LogLevel.WARN) {
    logWarn(message, logData);
  } else {
    logDebug(message, logData);
  }
}

/**
 * Log blockchain transaction
 */
export function logBlockchain(context: {
  requestId: string;
  action: string;
  digest?: string;
  objectId?: string;
  status: 'pending' | 'success' | 'error';
  duration: number;
  error?: string;
}) {
  const level = context.status === 'error' ? LogLevel.ERROR : LogLevel.INFO;
  const message = `Blockchain ${context.action}: ${context.status}`;
  
  if (level === LogLevel.ERROR) {
    logError(message, new Error(context.error), context);
  } else {
    logInfo(message, context);
  }
}

/**
 * Log business event
 */
export function logEvent(context: {
  requestId: string;
  event: string;
  userId?: string;
  role?: string;
  details?: Record<string, any>;
  severity?: 'info' | 'warning' | 'critical';
}) {
  const level = context.severity === 'critical' ? LogLevel.ERROR : 
               context.severity === 'warning' ? LogLevel.WARN : LogLevel.INFO;
  const message = `Event: ${context.event}`;
  
  if (level === LogLevel.ERROR) {
    logError(message, undefined, context);
  } else if (level === LogLevel.WARN) {
    logWarn(message, context);
  }else {
    logInfo(message, context);
  }
}

/**
 * Log security event (for audit trail)
 */
export function logSecurityEvent(context: {
  requestId: string;
  event: string;
  userId?: string;
  action: string;
  resource: string;
  result: 'allowed' | 'denied' | 'error';
  reason?: string;
}) {
  const level = context.result === 'error' ? LogLevel.ERROR : 
               context.result === 'denied' ? LogLevel.WARN : LogLevel.INFO;
  const message = `Security Event: ${context.event} - ${context.result}`;
  
  const logData = {
    ...context,
    timestamp: new Date().toISOString(),
  };

  if (level === LogLevel.ERROR) {
    logError(message, undefined, logData);
  }else if (level === LogLevel.WARN) {
    logWarn(message, logData);
  } else {
    logInfo(message, logData);
  }
}

/**
 * Log performance metric
 */
export function logPerformance(context: {
  requestId: string;
  operation: string;
  duration: number;
  threshold?: number;
}) {
  const isSlowOperation = context.threshold && context.duration > context.threshold;
  const level = isSlowOperation ? LogLevel.WARN : LogLevel.DEBUG;
  const message = `Performance: ${context.operation}took ${context.duration}ms`;
  
  if (level === LogLevel.WARN) {
    logWarn(message, {
      ...context,
      slow: true,
    });
  }else {
    logDebug(message, context);
  }
}
