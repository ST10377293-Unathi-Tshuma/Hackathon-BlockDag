import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// Base validation schemas
const schemas = {
  // User registration/login schemas
  userRegistration: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required()
      .messages({
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      }),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    role: Joi.string().valid('passenger', 'driver').required()
  }),

  userLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  // Driver-specific schemas
  driverRegistration: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    license_number: Joi.string().min(5).max(20).required(),
    vehicle_make: Joi.string().min(2).max(50).required(),
    vehicle_model: Joi.string().min(2).max(50).required(),
    vehicle_year: Joi.number().integer().min(2000).max(new Date().getFullYear() + 1).required(),
    vehicle_color: Joi.string().min(3).max(20).required(),
    vehicle_plate: Joi.string().min(2).max(15).required()
  }),

  driverVerification: Joi.object({
    driver_id: Joi.string().uuid().required(),
    document_type: Joi.string().valid('license', 'insurance', 'registration', 'background_check').required(),
    document_url: Joi.string().uri().required(),
    notes: Joi.string().max(500).optional()
  }),

  driverLocationUpdate: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    heading: Joi.number().min(0).max(360).optional(),
    speed: Joi.number().min(0).optional()
  }),

  // Passenger-specific schemas
  passengerProfile: Joi.object({
    first_name: Joi.string().min(2).max(50).optional(),
    last_name: Joi.string().min(2).max(50).optional(),
    date_of_birth: Joi.date().max('now').optional(),
    gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say').optional(),
    profile_picture_url: Joi.string().uri().optional(),
    emergency_contact_name: Joi.string().min(2).max(100).optional(),
    emergency_contact_phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional()
  }),

  // Ride-specific schemas
  rideRequest: Joi.object({
    pickup_latitude: Joi.number().min(-90).max(90).required(),
    pickup_longitude: Joi.number().min(-180).max(180).required(),
    pickup_address: Joi.string().min(5).max(200).required(),
    destination_latitude: Joi.number().min(-90).max(90).required(),
    destination_longitude: Joi.number().min(-180).max(180).required(),
    destination_address: Joi.string().min(5).max(200).required(),
    ride_type: Joi.string().valid('standard', 'premium', 'shared').default('standard'),
    passenger_count: Joi.number().integer().min(1).max(4).default(1),
    special_instructions: Joi.string().max(500).optional(),
    scheduled_time: Joi.date().min('now').optional()
  }),

  rideAccept: Joi.object({
    ride_id: Joi.string().uuid().required(),
    estimated_arrival_time: Joi.number().integer().min(1).max(60).required() // minutes
  }),

  rideStatusUpdate: Joi.object({
    ride_id: Joi.string().uuid().required(),
    status: Joi.string().valid('accepted', 'driver_arrived', 'in_progress', 'completed', 'cancelled').required(),
    location_latitude: Joi.number().min(-90).max(90).optional(),
    location_longitude: Joi.number().min(-180).max(180).optional()
  }),

  rideRating: Joi.object({
    ride_id: Joi.string().uuid().required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().max(500).optional()
  }),

  // Emergency schemas
  emergencyAlert: Joi.object({
    ride_id: Joi.string().uuid().optional(),
    emergency_type: Joi.string().valid('panic', 'accident', 'medical', 'harassment', 'other').required(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    description: Joi.string().max(1000).optional(),
    severity: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium')
  }),

  emergencyUpdate: Joi.object({
    incident_id: Joi.string().uuid().required(),
    status: Joi.string().valid('active', 'resolved', 'false_alarm').required(),
    resolution_notes: Joi.string().max(1000).optional()
  }),

  // Common schemas
  uuidParam: Joi.object({
    id: Joi.string().uuid().required()
  }),

  paginationQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort_by: Joi.string().optional(),
    sort_order: Joi.string().valid('asc', 'desc').default('desc')
  }),

  locationQuery: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    radius: Joi.number().min(0.1).max(50).default(5) // km
  })
};

// Generic validation middleware factory
const createValidationMiddleware = (schema: Joi.ObjectSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const dataToValidate = req[source];
    
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      res.status(400).json({
        error: 'Validation failed',
        details: errorDetails,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Replace the original data with validated and sanitized data
    req[source] = value;
    next();
  };
};

// Validation middleware collections
export const validationMiddleware = {
  // Driver validations
  driver: {
    register: createValidationMiddleware(schemas.driverRegistration),
    verify: createValidationMiddleware(schemas.driverVerification),
    updateLocation: createValidationMiddleware(schemas.driverLocationUpdate),
    params: createValidationMiddleware(schemas.uuidParam, 'params'),
    query: createValidationMiddleware(schemas.paginationQuery, 'query')
  },

  // Passenger validations
  passenger: {
    register: createValidationMiddleware(schemas.userRegistration),
    updateProfile: createValidationMiddleware(schemas.passengerProfile),
    params: createValidationMiddleware(schemas.uuidParam, 'params'),
    query: createValidationMiddleware(schemas.paginationQuery, 'query')
  },

  // Ride validations
  ride: {
    request: createValidationMiddleware(schemas.rideRequest),
    accept: createValidationMiddleware(schemas.rideAccept),
    updateStatus: createValidationMiddleware(schemas.rideStatusUpdate),
    rate: createValidationMiddleware(schemas.rideRating),
    params: createValidationMiddleware(schemas.uuidParam, 'params'),
    query: createValidationMiddleware(schemas.paginationQuery, 'query'),
    locationQuery: createValidationMiddleware(schemas.locationQuery, 'query')
  },

  // Emergency validations
  emergency: {
    alert: createValidationMiddleware(schemas.emergencyAlert),
    update: createValidationMiddleware(schemas.emergencyUpdate),
    params: createValidationMiddleware(schemas.uuidParam, 'params'),
    query: createValidationMiddleware(schemas.paginationQuery, 'query')
  },

  // Auth validations
  auth: {
    login: createValidationMiddleware(schemas.userLogin),
    register: createValidationMiddleware(schemas.userRegistration)
  },

  // Common validations
  common: {
    params: createValidationMiddleware(schemas.uuidParam, 'params'),
    query: createValidationMiddleware(schemas.paginationQuery, 'query'),
    location: createValidationMiddleware(schemas.locationQuery, 'query')
  }
};

// File upload validation
export const validateFileUpload = (allowedTypes: string[], maxSize: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.file && !req.files) {
      res.status(400).json({
        error: 'File upload required',
        message: 'Please provide a file to upload'
      });
      return;
    }

    const file = req.file || (Array.isArray(req.files) ? req.files[0] : req.files);
    
    if (!file) {
      res.status(400).json({
        error: 'Invalid file',
        message: 'No valid file found in request'
      });
      return;
    }

    // Check file type
    if (!allowedTypes.includes(file.mimetype)) {
      res.status(400).json({
        error: 'Invalid file type',
        message: `Allowed types: ${allowedTypes.join(', ')}`,
        received: file.mimetype
      });
      return;
    }

    // Check file size
    if (file.size > maxSize) {
      res.status(400).json({
        error: 'File too large',
        message: `Maximum file size: ${maxSize / (1024 * 1024)}MB`,
        received: `${(file.size / (1024 * 1024)).toFixed(2)}MB`
      });
      return;
    }

    next();
  };
};

export { schemas };