import express from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase';
import { generateTokens, verifyRefreshToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticationError, ValidationError } from '../middleware/errorHandler';
import { requestLogger } from '../middleware/logger';

const router = express.Router();

// User registration
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, full_name, phone, user_type } = req.body;

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existingUser) {
    throw new ValidationError('User with this email already exists');
  }

  // Hash password
  const saltRounds = 12;
  const password_hash = await bcrypt.hash(password, saltRounds);

  // Create user in database
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      email,
      password_hash,
      full_name,
      phone,
      user_type,
      is_active: true,
      email_verified: false,
      created_at: new Date().toISOString()
    })
    .select('id, email, full_name, phone, user_type, is_active, email_verified, created_at')
    .single();

  if (userError) {
    console.error('User creation error:', userError);
    throw new Error('Failed to create user account');
  }

  // Create user profile
  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      user_id: user.id,
      preferences: {
        notifications: {
          email: true,
          sms: true,
          push: true
        },
        privacy: {
          share_location: true,
          share_ride_history: false
        }
      },
      created_at: new Date().toISOString()
    });

  if (profileError) {
    console.error('Profile creation error:', profileError);
    // Don't fail registration if profile creation fails
  }

  // If user is a driver, create driver record
  if (user_type === 'driver') {
    const { error: driverError } = await supabase
      .from('drivers')
      .insert({
        user_id: user.id,
        verification_status: 'pending',
        is_available: false,
        rating: 0,
        total_rides: 0,
        created_at: new Date().toISOString()
      });

    if (driverError) {
      console.error('Driver record creation error:', driverError);
      // Don't fail registration if driver record creation fails
    }
  }

  // Generate tokens
  const tokens = generateTokens(user.id, user.user_type);

  // Log successful registration
  console.log(`New user registered: ${user.email} (${user.user_type})`);

  res.status(201).json({
    message: 'User registered successfully',
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      user_type: user.user_type,
      is_active: user.is_active,
      email_verified: user.email_verified,
      created_at: user.created_at
    },
    tokens
  });
}));

// User login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Get user from database
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, password_hash, full_name, phone, user_type, is_active, email_verified, created_at')
    .eq('email', email)
    .single();

  if (userError || !user) {
    throw new AuthenticationError('Invalid email or password');
  }

  // Check if user is active
  if (!user.is_active) {
    throw new AuthenticationError('Account has been deactivated. Please contact support.');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    throw new AuthenticationError('Invalid email or password');
  }

  // Update last login
  await supabase
    .from('users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', user.id);

  // Generate tokens
  const tokens = generateTokens(user.id, user.user_type);

  // Log successful login
  console.log(`User logged in: ${user.email}`);

  res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      user_type: user.user_type,
      is_active: user.is_active,
      email_verified: user.email_verified,
      created_at: user.created_at
    },
    tokens
  });
}));

// Refresh token
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    throw new ValidationError('Refresh token is required');
  }

  // Verify refresh token
  const decoded = verifyRefreshToken(refresh_token);
  
  // Get user to ensure they still exist and are active
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, user_type, is_active')
    .eq('id', decoded.userId)
    .single();

  if (userError || !user || !user.is_active) {
    throw new AuthenticationError('Invalid refresh token');
  }

  // Generate new tokens
  const tokens = generateTokens(user.id, user.user_type);

  res.json({
    message: 'Tokens refreshed successfully',
    tokens
  });
}));

// Logout (client-side token removal)
router.post('/logout', asyncHandler(async (req, res) => {
  // In a more sophisticated implementation, you might want to blacklist the token
  // For now, we'll just return a success message as the client will remove the token
  
  res.json({
    message: 'Logged out successfully'
  });
}));

// Get current user profile
router.get('/me', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Access token is required');
  }

  const token = authHeader.substring(7);
  const { verifyToken } = await import('../middleware/auth');
  const decoded = verifyToken(token);

  // Get user details
  const { data: user, error: userError } = await supabase
    .from('users')
    .select(`
      id, email, full_name, phone, user_type, is_active, email_verified, created_at, last_login,
      user_profiles (
        preferences, emergency_contacts, created_at as profile_created_at
      )
    `)
    .eq('id', decoded.userId)
    .single();

  if (userError || !user) {
    throw new AuthenticationError('User not found');
  }

  // Get driver-specific data if user is a driver
  let driverData = null;
  if (user.user_type === 'driver') {
    const { data: driver } = await supabase
      .from('drivers')
      .select(`
        verification_status, is_available, rating, total_rides, 
        current_location, created_at as driver_created_at
      `)
      .eq('user_id', user.id)
      .single();
    
    driverData = driver;
  }

  res.json({
    user: {
      ...user,
      driver: driverData
    }
  });
}));

// Change password
router.put('/password', asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Access token is required');
  }

  const token = authHeader.substring(7);
  const { verifyToken } = await import('../middleware/auth');
  const decoded = verifyToken(token);

  // Get current user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, password_hash')
    .eq('id', decoded.userId)
    .single();

  if (userError || !user) {
    throw new AuthenticationError('User not found');
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
  if (!isValidPassword) {
    throw new AuthenticationError('Current password is incorrect');
  }

  // Hash new password
  const saltRounds = 12;
  const new_password_hash = await bcrypt.hash(new_password, saltRounds);

  // Update password
  const { error: updateError } = await supabase
    .from('users')
    .update({ 
      password_hash: new_password_hash,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);

  if (updateError) {
    throw new Error('Failed to update password');
  }

  res.json({
    message: 'Password updated successfully'
  });
}));

export default router;