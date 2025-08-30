import { Request, Response, NextFunction } from 'express';
import { PostgrestError } from '@supabase/supabase-js';

// Custom error classes
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR');
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(`${service} service is currently unavailable`, 503, 'SERVICE_UNAVAILABLE');
    this.name = 'ServiceUnavailableError';
  }
}

// Error response interface
interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: any;
  timestamp: string;
  path: string;
  method: string;
  requestId?: string;
  stack?: string;
}

// Handle different types of errors
const handleSupabaseError = (error: PostgrestError): AppError => {
  const { code, message, details } = error;
  
  switch (code) {
    case '23505': // Unique violation
      return new ConflictError('Resource already exists');
    case '23503': // Foreign key violation
      return new ValidationError('Referenced resource does not exist');
    case '23502': // Not null violation
      return new ValidationError('Required field is missing');
    case '42P01': // Undefined table
      return new AppError('Database configuration error', 500, 'DATABASE_ERROR');
    case 'PGRST116': // No rows found
      return new NotFoundError();
    default:
      return new AppError(message || 'Database operation failed', 500, 'DATABASE_ERROR');
  }
};

const handleJWTError = (error: Error): AppError => {
  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('Token has expired');
  }
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid token');
  }
  if (error.name === 'NotBeforeError') {
    return new AuthenticationError('Token not active yet');
  }
  return new AuthenticationError('Token verification failed');
};

const handleValidationError = (error: any): AppError => {
  if (error.isJoi) {
    const details = error.details.map((detail: any) => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
    
    return new ValidationError('Validation failed', details);
  }
  
  return new ValidationError(error.message);
};

const handleCastError = (error: any): AppError => {
  return new ValidationError(`Invalid ${error.path}: ${error.value}`);
};

const handleDuplicateFieldsError = (error: any): AppError => {
  const field = Object.keys(error.keyValue)[0];
  return new ConflictError(`${field} already exists`);
};

// Main error handler middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let appError: AppError;

  // Handle different error types
  if (error instanceof AppError) {
    appError = error;
  } else if (error.name === 'PostgrestError' || (error as any).code) {
    appError = handleSupabaseError(error as PostgrestError);
  } else if (error.name?.includes('JWT') || error.name?.includes('Token')) {
    appError = handleJWTError(error);
  } else if ((error as any).isJoi || error.name === 'ValidationError') {
    appError = handleValidationError(error);
  } else if (error.name === 'CastError') {
    appError = handleCastError(error);
  } else if ((error as any).code === 11000) {
    appError = handleDuplicateFieldsError(error);
  } else if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
    appError = new ValidationError('Invalid JSON format');
  } else {
    // Generic server error
    appError = new AppError(
      process.env.NODE_ENV === 'production' 
        ? 'Something went wrong' 
        : error.message,
      500,
      'INTERNAL_SERVER_ERROR'
    );
  }

  // Log error for debugging
  if (appError.statusCode >= 500) {
    console.error('🚨 Server Error:', {
      message: appError.message,
      stack: appError.stack,
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      user: req.user?.id,
      timestamp: new Date().toISOString()
    });
  } else {
    console.warn('⚠️ Client Error:', {
      message: appError.message,
      code: appError.code,
      url: req.originalUrl,
      method: req.method,
      user: req.user?.id,
      timestamp: new Date().toISOString()
    });
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: appError.name || 'Error',
    message: appError.message,
    code: appError.code,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    requestId: req.headers['x-request-id'] as string
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = appError.stack;
  }

  // Include error details for validation errors
  if (appError instanceof ValidationError && (appError as any).details) {
    errorResponse.details = (appError as any).details;
  }

  res.status(appError.statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
};

// Unhandled promise rejection handler
export const handleUnhandledRejection = (): void => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('🚨 Unhandled Promise Rejection:', reason);
    console.error('Promise:', promise);
    
    // Graceful shutdown
    process.exit(1);
  });
};

// Uncaught exception handler
export const handleUncaughtException = (): void => {
  process.on('uncaughtException', (error: Error) => {
    console.error('🚨 Uncaught Exception:', error);
    
    // Graceful shutdown
    process.exit(1);
  });
};

// Initialize error handlers
export const initializeErrorHandlers = (): void => {
  handleUnhandledRejection();
  handleUncaughtException();
};