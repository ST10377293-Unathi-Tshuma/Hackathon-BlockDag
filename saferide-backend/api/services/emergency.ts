import express, { Request, Response } from 'express';
import { supabaseAdmin } from '../config/database.js';
import { EncryptionService } from '../utils/encryption.js';
import { getWebSocketService } from '../utils/websocket.js';
import { validate, emergencyRequestSchema } from '../middleware/validation.js';
import { asyncHandler, ApiError, logger } from '../middleware/errorHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  ApiResponse,
  PaginatedResponse,
  EmergencyRequest,
  EmergencyIncident,
  EmergencyContact,
  LocationData
} from '../../shared/types.js';

/**
 * Emergency Service
 * Handles panic button, live tracking, and emergency contact notifications
 */

interface EmergencyNotificationService {
  sendSMS(phone: string, message: string): Promise<boolean>;
  sendEmail(email: string, subject: string, message: string): Promise<boolean>;
  notifyAuthorities(incident: EmergencyIncident): Promise<boolean>;
}

// Mock implementation - replace with actual SMS/Email service
class MockNotificationService implements EmergencyNotificationService {
  async sendSMS(phone: string, message: string): Promise<boolean> {
    logger.info('SMS sent', { phone: phone.slice(-4), message: message.substring(0, 50) });
    return true;
  }

  async sendEmail(email: string, subject: string, message: string): Promise<boolean> {
    logger.info('Email sent', { email: email.split('@')[0] + '@***', subject });
    return true;
  }

  async notifyAuthorities(incident: EmergencyIncident): Promise<boolean> {
    logger.info('Authorities notified', { incidentId: incident.id, type: incident.emergency_type });
    return true;
  }
}

class EmergencyService {
  private app: express.Application;
  private notificationService: EmergencyNotificationService;
  private activeIncidents: Map<string, EmergencyIncident> = new Map();

