// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// User Types
export interface User {
  id: string;
  wallet_address: string;
  email?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  user_type: 'passenger' | 'driver';
  is_verified: boolean;
  profile_picture?: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  emergency_contact?: string;
  preferences?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Driver Types
export interface Driver {
  avatar: string;
  id: string;
  user_id: string;
  license_number: string;
  vehicle_info: VehicleInfo;
  verification_status: 'pending' | 'verified' | 'rejected';
  rating: number;
  total_rides: number;
  created_at: string;
  updated_at: string;
}

interface VehicleInfo {
  make: string;
  model: string;
  year: number;
  color: string;
  plate_number: string;
}

// Ride Types
export interface Ride {
  id: string;
  passenger_id: string;
  driver_id?: string;
  pickup_location: Location;
  destination: Location;
  status: 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  fare: number;
  estimated_duration: number;
  actual_duration?: number;
  created_at: string;
  updated_at: string;
  driver?: Driver;
}

export interface Location {
  latitude: number;
  longitude: number;
  address: string;
}

export interface RideRequest {
  pickup_location: Location;
  destination: Location;
  passenger_count: number;
  ride_type: 'standard' | 'premium' | 'shared';
  scheduled_time?: string;
}

// Emergency Types
export interface EmergencyIncident {
  id: string;
  user_id: string;
  ride_id?: string;
  incident_type: 'panic' | 'accident' | 'medical' | 'other';
  location: Location;
  status: 'active' | 'resolved' | 'false_alarm';
  description?: string;
  created_at: string;
  resolved_at?: string;
}

export interface EmergencyContact {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  relationship: string;
  is_primary: boolean;
  created_at: string;
}

// Escrow Types
export interface EscrowTransaction {
  id: string;
  ride_id: string;
  passenger_id: string;
  driver_id: string;
  amount: number;
  status: 'pending' | 'held' | 'released' | 'refunded';
  transaction_hash?: string;
  created_at: string;
  updated_at: string;
}

// Statistics Types
export interface UserStats {
  totalRides: number;
  totalSpent: number;
  rating: number;
  carbonSaved: number;
  favoriteDestinations: string[];
  monthlyRides: number;
}

export interface DriverStats {
  total_rides: number;
  total_earnings: number;
  average_rating: number;
  completion_rate: number;
  monthly_rides: number;
}

// API Error Types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

// Pagination Types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// Real-time Types
export interface RideUpdate {
  ride_id: string;
  status: Ride['status'];
  driver_location?: Location;
  estimated_arrival?: string;
  message?: string;
}

export interface DriverLocationUpdate {
  driver_id: string;
  location: Location;
  heading: number;
  speed: number;
  timestamp: string;
}

export interface RideOption {
  id: string;
  name: string;
  description: string;
  estimatedTime: string;
  capacity: number;
  price: number;
  type: 'standard' | 'premium' | 'shared';
  features: string[];
}

export interface BookingRequest {
  pickup: string;
  destination: string;
  rideType: string;
  driverId: string;
  passengerCount: number;
  scheduledTime?: string;
  fare: number;
  paymentMethod: string;
  walletAddress: string;
  userId: string;
}