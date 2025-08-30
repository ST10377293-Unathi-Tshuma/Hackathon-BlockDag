-- Grant permissions for SafeRide tables to anon and authenticated roles

-- Grant SELECT permissions to anon role (for public data)
GRANT SELECT ON saferide_users TO anon;
GRANT SELECT ON user_profiles TO anon;
GRANT SELECT ON vehicle_info TO anon;
GRANT SELECT ON drivers TO anon;

-- Grant full permissions to authenticated role
GRANT ALL PRIVILEGES ON saferide_users TO authenticated;
GRANT ALL PRIVILEGES ON user_profiles TO authenticated;
GRANT ALL PRIVILEGES ON vehicle_info TO authenticated;
GRANT ALL PRIVILEGES ON drivers TO authenticated;
GRANT ALL PRIVILEGES ON driver_verification TO authenticated;
GRANT ALL PRIVILEGES ON rides TO authenticated;
GRANT ALL PRIVILEGES ON emergency_incidents TO authenticated;
GRANT ALL PRIVILEGES ON emergency_contacts TO authenticated;
GRANT ALL PRIVILEGES ON escrow_transactions TO authenticated;

-- Grant sequence permissions for auto-incrementing IDs
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Grant permissions on custom types
GRANT USAGE ON TYPE user_role TO anon, authenticated;
GRANT USAGE ON TYPE verification_status TO anon, authenticated;
GRANT USAGE ON TYPE document_type TO anon, authenticated;
GRANT USAGE ON TYPE ride_status TO anon, authenticated;
GRANT USAGE ON TYPE ride_type TO anon, authenticated;
GRANT USAGE ON TYPE emergency_status TO anon, authenticated;
GRANT USAGE ON TYPE escrow_status TO anon, authenticated;