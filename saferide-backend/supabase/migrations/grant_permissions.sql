-- Grant permissions for SafeRide tables to anon and authenticated roles

-- Grant permissions for saferide_users table
GRANT SELECT, INSERT, UPDATE ON saferide_users TO authenticated;
GRANT SELECT ON saferide_users TO anon;

-- Grant permissions for user_profiles table
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO authenticated;
GRANT SELECT ON user_profiles TO anon;

-- Grant permissions for drivers table
GRANT SELECT, INSERT, UPDATE ON drivers TO authenticated;
GRANT SELECT ON drivers TO anon;

-- Grant permissions for driver_verification table
GRANT SELECT, INSERT, UPDATE ON driver_verification TO authenticated;
GRANT SELECT ON driver_verification TO anon;

-- Grant permissions for vehicle_info table
GRANT SELECT, INSERT, UPDATE ON vehicle_info TO authenticated;
GRANT SELECT ON vehicle_info TO anon;

-- Grant permissions for rides table
GRANT SELECT, INSERT, UPDATE ON rides TO authenticated;
GRANT SELECT ON rides TO anon;

-- Grant permissions for emergency_incidents table
GRANT SELECT, INSERT, UPDATE ON emergency_incidents TO authenticated;
GRANT SELECT ON emergency_incidents TO anon;

-- Grant permissions for emergency_contacts table
GRANT SELECT, INSERT, UPDATE, DELETE ON emergency_contacts TO authenticated;
GRANT SELECT ON emergency_contacts TO anon;

-- Grant permissions for escrow_transactions table
GRANT SELECT, INSERT, UPDATE ON escrow_transactions TO authenticated;
GRANT SELECT ON escrow_transactions TO anon;

-- Grant sequence permissions if needed
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Grant permissions for custom types
GRANT USAGE ON TYPE saferide_user_role TO authenticated, anon;
GRANT USAGE ON TYPE verification_status TO authenticated, anon;
GRANT USAGE ON TYPE document_type TO authenticated, anon;
GRANT USAGE ON TYPE ride_type TO authenticated, anon;
GRANT USAGE ON TYPE ride_status TO authenticated, anon;
GRANT USAGE ON TYPE emergency_type TO authenticated, anon;
GRANT USAGE ON TYPE emergency_status TO authenticated, anon;
GRANT USAGE ON TYPE escrow_status TO authenticated, anon;