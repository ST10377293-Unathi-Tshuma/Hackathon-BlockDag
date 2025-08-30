import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { requestLogger } from './middleware/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authenticateToken } from './middleware/auth';
import { validate } from './middleware/validation';
import Joi from 'joi';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression and parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs for sensitive endpoints
  message: {
    error: 'Too many requests for this endpoint, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API Documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'SafeRide API Gateway',
    version: '1.0.0',
    description: 'Decentralized ride-sharing platform API',
    endpoints: {
      auth: '/api/auth',
      drivers: '/api/drivers',
      passengers: '/api/passengers',
      rides: '/api/rides',
      emergency: '/api/emergency'
    },
    documentation: 'https://docs.saferide.com',
    status: 'operational'
  });
});

// Authentication routes (handled directly by gateway)
const authValidation = {
  login: validate(Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required()
  })),
  register: validate(Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    full_name: Joi.string().min(2).max(100).required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    user_type: Joi.string().valid('passenger', 'driver').required()
  })),
  refresh: validate(Joi.object({
    refresh_token: Joi.string().required()
  }))
};

// Import auth routes
import authRoutes from './routes/auth';
app.use('/api/auth', authValidation.login, authRoutes);

// Microservice proxy configurations
const serviceConfig = {
  driverVerification: {
    target: `http://localhost:${process.env.DRIVER_VERIFICATION_PORT || 3002}`,
    pathRewrite: { '^/api/drivers': '' },
    timeout: 30000
  },
  passengerManagement: {
    target: `http://localhost:${process.env.PASSENGER_MANAGEMENT_PORT || 3003}`,
    pathRewrite: { '^/api/passengers': '' },
    timeout: 30000
  },
  emergency: {
    target: `http://localhost:${process.env.EMERGENCY_PORT || 3004}`,
    pathRewrite: { '^/api/emergency': '' },
    timeout: 30000
  },
  rideBooking: {
    target: `http://localhost:${process.env.RIDE_BOOKING_PORT || 3005}`,
    pathRewrite: { '^/api/rides': '' },
    timeout: 30000
  }
};

// Create proxy middleware for each service
const createServiceProxy = (config: any) => {
  return createProxyMiddleware({
    target: config.target,
    changeOrigin: true,
    pathRewrite: config.pathRewrite,
    timeout: config.timeout,
    onError: (err, req, res) => {
      console.error(`Proxy error for ${req.url}:`, err.message);
      res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'The requested service is currently unavailable. Please try again later.',
        timestamp: new Date().toISOString()
      });
    },
    onProxyReq: (proxyReq, req, res) => {
      // Forward authentication headers
      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
      }
      // Forward user context if available
      if ((req as any).user) {
        proxyReq.setHeader('X-User-ID', (req as any).user.id);
        proxyReq.setHeader('X-User-Type', (req as any).user.user_type);
      }
    }
  });
};

// Protected routes that require authentication
app.use('/api/drivers', authenticateToken, createServiceProxy(serviceConfig.driverVerification));
app.use('/api/passengers', authenticateToken, createServiceProxy(serviceConfig.passengerManagement));
app.use('/api/rides', authenticateToken, createServiceProxy(serviceConfig.rideBooking));

// Emergency routes with strict rate limiting
app.use('/api/emergency', strictLimiter, authenticateToken, createServiceProxy(serviceConfig.emergency));

// WebSocket proxy for emergency tracking
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST']
  }
});

// WebSocket authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    // Verify token using auth middleware logic
    const { verifyToken } = await import('./middleware/auth');
    const decoded = verifyToken(token);
    socket.userId = decoded.userId;
    socket.userType = decoded.userType;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`User ${socket.userId} connected via WebSocket`);
  
  // Join user-specific room
  socket.join(`user_${socket.userId}`);
  
  // Handle location updates for emergency tracking
  socket.on('location_update', (data) => {
    // Broadcast to emergency contacts and relevant parties
    socket.broadcast.to(`emergency_${data.emergencyId}`).emit('location_update', {
      userId: socket.userId,
      location: data.location,
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle ride tracking
  socket.on('join_ride', (rideId) => {
    socket.join(`ride_${rideId}`);
  });
  
  socket.on('leave_ride', (rideId) => {
    socket.leave(`ride_${rideId}`);
  });
  
  socket.on('disconnect', () => {
    console.log(`User ${socket.userId} disconnected`);
  });
});

// Make io available globally for other services
app.set('io', io);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 SafeRide API Gateway running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api`);
});

export default app;
export { io };