import express from 'express';
import dotenv from 'dotenv';
import { createPassengerManagementService } from './passengerManagement.js';
import { logger } from '../middleware/errorHandler.js';

// Load environment variables
dotenv.config({ path: '../../.env' });

const PORT = process.env.PASSENGER_MANAGEMENT_PORT || 3003;

// Create Express app
const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create and mount passenger management service
const passengerService = createPassengerManagementService();
app.use('/api/passenger-management', passengerService.getApp());

// Health check for the microservice
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'passenger-management-server',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Passenger Management Service running on port ${PORT}`);
});

export default app;