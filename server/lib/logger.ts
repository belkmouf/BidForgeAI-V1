import winston from 'winston';
import path from 'path';

// Define log levels with priorities
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

// Define colors for different log levels
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'gray'
};

winston.addColors(logColors);

// Custom format for development
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

// Custom format for production
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
      environment: process.env.NODE_ENV,
      service: 'bidforge-api',
      version: process.env.npm_package_version || '1.0.0'
    });
  })
);

// File transport configuration
const createFileTransport = (filename: string, level: string) => {
  return new winston.transports.File({
    filename: path.join('logs', filename),
    level,
    format: productionFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 10,
    tailable: true
  });
};

// Console transport configuration
const consoleTransport = new winston.transports.Console({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat
});

// Create the main logger
export const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  transports: [
    consoleTransport,
    ...(process.env.NODE_ENV === 'production' ? [
      createFileTransport('error.log', 'error'),
      createFileTransport('combined.log', 'info'),
      createFileTransport('debug.log', 'debug')
    ] : [])
  ],
  // Don't exit on handled exceptions
  exitOnError: false
});

// Handle unhandled exceptions and rejections
if (process.env.NODE_ENV === 'production') {
  logger.exceptions.handle(
    createFileTransport('exceptions.log', 'error')
  );

  logger.rejections.handle(
    createFileTransport('rejections.log', 'error')
  );
}

// Create specialized loggers for different domains
export const securityLogger = winston.createLogger({
  levels: logLevels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        type: 'security',
        ...meta
      });
    })
  ),
  transports: [
    consoleTransport,
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({
        filename: path.join('logs', 'security.log'),
        maxsize: 5242880,
        maxFiles: 20,
      })
    ] : [])
  ]
});

export const auditLogger = winston.createLogger({
  levels: logLevels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        type: 'audit',
        ...meta
      });
    })
  ),
  transports: [
    consoleTransport,
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({
        filename: path.join('logs', 'audit.log'),
        maxsize: 5242880,
        maxFiles: 50, // Keep more audit logs
      })
    ] : [])
  ]
});

export const performanceLogger = winston.createLogger({
  levels: logLevels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        type: 'performance',
        ...meta
      });
    })
  ),
  transports: [
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({
        filename: path.join('logs', 'performance.log'),
        maxsize: 5242880,
        maxFiles: 10,
      })
    ] : [consoleTransport])
  ]
});

// Utility functions for structured logging
export const logContext = {
  // Authentication and security
  security: (message: string, meta: {
    userId?: number;
    email?: string;
    ip?: string;
    userAgent?: string;
    action?: string;
    result?: 'success' | 'failure';
    reason?: string;
  }) => {
    securityLogger.info(message, meta);
  },

  // User actions for audit trail
  audit: (message: string, meta: {
    userId?: number;
    email?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    changes?: any;
    ip?: string;
    userAgent?: string;
  }) => {
    auditLogger.info(message, meta);
  },

  // Performance monitoring
  performance: (message: string, meta: {
    operation: string;
    duration: number;
    success: boolean;
    userId?: number;
    metadata?: any;
  }) => {
    performanceLogger.info(message, meta);
  },

  // AI operations
  ai: (message: string, meta: {
    model?: string;
    operation: string;
    projectId?: string;
    userId?: number;
    duration?: number;
    tokenUsage?: number;
    success: boolean;
    error?: string;
  }) => {
    logger.info(message, { 
      type: 'ai',
      ...meta 
    });
  },

  // Database operations
  database: (message: string, meta: {
    operation: string;
    table?: string;
    duration?: number;
    success: boolean;
    error?: string;
    userId?: number;
  }) => {
    logger.info(message, { 
      type: 'database',
      ...meta 
    });
  },

  // API requests
  api: (message: string, meta: {
    method: string;
    path: string;
    statusCode: number;
    duration: number;
    userId?: number;
    ip?: string;
    userAgent?: string;
    error?: string;
  }) => {
    logger.http(message, { 
      type: 'api',
      ...meta 
    });
  },

  // Business logic errors
  business: (message: string, meta: {
    operation: string;
    userId?: number;
    projectId?: string;
    error?: string;
    data?: any;
  }) => {
    logger.error(message, { 
      type: 'business',
      ...meta 
    });
  },

  // System events
  system: (message: string, meta: {
    event: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    metadata?: any;
  }) => {
    const level = meta.severity === 'critical' ? 'error' : 
                  meta.severity === 'high' ? 'warn' : 'info';
    
    logger.log(level, message, { 
      type: 'system',
      ...meta 
    });
  }
};

// Express middleware for request logging
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  // Log request start
  logger.http('Request started', {
    type: 'request-start',
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.userId
  });

  // Override res.end to capture response
  const originalEnd = res.end;
  res.end = function(chunk: any, encoding: any) {
    const duration = Date.now() - start;
    
    logContext.api('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.userId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Error logging middleware
export const errorLogger = (err: any, req: any, res: any, next: any) => {
  logger.error('Request error', {
    type: 'request-error',
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    userId: req.user?.userId,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  next(err);
};

// Graceful shutdown handler
export const gracefulShutdown = () => {
  logger.info('Graceful shutdown initiated');
  
  // Wait for logs to be written
  logger.on('finish', () => {
    process.exit(0);
  });
  
  logger.end();
};

// Handle process events
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export default logger;