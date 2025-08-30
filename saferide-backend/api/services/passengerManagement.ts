import express, { Request, Response } from 'express';
import { supabaseAdmin } from '../config/database.js';
import { EncryptionService, AnonymizationService, ZKProofService } from '../utils/encryption.js';
import { validate, passengerProfileSchema, paginationSchema } from '../middleware/validation.js';
import { asyncHandler, ApiError, logger } from '../middleware/errorHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  ApiResponse,
  PaginatedResponse,
  UserProfile,
  Ride,
  LocationData
} from '../../shared/types.js';

/**
 * Passenger Management Service
 * Handles anonymized passenger profiles, updates, and ride history
 */

class PassengerManagementService {
  private app: express.Application;

  constructor() {
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Create/Update passenger profile
    this.app.post('/profile',
      authenticateToken,
      validate(passengerProfileSchema),
      asyncHandler(this.createOrUpdateProfile.bind(this))
    );

    // Get passenger profile
    this.app.get('/profile/:userId',
      authenticateToken,
      asyncHandler(this.getProfile.bind(this))
    );

    // Update passenger preferences
    this.app.put('/preferences/:userId',
      authenticateToken,
      asyncHandler(this.updatePreferences.bind(this))
    );

    // Get ride history
    this.app.get('/ride-history/:userId',
      authenticateToken,
      validate(paginationSchema, 'query'),
      asyncHandler(this.getRideHistory.bind(this))
    );

    // Get anonymized passenger data for drivers
    this.app.get('/anonymous/:userId',
      authenticateToken,
      asyncHandler(this.getAnonymizedProfile.bind(this))
    );

    // Update location preferences
    this.app.put('/location-preferences/:userId',
      authenticateToken,
      asyncHandler(this.updateLocationPreferences.bind(this))
    );

    // Get passenger statistics
    this.app.get('/stats/:userId',
      authenticateToken,
      asyncHandler(this.getPassengerStats.bind(this))
    );

    // Generate zero-knowledge proof for identity verification
    this.app.post('/zk-proof/:userId',
      authenticateToken,
      asyncHandler(this.generateZKProof.bind(this))
    );

    // Verify passenger identity without revealing personal data
    this.app.post('/verify-identity',
      authenticateToken,
      asyncHandler(this.verifyIdentity.bind(this))
    );

    // Get emergency contacts
    this.app.get('/emergency-contacts/:userId',
      authenticateToken,
      asyncHandler(this.getEmergencyContacts.bind(this))
    );

    // Update emergency contacts
    this.app.put('/emergency-contacts/:userId',
      authenticateToken,
      asyncHandler(this.updateEmergencyContacts.bind(this))
    );

    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', service: 'passenger-management' });
    });
  }

  private async createOrUpdateProfile(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.userId;
    const profileData = req.body;

    if (!userId) {
      throw new ApiError('User ID is required', 400);
    }

    try {
      // Check if profile already exists
      const { data: existingProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      // Encrypt sensitive personal information
      const encryptedData = {
        name: profileData.name ? EncryptionService.encrypt(profileData.name) : null,
        email: profileData.email ? EncryptionService.encrypt(profileData.email) : null,
        phone: profileData.phone ? EncryptionService.encrypt(profileData.phone) : null,
        address: profileData.address ? EncryptionService.encrypt(profileData.address) : null
      };

      // Generate anonymized identifiers
      const anonymizedData = {
        pseudonym: AnonymizationService.generatePseudonym(userId),
        masked_email: profileData.email ? AnonymizationService.maskEmail(profileData.email) : null,
        masked_phone: profileData.phone ? AnonymizationService.maskPhone(profileData.phone) : null
      };

      const profilePayload = {
        user_id: userId,
        encrypted_personal_info: encryptedData,
        anonymized_data: anonymizedData,
        preferences: profileData.preferences || {},
        privacy_settings: profileData.privacy_settings || {
          share_location: false,
          share_ride_history: false,
          anonymous_mode: true
        },
        updated_at: new Date().toISOString()
      };

      let profile;
      if (existingProfile) {
        // Update existing profile
        const { data, error } = await supabaseAdmin
          .from('user_profiles')
          .update(profilePayload)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) {
          throw new ApiError('Failed to update profile', 500);
        }
        profile = data;
      } else {
        // Create new profile
        profilePayload.created_at = new Date().toISOString();
        const { data, error } = await supabaseAdmin
          .from('user_profiles')
          .insert(profilePayload)
          .select()
          .single();

        if (error) {
          throw new ApiError('Failed to create profile', 500);
        }
        profile = data;
      }

      logger.info('Passenger profile updated', {
        userId,
        profileId: profile.id,
        action: existingProfile ? 'update' : 'create'
      });

      res.json({
        success: true,
        data: {
          profileId: profile.id,
          pseudonym: anonymizedData.pseudonym,
          preferences: profile.preferences,
          privacySettings: profile.privacy_settings
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to create/update passenger profile', { error, userId });
      throw error;
    }
  }

  private async getProfile(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const requestingUserId = (req as any).user?.userId;

    // Users can only access their own profile unless admin
    if (userId !== requestingUserId && !(req as any).user?.isAdmin) {
      throw new ApiError('Access denied', 403);
    }

    try {
      const { data: profile, error } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !profile) {
        throw new ApiError('Profile not found', 404);
      }

      // Decrypt personal information for the user
      const decryptedPersonalInfo = {
        name: profile.encrypted_personal_info.name ? 
          EncryptionService.decrypt(profile.encrypted_personal_info.name) : null,
        email: profile.encrypted_personal_info.email ? 
          EncryptionService.decrypt(profile.encrypted_personal_info.email) : null,
        phone: profile.encrypted_personal_info.phone ? 
          EncryptionService.decrypt(profile.encrypted_personal_info.phone) : null,
        address: profile.encrypted_personal_info.address ? 
          EncryptionService.decrypt(profile.encrypted_personal_info.address) : null
      };

      res.json({
        success: true,
        data: {
          ...profile,
          personalInfo: decryptedPersonalInfo,
          encrypted_personal_info: undefined // Remove encrypted data from response
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get passenger profile', { error, userId });
      throw error;
    }
  }

  private async updatePreferences(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const requestingUserId = (req as any).user?.userId;
    const { preferences } = req.body;

    if (userId !== requestingUserId) {
      throw new ApiError('Access denied', 403);
    }

    try {
      const { data: profile, error } = await supabaseAdmin
        .from('user_profiles')
        .update({
          preferences,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new ApiError('Failed to update preferences', 500);
      }

      res.json({
        success: true,
        data: {
          preferences: profile.preferences
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to update preferences', { error, userId });
      throw error;
    }
  }

  private async getRideHistory(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const requestingUserId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    if (userId !== requestingUserId) {
      throw new ApiError('Access denied', 403);
    }

    try {
      const { data: rides, error, count } = await supabaseAdmin
        .from('rides')
        .select(`
          *,
          drivers(
            id,
            anonymized_data
          )
        `, { count: 'exact' })
        .eq('passenger_id', userId)
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      if (error) {
        throw new ApiError('Failed to fetch ride history', 500);
      }

      // Anonymize sensitive data in ride history
      const anonymizedRides = rides?.map(ride => ({
        ...ride,
        pickup_location: this.anonymizeLocation(ride.pickup_location),
        dropoff_location: this.anonymizeLocation(ride.dropoff_location),
        driver: ride.drivers ? {
          pseudonym: ride.drivers.anonymized_data?.pseudonym || 'Anonymous Driver'
        } : null,
        drivers: undefined
      }));

      res.json({
        success: true,
        data: anonymizedRides,
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

  private async getAnonymizedProfile(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;

    try {
      const { data: profile, error } = await supabaseAdmin
        .from('user_profiles')
        .select('anonymized_data, preferences')
        .eq('user_id', userId)
        .single();

      if (error || !profile) {
        throw new ApiError('Profile not found', 404);
      }

      // Return only anonymized data for drivers
      res.json({
        success: true,
        data: {
          pseudonym: profile.anonymized_data.pseudonym,
          preferences: {
            vehicle_type: profile.preferences?.vehicle_type,
            accessibility_needs: profile.preferences?.accessibility_needs,
            music_preference: profile.preferences?.music_preference
          }
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get anonymized profile', { error, userId });
      throw error;
    }
  }

  private async updateLocationPreferences(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const requestingUserId = (req as any).user?.userId;
    const { locationPreferences } = req.body;

    if (userId !== requestingUserId) {
      throw new ApiError('Access denied', 403);
    }

    try {
      const { data: profile, error } = await supabaseAdmin
        .from('user_profiles')
        .update({
          preferences: {
            ...req.body.currentPreferences,
            location: locationPreferences
          },
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new ApiError('Failed to update location preferences', 500);
      }

      res.json({
        success: true,
        data: {
          locationPreferences: profile.preferences.location
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to update location preferences', { error, userId });
      throw error;
    }
  }

  private async getPassengerStats(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const requestingUserId = (req as any).user?.userId;

    if (userId !== requestingUserId) {
      throw new ApiError('Access denied', 403);
    }

    try {
      // Get ride statistics
      const { data: rideStats, error: rideError } = await supabaseAdmin
        .from('rides')
        .select('status, final_fare, created_at')
        .eq('passenger_id', userId);

      if (rideError) {
        throw new ApiError('Failed to fetch ride statistics', 500);
      }

      const stats = {
        totalRides: rideStats?.length || 0,
        completedRides: rideStats?.filter(r => r.status === 'completed').length || 0,
        totalSpent: rideStats?.reduce((sum, r) => sum + (r.final_fare || 0), 0) || 0,
        averageRideDistance: 5.2, // TODO: Calculate from actual ride data
        memberSince: rideStats?.[0]?.created_at || new Date().toISOString(),
        favoriteDestinations: [] // TODO: Implement based on ride history
      };

      res.json({
        success: true,
        data: stats
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get passenger stats', { error, userId });
      throw error;
    }
  }

  private async generateZKProof(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const requestingUserId = (req as any).user?.userId;

    if (userId !== requestingUserId) {
      throw new ApiError('Access denied', 403);
    }

    try {
      // Generate zero-knowledge proof for identity verification
      const proof = ZKProofService.generateIdentityProof(userId);

      res.json({
        success: true,
        data: {
          proof,
          timestamp: new Date().toISOString()
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to generate ZK proof', { error, userId });
      throw error;
    }
  }

  private async verifyIdentity(req: Request, res: Response): Promise<void> {
    const { proof, userId } = req.body;

    try {
      const isValid = ZKProofService.verifyIdentityProof(proof, userId);

      res.json({
        success: true,
        data: {
          verified: isValid,
          timestamp: new Date().toISOString()
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to verify identity', { error });
      throw error;
    }
  }

  private async getEmergencyContacts(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const requestingUserId = (req as any).user?.userId;

    if (userId !== requestingUserId) {
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

  private async updateEmergencyContacts(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const requestingUserId = (req as any).user?.userId;
    const { contacts } = req.body;

    if (userId !== requestingUserId) {
      throw new ApiError('Access denied', 403);
    }

    try {
      // Delete existing contacts
      await supabaseAdmin
        .from('emergency_contacts')
        .delete()
        .eq('user_id', userId);

      // Insert new contacts
      const encryptedContacts = contacts.map((contact: any, index: number) => ({
        user_id: userId,
        encrypted_name: EncryptionService.encrypt(contact.name),
        encrypted_phone: EncryptionService.encrypt(contact.phone),
        encrypted_email: contact.email ? EncryptionService.encrypt(contact.email) : null,
        relationship: contact.relationship,
        priority: index + 1,
        created_at: new Date().toISOString()
      }));

      const { data: newContacts, error } = await supabaseAdmin
        .from('emergency_contacts')
        .insert(encryptedContacts)
        .select();

      if (error) {
        throw new ApiError('Failed to update emergency contacts', 500);
      }

      res.json({
        success: true,
        data: {
          contactsUpdated: newContacts?.length || 0
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to update emergency contacts', { error, userId });
      throw error;
    }
  }

  private anonymizeLocation(location: LocationData): Partial<LocationData> {
    if (!location) return {};
    
    return {
      // Round coordinates to reduce precision
      latitude: Math.round(location.latitude * 100) / 100,
      longitude: Math.round(location.longitude * 100) / 100,
      address: location.address ? AnonymizationService.maskAddress(location.address) : undefined
    };
  }

  public getApp(): express.Application {
    return this.app;
  }
}

// Export singleton instance
let passengerServiceInstance: PassengerManagementService | null = null;

export const createPassengerManagementService = (): PassengerManagementService => {
  if (!passengerServiceInstance) {
    passengerServiceInstance = new PassengerManagementService();
  }
  return passengerServiceInstance;
};

export const getPassengerManagementService = (): PassengerManagementService => {
  if (!passengerServiceInstance) {
    throw new Error('Passenger Management Service not initialized');
  }
  return passengerServiceInstance;
};

export { PassengerManagementService };