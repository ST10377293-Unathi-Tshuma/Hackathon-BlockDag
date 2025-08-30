-- Grant permissions for SafeRide tables to anon and authenticated roles

-- Grant permissions for saferide_users table
GRANT SELECT, INSERT, UPDATE ON saferide_users TO anon;
GRANT ALL PRIVILEGES ON saferide_users TO authenticated;

-- Grant permissions for user_profiles table
GRANT SELECT, INSERT, UPDATE ON user_profiles TO anon;
GRANT ALL PRIVILEGES ON user_profiles TO authenticated;

-- Grant permissions for vehicle_info table
GRANT SELECT ON vehicle_info TO anon;
GRANT ALL PRIVILEGES ON vehicle_info TO authenticated;

-- Grant permissions for drivers table
GRANT SELECT ON drivers TO anon;
GRANT ALL PRIVILEGES ON drivers TO authenticated;

-- Grant permissions for driver_verification table
GRANT SELECT ON driver_verification TO anon;
GRANT ALL PRIVILEGES ON driver_verification TO authenticated;

-- Grant permissions for rides table
GRANT SELECT, INSERT, UPDATE ON rides TO anon;
GRANT ALL PRIVILEGES ON rides TO authenticated;

-- Grant permissions for emergency_incidents table
GRANT SELECT, INSERT, UPDATE ON emergency_incidents TO anon;
GRANT ALL PRIVILEGES ON emergency_incidents TO authenticated;

-- Grant permissions for emergency_contacts table
GRANT SELECT, INSERT, UPDATE ON emergency_contacts TO anon;
GRANT ALL PRIVILEGES ON emergency_contacts TO authenticated;

-- Grant permissions for escrow_transactions table
GRANT SELECT, INSERT, UPDATE ON escrow_transactions TO anon;
GRANT ALL PRIVILEGES ON escrow_transactions TO authenticated;

-- Grant usage on custom types
GRANT USAGE ON TYPE saferide_user_role TO anon, authenticated;
GRANT USAGE ON TYPE verification_status TO anon, authenticated;
GRANT USAGE ON TYPE document_type TO anon, authenticated;
GRANT USAGE ON TYPE ride_type TO anon, authenticated;
GRANT USAGE ON TYPE ride_status TO anon, authenticated;
GRANT USAGE ON TYPE emergency_type TO anon, authenticated;
GRANT USAGE ON TYPE emergency_status TO anon, authenticated;
GRANT USAGE ON TYPE escrow_status TO anon, authenticated;