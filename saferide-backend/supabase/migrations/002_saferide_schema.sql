-- SafeRide Database Schema
-- Migration to create SafeRide-specific tables

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create custom types for SafeRide
CREATE TYPE saferide_user_role AS ENUM ('passenger', 'driver', 'admin');
CREATE TYPE verification_status AS ENUM ('pending', 'in_review', 'approved', 'rejected');
CREATE TYPE ride_status AS ENUM ('requested', 'accepted', 'in_progress', 'completed', 'cancelled');
CREATE TYPE ride_type AS ENUM ('standard', 'premium', 'shared');
CREATE TYPE emergency_status AS ENUM ('active', 'resolved', 'cancelled');
CREATE TYPE emergency_type AS ENUM ('panic', 'accident', 'breakdown', 'medical');
CREATE TYPE escrow_status AS ENUM ('created', 'locked', 'released', 'refunded', 'disputed');
CREATE TYPE document_type AS ENUM ('drivers_license', 'vehicle_registration', 'insurance', 'background_check', 'vehicle_inspection');

-- SafeRide users table (extends existing users with SafeRide-specific fields)
CREATE TABLE saferide_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role saferide_user_role DEFAULT 'passenger',
    is_active BOOLEAN DEFAULT true,
    wallet_address VARCHAR(42),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User profiles table (anonymized data)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES saferide_users(id) ON DELETE CASCADE,
    anonymized_data JSONB,
    preferences JSONB DEFAULT '{}',
    location_preferences JSONB DEFAULT '{}',
    privacy_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vehicle info table
CREATE TABLE vehicle_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    color VARCHAR(30),
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type VARCHAR(30) DEFAULT 'sedan',
    capacity INTEGER DEFAULT 4,
    features JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drivers table
