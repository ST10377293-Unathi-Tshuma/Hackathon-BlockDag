import express, { Request, Response } from 'express';
import { supabaseAdmin } from '../config/database.js';
import { getBlockchainService, generateRideId } from '../utils/blockchain.js';
import { EncryptionService, AnonymizationService } from '../utils/encryption.js';
import { getWebSocketService } from '../utils/websocket.js';
import { validate, rideRequestSchema, rideAcceptanceSchema, rideCompletionSchema, locationUpdateSchema } from '../middleware/validation.js';
import { asyncHandler, ApiError, logger } from '../middleware/errorHandler.js';
import { authenticateToken, requireDriverVerification } from '../middleware/auth.js';
import {
  ApiResponse,
  PaginatedResponse,
  CreateRideRequest,
  Ride,
  LocationData,
  RideStatus,
  EscrowTransaction
} from '../../shared/types.js';

/**
 * Ride Booking Service
 * Handles ride requests, acceptance, completion, and real-time tracking
 */

interface FareCalculationService {
  calculateFare(distance: number, duration: number, rideType: string): number;
  calculateSurgePricing(basefare: number, demandMultiplier: number): number;
}

class MockFareCalculationService implements FareCalculationService {
  calculateFare(distance: number, duration: number, rideType: string): number {
    const baseFarePerKm = rideType === 'premium' ? 2.5 : 1.5;
    const baseFarePerMin = rideType === 'premium' ? 0.5 : 0.3;
    const minimumFare = rideType === 'premium' ? 8.0 : 5.0;
    
    const fare = (distance * baseFarePerKm) + (duration * baseFarePerMin);
    return Math.max(fare, minimumFare);
  }

  calculateSurgePricing(baseFare: number, demandMultiplier: number): number {
    return baseFare * Math.max(1.0, demandMultiplier);
  }
}

class RideBookingService {
  private app: express.Application;
  private fareCalculator: FareCalculationService;
  private activeRides: Map<string, Ride> = new Map();

