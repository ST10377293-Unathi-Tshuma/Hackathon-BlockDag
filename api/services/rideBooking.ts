import express, { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../middleware/logger';
import { AppError, ValidationError, NotFoundError } from '../middleware/errorHandler';
import { asyncHandler } from '../middleware/errorHandler';
import { BlockchainService } from './blockchain';

const app = express();
const logger = new Logger();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// Initialize Blockchain Service
const blockchainService = new BlockchainService();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Types
interface RideRequest {
  pickup_location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  dropoff_location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  ride_type: 'standard' | 'premium' | 'shared';
  scheduled_time?: string;
  passenger_count: number;
  special_requirements?: string;
  estimated_fare?: number;
  estimated_distance?: number;
  estimated_duration?: number;
}

interface RideAcceptance {
  driver_id: string;
  estimated_arrival_time: number; // minutes
  vehicle_info?: {
    make: string;
    model: string;
    color: string;
    license_plate: string;
  };
}

interface LocationUpdate {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}

interface RideCompletion {
  actual_fare: number;
  actual_distance: number;
  actual_duration: number;
  route_taken?: any;
  passenger_rating?: number;
  driver_rating?: number;
  tip_amount?: number;
}

// Helper Functions
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const calculateFare = (distance: number, rideType: string, duration: number): number => {
  const baseFares = {
    standard: 2.50,
    premium: 4.00,
    shared: 1.80,
  };

  const perKmRates = {
    standard: 1.20,
    premium: 2.00,
    shared: 0.90,
  };

  const perMinuteRates = {
    standard: 0.25,
    premium: 0.40,
    shared: 0.20,
  };

  const baseFare = baseFares[rideType as keyof typeof baseFares] || baseFares.standard;
  const distanceFare = distance * (perKmRates[rideType as keyof typeof perKmRates] || perKmRates.standard);
  const timeFare = duration * (perMinuteRates[rideType as keyof typeof perMinuteRates] || perMinuteRates.standard);

  return Math.round((baseFare + distanceFare + timeFare) * 100) / 100;
};

const findNearbyDrivers = async (latitude: number, longitude: number, radius: number = 10) => {
  // Find available drivers within radius
  const { data: drivers, error } = await supabase
    .from('drivers')
    .select(`
      id,
      user_id,
      current_latitude,
      current_longitude,
      is_available,
      vehicle_info,
      rating,
      saferide_users!inner(email, phone)
    `)
    .eq('is_available', true)
    .eq('verification_status', 'approved')
    .not('current_latitude', 'is', null)
    .not('current_longitude', 'is', null);

  if (error || !drivers) {
    return [];
  }

  // Filter by distance and sort by proximity
  const nearbyDrivers = drivers
    .map(driver => ({
      ...driver,
      distance: calculateDistance(latitude, longitude, driver.current_latitude, driver.current_longitude),
    }))
    .filter(driver => driver.distance <= radius)
    .sort((a, b) => a.distance - b.distance);

  return nearbyDrivers;
};

const notifyDriver = async (driverId: string, rideId: string, rideDetails: any) => {
  try {
    // In a real implementation, this would send push notifications
    // For now, we'll just log the notification
    logger.info('Driver notification sent', {
      driverId,
      rideId,
      pickup: rideDetails.pickup_location.address,
      dropoff: rideDetails.dropoff_location.address,
    });
    return true;
  } catch (error) {
    logger.error('Failed to notify driver', { error, driverId, rideId });
    return false;
  }
};

const notifyPassenger = async (passengerId: string, message: string, rideId?: string) => {
  try {
    // In a real implementation, this would send push notifications
    // For now, we'll just log the notification
    logger.info('Passenger notification sent', {
      passengerId,
      message,
      rideId,
    });
    return true;
  } catch (error) {
    logger.error('Failed to notify passenger', { error, passengerId, rideId });
    return false;
  }
};

// API Routes

// Request a Ride
app.post('/request', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const passengerId = req.user?.id;
  const rideData: RideRequest = req.body;

  if (!passengerId) {
    throw new ValidationError('Passenger ID is required');
  }

  // Validate required fields
  if (!rideData.pickup_location || !rideData.dropoff_location || !rideData.ride_type) {
    throw new ValidationError('pickup_location, dropoff_location, and ride_type are required');
  }

  // Validate ride type
  const validRideTypes = ['standard', 'premium', 'shared'];
  if (!validRideTypes.includes(rideData.ride_type)) {
    throw new ValidationError('Invalid ride type');
  }

  // Check if passenger has an active ride
  const { data: activeRide } = await supabase
    .from('rides')
    .select('id')
    .eq('passenger_id', passengerId)
    .in('status', ['requested', 'accepted', 'in_progress'])
    .single();

  if (activeRide) {
    throw new ValidationError('You already have an active ride');
  }

  // Calculate distance and estimated fare
  const distance = calculateDistance(
    rideData.pickup_location.latitude,
    rideData.pickup_location.longitude,
    rideData.dropoff_location.latitude,
    rideData.dropoff_location.longitude
  );

  const estimatedDuration = Math.round(distance * 2.5); // Rough estimate: 2.5 minutes per km
  const estimatedFare = calculateFare(distance, rideData.ride_type, estimatedDuration);

  // Create ride request
  const { data: ride, error: rideError } = await supabase
    .from('rides')
    .insert({
      passenger_id: passengerId,
      pickup_latitude: rideData.pickup_location.latitude,
      pickup_longitude: rideData.pickup_location.longitude,
      pickup_address: rideData.pickup_location.address,
      dropoff_latitude: rideData.dropoff_location.latitude,
      dropoff_longitude: rideData.dropoff_location.longitude,
      dropoff_address: rideData.dropoff_location.address,
      ride_type: rideData.ride_type,
      passenger_count: rideData.passenger_count || 1,
      special_requirements: rideData.special_requirements,
      estimated_fare: estimatedFare,
      estimated_distance: distance,
      estimated_duration: estimatedDuration,
      scheduled_time: rideData.scheduled_time,
      status: 'requested',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (rideError) {
    throw new AppError('Failed to create ride request', 500);
  }

  // Find nearby drivers
  const nearbyDrivers = await findNearbyDrivers(
    rideData.pickup_location.latitude,
    rideData.pickup_location.longitude
  );

  // Notify nearby drivers (in a real app, this would be done asynchronously)
  for (const driver of nearbyDrivers.slice(0, 5)) { // Notify top 5 closest drivers
    await notifyDriver(driver.id, ride.id, rideData);
  }

  logger.info('Ride requested', {
    rideId: ride.id,
    passengerId,
    pickup: rideData.pickup_location.address,
    dropoff: rideData.dropoff_location.address,
    nearbyDriversCount: nearbyDrivers.length,
  });

  res.status(201).json({
    success: true,
    message: 'Ride requested successfully',
    data: {
      ride_id: ride.id,
      status: 'requested',
      estimated_fare: estimatedFare,
      estimated_distance: distance,
      estimated_duration: estimatedDuration,
      nearby_drivers_count: nearbyDrivers.length,
      created_at: ride.created_at,
    },
  });
}));

// Accept a Ride (Driver)
app.post('/accept/:rideId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const driverId = req.user?.id;
  const { rideId } = req.params;
  const acceptanceData: RideAcceptance = req.body;

  if (!driverId) {
    throw new ValidationError('Driver ID is required');
  }

  // Verify driver exists and is available
  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('*')
    .eq('user_id', driverId)
    .eq('is_available', true)
    .eq('verification_status', 'approved')
    .single();

  if (driverError || !driver) {
    throw new NotFoundError('Driver not found or not available');
  }

  // Check if ride exists and is still available
  const { data: ride, error: rideError } = await supabase
    .from('rides')
    .select('*')
    .eq('id', rideId)
    .eq('status', 'requested')
    .single();

  if (rideError || !ride) {
    throw new NotFoundError('Ride not found or no longer available');
  }

  // Check if driver already has an active ride
  const { data: activeRide } = await supabase
    .from('rides')
    .select('id')
    .eq('driver_id', driver.id)
    .in('status', ['accepted', 'in_progress'])
    .single();

  if (activeRide) {
    throw new ValidationError('Driver already has an active ride');
  }

  // Create escrow for the ride
  let escrowId: string | null = null;
  try {
    const escrowResult = await blockchainService.createEscrow(
      ride.passenger_id,
      driver.user_id,
      ride.estimated_fare,
      ride.id
    );
    escrowId = escrowResult.escrowId;
  } catch (error) {
    logger.warn('Failed to create blockchain escrow', { error, rideId });
    // Continue without blockchain escrow for now
  }

  // Update ride with driver assignment
  const { data: updatedRide, error: updateError } = await supabase
    .from('rides')
    .update({
      driver_id: driver.id,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      estimated_arrival_time: acceptanceData.estimated_arrival_time,
      escrow_id: escrowId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rideId)
    .eq('status', 'requested') // Ensure it's still available
    .select()
    .single();

  if (updateError || !updatedRide) {
    throw new AppError('Failed to accept ride - it may have been taken by another driver', 409);
  }

  // Update driver availability
  await supabase
    .from('drivers')
    .update({ is_available: false })
    .eq('id', driver.id);

  // Notify passenger
  await notifyPassenger(
    ride.passenger_id,
    `Your ride has been accepted! Driver will arrive in ${acceptanceData.estimated_arrival_time} minutes.`,
    rideId
  );

  logger.info('Ride accepted', {
    rideId,
    driverId: driver.id,
    passengerId: ride.passenger_id,
    estimatedArrival: acceptanceData.estimated_arrival_time,
    escrowId,
  });

  res.json({
    success: true,
    message: 'Ride accepted successfully',
    data: {
      ride_id: rideId,
      status: 'accepted',
      driver_info: {
        name: driver.saferide_users?.email?.split('@')[0] || 'Driver',
        rating: driver.rating,
        vehicle_info: driver.vehicle_info,
      },
      estimated_arrival_time: acceptanceData.estimated_arrival_time,
      escrow_id: escrowId,
      accepted_at: updatedRide.accepted_at,
    },
  });
}));

