import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Log levels
enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

// Log entry interface
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  requestId: string;
  method: string;
  url: string;
  statusCode?: number;
  responseTime?: number;
  userAgent?: string;
  ip: string;
  userId?: string;
  userRole?: string;
  message?: string;
  error?: any;
  metadata?: any;
}

// Logger class
class Logger {
  private logLevel: LogLevel;
  private logFile: string;
  private logDir: string;

  constructor() {
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
    this.logFile = process.env.LOG_FILE || './logs/saferide.log';
    this.logDir = path.dirname(this.logFile);
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG, LogLevel.TRACE];
    return levels.indexOf(level) <= levels.indexOf(this.logLevel);
  }

  private formatLogEntry(entry: LogEntry): string {
    return JSON.stringify({
      ...entry,
      timestamp: new Date().toISOString()
    }) + '\n';
  }

  private writeToFile(entry: LogEntry): void {
    if (process.env.NODE_ENV !== 'test') {
      const logString = this.formatLogEntry(entry);
      fs.appendFileSync(this.logFile, logString);
    }
  }

  private writeToConsole(entry: LogEntry): void {
    const { level, message, requestId, method, url, statusCode, responseTime } = entry;
    const timestamp = new Date().toISOString();
    
    let emoji = '';
    let color = '';
    
    switch (level) {
      case LogLevel.ERROR:
        emoji = '🚨';
        color = '\x1b[31m'; // Red
        break;
      case LogLevel.WARN:
        emoji = '⚠️';
        color = '\x1b[33m'; // Yellow
        break;
      case LogLevel.INFO:
        emoji = 'ℹ️';
        color = '\x1b[36m'; // Cyan
        break;
      case LogLevel.DEBUG:
        emoji = '🐛';
        color = '\x1b[35m'; // Magenta
        break;
      case LogLevel.TRACE:
        emoji = '🔍';
        color = '\x1b[37m'; // White
        break;
    }
    
    const reset = '\x1b[0m';
    
    if (method && url) {
      // Request log format
      const statusEmoji = statusCode && statusCode >= 400 ? '❌' : '✅';
      console.log(
        `${color}${emoji} [${timestamp}] ${level.toUpperCase()}${reset} ` +
        `${statusEmoji} ${method} ${url} ` +
        `${statusCode ? `${statusCode} ` : ''}` +
        `${responseTime ? `${responseTime}ms ` : ''}` +
        `${requestId ? `[${requestId}]` : ''}` +
        `${message ? ` - ${message}` : ''}`
      );
    } else {
      // General log format
      console.log(
        `${color}${emoji} [${timestamp}] ${level.toUpperCase()}${reset} ` +
        `${message || 'No message'}` +
        `${requestId ? ` [${requestId}]` : ''}`
      );
    }
  }

  public log(level: LogLevel, entry: Partial<LogEntry>): void {
    if (!this.shouldLog(level)) return;

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId: entry.requestId || 'system',
      method: entry.method || '',
      url: entry.url || '',
      ip: entry.ip || '',
      ...entry
    };

    this.writeToConsole(logEntry);
    this.writeToFile(logEntry);
  }

  public error(message: string, error?: any, metadata?: any): void {
    this.log(LogLevel.ERROR, { message, error, metadata });
  }

  public warn(message: string, metadata?: any): void {
    this.log(LogLevel.WARN, { message, metadata });
  }

  public info(message: string, metadata?: any): void {
    this.log(LogLevel.INFO, { message, metadata });
  }

  public debug(message: string, metadata?: any): void {
    this.log(LogLevel.DEBUG, { message, metadata });
  }

  public trace(message: string, metadata?: any): void {
    this.log(LogLevel.TRACE, { message, metadata });
  }
}

// Global logger instance
export const logger = new Logger();

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const requestId = uuidv4();
  
  // Add request ID to headers for tracing
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Get client IP
  const ip = req.ip || 
    req.connection.remoteAddress || 
    req.socket.remoteAddress || 
    (req.connection as any)?.socket?.remoteAddress ||
    'unknown';

  // Log incoming request
  logger.log(LogLevel.INFO, {
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    userRole: req.user?.role,
    message: 'Incoming request',
    metadata: {
      query: req.query,
      body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
      headers: sanitizeHeaders(req.headers)
    }
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body: any) {
    const responseTime = Date.now() - startTime;
    
    // Log response
    logger.log(
      res.statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO,
      {
        requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime,
        ip,
        userId: req.user?.id,
        userRole: req.user?.role,
        message: 'Request completed',
        metadata: {
          responseBody: sanitizeResponse(body),
          responseSize: JSON.stringify(body).length
        }
      }
    );

    return originalJson.call(this, body);
  };

  // Handle response finish event
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    if (!res.headersSent) {
      logger.log(
        res.statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO,
        {
          requestId,
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          responseTime,
          ip,
          userId: req.user?.id,
          userRole: req.user?.role,
          message: 'Request finished'
        }
      );
    }
  });

  next();
};

// Sanitize sensitive data from logs
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

function sanitizeHeaders(headers: any): any {
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
  const sanitized = { ...headers };
  
  for (const header of sensitiveHeaders) {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

function sanitizeResponse(body: any): any {
  if (!body || typeof body !== 'object') return body;
  
  const sensitiveFields = ['password', 'token', 'secret', 'key'];
  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

// Performance monitoring middleware
export const performanceLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    // Log slow requests
    if (responseTime > 1000) { // Requests taking more than 1 second
      logger.warn('Slow request detected', {
        requestId: req.headers['x-request-id'] as string,
        method: req.method,
        url: req.originalUrl,
        responseTime: `${responseTime.toFixed(2)}ms`,
        statusCode: res.statusCode
      });
    }
  });
  
  next();
};

// Security event logger
export const securityLogger = {
  logFailedAuth: (req: Request, reason: string) => {
    logger.warn('Authentication failed', {
      requestId: req.headers['x-request-id'] as string,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      reason,
      timestamp: new Date().toISOString()
    });
  },
  
  logSuspiciousActivity: (req: Request, activity: string, details?: any) => {
    logger.warn('Suspicious activity detected', {
      requestId: req.headers['x-request-id'] as string,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      activity,
      details,
      timestamp: new Date().toISOString()
    });
  },
  
  logRateLimitExceeded: (req: Request) => {
    logger.warn('Rate limit exceeded', {
      requestId: req.headers['x-request-id'] as string,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  }
};

export { LogLevel };