import express, { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { BlockchainService } from './blockchain';
import { Logger } from '../middleware/logger';
import { AppError, ValidationError, NotFoundError } from '../middleware/errorHandler';
import { asyncHandler } from '../middleware/errorHandler';

const app = express();
const logger = new Logger();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// Initialize blockchain service
const blockchainService = new BlockchainService();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
    }
  },
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Types
interface DriverRegistrationData {
  user_id: string;
  license_number: string;
  license_expiry: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_color: string;
  vehicle_plate: string;
  insurance_policy: string;
  insurance_expiry: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

interface DocumentUpload {
  document_type: 'license' | 'insurance' | 'registration' | 'photo';
  file_data: Buffer;
  file_name: string;
  mime_type: string;
}

interface VerificationStatus {
  driver_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  verified_at?: string;
  verified_by?: string;
  rejection_reason?: string;
  notes?: string;
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

const uploadDocument = async (
  userId: string,
  documentType: string,
  fileData: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> => {
  try {
    const fileExtension = fileName.split('.').pop();
    const uniqueFileName = `${userId}/${documentType}_${Date.now()}.${fileExtension}`;
    
    const { data, error } = await supabase.storage
      .from('driver-documents')
      .upload(uniqueFileName, fileData, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      throw new AppError('Failed to upload document', 500);
    }

    return data.path;
  } catch (error) {
    logger.error('Document upload failed', { error, userId, documentType });
    throw error;
  }
};

const calculateDriverScore = (driver: any): number => {
  let score = 0;
  
  // Base score for verification
  if (driver.verification_status === 'approved') score += 50;
  
  // Vehicle age factor
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - driver.vehicle_year;
  if (vehicleAge <= 5) score += 20;
  else if (vehicleAge <= 10) score += 10;
  
  // License validity
  const licenseExpiry = new Date(driver.license_expiry);
  const monthsToExpiry = (licenseExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsToExpiry > 12) score += 15;
  else if (monthsToExpiry > 6) score += 10;
  else if (monthsToExpiry > 3) score += 5;
  
  // Insurance validity
  const insuranceExpiry = new Date(driver.insurance_expiry);
  const insuranceMonthsToExpiry = (insuranceExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
  if (insuranceMonthsToExpiry > 6) score += 15;
  else if (insuranceMonthsToExpiry > 3) score += 10;
  else if (insuranceMonthsToExpiry > 1) score += 5;
  
  return Math.min(score, 100);
};

// API Routes

// Driver Registration
app.post('/register', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const registrationData: DriverRegistrationData = req.body;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  // Validate required fields
  const requiredFields = [
    'license_number', 'license_expiry', 'vehicle_make', 'vehicle_model',
    'vehicle_year', 'vehicle_color', 'vehicle_plate', 'insurance_policy',
    'insurance_expiry', 'emergency_contact_name', 'emergency_contact_phone'
  ];

  for (const field of requiredFields) {
    if (!registrationData[field as keyof DriverRegistrationData]) {
      throw new ValidationError(`${field} is required`);
    }
  }

  // Check if driver already exists
  const { data: existingDriver } = await supabase
    .from('drivers')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (existingDriver) {
    throw new ValidationError('Driver profile already exists');
  }

  // Create driver profile
  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .insert({
      user_id: userId,
      license_number: registrationData.license_number,
      license_expiry: registrationData.license_expiry,
      verification_status: 'pending',
      is_available: false,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (driverError) {
    throw new AppError('Failed to create driver profile', 500);
  }

  // Create vehicle info
  const { error: vehicleError } = await supabase
    .from('vehicle_info')
    .insert({
      driver_id: driver.id,
      make: registrationData.vehicle_make,
      model: registrationData.vehicle_model,
      year: registrationData.vehicle_year,
      color: registrationData.vehicle_color,
      license_plate: registrationData.vehicle_plate,
      insurance_policy: registrationData.insurance_policy,
      insurance_expiry: registrationData.insurance_expiry,
    });

  if (vehicleError) {
    throw new AppError('Failed to create vehicle info', 500);
  }

  // Create emergency contact
  const { error: emergencyError } = await supabase
    .from('emergency_contacts')
    .insert({
      user_id: userId,
      name: registrationData.emergency_contact_name,
      phone: registrationData.emergency_contact_phone,
      relationship: 'emergency',
      is_primary: true,
    });

  if (emergencyError) {
    logger.warn('Failed to create emergency contact', { error: emergencyError, userId });
  }

  // Create driver verification record
  const { error: verificationError } = await supabase
    .from('driver_verification')
    .insert({
      driver_id: driver.id,
      status: 'pending',
      submitted_at: new Date().toISOString(),
    });

  if (verificationError) {
    throw new AppError('Failed to create verification record', 500);
  }

  logger.info('Driver registered successfully', { driverId: driver.id, userId });

  res.status(201).json({
    success: true,
    message: 'Driver registration successful',
    data: {
      driver_id: driver.id,
      verification_status: 'pending',
    },
  });
}));

// Document Upload
app.post('/documents/upload', authenticateToken, upload.array('documents', 5), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const files = req.files as Express.Multer.File[];
  const documentTypes = req.body.document_types; // Array of document types

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  if (!files || files.length === 0) {
    throw new ValidationError('No files uploaded');
  }

  // Get driver ID
  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (driverError || !driver) {
    throw new NotFoundError('Driver profile not found');
  }

  const uploadedDocuments = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const documentType = Array.isArray(documentTypes) ? documentTypes[i] : documentTypes;

    try {
      const filePath = await uploadDocument(
        userId,
        documentType,
        file.buffer,
        file.originalname,
        file.mimetype
      );

      // Update driver verification with document path
      const { error: updateError } = await supabase
        .from('driver_verification')
        .update({
          [`${documentType}_document_url`]: filePath,
          updated_at: new Date().toISOString(),
        })
        .eq('driver_id', driver.id);

      if (updateError) {
        logger.warn('Failed to update verification record', { error: updateError, driverId: driver.id });
      }

      uploadedDocuments.push({
        document_type: documentType,
        file_path: filePath,
        uploaded_at: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Document upload failed', { error, userId, documentType });
    }
  }

  logger.info('Documents uploaded', { driverId: driver.id, documentCount: uploadedDocuments.length });

  res.json({
    success: true,
    message: 'Documents uploaded successfully',
    data: {
      uploaded_documents: uploadedDocuments,
    },
  });
}));

// Get Driver Status
app.get('/status', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  // Get driver with verification and vehicle info
  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select(`
      *,
      driver_verification (*),
      vehicle_info (*)
    `)
    .eq('user_id', userId)
    .single();

  if (driverError || !driver) {
    throw new NotFoundError('Driver profile not found');
  }

  // Calculate driver score
  const driverScore = calculateDriverScore(driver);

  // Check blockchain verification status
  let blockchainVerified = false;
  try {
    blockchainVerified = await blockchainService.isDriverVerified(driver.id);
  } catch (error) {
    logger.warn('Failed to check blockchain verification', { error, driverId: driver.id });
  }

  res.json({
    success: true,
    data: {
      driver_id: driver.id,
      verification_status: driver.verification_status,
      is_available: driver.is_available,
      driver_score: driverScore,
      blockchain_verified: blockchainVerified,
      verification_details: driver.driver_verification[0] || null,
      vehicle_info: driver.vehicle_info[0] || null,
      created_at: driver.created_at,
      updated_at: driver.updated_at,
    },
  });
}));

// Update Driver Availability
app.patch('/availability', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { is_available, latitude, longitude } = req.body;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  if (typeof is_available !== 'boolean') {
    throw new ValidationError('is_available must be a boolean');
  }

  // Get driver ID
  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('id, verification_status')
    .eq('user_id', userId)
    .single();

  if (driverError || !driver) {
    throw new NotFoundError('Driver profile not found');
  }

  if (driver.verification_status !== 'approved') {
    throw new ValidationError('Driver must be verified to change availability');
  }

  // Update availability
  const updateData: any = {
    is_available,
    updated_at: new Date().toISOString(),
  };

  // Update location if provided
  if (latitude && longitude) {
    updateData.current_latitude = latitude;
    updateData.current_longitude = longitude;
    updateData.last_location_update = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from('drivers')
    .update(updateData)
    .eq('id', driver.id);

  if (updateError) {
    throw new AppError('Failed to update availability', 500);
  }

  logger.info('Driver availability updated', { driverId: driver.id, isAvailable: is_available });

  res.json({
    success: true,
    message: 'Availability updated successfully',
    data: {
      driver_id: driver.id,
      is_available,
    },
  });
}));