// Start Ride (Driver)
app.post('/start/:rideId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const driverId = req.user?.id;
  const { rideId } = req.params;
  const { pickup_confirmation_code } = req.body;

  if (!driverId) {
    throw new ValidationError('Driver ID is required');
  }

  // Verify ride belongs to driver and is accepted
  const { data: ride, error: rideError } = await supabase
    .from('rides')
    .select(`
      *,
      drivers!inner(user_id)
    `)
    .eq('id', rideId)
    .eq('drivers.user_id', driverId)
    .eq('status', 'accepted')
    .single();

  if (rideError || !ride) {
    throw new NotFoundError('Ride not found or not authorized');
  }

  // In a real app, you might want to verify pickup confirmation code
  // For now, we'll just log it
  if (pickup_confirmation_code) {
    logger.info('Pickup confirmation code provided', { rideId, code: pickup_confirmation_code });
  }

  // Update ride status to in_progress
  const { data: updatedRide, error: updateError } = await supabase
    .from('rides')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', rideId)
    .select()
    .single();

  if (updateError) {
    throw new AppError('Failed to start ride', 500);
  }

  // Notify passenger
  await notifyPassenger(
    ride.passenger_id,
    'Your ride has started! You can track your journey in real-time.',
    rideId
  );

  logger.info('Ride started', {
    rideId,
    driverId,
    passengerId: ride.passenger_id,
  });

  res.json({
    success: true,
    message: 'Ride started successfully',
    data: {
      ride_id: rideId,
      status: 'in_progress',
      started_at: updatedRide.started_at,
    },
  });
}));

