-- SafeRide Database Schema
-- This migration creates all required tables for the SafeRide application

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create custom types
CREATE TYPE user_role AS ENUM ('passenger', 'driver', 'admin');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected', 'expired');
CREATE TYPE ride_status AS ENUM ('requested', 'accepted', 'in_progress', 'completed', 'cancelled');
CREATE TYPE emergency_status AS ENUM ('active', 'resolved', 'false_alarm');
CREATE TYPE vehicle_type AS ENUM ('sedan', 'suv', 'hatchback', 'luxury', 'electric');
CREATE TYPE escrow_status AS ENUM ('created', 'funded', 'released', 'refunded', 'disputed');

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    full_name VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'passenger',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles table (additional profile information)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    avatar_url TEXT,
    date_of_birth DATE,
    gender VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    preferences JSONB DEFAULT '{}',
    privacy_settings JSONB DEFAULT '{"share_location": true, "share_ride_history": false}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Drivers table (driver-specific information)
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    license_expiry DATE NOT NULL,
    verification_status verification_status DEFAULT 'pending',
    verification_date TIMESTAMPTZ,
    background_check_status verification_status DEFAULT 'pending',
    background_check_date TIMESTAMPTZ,
    is_available BOOLEAN DEFAULT false,
    current_location GEOGRAPHY(POINT, 4326),
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_rides INTEGER DEFAULT 0,
    total_earnings DECIMAL(10,2) DEFAULT 0.00,
    bank_account_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Driver verification documents
