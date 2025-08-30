import express from 'express';
import dotenv from 'dotenv';
import { createDriverVerificationService } from './driverVerification';
import { logger } from '../middleware/errorHandler';

// Load environment variables
dotenv.config({ path: '../../.env' });

const PORT = process.env.DRIVER_VERIFICATION_PORT || 3002;

// Create Express app
const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create and mount driver verification service
const driverService = createDriverVerificationService();
app.use('/api/driver-verification', driverService.getApp());

// Health check for the microservice
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'driver-verification-server',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Driver Verification Service running on port ${PORT}`);
});

export default app;