// Update Location During Ride
app.post('/location/:rideId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { rideId } = req.params;
  const locationData: LocationUpdate = req.body;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  // Validate location data
  if (!locationData.latitude || !locationData.longitude) {
    throw new ValidationError('latitude and longitude are required');
  }

  // Verify user is part of this ride
  const { data: ride, error: rideError } = await supabase
    .from('rides')
    .select(`
      *,
      drivers!inner(user_id)
    `)
    .eq('id', rideId)
    .or(`passenger_id.eq.${userId},drivers.user_id.eq.${userId}`)
    .eq('status', 'in_progress')
    .single();

  if (rideError || !ride) {
    throw new NotFoundError('Ride not found or not authorized');
  }

  // Update ride location
  const { error: updateError } = await supabase
    .from('rides')
    .update({
      current_latitude: locationData.latitude,
      current_longitude: locationData.longitude,
      last_location_update: locationData.timestamp,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rideId);

  if (updateError) {
    throw new AppError('Failed to update location', 500);
  }

  // In a real app, this would broadcast to WebSocket connections
  logger.debug('Location updated', {
    rideId,
    userId,
    location: { latitude: locationData.latitude, longitude: locationData.longitude },
  });

  res.json({
    success: true,
    message: 'Location updated successfully',
    data: {
      ride_id: rideId,
      timestamp: new Date().toISOString(),
    },
  });
}));

