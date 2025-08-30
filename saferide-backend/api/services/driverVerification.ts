import express, { Request, Response } from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../config/database.js';
import { getBlockchainService, hashDocument } from '../utils/blockchain.js';
import { EncryptionService, AnonymizationService } from '../utils/encryption.js';
import { validate, driverRegistrationSchema, documentVerificationSchema } from '../middleware/validation.js';
import { asyncHandler, ApiError, logger } from '../middleware/errorHandler.js';
import { requireDriverVerification } from '../middleware/auth.js';
import {
  ApiResponse,
  PaginatedResponse,
  DriverRegistrationRequest,
  Driver,
  DriverVerification,
  VehicleInfo
} from '../../shared/types.js';

/**
 * Driver Verification Service
 * Handles driver registration, document verification, and status management
 */

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10
  },
  fileFilter: (req, file, cb) => {
    // Allow only specific file types
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError('Invalid file type. Only JPEG, PNG, and PDF files are allowed.', 400));
    }
  }
});

class DriverVerificationService {
  private app: express.Application;

  constructor() {
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Driver registration
    this.app.post('/register',
      upload.array('documents', 10),
      validate(driverRegistrationSchema),
      asyncHandler(this.registerDriver.bind(this))
    );

    // Get driver profile
    this.app.get('/profile/:driverId',
      asyncHandler(this.getDriverProfile.bind(this))
    );

    // Update driver profile
    this.app.put('/profile/:driverId',
      requireDriverVerification,
      asyncHandler(this.updateDriverProfile.bind(this))
    );

    // Document verification (admin only)
    this.app.post('/verify-document',
      validate(documentVerificationSchema),
      asyncHandler(this.verifyDocument.bind(this))
    );

    // Get verification status
    this.app.get('/verification-status/:driverId',
      asyncHandler(this.getVerificationStatus.bind(this))
    );

    // Get all drivers (admin only)
    this.app.get('/all',
      asyncHandler(this.getAllDrivers.bind(this))
    );

    // Get pending verifications (admin only)
    this.app.get('/pending-verifications',
      asyncHandler(this.getPendingVerifications.bind(this))
    );

    // Update verification status
    this.app.put('/verification-status/:driverId',
      asyncHandler(this.updateVerificationStatus.bind(this))
    );

    // Get driver statistics
    this.app.get('/stats/:driverId',
      requireDriverVerification,
      asyncHandler(this.getDriverStats.bind(this))
    );

    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', service: 'driver-verification' });
    });
  }

  private async registerDriver(req: Request, res: Response): Promise<void> {
    const { walletAddress, personalInfo, vehicleInfo } = req.body as DriverRegistrationRequest;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length < 3) {
      throw new ApiError('At least 3 documents are required (license, insurance, registration)', 400);
    }

    try {
      // Check if driver already exists
      const { data: existingDriver } = await supabaseAdmin
        .from('drivers')
        .select('id')
        .eq('wallet_address', walletAddress)
        .single();

      if (existingDriver) {
        throw new ApiError('Driver already registered with this wallet address', 409);
      }

      // Encrypt sensitive personal information
      const encryptedPersonalInfo = {
        name: EncryptionService.encrypt(personalInfo.name),
        email: EncryptionService.encrypt(personalInfo.email),
        phone: EncryptionService.encrypt(personalInfo.phone),
        address: EncryptionService.encrypt(personalInfo.address)
      };

      // Create driver record
      const { data: driver, error: driverError } = await supabaseAdmin
        .from('drivers')
        .insert({
          wallet_address: walletAddress,
          encrypted_personal_info: encryptedPersonalInfo,
          verification_status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (driverError) {
        throw new ApiError('Failed to create driver record', 500);
      }

      // Create vehicle info record
      const { error: vehicleError } = await supabaseAdmin
        .from('vehicle_info')
        .insert({
          driver_id: driver.id,
          make: vehicleInfo.make,
          model: vehicleInfo.model,
          year: vehicleInfo.year,
          license_plate: AnonymizationService.maskLicensePlate(vehicleInfo.license_plate),
          color: vehicleInfo.color,
          vehicle_type: vehicleInfo.vehicle_type,
          created_at: new Date().toISOString()
        });

      if (vehicleError) {
        throw new ApiError('Failed to create vehicle record', 500);
      }

      // Process and store documents
      const documentHashes: string[] = [];
      for (const file of files) {
        const documentHash = hashDocument(file.buffer);
        documentHashes.push(documentHash);

        // Store document verification record
        await supabaseAdmin
          .from('driver_verification')
          .insert({
            driver_id: driver.id,
            document_type: this.getDocumentType(file.originalname),
            document_hash: documentHash,
            verification_status: 'pending',
            submitted_at: new Date().toISOString()
          });
      }

      logger.info('Driver registration completed', {
        driverId: driver.id,
        walletAddress,
        documentsCount: files.length
      });

      res.status(201).json({
        success: true,
        data: {
          driverId: driver.id,
          walletAddress,
          verificationStatus: 'pending',
          documentsSubmitted: documentHashes.length
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Driver registration failed', { error, walletAddress });
      throw error;
    }
  }

  private async getDriverProfile(req: Request, res: Response): Promise<void> {
    const { driverId } = req.params;

    try {
      const { data: driver, error } = await supabaseAdmin
        .from('drivers')
        .select(`
          *,
          vehicle_info(*),
          driver_verification(*)
        `)
        .eq('id', driverId)
        .single();

      if (error || !driver) {
        throw new ApiError('Driver not found', 404);
      }

      // Decrypt personal information for authorized access
      const decryptedPersonalInfo = {
        name: EncryptionService.decrypt(driver.encrypted_personal_info.name),
        email: AnonymizationService.maskEmail(EncryptionService.decrypt(driver.encrypted_personal_info.email)),
        phone: AnonymizationService.maskPhone(EncryptionService.decrypt(driver.encrypted_personal_info.phone)),
        address: EncryptionService.decrypt(driver.encrypted_personal_info.address)
      };

      res.json({
        success: true,
        data: {
          ...driver,
          personalInfo: decryptedPersonalInfo,
          encrypted_personal_info: undefined // Remove encrypted data from response
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get driver profile', { error, driverId });
      throw error;
    }
  }

  private async updateDriverProfile(req: Request, res: Response): Promise<void> {
    const { driverId } = req.params;
    const updates = req.body;

    try {
      // Encrypt sensitive updates
      if (updates.personalInfo) {
        const encryptedPersonalInfo: any = {};
        if (updates.personalInfo.name) {
          encryptedPersonalInfo.name = EncryptionService.encrypt(updates.personalInfo.name);
        }
        if (updates.personalInfo.email) {
          encryptedPersonalInfo.email = EncryptionService.encrypt(updates.personalInfo.email);
        }
        if (updates.personalInfo.phone) {
          encryptedPersonalInfo.phone = EncryptionService.encrypt(updates.personalInfo.phone);
        }
        if (updates.personalInfo.address) {
          encryptedPersonalInfo.address = EncryptionService.encrypt(updates.personalInfo.address);
        }
        updates.encrypted_personal_info = encryptedPersonalInfo;
        delete updates.personalInfo;
      }

      const { data: driver, error } = await supabaseAdmin
        .from('drivers')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', driverId)
        .select()
        .single();

      if (error) {
        throw new ApiError('Failed to update driver profile', 500);
      }

      res.json({
        success: true,
        data: driver
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to update driver profile', { error, driverId });
      throw error;
    }
  }

  private async verifyDocument(req: Request, res: Response): Promise<void> {
    const { driverId, documentType, documentHash, verificationLevel } = req.body;

    try {
      // Update document verification status
      const { error: updateError } = await supabaseAdmin
        .from('driver_verification')
        .update({
          verification_status: 'verified',
          verification_level: verificationLevel,
          verified_at: new Date().toISOString(),
          verified_by: (req as any).user?.userId
        })
        .eq('driver_id', driverId)
        .eq('document_hash', documentHash);

      if (updateError) {
        throw new ApiError('Failed to update document verification', 500);
      }

      // Check if all required documents are verified
      const { data: verifications } = await supabaseAdmin
        .from('driver_verification')
        .select('verification_status')
        .eq('driver_id', driverId);

      const allVerified = verifications?.every(v => v.verification_status === 'verified');

      if (allVerified) {
        // Update driver status to verified
        await supabaseAdmin
          .from('drivers')
          .update({
            verification_status: 'verified',
            verified_at: new Date().toISOString()
          })
          .eq('id', driverId);

        // Get driver wallet address for blockchain verification
        const { data: driver } = await supabaseAdmin
          .from('drivers')
          .select('wallet_address')
          .eq('id', driverId)
          .single();

        if (driver) {
          // Verify on blockchain
          try {
            const blockchainService = getBlockchainService();
            await blockchainService.verifyDriver(
              driver.wallet_address,
              documentHash,
              verificationLevel
            );
          } catch (blockchainError) {
            logger.warn('Blockchain verification failed, but database updated', {
              driverId,
              error: blockchainError
            });
          }
        }
      }

      res.json({
        success: true,
        data: {
          driverId,
          documentType,
          verificationStatus: 'verified',
          allDocumentsVerified: allVerified
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Document verification failed', { error, driverId, documentType });
      throw error;
    }
  }

  private async getVerificationStatus(req: Request, res: Response): Promise<void> {
    const { driverId } = req.params;

    try {
      const { data: driver, error } = await supabaseAdmin
        .from('drivers')
        .select(`
          verification_status,
          verified_at,
          driver_verification(*)
        `)
        .eq('id', driverId)
        .single();

      if (error || !driver) {
        throw new ApiError('Driver not found', 404);
      }

      res.json({
        success: true,
        data: {
          driverId,
          verificationStatus: driver.verification_status,
          verifiedAt: driver.verified_at,
          documents: driver.driver_verification
        }
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get verification status', { error, driverId });
      throw error;
    }
  }

  private async getAllDrivers(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    try {
      const { data: drivers, error, count } = await supabaseAdmin
        .from('drivers')
        .select(`
          *,
          vehicle_info(*)
        `, { count: 'exact' })
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      if (error) {
        throw new ApiError('Failed to fetch drivers', 500);
      }

      res.json({
        success: true,
        data: drivers,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      } as PaginatedResponse);
    } catch (error) {
      logger.error('Failed to get all drivers', { error });
      throw error;
    }
  }

  private async getPendingVerifications(req: Request, res: Response): Promise<void> {
    try {
      const { data: pendingVerifications, error } = await supabaseAdmin
        .from('driver_verification')
        .select(`
          *,
          drivers(
            id,
            wallet_address,
            verification_status
          )
        `)
        .eq('verification_status', 'pending')
        .order('submitted_at', { ascending: true });

      if (error) {
        throw new ApiError('Failed to fetch pending verifications', 500);
      }

      res.json({
        success: true,
        data: pendingVerifications
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get pending verifications', { error });
      throw error;
    }
  }

  private async updateVerificationStatus(req: Request, res: Response): Promise<void> {
    const { driverId } = req.params;
    const { status, reason } = req.body;

    try {
      const { data: driver, error } = await supabaseAdmin
        .from('drivers')
        .update({
          verification_status: status,
          verification_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', driverId)
        .select()
        .single();

      if (error) {
        throw new ApiError('Failed to update verification status', 500);
      }

      res.json({
        success: true,
        data: driver
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to update verification status', { error, driverId });
      throw error;
    }
  }

  private async getDriverStats(req: Request, res: Response): Promise<void> {
    const { driverId } = req.params;

    try {
      // Get ride statistics
      const { data: rideStats, error: rideError } = await supabaseAdmin
        .from('rides')
        .select('status, final_fare')
        .eq('driver_id', driverId);

      if (rideError) {
        throw new ApiError('Failed to fetch ride statistics', 500);
      }

      const stats = {
        totalRides: rideStats?.length || 0,
        completedRides: rideStats?.filter(r => r.status === 'completed').length || 0,
        totalEarnings: rideStats?.reduce((sum, r) => sum + (r.final_fare || 0), 0) || 0,
        averageRating: 4.5, // TODO: Implement rating system
        joinedDate: new Date().toISOString() // TODO: Get actual join date
      };

      res.json({
        success: true,
        data: stats
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get driver stats', { error, driverId });
      throw error;
    }
  }

  private getDocumentType(filename: string): string {
    const name = filename.toLowerCase();
    if (name.includes('license') || name.includes('licence')) {
      return 'drivers_license';
    } else if (name.includes('insurance')) {
      return 'insurance';
    } else if (name.includes('registration')) {
      return 'vehicle_registration';
    } else {
      return 'other';
    }
  }

  public getApp(): express.Application {
    return this.app;
  }
}

// Export singleton instance
let driverServiceInstance: DriverVerificationService | null = null;

export const createDriverVerificationService = (): DriverVerificationService => {
  if (!driverServiceInstance) {
    driverServiceInstance = new DriverVerificationService();
  }
  return driverServiceInstance;
};

export const getDriverVerificationService = (): DriverVerificationService => {
  if (!driverServiceInstance) {
    throw new Error('Driver Verification Service not initialized');
  }
  return driverServiceInstance;
};

export { DriverVerificationService };