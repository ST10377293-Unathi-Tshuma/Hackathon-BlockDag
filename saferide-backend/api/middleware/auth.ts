import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';
import { ApiResponse } from '../../shared/types.js';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

/**
 * Generate access and refresh tokens
 */
export const generateTokens = (userId: string, userType: string) => {
  const payload = { userId, userType };
  
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'saferide-api',
    audience: 'saferide-app'
  });
  
  const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    issuer: 'saferide-api',
    audience: 'saferide-app'
  });
  
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: JWT_EXPIRES_IN
  };
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): any => {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET, {
      issuer: 'saferide-api',
      audience: 'saferide-app'
    });
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'saferide-api',
      audience: 'saferide-app'
    });
  } catch (error) {
    throw new Error('Invalid access token');
  }
};

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    wallet_address: string;
    email?: string;
  };
}

/**
 * Middleware to verify JWT token from Supabase Auth
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required'
      } as ApiResponse);
      return;
    }

    // Verify JWT token
    const decoded = verifyAccessToken(token);
    
    // Get user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, user_type, is_active')
      .eq('id', decoded.userId)
      .single();

    if (error || !user || !user.is_active) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      } as ApiResponse);
      return;
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      wallet_address: '', // Will be populated from user profile if needed
      email: user.email
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication service error'
    } as ApiResponse);
  }
};

/**
 * Middleware to verify wallet signature for blockchain operations
 */
export const verifyWalletSignature = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { signature, message, walletAddress } = req.body;

    if (!signature || !message || !walletAddress) {
      res.status(400).json({
        success: false,
        error: 'Signature, message, and wallet address required'
      } as ApiResponse);
      return;
    }

    // Verify that the wallet address matches the authenticated user
    if (req.user?.wallet_address !== walletAddress) {
      res.status(403).json({
        success: false,
        error: 'Wallet address mismatch'
      } as ApiResponse);
      return;
    }

    // TODO: Implement actual signature verification with ethers.js
    // For now, we'll assume the signature is valid
    
    next();
  } catch (error) {
    console.error('Wallet verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Wallet verification failed'
    } as ApiResponse);
  }
};

/**
 * Middleware to check if user is a verified driver
 */
export const requireDriverVerification = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as ApiResponse);
      return;
    }

    // Check driver verification status
    const { data: driver, error } = await supabase
      .from('drivers')
      .select('id, verification_status')
      .eq('user_id', req.user.id)
      .single();

    if (error || !driver) {
      res.status(403).json({
        success: false,
        error: 'Driver registration required'
      } as ApiResponse);
      return;
    }

    if (driver.verification_status !== 'verified') {
      res.status(403).json({
        success: false,
        error: 'Driver verification required'
      } as ApiResponse);
      return;
    }

    next();
  } catch (error) {
    console.error('Driver verification check error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification check failed'
    } as ApiResponse);
  }
};

/**
 * Middleware to check admin permissions
 */
export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as ApiResponse);
      return;
    }

    // Check if user has admin role
    const { data: user, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', req.user.id)
      .eq('user_type', 'admin')
      .single();

    if (error || !user) {
      res.status(403).json({
        success: false,
        error: 'Admin access required'
      } as ApiResponse);
      return;
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({
      success: false,
      error: 'Authorization check failed'
    } as ApiResponse);
  }
};