// Complete Ride (Driver)
app.post('/complete/:rideId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const driverId = req.user?.id;
  const { rideId } = req.params;
  const completionData: RideCompletion = req.body;

  if (!driverId) {
    throw new ValidationError('Driver ID is required');
  }

  // Verify ride belongs to driver and is in progress
  const { data: ride, error: rideError } = await supabase
    .from('rides')
    .select(`
      *,
      drivers!inner(user_id, id)
    `)
    .eq('id', rideId)
    .eq('drivers.user_id', driverId)
    .eq('status', 'in_progress')
    .single();

  if (rideError || !ride) {
    throw new NotFoundError('Ride not found or not authorized');
  }

  // Calculate actual fare if not provided
  let actualFare = completionData.actual_fare;
  if (!actualFare) {
    const distance = completionData.actual_distance || ride.estimated_distance;
    const duration = completionData.actual_duration || ride.estimated_duration;
    actualFare = calculateFare(distance, ride.ride_type, duration);
  }

  // Update ride as completed
  const { data: updatedRide, error: updateError } = await supabase
    .from('rides')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      actual_fare: actualFare,
      actual_distance: completionData.actual_distance,
      actual_duration: completionData.actual_duration,
      route_taken: completionData.route_taken,
      tip_amount: completionData.tip_amount || 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rideId)
    .select()
    .single();

  if (updateError) {
    throw new AppError('Failed to complete ride', 500);
  }

  // Release escrow if it exists
  if (ride.escrow_id) {
    try {
      await blockchainService.releaseEscrow(ride.escrow_id, actualFare + (completionData.tip_amount || 0));
      logger.info('Escrow released', { rideId, escrowId: ride.escrow_id, amount: actualFare });
    } catch (error) {
      logger.error('Failed to release escrow', { error, rideId, escrowId: ride.escrow_id });
    }
  }

  // Update driver availability
  await supabase
    .from('drivers')
    .update({ is_available: true })
    .eq('id', ride.drivers.id);

  // Create escrow transaction record
  if (ride.escrow_id) {
    await supabase
      .from('escrow_transactions')
      .insert({
        ride_id: rideId,
        passenger_id: ride.passenger_id,
        driver_id: ride.drivers.id,
        amount: actualFare,
        tip_amount: completionData.tip_amount || 0,
        status: 'completed',
        blockchain_tx_hash: ride.escrow_id, // Using escrow_id as tx_hash for now
        created_at: new Date().toISOString(),
      });
  }

  // Notify passenger
  await notifyPassenger(
    ride.passenger_id,
    `Your ride has been completed! Total fare: $${actualFare.toFixed(2)}. Please rate your driver.`,
    rideId
  );

  logger.info('Ride completed', {
    rideId,
    driverId,
    passengerId: ride.passenger_id,
    actualFare,
    tipAmount: completionData.tip_amount,
  });

  res.json({
    success: true,
    message: 'Ride completed successfully',
    data: {
      ride_id: rideId,
      status: 'completed',
      actual_fare: actualFare,
      tip_amount: completionData.tip_amount || 0,
      total_amount: actualFare + (completionData.tip_amount || 0),
      completed_at: updatedRide.completed_at,
    },
  });
}));

