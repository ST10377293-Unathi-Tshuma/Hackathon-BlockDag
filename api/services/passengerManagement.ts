import express, { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { Logger } from '../middleware/logger';
import { AppError, ValidationError, NotFoundError } from '../middleware/errorHandler';
import { asyncHandler } from '../middleware/errorHandler';

const app = express();
const logger = new Logger();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Types
interface PassengerProfile {
  user_id: string;
  anonymized_id: string;
  preferred_name?: string;
  phone_verified: boolean;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  safety_preferences: {
    share_trip_details: boolean;
    require_driver_photo: boolean;
    enable_live_tracking: boolean;
    auto_emergency_alert: boolean;
  };
  ride_preferences: {
    preferred_vehicle_type: string;
    max_wait_time: number;
    allow_shared_rides: boolean;
    accessibility_needs: string[];
  };
}

interface RideHistory {
  ride_id: string;
  driver_anonymized_id: string;
  pickup_location: string;
  dropoff_location: string;
  ride_date: string;
  duration: number;
  distance: number;
  fare: number;
  rating_given?: number;
  status: string;
}

interface SafetyReport {
  ride_id: string;
  report_type: 'safety_concern' | 'driver_behavior' | 'vehicle_condition' | 'route_issue';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence_urls?: string[];
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

const generateAnonymizedId = (userId: string): string => {
  const hash = crypto.createHash('sha256');
  hash.update(userId + process.env.ANONYMIZATION_SALT!);
  return 'P_' + hash.digest('hex').substring(0, 12).toUpperCase();
};

const anonymizeLocation = (location: string): string => {
  // Remove specific address details, keep only general area
  const parts = location.split(',');
  if (parts.length > 2) {
    return parts.slice(-2).join(',').trim(); // Keep only city and state/country
  }
  return location;
};

const calculatePassengerScore = (profile: any, rideHistory: any[]): number => {
  let score = 50; // Base score
  
  // Phone verification bonus
  if (profile.phone_verified) score += 15;
  
  // Emergency contact bonus
  if (profile.emergency_contact_name && profile.emergency_contact_phone) score += 10;
  
  // Ride history factor
  const totalRides = rideHistory.length;
  if (totalRides > 50) score += 20;
  else if (totalRides > 20) score += 15;
  else if (totalRides > 10) score += 10;
  else if (totalRides > 5) score += 5;
  
  // Average rating factor
  const ratingsGiven = rideHistory.filter(ride => ride.rating_given).length;
  if (ratingsGiven > totalRides * 0.8) score += 5; // High engagement
  
  // Completed rides factor
  const completedRides = rideHistory.filter(ride => ride.status === 'completed').length;
  const completionRate = totalRides > 0 ? completedRides / totalRides : 0;
  if (completionRate > 0.95) score += 10;
  else if (completionRate > 0.9) score += 5;
  
  return Math.min(score, 100);
};

// API Routes

// Create/Update Passenger Profile
app.post('/profile', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const profileData = req.body;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  // Generate anonymized ID
  const anonymizedId = generateAnonymizedId(userId);

  // Check if profile already exists
  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  const profilePayload = {
    user_id: userId,
    anonymized_id: anonymizedId,
    preferred_name: profileData.preferred_name,
    phone_verified: profileData.phone_verified || false,
    emergency_contact_name: profileData.emergency_contact_name,
    emergency_contact_phone: profileData.emergency_contact_phone,
    safety_preferences: profileData.safety_preferences || {
      share_trip_details: true,
      require_driver_photo: true,
      enable_live_tracking: true,
      auto_emergency_alert: false,
    },
    ride_preferences: profileData.ride_preferences || {
      preferred_vehicle_type: 'any',
      max_wait_time: 10,
      allow_shared_rides: false,
      accessibility_needs: [],
    },
    updated_at: new Date().toISOString(),
  };

  let result;
  if (existingProfile) {
    // Update existing profile
    const { data, error } = await supabase
      .from('user_profiles')
      .update(profilePayload)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) {
      throw new AppError('Failed to update passenger profile', 500);
    }
    result = data;
  } else {
    // Create new profile
    profilePayload.created_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('user_profiles')
      .insert(profilePayload)
      .select()
      .single();
    
    if (error) {
      throw new AppError('Failed to create passenger profile', 500);
    }
    result = data;
  }

  // Create emergency contact if provided
  if (profileData.emergency_contact_name && profileData.emergency_contact_phone) {
    const { error: emergencyError } = await supabase
      .from('emergency_contacts')
      .upsert({
        user_id: userId,
        name: profileData.emergency_contact_name,
        phone: profileData.emergency_contact_phone,
        relationship: 'emergency',
        is_primary: true,
      }, {
        onConflict: 'user_id,is_primary',
      });

    if (emergencyError) {
      logger.warn('Failed to create/update emergency contact', { error: emergencyError, userId });
    }
  }

  logger.info('Passenger profile updated', { userId, anonymizedId });

  res.json({
    success: true,
    message: existingProfile ? 'Profile updated successfully' : 'Profile created successfully',
    data: {
      anonymized_id: result.anonymized_id,
      preferred_name: result.preferred_name,
      phone_verified: result.phone_verified,
      safety_preferences: result.safety_preferences,
      ride_preferences: result.ride_preferences,
      created_at: result.created_at,
      updated_at: result.updated_at,
    },
  });
}));

