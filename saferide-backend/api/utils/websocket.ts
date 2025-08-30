import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { logger } from '../middleware/errorHandler.js';
import { SocketEvent, LocationUpdate, RideUpdate } from '../../shared/types.js';

/**
 * WebSocket service for real-time communication
 */

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userType?: 'passenger' | 'driver';
  walletAddress?: string;
}

interface Socket {
  id: string;
  userId?: string;
  userType?: 'passenger' | 'driver';
  walletAddress?: string;
  join: (room: string) => void;
  leave: (room: string) => void;
  emit: (event: string, data: any) => void;
  on: (event: string, callback: (data: any) => void) => void;
  disconnect: () => void;
}

class WebSocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, AuthenticatedSocket> = new Map();
  private activeRides: Map<string, { passengerId: string; driverId: string }> = new Map();

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use((socket: any, next) => {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
        socket.userId = decoded.userId;
        socket.userType = decoded.userType;
        socket.walletAddress = decoded.walletAddress;
        next();
      } catch (error) {
        logger.error('WebSocket authentication failed', { error, socketId: socket.id });
        next(new Error('Invalid authentication token'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info('User connected to WebSocket', {
        socketId: socket.id,
        userId: socket.userId,
        userType: socket.userType
      });

      // Store connected user
      if (socket.userId) {
        this.connectedUsers.set(socket.userId, socket);
        
        // Join user-specific room
        socket.join(`user:${socket.userId}`);
        
        // Join type-specific room
        if (socket.userType) {
          socket.join(`${socket.userType}s`);
        }
      }

      // Handle location updates
      socket.on('location_update', (data: LocationUpdate) => {
        this.handleLocationUpdate(socket, data);
      });

      // Handle ride updates
      socket.on('ride_update', (data: RideUpdate) => {
        this.handleRideUpdate(socket, data);
      });

      // Handle emergency alerts
      socket.on('emergency_alert', (data: any) => {
        this.handleEmergencyAlert(socket, data);
      });

      // Handle ride matching
      socket.on('join_ride', (rideId: string) => {
        socket.join(`ride:${rideId}`);
        logger.info('User joined ride room', { userId: socket.userId, rideId });
      });

      socket.on('leave_ride', (rideId: string) => {
        socket.leave(`ride:${rideId}`);
        logger.info('User left ride room', { userId: socket.userId, rideId });
      });

      // Handle driver availability
      socket.on('driver_available', (data: { available: boolean; location?: LocationUpdate }) => {
        this.handleDriverAvailability(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });
    });
  }

  private handleLocationUpdate(socket: AuthenticatedSocket, data: LocationUpdate): void {
    try {
      // Validate location data
      if (!data.latitude || !data.longitude || !data.timestamp) {
        socket.emit('error', { message: 'Invalid location data' });
        return;
      }

      // Broadcast location to relevant parties
      if (socket.userType === 'driver') {
        // Update driver location for passengers in active rides
        this.broadcastDriverLocation(socket.userId!, data);
      } else if (socket.userType === 'passenger') {
        // Update passenger location for driver in active ride
        this.broadcastPassengerLocation(socket.userId!, data);
      }

      logger.debug('Location updated', {
        userId: socket.userId,
        userType: socket.userType,
        location: { lat: data.latitude, lng: data.longitude }
      });
    } catch (error) {
      logger.error('Error handling location update', { error, userId: socket.userId });
      socket.emit('error', { message: 'Failed to update location' });
    }
  }

  private handleRideUpdate(socket: AuthenticatedSocket, data: RideUpdate): void {
    try {
      // Broadcast ride update to all participants
      this.io.to(`ride:${data.rideId}`).emit('ride_update', {
        ...data,
        timestamp: new Date().toISOString()
      });

      logger.info('Ride update broadcasted', {
        rideId: data.rideId,
        status: data.status,
        userId: socket.userId
      });
    } catch (error) {
      logger.error('Error handling ride update', { error, userId: socket.userId });
      socket.emit('error', { message: 'Failed to update ride' });
    }
  }

  private handleEmergencyAlert(socket: AuthenticatedSocket, data: any): void {
    try {
      const emergencyData = {
        ...data,
        userId: socket.userId,
        userType: socket.userType,
        timestamp: new Date().toISOString(),
        severity: 'high'
      };

      // Broadcast to emergency responders
      this.io.to('emergency_responders').emit('emergency_alert', emergencyData);
      
      // Broadcast to ride participants if in a ride
      if (data.rideId) {
        this.io.to(`ride:${data.rideId}`).emit('emergency_alert', emergencyData);
      }

      logger.error('Emergency alert triggered', {
        userId: socket.userId,
        rideId: data.rideId,
        location: data.location
      });
    } catch (error) {
      logger.error('Error handling emergency alert', { error, userId: socket.userId });
      socket.emit('error', { message: 'Failed to send emergency alert' });
    }
  }

  private handleDriverAvailability(socket: AuthenticatedSocket, data: { available: boolean; location?: LocationUpdate }): void {
    try {
      if (socket.userType !== 'driver') {
        socket.emit('error', { message: 'Only drivers can update availability' });
        return;
      }

      const availabilityData = {
        driverId: socket.userId,
        available: data.available,
        location: data.location,
        timestamp: new Date().toISOString()
      };

      // Broadcast to ride matching service
      this.io.to('ride_matching').emit('driver_availability', availabilityData);

      logger.info('Driver availability updated', {
        driverId: socket.userId,
        available: data.available
      });
    } catch (error) {
      logger.error('Error handling driver availability', { error, userId: socket.userId });
      socket.emit('error', { message: 'Failed to update availability' });
    }
  }

  private handleDisconnection(socket: AuthenticatedSocket): void {
    logger.info('User disconnected from WebSocket', {
      socketId: socket.id,
      userId: socket.userId,
      userType: socket.userType
    });

    // Remove from connected users
    if (socket.userId) {
      this.connectedUsers.delete(socket.userId);
    }

    // Handle driver going offline
    if (socket.userType === 'driver') {
      this.io.to('ride_matching').emit('driver_availability', {
        driverId: socket.userId,
        available: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  private broadcastDriverLocation(driverId: string, location: LocationUpdate): void {
    // Find active rides for this driver
    for (const [rideId, ride] of this.activeRides.entries()) {
      if (ride.driverId === driverId) {
        this.io.to(`ride:${rideId}`).emit('driver_location', {
          driverId,
          location,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  private broadcastPassengerLocation(passengerId: string, location: LocationUpdate): void {
    // Find active rides for this passenger
    for (const [rideId, ride] of this.activeRides.entries()) {
      if (ride.passengerId === passengerId) {
        this.io.to(`ride:${rideId}`).emit('passenger_location', {
          passengerId,
          location,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Public methods for external services

  public addActiveRide(rideId: string, passengerId: string, driverId: string): void {
    this.activeRides.set(rideId, { passengerId, driverId });
  }

  public removeActiveRide(rideId: string): void {
    this.activeRides.delete(rideId);
  }

  public notifyUser(userId: string, event: string, data: any): void {
    const socket = this.connectedUsers.get(userId);
    if (socket) {
      socket.emit(event, data);
    }
  }

  public notifyRide(rideId: string, event: string, data: any): void {
    this.io.to(`ride:${rideId}`).emit(event, data);
  }

  public broadcastToDrivers(event: string, data: any): void {
    this.io.to('drivers').emit(event, data);
  }

  public broadcastToPassengers(event: string, data: any): void {
    this.io.to('passengers').emit(event, data);
  }

  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  public isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}

// Singleton instance
let webSocketService: WebSocketService | null = null;

export const initializeWebSocket = (server: HttpServer): WebSocketService => {
  if (!webSocketService) {
    webSocketService = new WebSocketService(server);
    logger.info('WebSocket service initialized');
  }
  return webSocketService;
};

export const getWebSocketService = (): WebSocketService => {
  if (!webSocketService) {
    throw new Error('WebSocket service not initialized');
  }
  return webSocketService;
};

export { WebSocketService };