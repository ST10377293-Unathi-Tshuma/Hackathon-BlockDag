import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://pqnohhlegulczuertmkw.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbm9oaGxlZ3VsY3p1ZXJ0bWt3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTA4OTM1NiwiZXhwIjoyMDcwNjY1MzU2fQ.uUHel3PAFauQjBUbG3SNq3ERAzzav2rxoRC7aOsHKto';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbm9oaGxlZ3VsY3p1ZXJ0bWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODkzNTYsImV4cCI6MjA3MDY2NTM1Nn0.tk7wrPWYUknhUz3ZUE9IA5xRcsPsLY1fPvRb8ikOlng';

// Create Supabase client with service role key for backend operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Create Supabase client with anon key for public operations
export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// Database configuration
export const dbConfig = {
  url: supabaseUrl,
  serviceRoleKey: supabaseServiceKey,
  anonKey: supabaseAnonKey
};

// Helper function to get user from JWT token
export const getUserFromToken = async (token: string) => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error getting user from token:', error);
    return null;
  }
};

// Helper function to verify JWT token
export const verifyToken = async (token: string) => {
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) throw error;
    return data.user;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
};

export default supabase;