// Get Passenger Profile
app.get('/profile', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !profile) {
    throw new NotFoundError('Passenger profile not found');
  }

  // Get ride history for score calculation
  const { data: rideHistory } = await supabase
    .from('rides')
    .select('*')
    .eq('passenger_id', userId)
    .order('created_at', { ascending: false });

  const passengerScore = calculatePassengerScore(profile, rideHistory || []);

  res.json({
    success: true,
    data: {
      anonymized_id: profile.anonymized_id,
      preferred_name: profile.preferred_name,
      phone_verified: profile.phone_verified,
      passenger_score: passengerScore,
      safety_preferences: profile.safety_preferences,
      ride_preferences: profile.ride_preferences,
      emergency_contact_name: profile.emergency_contact_name,
      emergency_contact_phone: profile.emergency_contact_phone,
      total_rides: rideHistory?.length || 0,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    },
  });
}));

// Get Ride History
app.get('/rides/history', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { page = 1, limit = 20, status } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  let query = supabase
    .from('rides')
    .select(`
      id,
      driver_id,
      pickup_location,
      dropoff_location,
      pickup_time,
      dropoff_time,
      duration,
      distance,
      fare,
      status,
      passenger_rating,
      created_at,
      drivers!inner(id)
    `)
    .eq('passenger_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data: rides, error } = await query;

  if (error) {
    throw new AppError('Failed to fetch ride history', 500);
  }

  // Anonymize the ride data
  const anonymizedRides = rides?.map(ride => ({
    ride_id: ride.id,
    driver_anonymized_id: generateAnonymizedId(ride.driver_id),
    pickup_location: anonymizeLocation(ride.pickup_location),
    dropoff_location: anonymizeLocation(ride.dropoff_location),
    ride_date: ride.pickup_time,
    duration: ride.duration,
    distance: ride.distance,
    fare: ride.fare,
    rating_given: ride.passenger_rating,
    status: ride.status,
    created_at: ride.created_at,
  })) || [];

  res.json({
    success: true,
    data: {
      rides: anonymizedRides,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: rides?.length || 0,
      },
    },
  });
}));

// Get Ride Statistics
app.get('/rides/stats', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { period = '30d' } = req.query;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  // Calculate date range
  const now = new Date();
  let startDate: Date;
  
  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const { data: rides, error } = await supabase
    .from('rides')
    .select('*')
    .eq('passenger_id', userId)
    .gte('created_at', startDate.toISOString());

  if (error) {
    throw new AppError('Failed to fetch ride statistics', 500);
  }

  const stats = {
    total_rides: rides?.length || 0,
    completed_rides: rides?.filter(r => r.status === 'completed').length || 0,
    cancelled_rides: rides?.filter(r => r.status === 'cancelled').length || 0,
    total_distance: rides?.reduce((sum, r) => sum + (r.distance || 0), 0) || 0,
    total_fare: rides?.reduce((sum, r) => sum + (r.fare || 0), 0) || 0,
    average_rating_given: 0,
    favorite_pickup_areas: [],
    favorite_dropoff_areas: [],
  };

  // Calculate average rating
  const ratingsGiven = rides?.filter(r => r.passenger_rating) || [];
  if (ratingsGiven.length > 0) {
    stats.average_rating_given = ratingsGiven.reduce((sum, r) => sum + r.passenger_rating, 0) / ratingsGiven.length;
  }

  // Calculate favorite areas (simplified)
  const pickupAreas = rides?.map(r => anonymizeLocation(r.pickup_location)) || [];
  const dropoffAreas = rides?.map(r => anonymizeLocation(r.dropoff_location)) || [];
  
  const pickupCounts = pickupAreas.reduce((acc: any, area) => {
    acc[area] = (acc[area] || 0) + 1;
    return acc;
  }, {});
  
  const dropoffCounts = dropoffAreas.reduce((acc: any, area) => {
    acc[area] = (acc[area] || 0) + 1;
    return acc;
  }, {});

  stats.favorite_pickup_areas = Object.entries(pickupCounts)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([area, count]) => ({ area, count }));

  stats.favorite_dropoff_areas = Object.entries(dropoffCounts)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([area, count]) => ({ area, count }));

  res.json({
    success: true,
    data: {
      period,
      statistics: stats,
    },
  });
}));