// Admin: Verify Driver
app.post('/admin/verify/:driverId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { driverId } = req.params;
  const { status, notes, rejection_reason } = req.body;
  const adminUserId = req.user?.id;

  if (!['approved', 'rejected'].includes(status)) {
    throw new ValidationError('Status must be either approved or rejected');
  }

  // Check if user is admin (you might want to implement proper role checking)
  // For now, we'll assume any authenticated user can verify

  // Get driver
  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .single();

  if (driverError || !driver) {
    throw new NotFoundError('Driver not found');
  }

  // Update driver verification status
  const { error: driverUpdateError } = await supabase
    .from('drivers')
    .update({
      verification_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', driverId);

  if (driverUpdateError) {
    throw new AppError('Failed to update driver status', 500);
  }

  // Update verification record
  const verificationUpdate: any = {
    status,
    verified_at: new Date().toISOString(),
    verified_by: adminUserId,
    notes,
    updated_at: new Date().toISOString(),
  };

  if (status === 'rejected' && rejection_reason) {
    verificationUpdate.rejection_reason = rejection_reason;
  }

  const { error: verificationError } = await supabase
    .from('driver_verification')
    .update(verificationUpdate)
    .eq('driver_id', driverId);

  if (verificationError) {
    throw new AppError('Failed to update verification record', 500);
  }

  // If approved, verify on blockchain
  if (status === 'approved') {
    try {
      await blockchainService.verifyDriver(driverId, 100); // Initial reputation score
      logger.info('Driver verified on blockchain', { driverId });
    } catch (error) {
      logger.error('Failed to verify driver on blockchain', { error, driverId });
    }
  }

  logger.info('Driver verification updated', { driverId, status, adminUserId });

  res.json({
    success: true,
    message: `Driver ${status} successfully`,
    data: {
      driver_id: driverId,
      status,
      verified_at: new Date().toISOString(),
    },
  });
}));

// Admin: Get Pending Verifications
app.get('/admin/pending', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const { data: pendingDrivers, error } = await supabase
    .from('drivers')
    .select(`
      *,
      driver_verification (*),
      vehicle_info (*),
      saferide_users (email, phone)
    `)
    .eq('verification_status', 'pending')
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (error) {
    throw new AppError('Failed to fetch pending verifications', 500);
  }

  res.json({
    success: true,
    data: {
      drivers: pendingDrivers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: pendingDrivers.length,
      },
    },
  });
}));

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'driver-verification',
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Driver verification service error', { error: error.message, stack: error.stack });
  
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

const PORT = process.env.DRIVER_VERIFICATION_PORT || 3002;

app.listen(PORT, () => {
  logger.info(`Driver Verification Service running on port ${PORT}`);
});

export default app;