// Cancel Ride
app.post('/cancel/:rideId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { rideId } = req.params;
  const { reason, cancellation_fee } = req.body;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  // Verify user is part of this ride
  const { data: ride, error: rideError } = await supabase
    .from('rides')
    .select(`
      *,
      drivers(user_id, id)
    `)
    .eq('id', rideId)
    .or(`passenger_id.eq.${userId},drivers.user_id.eq.${userId}`)
    .in('status', ['requested', 'accepted', 'in_progress'])
    .single();

  if (rideError || !ride) {
    throw new NotFoundError('Ride not found or cannot be cancelled');
  }

  // Determine cancellation fee based on ride status and who's cancelling
  let actualCancellationFee = 0;
  const isPassengerCancelling = ride.passenger_id === userId;
  const isDriverCancelling = ride.drivers?.user_id === userId;

  if (ride.status === 'accepted' && isPassengerCancelling) {
    actualCancellationFee = cancellation_fee || 2.50; // Default cancellation fee
  } else if (ride.status === 'in_progress') {
    actualCancellationFee = ride.estimated_fare * 0.5; // 50% of estimated fare
  }

  // Update ride as cancelled
  const { data: updatedRide, error: updateError } = await supabase
    .from('rides')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
      cancellation_fee: actualCancellationFee,
      cancelled_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rideId)
    .select()
    .single();

  if (updateError) {
    throw new AppError('Failed to cancel ride', 500);
  }

  // Handle escrow refund/partial payment
  if (ride.escrow_id) {
    try {
      if (actualCancellationFee > 0) {
        // Partial release for cancellation fee
        await blockchainService.releaseEscrow(ride.escrow_id, actualCancellationFee);
      } else {
        // Full refund
        await blockchainService.refundEscrow(ride.escrow_id);
      }
    } catch (error) {
      logger.error('Failed to handle escrow for cancelled ride', { error, rideId, escrowId: ride.escrow_id });
    }
  }

  // Update driver availability if driver was assigned
  if (ride.drivers?.id) {
    await supabase
      .from('drivers')
      .update({ is_available: true })
      .eq('id', ride.drivers.id);
  }

  // Notify the other party
  const otherPartyId = isPassengerCancelling ? ride.drivers?.user_id : ride.passenger_id;
  if (otherPartyId) {
    const message = isPassengerCancelling 
      ? 'The passenger has cancelled the ride.'
      : 'The driver has cancelled the ride.';
    await notifyPassenger(otherPartyId, message, rideId);
  }

  logger.info('Ride cancelled', {
    rideId,
    cancelledBy: userId,
    reason,
    cancellationFee: actualCancellationFee,
    rideStatus: ride.status,
  });

  res.json({
    success: true,
    message: 'Ride cancelled successfully',
    data: {
      ride_id: rideId,
      status: 'cancelled',
      cancellation_fee: actualCancellationFee,
      cancelled_at: updatedRide.cancelled_at,
      cancelled_by: isPassengerCancelling ? 'passenger' : 'driver',
    },
  });
}));

// Rate Ride
app.post('/rate/:rideId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { rideId } = req.params;
  const { rating, comment } = req.body;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  if (!rating || rating < 1 || rating > 5) {
    throw new ValidationError('Rating must be between 1 and 5');
  }

  // Verify user is part of this completed ride
  const { data: ride, error: rideError } = await supabase
    .from('rides')
    .select(`
      *,
      drivers(user_id, id)
    `)
    .eq('id', rideId)
    .or(`passenger_id.eq.${userId},drivers.user_id.eq.${userId}`)
    .eq('status', 'completed')
    .single();

  if (rideError || !ride) {
    throw new NotFoundError('Completed ride not found or not authorized');
  }

  const isPassengerRating = ride.passenger_id === userId;
  const updateField = isPassengerRating ? 'passenger_rating' : 'driver_rating';
  const commentField = isPassengerRating ? 'passenger_comment' : 'driver_comment';

  // Update ride with rating
  const { error: updateError } = await supabase
    .from('rides')
    .update({
      [updateField]: rating,
      [commentField]: comment,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rideId);

  if (updateError) {
    throw new AppError('Failed to submit rating', 500);
  }

  // Update average rating for the rated party
  if (isPassengerRating && ride.drivers?.id) {
    // Update driver's average rating
    const { data: driverRatings } = await supabase
      .from('rides')
      .select('passenger_rating')
      .eq('driver_id', ride.drivers.id)
      .eq('status', 'completed')
      .not('passenger_rating', 'is', null);

    if (driverRatings && driverRatings.length > 0) {
      const avgRating = driverRatings.reduce((sum, r) => sum + r.passenger_rating, 0) / driverRatings.length;
      await supabase
        .from('drivers')
        .update({ rating: Math.round(avgRating * 100) / 100 })
        .eq('id', ride.drivers.id);
    }
  }

  logger.info('Ride rated', {
    rideId,
    ratedBy: userId,
    rating,
    isPassengerRating,
  });

  res.json({
    success: true,
    message: 'Rating submitted successfully',
    data: {
      ride_id: rideId,
      rating,
      comment,
      rated_by: isPassengerRating ? 'passenger' : 'driver',
    },
  });
}));