CREATE TABLE driver_verification (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- 'license', 'insurance', 'registration', 'background_check'
    document_url TEXT NOT NULL,
    verification_status verification_status DEFAULT 'pending',
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    expiry_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicle information
CREATE TABLE vehicle_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    color VARCHAR(30) NOT NULL,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type vehicle_type NOT NULL,
    seats INTEGER DEFAULT 4,
    features JSONB DEFAULT '[]', -- ['ac', 'wifi', 'music', 'phone_charger']
    insurance_policy_number VARCHAR(100),
    insurance_expiry DATE,
    registration_number VARCHAR(100),
    registration_expiry DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rides table
CREATE TABLE rides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    passenger_id UUID REFERENCES users(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES vehicle_info(id) ON DELETE SET NULL,
    pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
    pickup_address TEXT NOT NULL,
    dropoff_location GEOGRAPHY(POINT, 4326) NOT NULL,
    dropoff_address TEXT NOT NULL,
    current_location GEOGRAPHY(POINT, 4326),
    status ride_status DEFAULT 'requested',
    estimated_fare DECIMAL(8,2),
    actual_fare DECIMAL(8,2),
    estimated_distance DECIMAL(8,2), -- in kilometers
    actual_distance DECIMAL(8,2),
    estimated_duration INTEGER, -- in minutes
    actual_duration INTEGER,
    passenger_rating INTEGER CHECK (passenger_rating >= 1 AND passenger_rating <= 5),
    driver_rating INTEGER CHECK (driver_rating >= 1 AND driver_rating <= 5),
    passenger_comment TEXT,
    driver_comment TEXT,
    special_instructions TEXT,
    ride_type VARCHAR(20) DEFAULT 'standard', -- 'standard', 'premium', 'shared'
    payment_method VARCHAR(20) DEFAULT 'blockchain', -- 'blockchain', 'card', 'cash'
    blockchain_tx_hash VARCHAR(100),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emergency incidents
CREATE TABLE emergency_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
    incident_type VARCHAR(50) NOT NULL, -- 'panic_button', 'accident', 'harassment', 'other'
    status emergency_status DEFAULT 'active',
    location GEOGRAPHY(POINT, 4326),
    address TEXT,
    description TEXT,
    severity_level INTEGER DEFAULT 1 CHECK (severity_level >= 1 AND severity_level <= 5),
    contacts_notified JSONB DEFAULT '[]',
    authorities_notified BOOLEAN DEFAULT false,
    response_time INTEGER, -- in seconds
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emergency contacts
CREATE TABLE emergency_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    relationship VARCHAR(50), -- 'family', 'friend', 'colleague', 'other'
    is_primary BOOLEAN DEFAULT false,
    notification_preferences JSONB DEFAULT '{"sms": true, "email": true, "call": false}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Escrow transactions (blockchain integration)
CREATE TABLE escrow_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
    passenger_id UUID REFERENCES users(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'BDAG',
    status escrow_status DEFAULT 'created',
    blockchain_address VARCHAR(100),
    transaction_hash VARCHAR(100),
    smart_contract_address VARCHAR(100),
    gas_fee DECIMAL(10,6),
    platform_fee DECIMAL(8,2),
    driver_earnings DECIMAL(8,2),
    created_tx_hash VARCHAR(100),
    funded_tx_hash VARCHAR(100),
    released_tx_hash VARCHAR(100),
    refunded_tx_hash VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    funded_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Location tracking (for emergency and ride tracking)
CREATE TABLE location_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
    emergency_incident_id UUID REFERENCES emergency_incidents(id) ON DELETE CASCADE,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    accuracy DECIMAL(8,2), -- in meters
    speed DECIMAL(8,2), -- in km/h
    heading DECIMAL(5,2), -- in degrees
    altitude DECIMAL(8,2), -- in meters
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safety reports
CREATE TABLE safety_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reported_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
    report_type VARCHAR(50) NOT NULL, -- 'harassment', 'unsafe_driving', 'inappropriate_behavior', 'other'
    description TEXT NOT NULL,
    evidence_urls JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'investigating', 'resolved', 'dismissed'
    priority_level INTEGER DEFAULT 1 CHECK (priority_level >= 1 AND priority_level <= 5),
    investigated_by UUID REFERENCES users(id),
    investigation_notes TEXT,
    action_taken TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE INDEX idx_drivers_user_id ON drivers(user_id);
CREATE INDEX idx_drivers_verification_status ON drivers(verification_status);
CREATE INDEX idx_drivers_is_available ON drivers(is_available);
CREATE INDEX idx_drivers_current_location ON drivers USING GIST(current_location);
CREATE INDEX idx_drivers_rating ON drivers(rating);

CREATE INDEX idx_driver_verification_driver_id ON driver_verification(driver_id);
CREATE INDEX idx_driver_verification_status ON driver_verification(verification_status);
CREATE INDEX idx_driver_verification_document_type ON driver_verification(document_type);

CREATE INDEX idx_vehicle_info_driver_id ON vehicle_info(driver_id);
CREATE INDEX idx_vehicle_info_license_plate ON vehicle_info(license_plate);
CREATE INDEX idx_vehicle_info_is_active ON vehicle_info(is_active);

CREATE INDEX idx_rides_passenger_id ON rides(passenger_id);
CREATE INDEX idx_rides_driver_id ON rides(driver_id);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_pickup_location ON rides USING GIST(pickup_location);
CREATE INDEX idx_rides_dropoff_location ON rides USING GIST(dropoff_location);
CREATE INDEX idx_rides_requested_at ON rides(requested_at);
CREATE INDEX idx_rides_completed_at ON rides(completed_at);

CREATE INDEX idx_emergency_incidents_user_id ON emergency_incidents(user_id);
CREATE INDEX idx_emergency_incidents_ride_id ON emergency_incidents(ride_id);
CREATE INDEX idx_emergency_incidents_status ON emergency_incidents(status);
CREATE INDEX idx_emergency_incidents_location ON emergency_incidents USING GIST(location);
CREATE INDEX idx_emergency_incidents_created_at ON emergency_incidents(created_at);

CREATE INDEX idx_emergency_contacts_user_id ON emergency_contacts(user_id);
CREATE INDEX idx_emergency_contacts_is_primary ON emergency_contacts(is_primary);

CREATE INDEX idx_escrow_transactions_ride_id ON escrow_transactions(ride_id);
CREATE INDEX idx_escrow_transactions_status ON escrow_transactions(status);
CREATE INDEX idx_escrow_transactions_created_at ON escrow_transactions(created_at);

CREATE INDEX idx_location_tracking_user_id ON location_tracking(user_id);
CREATE INDEX idx_location_tracking_ride_id ON location_tracking(ride_id);
CREATE INDEX idx_location_tracking_emergency_incident_id ON location_tracking(emergency_incident_id);
CREATE INDEX idx_location_tracking_location ON location_tracking USING GIST(location);
CREATE INDEX idx_location_tracking_timestamp ON location_tracking(timestamp);

CREATE INDEX idx_safety_reports_reporter_id ON safety_reports(reporter_id);
CREATE INDEX idx_safety_reports_reported_user_id ON safety_reports(reported_user_id);
CREATE INDEX idx_safety_reports_ride_id ON safety_reports(ride_id);
CREATE INDEX idx_safety_reports_status ON safety_reports(status);
CREATE INDEX idx_safety_reports_created_at ON safety_reports(created_at);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_driver_verification_updated_at BEFORE UPDATE ON driver_verification FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicle_info_updated_at BEFORE UPDATE ON vehicle_info FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON rides FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_emergency_incidents_updated_at BEFORE UPDATE ON emergency_incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_emergency_contacts_updated_at BEFORE UPDATE ON emergency_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_escrow_transactions_updated_at BEFORE UPDATE ON escrow_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_safety_reports_updated_at BEFORE UPDATE ON safety_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Users policies
CREATE POLICY "Users can view their own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Service role can manage all users" ON users FOR ALL USING (auth.role() = 'service_role');

-- User profiles policies
CREATE POLICY "Users can view their own profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role can manage all profiles" ON user_profiles FOR ALL USING (auth.role() = 'service_role');

-- Drivers policies
CREATE POLICY "Drivers can view their own data" ON drivers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Drivers can update their own data" ON drivers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Drivers can insert their own data" ON drivers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role can manage all drivers" ON drivers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Passengers can view available drivers" ON drivers FOR SELECT USING (is_available = true AND verification_status = 'verified');

-- Driver verification policies
CREATE POLICY "Drivers can view their own verification" ON driver_verification FOR SELECT USING (
    EXISTS (SELECT 1 FROM drivers WHERE drivers.id = driver_verification.driver_id AND drivers.user_id = auth.uid())
);
CREATE POLICY "Drivers can insert their own verification" ON driver_verification FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM drivers WHERE drivers.id = driver_verification.driver_id AND drivers.user_id = auth.uid())
);
CREATE POLICY "Service role can manage all verifications" ON driver_verification FOR ALL USING (auth.role() = 'service_role');

-- Vehicle info policies
CREATE POLICY "Drivers can manage their own vehicles" ON vehicle_info FOR ALL USING (
    EXISTS (SELECT 1 FROM drivers WHERE drivers.id = vehicle_info.driver_id AND drivers.user_id = auth.uid())
);
CREATE POLICY "Service role can manage all vehicles" ON vehicle_info FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Passengers can view active vehicles" ON vehicle_info FOR SELECT USING (is_active = true);

-- Rides policies
CREATE POLICY "Users can view their own rides" ON rides FOR SELECT USING (
    auth.uid() = passenger_id OR 
    EXISTS (SELECT 1 FROM drivers WHERE drivers.id = rides.driver_id AND drivers.user_id = auth.uid())
);
CREATE POLICY "Passengers can create rides" ON rides FOR INSERT WITH CHECK (auth.uid() = passenger_id);
CREATE POLICY "Drivers can update rides they're assigned to" ON rides FOR UPDATE USING (
    EXISTS (SELECT 1 FROM drivers WHERE drivers.id = rides.driver_id AND drivers.user_id = auth.uid())
);
CREATE POLICY "Passengers can update their own rides" ON rides FOR UPDATE USING (auth.uid() = passenger_id);
CREATE POLICY "Service role can manage all rides" ON rides FOR ALL USING (auth.role() = 'service_role');

-- Emergency incidents policies
CREATE POLICY "Users can view their own incidents" ON emergency_incidents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own incidents" ON emergency_incidents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own incidents" ON emergency_incidents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all incidents" ON emergency_incidents FOR ALL USING (auth.role() = 'service_role');

-- Emergency contacts policies
CREATE POLICY "Users can manage their own emergency contacts" ON emergency_contacts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all emergency contacts" ON emergency_contacts FOR ALL USING (auth.role() = 'service_role');

-- Escrow transactions policies
CREATE POLICY "Users can view their own transactions" ON escrow_transactions FOR SELECT USING (
    auth.uid() = passenger_id OR 
    EXISTS (SELECT 1 FROM drivers WHERE drivers.id = escrow_transactions.driver_id AND drivers.user_id = auth.uid())
);
CREATE POLICY "Service role can manage all transactions" ON escrow_transactions FOR ALL USING (auth.role() = 'service_role');

-- Location tracking policies
CREATE POLICY "Users can view their own location data" ON location_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own location data" ON location_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role can manage all location data" ON location_tracking FOR ALL USING (auth.role() = 'service_role');

-- Safety reports policies
CREATE POLICY "Users can view reports they created" ON safety_reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Users can create safety reports" ON safety_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Service role can manage all safety reports" ON safety_reports FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Grant specific permissions for each table
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON drivers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON driver_verification TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vehicle_info TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON emergency_incidents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON emergency_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON escrow_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON location_tracking TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON safety_reports TO authenticated;

-- Grant read access to anon for public data
GRANT SELECT ON users TO anon;
GRANT SELECT ON drivers TO anon;
GRANT SELECT ON vehicle_info TO anon;

-- Create a function to handle user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO users (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Unknown'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'passenger')::user_role
    );
    
    INSERT INTO user_profiles (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create a function to calculate distance between two points
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION AS $$
BEGIN
    RETURN ST_Distance(
        ST_GeogFromText('POINT(' || lon1 || ' ' || lat1 || ')'),
        ST_GeogFromText('POINT(' || lon2 || ' ' || lat2 || ')')
    ) / 1000; -- Convert to kilometers
END;
$$ LANGUAGE plpgsql;

-- Create a function to find nearby drivers
CREATE OR REPLACE FUNCTION find_nearby_drivers(
    pickup_lat DOUBLE PRECISION,
    pickup_lon DOUBLE PRECISION,
    radius_km DOUBLE PRECISION DEFAULT 10
)
RETURNS TABLE(
    driver_id UUID,
    user_id UUID,
    distance_km DOUBLE PRECISION,
    rating DECIMAL(3,2),
    vehicle_type vehicle_type
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.user_id,
        ST_Distance(
            d.current_location,
            ST_GeogFromText('POINT(' || pickup_lon || ' ' || pickup_lat || ')')
        ) / 1000 AS distance_km,
        d.rating,
        v.vehicle_type
    FROM drivers d
    JOIN vehicle_info v ON d.id = v.driver_id
    WHERE 
        d.is_available = true
        AND d.verification_status = 'verified'
        AND v.is_active = true
        AND ST_DWithin(
            d.current_location,
            ST_GeogFromText('POINT(' || pickup_lon || ' ' || pickup_lat || ')'),
            radius_km * 1000
        )
    ORDER BY distance_km ASC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample data for testing
INSERT INTO users (id, email, full_name, role) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'admin@saferide.com', 'Admin User', 'admin'),
('550e8400-e29b-41d4-a716-446655440001', 'driver1@saferide.com', 'John Driver', 'driver'),
('550e8400-e29b-41d4-a716-446655440002', 'passenger1@saferide.com', 'Jane Passenger', 'passenger')
ON CONFLICT (id) DO NOTHING;

-- Insert corresponding user profiles
INSERT INTO user_profiles (user_id, emergency_contact_name, emergency_contact_phone) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Emergency Admin', '+1234567890'),
('550e8400-e29b-41d4-a716-446655440001', 'Driver Emergency', '+1234567891'),
('550e8400-e29b-41d4-a716-446655440002', 'Passenger Emergency', '+1234567892')
ON CONFLICT (user_id) DO NOTHING;

-- Insert sample driver
INSERT INTO drivers (user_id, license_number, license_expiry, verification_status, background_check_status, is_available, rating, total_rides) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'DL123456789', '2025-12-31', 'verified', 'verified', true, 4.8, 150)
ON CONFLICT (user_id) DO NOTHING;

-- Insert sample vehicle
INSERT INTO vehicle_info (driver_id, make, model, year, color, license_plate, vehicle_type, seats) 
SELECT d.id, 'Toyota', 'Camry', 2022, 'Blue', 'ABC123', 'sedan', 4
FROM drivers d WHERE d.user_id = '550e8400-e29b-41d4-a716-446655440001'
ON CONFLICT (license_plate) DO NOTHING;

COMMIT;