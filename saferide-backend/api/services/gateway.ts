import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { authenticateToken, verifyWalletSignature } from '../middleware/auth.js';
import { generalLimiter, authLimiter, emergencyLimiter, rideLimiter } from '../middleware/rateLimiter.js';
import { requestLogger, securityHeaders } from '../middleware/errorHandler.js';
import { logger } from '../middleware/errorHandler.js';
import { ApiResponse } from '../../shared/types.js';

/**
 * API Gateway Service
 * Routes requests to appropriate microservices
 */

interface ServiceConfig {
  name: string;
  baseUrl: string;
  healthEndpoint: string;
  timeout: number;
}

interface RouteConfig {
  path: string;
  target: string;
  methods: string[];
  auth: boolean;
  rateLimit?: any;
  middleware?: any[];
}

class APIGateway {
  private app: express.Application;
  private services: Map<string, ServiceConfig> = new Map();
  private routes: RouteConfig[] = [];

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.registerServices();
    this.setupRoutes();
    this.setupHealthCheck();
  }

  private setupMiddleware(): void {
    // Security headers
    this.app.use(securityHeaders);
    
    // Request logging
    this.app.use(requestLogger);
    
    // General rate limiting
    this.app.use(generalLimiter);
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  private registerServices(): void {
    // Register microservices
    this.services.set('driver-verification', {
      name: 'Driver Verification Service',
      baseUrl: process.env.DRIVER_SERVICE_URL || 'http://localhost:3001',
      healthEndpoint: '/health',
      timeout: 30000
    });

    this.services.set('passenger-management', {
      name: 'Passenger Management Service',
      baseUrl: process.env.PASSENGER_SERVICE_URL || 'http://localhost:3002',
      healthEndpoint: '/health',
      timeout: 30000
    });

    this.services.set('emergency', {
      name: 'Emergency Service',
      baseUrl: process.env.EMERGENCY_SERVICE_URL || 'http://localhost:3003',
      healthEndpoint: '/health',
      timeout: 10000
    });

    this.services.set('ride-booking', {
      name: 'Ride Booking Service',
      baseUrl: process.env.RIDE_SERVICE_URL || 'http://localhost:3004',
      healthEndpoint: '/health',
      timeout: 30000
    });
  }

  private setupRoutes(): void {
    // Authentication routes (no proxy, handled directly)
    this.app.post('/api/auth/login', authLimiter, this.handleLogin.bind(this));
    this.app.post('/api/auth/verify-wallet', authLimiter, this.handleWalletVerification.bind(this));
    this.app.post('/api/auth/refresh', authLimiter, this.handleTokenRefresh.bind(this));

    // Driver Verification Service routes
    this.setupServiceProxy('/api/drivers', 'driver-verification', {
      auth: true,
      rateLimit: generalLimiter
    });

    // Passenger Management Service routes
    this.setupServiceProxy('/api/passengers', 'passenger-management', {
      auth: true,
      rateLimit: generalLimiter
    });

    // Emergency Service routes
    this.setupServiceProxy('/api/emergency', 'emergency', {
      auth: true,
      rateLimit: emergencyLimiter
    });

    // Ride Booking Service routes
    this.setupServiceProxy('/api/rides', 'ride-booking', {
      auth: true,
      rateLimit: rideLimiter
    });

    // Public routes (no authentication required)
    this.setupServiceProxy('/api/public', 'passenger-management', {
      auth: false,
      rateLimit: generalLimiter
    });
  }

  private setupServiceProxy(
    path: string,
    serviceName: string,
    options: { auth: boolean; rateLimit?: any; middleware?: any[] }
  ): void {
    const service = this.services.get(serviceName);
    if (!service) {
      logger.error(`Service ${serviceName} not found`);
      return;
    }

    const middleware: any[] = [];

    // Add rate limiting
    if (options.rateLimit) {
      middleware.push(options.rateLimit);
    }

    // Add authentication
    if (options.auth) {
      middleware.push(authenticateToken);
    }

    // Add custom middleware
    if (options.middleware) {
      middleware.push(...options.middleware);
    }

    // Add service health check middleware
    middleware.push(this.createHealthCheckMiddleware(serviceName));

    // Create proxy middleware
    const proxyMiddleware = createProxyMiddleware({
      target: service.baseUrl,
      changeOrigin: true,
      pathRewrite: {
        [`^${path}`]: ''
      },
      timeout: service.timeout,
      onError: (err, req, res) => {
        logger.error(`Proxy error for ${serviceName}`, { error: err, path: req.url });
        (res as Response).status(503).json({
          success: false,
          error: `Service ${serviceName} unavailable`
        } as ApiResponse);
      },
      onProxyReq: (proxyReq, req) => {
        // Add request headers
        proxyReq.setHeader('X-Gateway-Request-ID', this.generateRequestId());
        proxyReq.setHeader('X-Gateway-Timestamp', new Date().toISOString());
        
        // Forward user information
        if ((req as any).user) {
          proxyReq.setHeader('X-User-ID', (req as any).user.userId);
          proxyReq.setHeader('X-User-Type', (req as any).user.userType);
          proxyReq.setHeader('X-Wallet-Address', (req as any).user.walletAddress);
        }
      },
      onProxyRes: (proxyRes, req, res) => {
        // Add response headers
        proxyRes.headers['X-Gateway-Service'] = serviceName;
        proxyRes.headers['X-Gateway-Timestamp'] = new Date().toISOString();
      }
    });

    // Apply middleware and proxy
    this.app.use(path, ...middleware, proxyMiddleware);

    logger.info(`Proxy route configured: ${path} -> ${service.baseUrl}`);
  }

  private createHealthCheckMiddleware(serviceName: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const service = this.services.get(serviceName);
      if (!service) {
        return res.status(503).json({
          success: false,
          error: `Service ${serviceName} not configured`
        } as ApiResponse);
      }

      try {
        // Simple health check - in production, implement proper health checking
        next();
      } catch (error) {
        logger.error(`Health check failed for ${serviceName}`, { error });
        res.status(503).json({
          success: false,
          error: `Service ${serviceName} health check failed`
        } as ApiResponse);
      }
    };
  }

  private async handleLogin(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement proper authentication logic
      // This would typically validate credentials and return JWT token
      
      const { walletAddress, signature, message } = req.body;
      
      if (!walletAddress || !signature || !message) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: walletAddress, signature, message'
        } as ApiResponse);
        return;
      }

      // Verify wallet signature (simplified)
      // In production, implement proper signature verification
      
      res.json({
        success: true,
        data: {
          token: 'jwt-token-placeholder',
          user: {
            walletAddress,
            userType: 'passenger' // Determine from database
          }
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Login error', { error });
      res.status(500).json({
        success: false,
        error: 'Login failed'
      } as ApiResponse);
    }
  }

  private async handleWalletVerification(req: Request, res: Response): Promise<void> {
    try {
      const { walletAddress, signature, message } = req.body;
      
      // TODO: Implement wallet signature verification
      // Use blockchain utilities to verify signature
      
      res.json({
        success: true,
        data: {
          verified: true,
          walletAddress
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Wallet verification error', { error });
      res.status(500).json({
        success: false,
        error: 'Wallet verification failed'
      } as ApiResponse);
    }
  }

  private async handleTokenRefresh(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement token refresh logic
      
      res.json({
        success: true,
        data: {
          token: 'new-jwt-token-placeholder'
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Token refresh error', { error });
      res.status(500).json({
        success: false,
        error: 'Token refresh failed'
      } as ApiResponse);
    }
  }

  private setupHealthCheck(): void {
    this.app.get('/api/health', async (req: Request, res: Response) => {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {} as any,
        gateway: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.env.npm_package_version || '1.0.0'
        }
      };

      // Check service health (simplified)
      for (const [name, service] of this.services.entries()) {
        healthStatus.services[name] = {
          status: 'unknown', // In production, implement actual health checks
          url: service.baseUrl
        };
      }

      res.json({
        success: true,
        data: healthStatus
      } as ApiResponse);
    });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getApp(): express.Application {
    return this.app;
  }

  public async start(port: number = 3000): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        logger.info(`API Gateway started on port ${port}`);
        resolve();
      });
    });
  }
}

// Export singleton instance
let gatewayInstance: APIGateway | null = null;

export const createAPIGateway = (): APIGateway => {
  if (!gatewayInstance) {
    gatewayInstance = new APIGateway();
  }
  return gatewayInstance;
};

export const getAPIGateway = (): APIGateway => {
  if (!gatewayInstance) {
    throw new Error('API Gateway not initialized');
  }
  return gatewayInstance;
};

export { APIGateway };