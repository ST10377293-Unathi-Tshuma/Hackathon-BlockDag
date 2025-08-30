import express from 'express';
import dotenv from 'dotenv';
import { createRideBookingService } from './rideBooking';
import { logger } from '../middleware/errorHandler';

// Load environment variables
dotenv.config({ path: '../../.env' });

const PORT = process.env.RIDE_BOOKING_PORT || 3005;

// Create Express app
const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create and mount ride booking service
const rideBookingService = createRideBookingService();
app.use('/api/ride-booking', rideBookingService.getApp());

// Health check for the microservice
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'ride-booking-server',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Ride Booking Service running on port ${PORT}`);
});

export default app;