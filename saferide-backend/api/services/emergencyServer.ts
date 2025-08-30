import express from 'express';
import dotenv from 'dotenv';
import { createEmergencyService } from './emergency';
import { logger } from '../middleware/errorHandler';

// Load environment variables
dotenv.config({ path: '../../.env' });

const PORT = process.env.EMERGENCY_PORT || 3004;

// Create Express app
const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create and mount emergency service
const emergencyService = createEmergencyService();
app.use('/api/emergency', emergencyService.getApp());

// Health check for the microservice
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'emergency-server',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Emergency Service running on port ${PORT}`);
});

export default app;