// Get Ride Details
app.get('/:rideId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { rideId } = req.params;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  // Get ride details
  const { data: ride, error: rideError } = await supabase
    .from('rides')
    .select(`
      *,
      drivers(id, user_id, rating, vehicle_info, saferide_users(email)),
      passengers:saferide_users!rides_passenger_id_fkey(email)
    `)
    .eq('id', rideId)
    .or(`passenger_id.eq.${userId},drivers.user_id.eq.${userId}`)
    .single();

  if (rideError || !ride) {
    throw new NotFoundError('Ride not found or not authorized');
  }

  // Anonymize sensitive data based on user role
  const isPassenger = ride.passenger_id === userId;
  const responseData = {
    id: ride.id,
    status: ride.status,
    ride_type: ride.ride_type,
    passenger_count: ride.passenger_count,
    pickup_location: {
      latitude: ride.pickup_latitude,
      longitude: ride.pickup_longitude,
      address: ride.pickup_address,
    },
    dropoff_location: {
      latitude: ride.dropoff_latitude,
      longitude: ride.dropoff_longitude,
      address: ride.dropoff_address,
    },
    estimated_fare: ride.estimated_fare,
    actual_fare: ride.actual_fare,
    estimated_distance: ride.estimated_distance,
    actual_distance: ride.actual_distance,
    estimated_duration: ride.estimated_duration,
    actual_duration: ride.actual_duration,
    tip_amount: ride.tip_amount,
    passenger_rating: ride.passenger_rating,
    driver_rating: ride.driver_rating,
    created_at: ride.created_at,
    accepted_at: ride.accepted_at,
    started_at: ride.started_at,
    completed_at: ride.completed_at,
    cancelled_at: ride.cancelled_at,
    cancellation_reason: ride.cancellation_reason,
    cancellation_fee: ride.cancellation_fee,
    driver_info: ride.drivers ? {
      name: isPassenger ? ride.drivers.saferide_users?.email?.split('@')[0] || 'Driver' : 'You',
      rating: ride.drivers.rating,
      vehicle_info: ride.drivers.vehicle_info,
    } : null,
    passenger_info: {
      name: isPassenger ? 'You' : ride.passengers?.email?.split('@')[0] || 'Passenger',
    },
  };

  res.json({
    success: true,
    data: responseData,
  });
}));

// Get Active Rides for User
app.get('/active/list', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  // Get active rides for user (as passenger or driver)
  const { data: rides, error } = await supabase
    .from('rides')
    .select(`
      *,
      drivers(id, user_id, rating, vehicle_info, saferide_users(email))
    `)
    .or(`passenger_id.eq.${userId},drivers.user_id.eq.${userId}`)
    .in('status', ['requested', 'accepted', 'in_progress'])
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError('Failed to fetch active rides', 500);
  }

  const activeRides = rides?.map(ride => {
    const isPassenger = ride.passenger_id === userId;
    return {
      id: ride.id,
      status: ride.status,
      ride_type: ride.ride_type,
      pickup_address: ride.pickup_address,
      dropoff_address: ride.dropoff_address,
      estimated_fare: ride.estimated_fare,
      estimated_arrival_time: ride.estimated_arrival_time,
      created_at: ride.created_at,
      accepted_at: ride.accepted_at,
      started_at: ride.started_at,
      role: isPassenger ? 'passenger' : 'driver',
      other_party: {
        name: isPassenger 
          ? ride.drivers?.saferide_users?.email?.split('@')[0] || 'Driver'
          : 'Passenger',
        rating: isPassenger ? ride.drivers?.rating : null,
      },
    };
  }) || [];

  res.json({
    success: true,
    data: {
      active_rides: activeRides,
      count: activeRides.length,
    },
  });
}));

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'ride-booking',
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Ride booking service error', { error: error.message, stack: error.stack });
  
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

const PORT = process.env.RIDE_BOOKING_PORT || 3006;

app.listen(PORT, () => {
  logger.info(`Ride Booking Service running on port ${PORT}`);
});

export default app;