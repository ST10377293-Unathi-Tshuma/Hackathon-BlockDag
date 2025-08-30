import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { ApiResponse } from '../../shared/types.js';

/**
 * General API rate limiter
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  } as ApiResponse,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict rate limiter for authentication endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.'
  } as ApiResponse,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Emergency endpoint rate limiter (more lenient)
 */
export const emergencyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Allow more emergency requests
  message: {
    success: false,
    error: 'Emergency rate limit exceeded, please contact support.'
  } as ApiResponse,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Ride booking rate limiter
 */
export const rideLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // Limit ride requests
  message: {
    success: false,
    error: 'Too many ride requests, please wait before booking again.'
  } as ApiResponse,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Driver verification rate limiter
 */
export const verificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Very limited verification attempts
  message: {
    success: false,
    error: 'Too many verification attempts, please try again later.'
  } as ApiResponse,
  standardHeaders: true,
  legacyHeaders: false,
});