// Submit Safety Report
app.post('/safety/report', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { ride_id, report_type, description, severity, evidence_urls } = req.body;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  // Validate required fields
  if (!ride_id || !report_type || !description || !severity) {
    throw new ValidationError('ride_id, report_type, description, and severity are required');
  }

  // Validate report type and severity
  const validReportTypes = ['safety_concern', 'driver_behavior', 'vehicle_condition', 'route_issue'];
  const validSeverities = ['low', 'medium', 'high', 'critical'];

  if (!validReportTypes.includes(report_type)) {
    throw new ValidationError('Invalid report type');
  }

  if (!validSeverities.includes(severity)) {
    throw new ValidationError('Invalid severity level');
  }

  // Verify the ride belongs to the user
  const { data: ride, error: rideError } = await supabase
    .from('rides')
    .select('id, driver_id')
    .eq('id', ride_id)
    .eq('passenger_id', userId)
    .single();

  if (rideError || !ride) {
    throw new NotFoundError('Ride not found or access denied');
  }

  // Create safety report
  const { data: report, error: reportError } = await supabase
    .from('emergency_incidents')
    .insert({
      ride_id,
      user_id: userId,
      incident_type: 'safety_report',
      description,
      severity,
      status: 'reported',
      metadata: {
        report_type,
        evidence_urls: evidence_urls || [],
        driver_id: ride.driver_id,
      },
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (reportError) {
    throw new AppError('Failed to submit safety report', 500);
  }

  logger.info('Safety report submitted', { 
    reportId: report.id, 
    userId, 
    rideId: ride_id, 
    reportType: report_type, 
    severity 
  });

  res.status(201).json({
    success: true,
    message: 'Safety report submitted successfully',
    data: {
      report_id: report.id,
      status: 'reported',
      submitted_at: report.created_at,
    },
  });
}));

// Get Safety Reports
app.get('/safety/reports', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { page = 1, limit = 10 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  const { data: reports, error } = await supabase
    .from('emergency_incidents')
    .select(`
      id,
      ride_id,
      incident_type,
      description,
      severity,
      status,
      metadata,
      created_at,
      updated_at
    `)
    .eq('user_id', userId)
    .eq('incident_type', 'safety_report')
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (error) {
    throw new AppError('Failed to fetch safety reports', 500);
  }

  res.json({
    success: true,
    data: {
      reports: reports?.map(report => ({
        report_id: report.id,
        ride_id: report.ride_id,
        report_type: report.metadata?.report_type,
        description: report.description,
        severity: report.severity,
        status: report.status,
        submitted_at: report.created_at,
        updated_at: report.updated_at,
      })) || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: reports?.length || 0,
      },
    },
  });
}));

// Update Preferences
app.patch('/preferences', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { safety_preferences, ride_preferences } = req.body;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  if (!safety_preferences && !ride_preferences) {
    throw new ValidationError('At least one preference type must be provided');
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (safety_preferences) {
    updateData.safety_preferences = safety_preferences;
  }

  if (ride_preferences) {
    updateData.ride_preferences = ride_preferences;
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .update(updateData)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to update preferences', 500);
  }

  logger.info('Passenger preferences updated', { userId });

  res.json({
    success: true,
    message: 'Preferences updated successfully',
    data: {
      safety_preferences: profile.safety_preferences,
      ride_preferences: profile.ride_preferences,
      updated_at: profile.updated_at,
    },
  });
}));

// Delete Account Data (GDPR Compliance)
app.delete('/account', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { confirmation } = req.body;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  if (confirmation !== 'DELETE_MY_DATA') {
    throw new ValidationError('Confirmation phrase required');
  }

  // Check for active rides
  const { data: activeRides } = await supabase
    .from('rides')
    .select('id')
    .eq('passenger_id', userId)
    .in('status', ['requested', 'accepted', 'in_progress']);

  if (activeRides && activeRides.length > 0) {
    throw new ValidationError('Cannot delete account with active rides');
  }

  // Anonymize ride history instead of deleting
  const { error: ridesError } = await supabase
    .from('rides')
    .update({
      passenger_id: null,
      pickup_location: 'ANONYMIZED',
      dropoff_location: 'ANONYMIZED',
    })
    .eq('passenger_id', userId);

  if (ridesError) {
    logger.warn('Failed to anonymize ride history', { error: ridesError, userId });
  }

  // Delete user profile
  const { error: profileError } = await supabase
    .from('user_profiles')
    .delete()
    .eq('user_id', userId);

  if (profileError) {
    throw new AppError('Failed to delete user profile', 500);
  }

  // Delete emergency contacts
  const { error: emergencyError } = await supabase
    .from('emergency_contacts')
    .delete()
    .eq('user_id', userId);

  if (emergencyError) {
    logger.warn('Failed to delete emergency contacts', { error: emergencyError, userId });
  }

  logger.info('Passenger account data deleted', { userId });

  res.json({
    success: true,
    message: 'Account data deleted successfully',
  });
}));

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'passenger-management',
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Passenger management service error', { error: error.message, stack: error.stack });
  
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

const PORT = process.env.PASSENGER_MANAGEMENT_PORT || 3003;

app.listen(PORT, () => {
  logger.info(`Passenger Management Service running on port ${PORT}`);
});

export default app;