CREATE TABLE drivers (
    id UUID PRIMARY KEY REFERENCES saferide_users(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicle_info(id),
    license_number VARCHAR(50) UNIQUE NOT NULL,
    verification_status verification_status DEFAULT 'pending',
    verification_date TIMESTAMP WITH TIME ZONE,
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_rides INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT false,
    current_location GEOGRAPHY(POINT),
    anonymized_data JSONB,
    wallet_address VARCHAR(42),
    blockchain_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Driver verification table
CREATE TABLE driver_verification (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    document_type document_type NOT NULL,
    document_url VARCHAR(500),
    encrypted_document_hash VARCHAR(128),
    verification_status verification_status DEFAULT 'pending',
    verified_by UUID REFERENCES saferide_users(id),
    verification_notes TEXT,
    blockchain_hash VARCHAR(66),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rides table
CREATE TABLE rides (
    id VARCHAR(50) PRIMARY KEY,
    passenger_id UUID REFERENCES saferide_users(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    pickup_location GEOGRAPHY(POINT) NOT NULL,
    dropoff_location GEOGRAPHY(POINT) NOT NULL,
    driver_location GEOGRAPHY(POINT),
    passenger_location GEOGRAPHY(POINT),
    final_location GEOGRAPHY(POINT),
    ride_type ride_type DEFAULT 'standard',
    status ride_status DEFAULT 'requested',
    estimated_fare DECIMAL(10,2),
    final_fare DECIMAL(10,2),
    estimated_distance DECIMAL(8,2),
    actual_distance DECIMAL(8,2),
    estimated_duration INTEGER,
    actual_duration INTEGER,
    passenger_count INTEGER DEFAULT 1,
    special_requests TEXT,
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES saferide_users(id),
    cancellation_fee DECIMAL(10,2) DEFAULT 0.00,
    scheduled_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Emergency incidents table
CREATE TABLE emergency_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES saferide_users(id) ON DELETE CASCADE,
    ride_id VARCHAR(50) REFERENCES rides(id),
    emergency_type emergency_type NOT NULL,
    status emergency_status DEFAULT 'active',
    location GEOGRAPHY(POINT) NOT NULL,
    description TEXT,
    severity_level INTEGER DEFAULT 1 CHECK (severity_level BETWEEN 1 AND 5),
    response_time INTEGER,
    resolved_by UUID REFERENCES saferide_users(id),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Emergency contacts table
CREATE TABLE emergency_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES saferide_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    relationship VARCHAR(50),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Escrow transactions table
CREATE TABLE escrow_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id VARCHAR(50) REFERENCES rides(id) ON DELETE CASCADE,
    passenger_wallet VARCHAR(42) NOT NULL,
    driver_wallet VARCHAR(42) NOT NULL,
    amount DECIMAL(18,8) NOT NULL,
    status escrow_status DEFAULT 'created',
    transaction_hash VARCHAR(66),
    block_number BIGINT,
    gas_used BIGINT,
    gas_price BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    locked_at TIMESTAMP WITH TIME ZONE,
    released_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_saferide_users_email ON saferide_users(email);
CREATE INDEX idx_saferide_users_wallet_address ON saferide_users(wallet_address);
CREATE INDEX idx_saferide_users_role ON saferide_users(role);
CREATE INDEX idx_saferide_users_original_user_id ON saferide_users(original_user_id);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

CREATE INDEX idx_drivers_verification_status ON drivers(verification_status);
CREATE INDEX idx_drivers_is_available ON drivers(is_available);
CREATE INDEX idx_drivers_current_location ON drivers USING GIST(current_location);
CREATE INDEX idx_drivers_wallet_address ON drivers(wallet_address);

CREATE INDEX idx_driver_verification_driver_id ON driver_verification(driver_id);
CREATE INDEX idx_driver_verification_status ON driver_verification(verification_status);
CREATE INDEX idx_driver_verification_document_type ON driver_verification(document_type);

CREATE INDEX idx_rides_passenger_id ON rides(passenger_id);
CREATE INDEX idx_rides_driver_id ON rides(driver_id);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_created_at ON rides(created_at);
CREATE INDEX idx_rides_pickup_location ON rides USING GIST(pickup_location);
CREATE INDEX idx_rides_dropoff_location ON rides USING GIST(dropoff_location);

CREATE INDEX idx_emergency_incidents_user_id ON emergency_incidents(user_id);
CREATE INDEX idx_emergency_incidents_ride_id ON emergency_incidents(ride_id);
CREATE INDEX idx_emergency_incidents_status ON emergency_incidents(status);
CREATE INDEX idx_emergency_incidents_location ON emergency_incidents USING GIST(location);
CREATE INDEX idx_emergency_incidents_created_at ON emergency_incidents(created_at);

CREATE INDEX idx_emergency_contacts_user_id ON emergency_contacts(user_id);
CREATE INDEX idx_emergency_contacts_is_primary ON emergency_contacts(is_primary);

CREATE INDEX idx_escrow_transactions_ride_id ON escrow_transactions(ride_id);
CREATE INDEX idx_escrow_transactions_status ON escrow_transactions(status);
CREATE INDEX idx_escrow_transactions_passenger_wallet ON escrow_transactions(passenger_wallet);
CREATE INDEX idx_escrow_transactions_driver_wallet ON escrow_transactions(driver_wallet);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_saferide_users_updated_at BEFORE UPDATE ON saferide_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicle_info_updated_at BEFORE UPDATE ON vehicle_info FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_driver_verification_updated_at BEFORE UPDATE ON driver_verification FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON rides FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_emergency_incidents_updated_at BEFORE UPDATE ON emergency_incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_emergency_contacts_updated_at BEFORE UPDATE ON emergency_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_escrow_transactions_updated_at BEFORE UPDATE ON escrow_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE saferide_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- SafeRide users policies
CREATE POLICY "Users can view their own profile" ON saferide_users FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Users can update their own profile" ON saferide_users FOR UPDATE USING (auth.uid()::text = id::text);
CREATE POLICY "Allow user registration" ON saferide_users FOR INSERT WITH CHECK (auth.uid()::text = id::text);

-- User profiles policies
CREATE POLICY "Users can view their own user profile" ON user_profiles FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update their own user profile" ON user_profiles FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can create their own user profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Vehicle info policies
CREATE POLICY "Drivers can view vehicle info" ON vehicle_info FOR SELECT USING (
    EXISTS (SELECT 1 FROM drivers WHERE drivers.id::text = auth.uid()::text AND drivers.vehicle_id = vehicle_info.id)
);
CREATE POLICY "Drivers can update their vehicle info" ON vehicle_info FOR UPDATE USING (
    EXISTS (SELECT 1 FROM drivers WHERE drivers.id::text = auth.uid()::text AND drivers.vehicle_id = vehicle_info.id)
);
CREATE POLICY "Allow vehicle info creation" ON vehicle_info FOR INSERT WITH CHECK (true);

-- Drivers policies
CREATE POLICY "Drivers can view their own profile" ON drivers FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Drivers can update their own profile" ON drivers FOR UPDATE USING (auth.uid()::text = id::text);
CREATE POLICY "Allow driver registration" ON drivers FOR INSERT WITH CHECK (auth.uid()::text = id::text);
CREATE POLICY "Passengers can view driver info during rides" ON drivers FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM rides 
        WHERE rides.driver_id = drivers.id 
        AND rides.passenger_id::text = auth.uid()::text 
        AND rides.status IN ('accepted', 'in_progress')
    )
);

-- Driver verification policies
CREATE POLICY "Drivers can view their own verification" ON driver_verification FOR SELECT USING (auth.uid()::text = driver_id::text);
CREATE POLICY "Drivers can create their own verification" ON driver_verification FOR INSERT WITH CHECK (auth.uid()::text = driver_id::text);
CREATE POLICY "Drivers can update their own verification" ON driver_verification FOR UPDATE USING (auth.uid()::text = driver_id::text);

-- Rides policies
CREATE POLICY "Users can view their own rides" ON rides FOR SELECT USING (
    auth.uid()::text = passenger_id::text OR auth.uid()::text = driver_id::text
);
CREATE POLICY "Passengers can create rides" ON rides FOR INSERT WITH CHECK (auth.uid()::text = passenger_id::text);
CREATE POLICY "Drivers and passengers can update rides" ON rides FOR UPDATE USING (
    auth.uid()::text = passenger_id::text OR auth.uid()::text = driver_id::text
);

-- Emergency incidents policies
CREATE POLICY "Users can view their own emergency incidents" ON emergency_incidents FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can create their own emergency incidents" ON emergency_incidents FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update their own emergency incidents" ON emergency_incidents FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Emergency contacts policies
CREATE POLICY "Users can view their own emergency contacts" ON emergency_contacts FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can create their own emergency contacts" ON emergency_contacts FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update their own emergency contacts" ON emergency_contacts FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete their own emergency contacts" ON emergency_contacts FOR DELETE USING (auth.uid()::text = user_id::text);

-- Escrow transactions policies
CREATE POLICY "Users can view their own escrow transactions" ON escrow_transactions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM rides 
        WHERE rides.id = escrow_transactions.ride_id 
        AND (rides.passenger_id::text = auth.uid()::text OR rides.driver_id::text = auth.uid()::text)
    )
);
CREATE POLICY "Allow escrow transaction creation" ON escrow_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow escrow transaction updates" ON escrow_transactions FOR UPDATE WITH CHECK (true);

-- Create functions for common operations

-- Function to get nearby drivers
CREATE OR REPLACE FUNCTION get_nearby_drivers(
    pickup_lat DOUBLE PRECISION,
    pickup_lng DOUBLE PRECISION,
    radius_km DOUBLE PRECISION DEFAULT 10
)
RETURNS TABLE (
    driver_id UUID,
    distance_km DOUBLE PRECISION,
    rating DECIMAL(3,2),
    vehicle_info JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        ST_Distance(
            ST_GeogFromText('POINT(' || pickup_lng || ' ' || pickup_lat || ')'),
            d.current_location
        ) / 1000 AS distance_km,
        d.rating,
        row_to_json(v.*)::JSONB AS vehicle_info
    FROM drivers d
    LEFT JOIN vehicle_info v ON d.vehicle_id = v.id
    WHERE 
        d.is_available = true
        AND d.verification_status = 'approved'
        AND ST_DWithin(
            ST_GeogFromText('POINT(' || pickup_lng || ' ' || pickup_lat || ')'),
            d.current_location,
            radius_km * 1000
        )
    ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate ride fare
CREATE OR REPLACE FUNCTION calculate_ride_fare(
    distance_km DOUBLE PRECISION,
    duration_minutes INTEGER,
    ride_type_param ride_type DEFAULT 'standard'
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    base_fare DECIMAL(10,2);
    per_km_rate DECIMAL(10,2);
    per_minute_rate DECIMAL(10,2);
    minimum_fare DECIMAL(10,2);
    calculated_fare DECIMAL(10,2);
BEGIN
    -- Set rates based on ride type
    CASE ride_type_param
        WHEN 'premium' THEN
            base_fare := 5.00;
            per_km_rate := 2.50;
            per_minute_rate := 0.50;
            minimum_fare := 8.00;
        WHEN 'shared' THEN
            base_fare := 2.00;
            per_km_rate := 1.00;
            per_minute_rate := 0.20;
            minimum_fare := 3.00;
        ELSE -- standard
            base_fare := 3.00;
            per_km_rate := 1.50;
            per_minute_rate := 0.30;
            minimum_fare := 5.00;
    END CASE;
    
    calculated_fare := base_fare + (distance_km * per_km_rate) + (duration_minutes * per_minute_rate);
    
    RETURN GREATEST(calculated_fare, minimum_fare);
END;
$$ LANGUAGE plpgsql;

-- Function to update driver location
CREATE OR REPLACE FUNCTION update_driver_location(
    driver_id_param UUID,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE drivers 
    SET 
        current_location = ST_GeogFromText('POINT(' || lng || ' ' || lat || ')'),
        updated_at = NOW()
    WHERE id = driver_id_param;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert some initial test data
INSERT INTO vehicle_info (make, model, year, color, license_plate, vehicle_type, capacity) VALUES
('Toyota', 'Camry', 2022, 'White', 'SR001', 'sedan', 4),
('Honda', 'Civic', 2021, 'Black', 'SR002', 'sedan', 4),
('Tesla', 'Model 3', 2023, 'Blue', 'SR003', 'electric', 4);

COMMIT;