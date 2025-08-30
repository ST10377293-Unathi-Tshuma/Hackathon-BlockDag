import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { authMiddleware } from '../middleware/auth';
import { validationMiddleware } from '../middleware/validation';
import { errorHandler } from '../middleware/errorHandler';
import { requestLogger } from '../middleware/logger';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.API_GATEWAY_PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: process.env.CORS_CREDENTIALS === 'true'
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || 'v1',
    services: {
      gateway: 'running',
      database: 'connected',
      blockchain: 'connected'
    }
  });
});

// API version prefix
const API_PREFIX = `/api/${process.env.API_VERSION || 'v1'}`;

// Service endpoints configuration
const services = {
  auth: {
    target: `http://localhost:${process.env.PASSENGER_MANAGEMENT_PORT || 3003}`,
    pathRewrite: { [`^${API_PREFIX}/auth`]: '/auth' }
  },
  drivers: {
    target: `http://localhost:${process.env.DRIVER_VERIFICATION_PORT || 3002}`,
    pathRewrite: { [`^${API_PREFIX}/drivers`]: '/drivers' }
  },
  passengers: {
    target: `http://localhost:${process.env.PASSENGER_MANAGEMENT_PORT || 3003}`,
    pathRewrite: { [`^${API_PREFIX}/passengers`]: '/passengers' }
  },
  rides: {
    target: `http://localhost:${process.env.RIDE_BOOKING_PORT || 3005}`,
    pathRewrite: { [`^${API_PREFIX}/rides`]: '/rides' }
  },
  emergency: {
    target: `http://localhost:${process.env.EMERGENCY_SERVICE_PORT || 3004}`,
    pathRewrite: { [`^${API_PREFIX}/emergency`]: '/emergency' }
  },
  blockchain: {
    target: `http://localhost:${process.env.BLOCKCHAIN_SERVICE_PORT || 3006}`,
    pathRewrite: { [`^${API_PREFIX}/blockchain`]: '/blockchain' }
  }
};

// Public routes (no authentication required)
const publicRoutes = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/drivers/register',
  '/passengers/register'
];

// Authentication middleware for protected routes
app.use((req, res, next) => {
  const isPublicRoute = publicRoutes.some(route => 
    req.path.startsWith(`${API_PREFIX}${route}`)
  );
  
  if (isPublicRoute || req.path === '/health') {
    return next();
  }
  
  return authMiddleware(req, res, next);
});

// Route-specific validation middleware
app.use(`${API_PREFIX}/drivers`, validationMiddleware.driver);
app.use(`${API_PREFIX}/passengers`, validationMiddleware.passenger);
app.use(`${API_PREFIX}/rides`, validationMiddleware.ride);
app.use(`${API_PREFIX}/emergency`, validationMiddleware.emergency);

// Service proxies
Object.entries(services).forEach(([serviceName, config]) => {
  const proxyOptions = {
    target: config.target,
    changeOrigin: true,
    pathRewrite: config.pathRewrite,
    onError: (err: Error, req: express.Request, res: express.Response) => {
      console.error(`Proxy error for ${serviceName}:`, err.message);
      res.status(503).json({
        error: 'Service temporarily unavailable',
        service: serviceName,
        message: 'Please try again later'
      });
    },
    onProxyReq: (proxyReq: any, req: express.Request) => {
      // Forward user information to microservices
      if (req.user) {
        proxyReq.setHeader('X-User-ID', req.user.id);
        proxyReq.setHeader('X-User-Role', req.user.role);
      }
    },
    timeout: 30000,
    proxyTimeout: 30000
  };

  app.use(
    `${API_PREFIX}/${serviceName}`,
    createProxyMiddleware(proxyOptions)
  );
});

// 404 handler for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}${API_PREFIX}`);
  console.log('🔧 Configured services:', Object.keys(services).join(', '));
});

export default app;