  constructor() {
    this.app = express();
    this.fareCalculator = new MockFareCalculationService();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Request a ride
    this.app.post('/request',
      authenticateToken,
      validate(rideRequestSchema),
      asyncHandler(this.requestRide.bind(this))
    );

    // Accept a ride (driver)
    this.app.post('/accept/:rideId',
      authenticateToken,
      requireDriverVerification,
      validate(rideAcceptanceSchema),
      asyncHandler(this.acceptRide.bind(this))
    );

    // Start ride (driver)
    this.app.post('/start/:rideId',
      authenticateToken,
      requireDriverVerification,
      asyncHandler(this.startRide.bind(this))
    );

    // Complete ride
    this.app.post('/complete/:rideId',
      authenticateToken,
      validate(rideCompletionSchema),
      asyncHandler(this.completeRide.bind(this))
    );

    // Cancel ride
    this.app.post('/cancel/:rideId',
      authenticateToken,
      asyncHandler(this.cancelRide.bind(this))
    );

    // Update location during ride
    this.app.post('/location/:rideId',
      authenticateToken,
      validate(locationUpdateSchema),
      asyncHandler(this.updateLocation.bind(this))
    );

    // Get ride details
    this.app.get('/details/:rideId',
      authenticateToken,
      asyncHandler(this.getRideDetails.bind(this))
    );

    // Get available rides (for drivers)
    this.app.get('/available',
      authenticateToken,
      requireDriverVerification,
      asyncHandler(this.getAvailableRides.bind(this))
    );

    // Get user's ride history
    this.app.get('/history/:userId',
      authenticateToken,
      asyncHandler(this.getRideHistory.bind(this))
    );

    // Get active ride for user
    this.app.get('/active/:userId',
      authenticateToken,
      asyncHandler(this.getActiveRide.bind(this))
    );

    // Calculate fare estimate
    this.app.post('/fare-estimate',
      authenticateToken,
      asyncHandler(this.calculateFareEstimate.bind(this))
    );

    // Get ride statistics
    this.app.get('/stats/:userId',
      authenticateToken,
      asyncHandler(this.getRideStats.bind(this))
    );

    // Rate ride
    this.app.post('/rate/:rideId',
      authenticateToken,
      asyncHandler(this.rateRide.bind(this))
    );

    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', service: 'ride-booking' });
    });
  }

  private async requestRide(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.userId;
    const {
      pickupLocation,
      dropoffLocation,
      rideType,
      scheduledTime,
      passengerCount,
      specialRequests
    } = req.body as CreateRideRequest;

    if (!userId) {
      throw new ApiError('User ID is required', 400);
    }

    try {
      // Check if user has an active ride
      const { data: activeRide } = await supabaseAdmin
        .from('rides')
        .select('id')
        .eq('passenger_id', userId)
        .in('status', ['requested', 'accepted', 'in_progress'])
        .single();

      if (activeRide) {
        throw new ApiError('You already have an active ride', 409);
      }

      // Calculate estimated fare and distance
      const estimatedDistance = this.calculateDistance(pickupLocation, dropoffLocation);
      const estimatedDuration = estimatedDistance * 2; // Rough estimate: 2 minutes per km
      const estimatedFare = this.fareCalculator.calculateFare(estimatedDistance, estimatedDuration, rideType);

      // Generate unique ride ID
      const rideId = generateRideId();

      // Create ride request
      const { data: ride, error: rideError } = await supabaseAdmin
        .from('rides')
        .insert({
          id: rideId,
          passenger_id: userId,
          pickup_location: pickupLocation,
          dropoff_location: dropoffLocation,
          ride_type: rideType,
          status: 'requested',
          estimated_fare: estimatedFare,
          estimated_distance: estimatedDistance,
          estimated_duration: estimatedDuration,
          passenger_count: passengerCount || 1,
          special_requests: specialRequests || null,
          scheduled_time: scheduledTime || null,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (rideError) {
        throw new ApiError('Failed to create ride request', 500);
      }

      // Add to active rides
      this.activeRides.set(rideId, ride);

      // Create escrow transaction on blockchain
      try {
        const blockchainService = getBlockchainService();
        const { data: userProfile } = await supabaseAdmin
          .from('user_profiles')
          .select('wallet_address')
          .eq('user_id', userId)
          .single();

        if (userProfile?.wallet_address) {
          await blockchainService.createEscrow(
            rideId,
            userProfile.wallet_address,
            estimatedFare
          );
        }
      } catch (blockchainError) {
        logger.warn('Blockchain escrow creation failed', {
          error: blockchainError,
          rideId
        });
      }

      // Broadcast ride request to nearby drivers
      try {
        const wsService = getWebSocketService();
        wsService.broadcastRideRequest({
          rideId,
          pickupLocation,
          dropoffLocation,
          rideType,
          estimatedFare,
          passengerCount,
          timestamp: ride.created_at
        });
      } catch (wsError) {
        logger.warn('Failed to broadcast ride request', { error: wsError });
      }

      logger.info('Ride requested', {
        rideId,
        userId,
        pickupLocation,
        dropoffLocation,
        estimatedFare
      });

      res.status(201).json({
        success: true,
        data: {
          rideId,
          status: ride.status,
          estimatedFare,
          estimatedDistance,
          estimatedDuration,
          createdAt: ride.created_at
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to request ride', { error, userId });
      throw error;
    }
  }

  private async acceptRide(req: Request, res: Response): Promise<void> {
    const { rideId } = req.params;
    const driverId = (req as any).user?.userId;
    const { estimatedArrival, currentLocation } = req.body;

    if (!driverId) {
      throw new ApiError('Driver ID is required', 400);
    }

    try {
      // Check if ride is still available
      const { data: ride, error: fetchError } = await supabaseAdmin
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .eq('status', 'requested')
        .single();

      if (fetchError || !ride) {
        throw new ApiError('Ride not available or already accepted', 404);
      }

      // Check if driver has an active ride
      const { data: activeDriverRide } = await supabaseAdmin
        .from('rides')
        .select('id')
        .eq('driver_id', driverId)
        .in('status', ['accepted', 'in_progress'])
        .single();

      if (activeDriverRide) {
        throw new ApiError('Driver already has an active ride', 409);
      }

      // Accept the ride
      const { data: updatedRide, error: updateError } = await supabaseAdmin
        .from('rides')
        .update({
          driver_id: driverId,
          status: 'accepted',
          driver_location: currentLocation,
          estimated_arrival: estimatedArrival,
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', rideId)
        .select()
        .single();

      if (updateError) {
        throw new ApiError('Failed to accept ride', 500);
      }

      // Update active rides
      this.activeRides.set(rideId, updatedRide);

      // Get driver and passenger profiles for notifications
      const [driverProfile, passengerProfile] = await Promise.all([
        supabaseAdmin
          .from('drivers')
          .select('anonymized_data, vehicle_info(*)')
          .eq('id', driverId)
          .single(),
        supabaseAdmin
          .from('user_profiles')
          .select('anonymized_data')
          .eq('user_id', ride.passenger_id)
          .single()
      ]);

      // Notify passenger that ride was accepted
      try {
        const wsService = getWebSocketService();
        wsService.sendRideUpdate({
          rideId,
          status: 'accepted',
          driverInfo: {
            pseudonym: driverProfile.data?.anonymized_data?.pseudonym || 'Anonymous Driver',
            vehicleInfo: driverProfile.data?.vehicle_info
          },
          estimatedArrival,
          timestamp: updatedRide.accepted_at
        });
      } catch (wsError) {
        logger.warn('Failed to send ride acceptance notification', { error: wsError });
      }

      logger.info('Ride accepted', {
        rideId,
        driverId,
        passengerId: ride.passenger_id,
        estimatedArrival
      });

      res.json({
        success: true,
        data: {
          rideId,
          status: 'accepted',
          passengerInfo: {
            pseudonym: passengerProfile.data?.anonymized_data?.pseudonym || 'Anonymous Passenger'
          },
          pickupLocation: ride.pickup_location,
          dropoffLocation: ride.dropoff_location,
          estimatedFare: ride.estimated_fare,
          acceptedAt: updatedRide.accepted_at
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to accept ride', { error, rideId, driverId });
      throw error;
    }
  }

  private async startRide(req: Request, res: Response): Promise<void> {
    const { rideId } = req.params;
    const driverId = (req as any).user?.userId;

    try {
      // Verify driver owns this ride
      const { data: ride, error: fetchError } = await supabaseAdmin
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .eq('driver_id', driverId)
        .eq('status', 'accepted')
        .single();

      if (fetchError || !ride) {
        throw new ApiError('Ride not found or cannot be started', 404);
      }

      // Start the ride
      const { data: updatedRide, error: updateError } = await supabaseAdmin
        .from('rides')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', rideId)
        .select()
        .single();

      if (updateError) {
        throw new ApiError('Failed to start ride', 500);
      }

      // Update active rides
      this.activeRides.set(rideId, updatedRide);

      // Notify passenger that ride has started
      try {
        const wsService = getWebSocketService();
        wsService.sendRideUpdate({
          rideId,
          status: 'in_progress',
          timestamp: updatedRide.started_at
        });
      } catch (wsError) {
        logger.warn('Failed to send ride start notification', { error: wsError });
      }

      logger.info('Ride started', {
        rideId,
        driverId,
        passengerId: ride.passenger_id
      });

      res.json({
        success: true,
        data: {
          rideId,
          status: 'in_progress',
          startedAt: updatedRide.started_at
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to start ride', { error, rideId, driverId });
      throw error;
    }
  }

  private async completeRide(req: Request, res: Response): Promise<void> {
    const { rideId } = req.params;
    const userId = (req as any).user?.userId;
    const { finalLocation, actualDistance, actualDuration } = req.body;

    try {
      // Get ride details
      const { data: ride, error: fetchError } = await supabaseAdmin
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .eq('status', 'in_progress')
        .single();

      if (fetchError || !ride) {
        throw new ApiError('Ride not found or cannot be completed', 404);
      }

      // Verify user is either driver or passenger
      if (ride.driver_id !== userId && ride.passenger_id !== userId) {
        throw new ApiError('Access denied', 403);
      }

      // Calculate final fare
      const finalFare = this.fareCalculator.calculateFare(
        actualDistance || ride.estimated_distance,
        actualDuration || ride.estimated_duration,
        ride.ride_type
      );

      // Complete the ride
      const { data: updatedRide, error: updateError } = await supabaseAdmin
        .from('rides')
        .update({
          status: 'completed',
          final_location: finalLocation || ride.dropoff_location,
          actual_distance: actualDistance || ride.estimated_distance,
          actual_duration: actualDuration || ride.estimated_duration,
          final_fare: finalFare,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', rideId)
        .select()
        .single();

      if (updateError) {
        throw new ApiError('Failed to complete ride', 500);
      }

      // Remove from active rides
      this.activeRides.delete(rideId);

      // Process payment via blockchain escrow
      try {
        const blockchainService = getBlockchainService();
        
        // Get driver wallet address
        const { data: driverProfile } = await supabaseAdmin
          .from('drivers')
          .select('wallet_address')
          .eq('id', ride.driver_id)
          .single();

        if (driverProfile?.wallet_address) {
          await blockchainService.releaseEscrow(
            rideId,
            driverProfile.wallet_address,
            finalFare
          );

          // Record escrow transaction
          await supabaseAdmin
            .from('escrow_transactions')
            .insert({
              ride_id: rideId,
              passenger_wallet: '', // TODO: Get from user profile
              driver_wallet: driverProfile.wallet_address,
              amount: finalFare,
              status: 'completed',
              transaction_hash: '', // TODO: Get from blockchain
              created_at: new Date().toISOString()
            });
        }
      } catch (blockchainError) {
        logger.warn('Blockchain payment processing failed', {
          error: blockchainError,
          rideId
        });
      }

      // Notify both parties that ride is completed
      try {
        const wsService = getWebSocketService();
        wsService.sendRideUpdate({
          rideId,
          status: 'completed',
          finalFare,
          actualDistance: updatedRide.actual_distance,
          actualDuration: updatedRide.actual_duration,
          timestamp: updatedRide.completed_at
        });
      } catch (wsError) {
        logger.warn('Failed to send ride completion notification', { error: wsError });
      }

      logger.info('Ride completed', {
        rideId,
        driverId: ride.driver_id,
        passengerId: ride.passenger_id,
        finalFare,
        actualDistance: updatedRide.actual_distance
      });

      res.json({
        success: true,
        data: {
          rideId,
          status: 'completed',
          finalFare,
          actualDistance: updatedRide.actual_distance,
          actualDuration: updatedRide.actual_duration,
          completedAt: updatedRide.completed_at
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to complete ride', { error, rideId, userId });
      throw error;
    }
  }

  private async cancelRide(req: Request, res: Response): Promise<void> {
    const { rideId } = req.params;
    const userId = (req as any).user?.userId;
    const { reason } = req.body;

    try {
      // Get ride details
      const { data: ride, error: fetchError } = await supabaseAdmin
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .in('status', ['requested', 'accepted', 'in_progress'])
        .single();

      if (fetchError || !ride) {
        throw new ApiError('Ride not found or cannot be cancelled', 404);
      }

      // Verify user is either driver or passenger
      if (ride.driver_id !== userId && ride.passenger_id !== userId) {
        throw new ApiError('Access denied', 403);
      }

      // Calculate cancellation fee if applicable
      let cancellationFee = 0;
      if (ride.status === 'accepted' || ride.status === 'in_progress') {
        cancellationFee = ride.estimated_fare * 0.1; // 10% cancellation fee
      }

      // Cancel the ride
      const { data: updatedRide, error: updateError } = await supabaseAdmin
        .from('rides')
        .update({
          status: 'cancelled',
          cancellation_reason: reason || 'No reason provided',
          cancelled_by: userId,
          cancellation_fee: cancellationFee,
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', rideId)
        .select()
        .single();

      if (updateError) {
        throw new ApiError('Failed to cancel ride', 500);
      }

      // Remove from active rides
      this.activeRides.delete(rideId);

      // Handle escrow refund/fee processing
      try {
        const blockchainService = getBlockchainService();
        // TODO: Implement escrow cancellation logic
      } catch (blockchainError) {
        logger.warn('Blockchain cancellation processing failed', {
          error: blockchainError,
          rideId
        });
      }

      // Notify other party about cancellation
      try {
        const wsService = getWebSocketService();
        wsService.sendRideUpdate({
          rideId,
          status: 'cancelled',
          cancellationReason: reason,
          cancellationFee,
          timestamp: updatedRide.cancelled_at
        });
      } catch (wsError) {
        logger.warn('Failed to send ride cancellation notification', { error: wsError });
      }

      logger.info('Ride cancelled', {
        rideId,
        cancelledBy: userId,
        reason,
        cancellationFee
      });

      res.json({
        success: true,
        data: {
          rideId,
          status: 'cancelled',
          cancellationFee,
          cancelledAt: updatedRide.cancelled_at
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to cancel ride', { error, rideId, userId });
      throw error;
    }
  }

  private async updateLocation(req: Request, res: Response): Promise<void> {
    const { rideId } = req.params;
    const userId = (req as any).user?.userId;
    const { location } = req.body;

    try {
      // Verify user is part of this ride
      const { data: ride, error: fetchError } = await supabaseAdmin
        .from('rides')
        .select('driver_id, passenger_id, status')
        .eq('id', rideId)
        .single();

      if (fetchError || !ride) {
        throw new ApiError('Ride not found', 404);
      }

      if (ride.driver_id !== userId && ride.passenger_id !== userId) {
        throw new ApiError('Access denied', 403);
      }

      if (!['accepted', 'in_progress'].includes(ride.status)) {
        throw new ApiError('Cannot update location for inactive ride', 400);
      }

      // Update location based on user role
      const updateField = ride.driver_id === userId ? 'driver_location' : 'passenger_location';
      
      const { error: updateError } = await supabaseAdmin
        .from('rides')
        .update({
          [updateField]: location,
          updated_at: new Date().toISOString()
        })
        .eq('id', rideId);

      if (updateError) {
        throw new ApiError('Failed to update location', 500);
      }

      // Send location update via WebSocket
      try {
        const wsService = getWebSocketService();
        wsService.sendLocationUpdate({
          rideId,
          userId,
          location,
          userType: ride.driver_id === userId ? 'driver' : 'passenger',
          timestamp: new Date().toISOString()
        });
      } catch (wsError) {
        logger.warn('Failed to send location update', { error: wsError });
      }

      res.json({
        success: true,
        data: {
          rideId,
          location,
          updatedAt: new Date().toISOString()
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to update location', { error, rideId, userId });
      throw error;
    }
  }

  private async getRideDetails(req: Request, res: Response): Promise<void> {
    const { rideId } = req.params;
    const userId = (req as any).user?.userId;

    try {
      const { data: ride, error } = await supabaseAdmin
        .from('rides')
        .select(`
          *,
          drivers(
            anonymized_data,
            vehicle_info(*)
          ),
          user_profiles(
            anonymized_data
          )
        `)
        .eq('id', rideId)
        .single();

      if (error || !ride) {
        throw new ApiError('Ride not found', 404);
      }

      // Verify user has access to this ride
      if (ride.driver_id !== userId && ride.passenger_id !== userId && !(req as any).user?.isAdmin) {
        throw new ApiError('Access denied', 403);
      }

      res.json({
        success: true,
        data: ride
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get ride details', { error, rideId });
      throw error;
    }
  }

  private async getAvailableRides(req: Request, res: Response): Promise<void> {
    const driverId = (req as any).user?.userId;
    const { latitude, longitude, radius = 10 } = req.query;

    try {
      // Get available rides within radius
      const { data: rides, error } = await supabaseAdmin
        .from('rides')
        .select(`
          *,
          user_profiles(
            anonymized_data
          )
        `)
        .eq('status', 'requested')
        .order('created_at', { ascending: true });

      if (error) {
        throw new ApiError('Failed to fetch available rides', 500);
      }

      // Filter by distance if location provided
      let filteredRides = rides || [];
      if (latitude && longitude) {
        filteredRides = rides?.filter(ride => {
          const distance = this.calculateDistance(
            { latitude: parseFloat(latitude as string), longitude: parseFloat(longitude as string) },
            ride.pickup_location
          );
          return distance <= parseFloat(radius as string);
        }) || [];
      }

      res.json({
        success: true,
        data: filteredRides
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get available rides', { error, driverId });
      throw error;
    }
  }

  private async getRideHistory(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const requestingUserId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    if (userId !== requestingUserId && !(req as any).user?.isAdmin) {
      throw new ApiError('Access denied', 403);
    }

    try {
      const { data: rides, error, count } = await supabaseAdmin
        .from('rides')
        .select(`
          *,
          drivers(
            anonymized_data,
            vehicle_info(*)
          ),
          user_profiles(
            anonymized_data
          )
        `, { count: 'exact' })
        .or(`passenger_id.eq.${userId},driver_id.eq.${userId}`)
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      if (error) {
        throw new ApiError('Failed to fetch ride history', 500);
      }

      res.json({
        success: true,
        data: rides,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      } as PaginatedResponse);
    } catch (error) {
      logger.error('Failed to get ride history', { error, userId });
      throw error;
    }
  }

  private async getActiveRide(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const requestingUserId = (req as any).user?.userId;

    if (userId !== requestingUserId) {
      throw new ApiError('Access denied', 403);
    }

    try {
      const { data: ride, error } = await supabaseAdmin
        .from('rides')
        .select(`
          *,
          drivers(
            anonymized_data,
            vehicle_info(*)
          ),
          user_profiles(
            anonymized_data
          )
        `)
        .or(`passenger_id.eq.${userId},driver_id.eq.${userId}`)
        .in('status', ['requested', 'accepted', 'in_progress'])
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new ApiError('Failed to fetch active ride', 500);
      }

      res.json({
        success: true,
        data: ride || null
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get active ride', { error, userId });
      throw error;
    }
  }

  private async calculateFareEstimate(req: Request, res: Response): Promise<void> {
    const { pickupLocation, dropoffLocation, rideType } = req.body;

    try {
      const distance = this.calculateDistance(pickupLocation, dropoffLocation);
      const duration = distance * 2; // Rough estimate
      const baseFare = this.fareCalculator.calculateFare(distance, duration, rideType);
      
      // Apply surge pricing if needed (mock implementation)
      const demandMultiplier = 1.2; // Mock surge multiplier
      const finalFare = this.fareCalculator.calculateSurgePricing(baseFare, demandMultiplier);

      res.json({
        success: true,
        data: {
          estimatedFare: finalFare,
          baseFare,
          surgeMultiplier: demandMultiplier,
          estimatedDistance: distance,
          estimatedDuration: duration
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to calculate fare estimate', { error });
      throw error;
    }
  }

  private async getRideStats(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const requestingUserId = (req as any).user?.userId;

    if (userId !== requestingUserId && !(req as any).user?.isAdmin) {
      throw new ApiError('Access denied', 403);
    }

    try {
      // Get ride statistics
      const { data: rideStats, error } = await supabaseAdmin
        .from('rides')
        .select('status, final_fare, actual_distance, created_at')
        .or(`passenger_id.eq.${userId},driver_id.eq.${userId}`);

      if (error) {
        throw new ApiError('Failed to fetch ride statistics', 500);
      }

      const stats = {
        totalRides: rideStats?.length || 0,
        completedRides: rideStats?.filter(r => r.status === 'completed').length || 0,
        cancelledRides: rideStats?.filter(r => r.status === 'cancelled').length || 0,
        totalDistance: rideStats?.reduce((sum, r) => sum + (r.actual_distance || 0), 0) || 0,
        totalSpent: rideStats?.reduce((sum, r) => sum + (r.final_fare || 0), 0) || 0,
        averageRideDistance: 0,
        averageFare: 0
      };

      if (stats.completedRides > 0) {
        stats.averageRideDistance = stats.totalDistance / stats.completedRides;
        stats.averageFare = stats.totalSpent / stats.completedRides;
      }

      res.json({
        success: true,
        data: stats
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get ride stats', { error, userId });
      throw error;
    }
  }

  private async rateRide(req: Request, res: Response): Promise<void> {
    const { rideId } = req.params;
    const userId = (req as any).user?.userId;
    const { rating, comment } = req.body;

    try {
      // Verify user was part of this ride
      const { data: ride, error: fetchError } = await supabaseAdmin
        .from('rides')
        .select('driver_id, passenger_id, status')
        .eq('id', rideId)
        .single();

      if (fetchError || !ride) {
        throw new ApiError('Ride not found', 404);
      }

      if (ride.driver_id !== userId && ride.passenger_id !== userId) {
        throw new ApiError('Access denied', 403);
      }

      if (ride.status !== 'completed') {
        throw new ApiError('Can only rate completed rides', 400);
      }

      // Determine who is being rated
      const ratedUserId = ride.driver_id === userId ? ride.passenger_id : ride.driver_id;
      const raterType = ride.driver_id === userId ? 'driver' : 'passenger';

      // TODO: Implement rating system in database
      // For now, just log the rating
      logger.info('Ride rated', {
        rideId,
        ratedBy: userId,
        ratedUser: ratedUserId,
        raterType,
        rating,
        comment
      });

      res.json({
        success: true,
        data: {
          rideId,
          rating,
          message: 'Rating submitted successfully'
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to rate ride', { error, rideId, userId });
      throw error;
    }
  }

  private calculateDistance(point1: LocationData, point2: LocationData): number {
    // Haversine formula for calculating distance between two points
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLon = this.toRadians(point2.longitude - point1.longitude);
    const lat1 = this.toRadians(point1.latitude);
    const lat2 = this.toRadians(point2.latitude);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  public getApp(): express.Application {
    return this.app;
  }

  public getActiveRides(): Map<string, Ride> {
    return this.activeRides;
  }
}

// Export singleton instance
let rideBookingServiceInstance: RideBookingService | null = null;

export const createRideBookingService = (): RideBookingService => {
  if (!rideBookingServiceInstance) {
    rideBookingServiceInstance = new RideBookingService();
  }
  return rideBookingServiceInstance;
};

export const getRideBookingService = (): RideBookingService => {
  if (!rideBookingServiceInstance) {
    throw new Error('Ride Booking Service not initialized');
  }
  return rideBookingServiceInstance;
};

export { RideBookingService };