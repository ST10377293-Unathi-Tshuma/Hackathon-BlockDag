import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../shared/types.js';

/**
 * Generic validation middleware factory
 */
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      res.status(400).json({
        success: false,
        error: error.details[0].message
      } as ApiResponse);
      return;
    }
    
    next();
  };
};

/**
 * Validation schemas
 */

// Driver registration schema
export const driverRegistrationSchema = Joi.object({
  walletAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required()
    .messages({
      'string.pattern.base': 'Invalid wallet address format'
    }),
  personalInfo: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    address: Joi.string().min(10).max(200).required()
  }).required(),
  vehicleInfo: Joi.object({
    make: Joi.string().min(2).max(50).required(),
    model: Joi.string().min(2).max(50).required(),
    year: Joi.number().integer().min(2000).max(new Date().getFullYear() + 1).required(),
    license_plate: Joi.string().min(2).max(20).required(),
    color: Joi.string().min(3).max(30).required(),
    vehicle_type: Joi.string().valid('sedan', 'suv', 'hatchback', 'truck', 'van').required()
  }).required(),
  documents: Joi.array().items(Joi.string()).min(3).required()
});

// Document verification schema
export const documentVerificationSchema = Joi.object({
  driverId: Joi.string().uuid().required(),
  documentType: Joi.string().valid('drivers_license', 'insurance', 'vehicle_registration', 'background_check').required(),
  documentHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required(),
  verificationLevel: Joi.number().integer().min(1).max(3).required()
});

// Passenger profile schema
export const passengerProfileSchema = Joi.object({
  walletAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  pseudonym: Joi.string().min(3).max(50).required(),
  emergencyContacts: Joi.array().items(
    Joi.object({
      name: Joi.string().min(2).max(100).required(),
      phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
      relationship: Joi.string().valid('family', 'friend', 'medical', 'legal').required()
    })
  ).max(5).optional(),
  preferences: Joi.object({
    ride_type_preference: Joi.string().valid('economy', 'premium', 'express').optional(),
    music_preference: Joi.string().optional(),
    temperature_preference: Joi.string().optional(),
    conversation_preference: Joi.string().valid('chatty', 'quiet', 'no_preference').optional()
  }).optional()
});

// Ride request schema
export const rideRequestSchema = Joi.object({
  passengerId: Joi.string().uuid().required(),
  pickup: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    address: Joi.string().min(5).max(200).required(),
    city: Joi.string().min(2).max(100).required(),
    country: Joi.string().min(2).max(100).required()
  }).required(),
  destination: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    address: Joi.string().min(5).max(200).required(),
    city: Joi.string().min(2).max(100).required(),
    country: Joi.string().min(2).max(100).required()
  }).required(),
  rideType: Joi.string().valid('economy', 'premium', 'express').required(),
  estimatedFare: Joi.number().positive().precision(2).required()
});

// Emergency request schema
export const emergencyRequestSchema = Joi.object({
  rideId: Joi.string().uuid().required(),
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    address: Joi.string().min(5).max(200).required(),
    city: Joi.string().min(2).max(100).required(),
    country: Joi.string().min(2).max(100).required()
  }).required(),
  emergencyType: Joi.string().valid('safety', 'medical', 'vehicle', 'other').required()
});

// Ride acceptance schema
export const rideAcceptanceSchema = Joi.object({
  driverId: Joi.string().uuid().required(),
  estimatedArrival: Joi.number().integer().min(1).max(60).required() // minutes
});

// Ride completion schema
export const rideCompletionSchema = Joi.object({
  finalFare: Joi.number().positive().precision(2).required(),
  route: Joi.array().items(
    Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
      timestamp: Joi.string().isoDate().required()
    })
  ).min(2).required(),
  duration: Joi.number().integer().min(1).required() // minutes
});

// Location update schema
export const locationUpdateSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  timestamp: Joi.string().isoDate().required()
});

// Wallet signature schema
export const walletSignatureSchema = Joi.object({
  signature: Joi.string().required(),
  message: Joi.string().required(),
  walletAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required()
});

// Query parameter validation schemas
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query);
    
    if (error) {
      res.status(400).json({
        success: false,
        error: error.details[0].message
      } as ApiResponse);
      return;
    }
    
    req.query = value;
    next();
  };
};