  constructor() {
    this.app = express();
    this.notificationService = new MockNotificationService();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Trigger emergency alert
    this.app.post('/alert',
      authenticateToken,
      validate(emergencyRequestSchema),
      asyncHandler(this.triggerEmergency.bind(this))
    );

    // Update emergency status
    this.app.put('/incident/:incidentId/status',
      authenticateToken,
      asyncHandler(this.updateEmergencyStatus.bind(this))
    );

    // Get emergency incident details
    this.app.get('/incident/:incidentId',
      authenticateToken,
      asyncHandler(this.getEmergencyIncident.bind(this))
    );

    // Get user's emergency history
    this.app.get('/history/:userId',
      authenticateToken,
      asyncHandler(this.getEmergencyHistory.bind(this))
    );

    // Update location during emergency
    this.app.post('/incident/:incidentId/location',
      authenticateToken,
      asyncHandler(this.updateEmergencyLocation.bind(this))
    );

    // Get active emergencies (admin/dispatcher)
    this.app.get('/active',
      authenticateToken,
      asyncHandler(this.getActiveEmergencies.bind(this))
    );

    // Respond to emergency (emergency responder)
    this.app.post('/incident/:incidentId/respond',
      authenticateToken,
      asyncHandler(this.respondToEmergency.bind(this))
    );

    // Cancel emergency
    this.app.post('/incident/:incidentId/cancel',
      authenticateToken,
      asyncHandler(this.cancelEmergency.bind(this))
    );

    // Get emergency contacts for user
    this.app.get('/contacts/:userId',
      authenticateToken,
      asyncHandler(this.getEmergencyContacts.bind(this))
    );

    // Test emergency system
    this.app.post('/test',
      authenticateToken,
      asyncHandler(this.testEmergencySystem.bind(this))
    );

    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', service: 'emergency' });
    });
  }

  private async triggerEmergency(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.userId;
    const { emergencyType, location, rideId, description } = req.body as EmergencyRequest;

    if (!userId) {
      throw new ApiError('User ID is required', 400);
    }

    try {
      // Create emergency incident
      const { data: incident, error: incidentError } = await supabaseAdmin
        .from('emergency_incidents')
        .insert({
          user_id: userId,
          ride_id: rideId || null,
          emergency_type: emergencyType,
          status: 'active',
          location: location,
          description: description || null,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (incidentError) {
        throw new ApiError('Failed to create emergency incident', 500);
      }

      // Add to active incidents
      this.activeIncidents.set(incident.id, incident);

      // Get user's emergency contacts
      const { data: contacts } = await supabaseAdmin
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', userId)
        .order('priority', { ascending: true });

      // Get user profile for additional context
      const { data: userProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('anonymized_data')
        .eq('user_id', userId)
        .single();

      // Notify emergency contacts
      if (contacts && contacts.length > 0) {
        await this.notifyEmergencyContacts(incident, contacts, userProfile?.anonymized_data?.pseudonym);
      }

      // Notify authorities for severe emergencies
      if (emergencyType === 'medical' || emergencyType === 'assault' || emergencyType === 'kidnapping') {
        await this.notificationService.notifyAuthorities(incident);
      }

      // Send real-time alert via WebSocket
      try {
        const wsService = getWebSocketService();
        wsService.sendEmergencyAlert({
          incidentId: incident.id,
          userId,
          emergencyType,
          location,
          timestamp: incident.created_at
        });
      } catch (wsError) {
        logger.warn('Failed to send WebSocket emergency alert', { error: wsError });
      }

      // If this is related to a ride, notify the driver
      if (rideId) {
        await this.notifyRideParticipants(rideId, incident);
      }

      logger.info('Emergency alert triggered', {
        incidentId: incident.id,
        userId,
        emergencyType,
        rideId
      });

      res.status(201).json({
        success: true,
        data: {
          incidentId: incident.id,
          status: incident.status,
          emergencyType: incident.emergency_type,
          contactsNotified: contacts?.length || 0,
          authoritiesNotified: ['medical', 'assault', 'kidnapping'].includes(emergencyType)
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to trigger emergency', { error, userId, emergencyType });
      throw error;
    }
  }

  private async updateEmergencyStatus(req: Request, res: Response): Promise<void> {
    const { incidentId } = req.params;
    const { status, responderInfo, notes } = req.body;
    const userId = (req as any).user?.userId;

    try {
      const { data: incident, error } = await supabaseAdmin
        .from('emergency_incidents')
        .update({
          status,
          responder_info: responderInfo || null,
          response_notes: notes || null,
          resolved_at: status === 'resolved' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', incidentId)
        .select()
        .single();

      if (error) {
        throw new ApiError('Failed to update emergency status', 500);
      }

      // Update active incidents map
      if (status === 'resolved' || status === 'cancelled') {
        this.activeIncidents.delete(incidentId);
      } else {
        this.activeIncidents.set(incidentId, incident);
      }

      // Send status update via WebSocket
      try {
        const wsService = getWebSocketService();
        wsService.sendEmergencyUpdate({
          incidentId,
          status,
          timestamp: new Date().toISOString()
        });
      } catch (wsError) {
        logger.warn('Failed to send WebSocket emergency update', { error: wsError });
      }

      res.json({
        success: true,
        data: {
          incidentId,
          status: incident.status,
          updatedAt: incident.updated_at
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to update emergency status', { error, incidentId });
      throw error;
    }
  }

  private async getEmergencyIncident(req: Request, res: Response): Promise<void> {
    const { incidentId } = req.params;
    const userId = (req as any).user?.userId;

    try {
      const { data: incident, error } = await supabaseAdmin
        .from('emergency_incidents')
        .select('*')
        .eq('id', incidentId)
        .single();

      if (error || !incident) {
        throw new ApiError('Emergency incident not found', 404);
      }

      // Check access permissions
      if (incident.user_id !== userId && !(req as any).user?.isAdmin) {
        throw new ApiError('Access denied', 403);
      }

      res.json({
        success: true,
        data: incident
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get emergency incident', { error, incidentId });
      throw error;
    }
  }

  private async getEmergencyHistory(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const requestingUserId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    if (userId !== requestingUserId && !(req as any).user?.isAdmin) {
      throw new ApiError('Access denied', 403);
    }

    try {
      const { data: incidents, error, count } = await supabaseAdmin
        .from('emergency_incidents')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      if (error) {
        throw new ApiError('Failed to fetch emergency history', 500);
      }

      res.json({
        success: true,
        data: incidents,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      } as PaginatedResponse);
    } catch (error) {
      logger.error('Failed to get emergency history', { error, userId });
      throw error;
    }
  }

  private async updateEmergencyLocation(req: Request, res: Response): Promise<void> {
    const { incidentId } = req.params;
    const { location } = req.body;
    const userId = (req as any).user?.userId;

    try {
      // Verify incident belongs to user
      const { data: incident, error: fetchError } = await supabaseAdmin
        .from('emergency_incidents')
        .select('user_id, status')
        .eq('id', incidentId)
        .single();

      if (fetchError || !incident) {
        throw new ApiError('Emergency incident not found', 404);
      }

      if (incident.user_id !== userId) {
        throw new ApiError('Access denied', 403);
      }

      if (incident.status !== 'active') {
        throw new ApiError('Cannot update location for inactive incident', 400);
      }

      // Update location
      const { error: updateError } = await supabaseAdmin
        .from('emergency_incidents')
        .update({
          location,
          updated_at: new Date().toISOString()
        })
        .eq('id', incidentId);

      if (updateError) {
        throw new ApiError('Failed to update emergency location', 500);
      }

      // Send location update via WebSocket
      try {
        const wsService = getWebSocketService();
        wsService.sendLocationUpdate({
          incidentId,
          location,
          timestamp: new Date().toISOString()
        });
      } catch (wsError) {
        logger.warn('Failed to send WebSocket location update', { error: wsError });
      }

      res.json({
        success: true,
        data: {
          incidentId,
          location,
          updatedAt: new Date().toISOString()
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to update emergency location', { error, incidentId });
      throw error;
    }
  }

  private async getActiveEmergencies(req: Request, res: Response): Promise<void> {
    // Only admin/dispatcher access
    if (!(req as any).user?.isAdmin) {
      throw new ApiError('Access denied', 403);
    }

    try {
      const { data: incidents, error } = await supabaseAdmin
        .from('emergency_incidents')
        .select(`
          *,
          user_profiles(
            anonymized_data
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        throw new ApiError('Failed to fetch active emergencies', 500);
      }

      res.json({
        success: true,
        data: incidents
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get active emergencies', { error });
      throw error;
    }
  }

  private async respondToEmergency(req: Request, res: Response): Promise<void> {
    const { incidentId } = req.params;
    const { responderType, estimatedArrival, contactInfo } = req.body;
    const responderId = (req as any).user?.userId;

    try {
      const { data: incident, error } = await supabaseAdmin
        .from('emergency_incidents')
        .update({
          status: 'responding',
          responder_info: {
            responderId,
            responderType,
            estimatedArrival,
            contactInfo
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', incidentId)
        .select()
        .single();

      if (error) {
        throw new ApiError('Failed to respond to emergency', 500);
      }

      // Notify user that help is on the way
      try {
        const wsService = getWebSocketService();
        wsService.sendEmergencyUpdate({
          incidentId,
          status: 'responding',
          responderInfo: incident.responder_info,
          timestamp: new Date().toISOString()
        });
      } catch (wsError) {
        logger.warn('Failed to send WebSocket responder update', { error: wsError });
      }

      res.json({
        success: true,
        data: {
          incidentId,
          status: 'responding',
          estimatedArrival
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to respond to emergency', { error, incidentId });
      throw error;
    }
  }

  private async cancelEmergency(req: Request, res: Response): Promise<void> {
    const { incidentId } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user?.userId;

    try {
      // Verify incident belongs to user
      const { data: incident, error: fetchError } = await supabaseAdmin
        .from('emergency_incidents')
        .select('user_id')
        .eq('id', incidentId)
        .single();

      if (fetchError || !incident) {
        throw new ApiError('Emergency incident not found', 404);
      }

      if (incident.user_id !== userId) {
        throw new ApiError('Access denied', 403);
      }

      // Cancel incident
      const { error: updateError } = await supabaseAdmin
        .from('emergency_incidents')
        .update({
          status: 'cancelled',
          response_notes: reason || 'Cancelled by user',
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', incidentId);

      if (updateError) {
        throw new ApiError('Failed to cancel emergency', 500);
      }

      // Remove from active incidents
      this.activeIncidents.delete(incidentId);

      // Send cancellation update
      try {
        const wsService = getWebSocketService();
        wsService.sendEmergencyUpdate({
          incidentId,
          status: 'cancelled',
          timestamp: new Date().toISOString()
        });
      } catch (wsError) {
        logger.warn('Failed to send WebSocket cancellation update', { error: wsError });
      }

      res.json({
        success: true,
        data: {
          incidentId,
          status: 'cancelled'
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to cancel emergency', { error, incidentId });
      throw error;
    }
  }

  private async getEmergencyContacts(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const requestingUserId = (req as any).user?.userId;

    if (userId !== requestingUserId && !(req as any).user?.isAdmin) {
      throw new ApiError('Access denied', 403);
    }

    try {
      const { data: contacts, error } = await supabaseAdmin
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', userId)
        .order('priority', { ascending: true });

      if (error) {
        throw new ApiError('Failed to fetch emergency contacts', 500);
      }

      // Decrypt contact information
      const decryptedContacts = contacts?.map(contact => ({
        ...contact,
        name: EncryptionService.decrypt(contact.encrypted_name),
        phone: EncryptionService.decrypt(contact.encrypted_phone),
        email: contact.encrypted_email ? EncryptionService.decrypt(contact.encrypted_email) : null,
        encrypted_name: undefined,
        encrypted_phone: undefined,
        encrypted_email: undefined
      }));

      res.json({
        success: true,
        data: decryptedContacts
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get emergency contacts', { error, userId });
      throw error;
    }
  }

  private async testEmergencySystem(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.userId;

    try {
      // Create test incident
      const testIncident = {
        id: 'test-' + Date.now(),
        user_id: userId,
        emergency_type: 'test' as any,
        status: 'test' as any,
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          address: 'Test Location'
        },
        created_at: new Date().toISOString()
      };

      // Test WebSocket notification
      try {
        const wsService = getWebSocketService();
        wsService.sendEmergencyAlert({
          incidentId: testIncident.id,
          userId,
          emergencyType: 'test',
          location: testIncident.location,
          timestamp: testIncident.created_at
        });
      } catch (wsError) {
        logger.warn('WebSocket test failed', { error: wsError });
      }

      res.json({
        success: true,
        data: {
          message: 'Emergency system test completed',
          testIncidentId: testIncident.id,
          timestamp: testIncident.created_at
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Emergency system test failed', { error, userId });
      throw error;
    }
  }

  private async notifyEmergencyContacts(
    incident: EmergencyIncident,
    contacts: EmergencyContact[],
    userPseudonym?: string
  ): Promise<void> {
    const message = `EMERGENCY ALERT: ${userPseudonym || 'SafeRide user'} has triggered an emergency alert (${incident.emergency_type}). Location: ${incident.location?.address || 'Unknown'}. Time: ${new Date(incident.created_at).toLocaleString()}. Incident ID: ${incident.id}`;

    for (const contact of contacts) {
      try {
        // Decrypt contact information
        const phone = EncryptionService.decrypt(contact.encrypted_phone);
        const email = contact.encrypted_email ? EncryptionService.decrypt(contact.encrypted_email) : null;

        // Send SMS
        await this.notificationService.sendSMS(phone, message);

        // Send email if available
        if (email) {
          await this.notificationService.sendEmail(
            email,
            'SafeRide Emergency Alert',
            message
          );
        }
      } catch (error) {
        logger.error('Failed to notify emergency contact', {
          error,
          contactId: contact.id,
          incidentId: incident.id
        });
      }
    }
  }

  private async notifyRideParticipants(rideId: string, incident: EmergencyIncident): Promise<void> {
    try {
      const { data: ride } = await supabaseAdmin
        .from('rides')
        .select('driver_id, passenger_id')
        .eq('id', rideId)
        .single();

      if (ride) {
        const wsService = getWebSocketService();
        
        // Notify driver if passenger triggered emergency
        if (ride.passenger_id === incident.user_id && ride.driver_id) {
          wsService.sendEmergencyAlert({
            incidentId: incident.id,
            userId: ride.driver_id,
            emergencyType: incident.emergency_type,
            location: incident.location,
            timestamp: incident.created_at,
            rideId
          });
        }
        
        // Notify passenger if driver triggered emergency
        if (ride.driver_id === incident.user_id && ride.passenger_id) {
          wsService.sendEmergencyAlert({
            incidentId: incident.id,
            userId: ride.passenger_id,
            emergencyType: incident.emergency_type,
            location: incident.location,
            timestamp: incident.created_at,
            rideId
          });
        }
      }
    } catch (error) {
      logger.error('Failed to notify ride participants', { error, rideId, incidentId: incident.id });
    }
  }

  public getApp(): express.Application {
    return this.app;
  }

  public getActiveIncidents(): Map<string, EmergencyIncident> {
    return this.activeIncidents;
  }
}

// Export singleton instance
let emergencyServiceInstance: EmergencyService | null = null;

export const createEmergencyService = (): EmergencyService => {
  if (!emergencyServiceInstance) {
    emergencyServiceInstance = new EmergencyService();
  }
  return emergencyServiceInstance;
};

export const getEmergencyService = (): EmergencyService => {
  if (!emergencyServiceInstance) {
    throw new Error('Emergency Service not initialized');
  }
  return emergencyServiceInstance;
};

export { EmergencyService };