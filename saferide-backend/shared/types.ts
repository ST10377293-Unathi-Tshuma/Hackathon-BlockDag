// User and Authentication Types
export interface User {
  id: string;
  wallet_address: string;
  pseudonym: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// Driver Types
export interface Driver {
  id: string;
  user_id: string;
  wallet_address: string;
  verification_level: number;
  is_verified: boolean;
  is_active: boolean;
  vehicle_info: VehicleInfo;
  created_at: string;
  updated_at: string;
}

export interface VehicleInfo {
  make: string;
  model: string;
  year: number;
  license_plate: string;
  color: string;
  vehicle_type: string;
}

export interface DriverVerification {
  id: string;
  driver_id: string;
  document_type: DocumentType;
  document_hash: string;
  verification_status: VerificationStatus;
  blockchain_tx_hash?: string;
  verified_at?: string;
  expires_at?: string;
  created_at: string;
}

export type DocumentType = 'drivers_license' | 'insurance' | 'vehicle_registration' | 'background_check';
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'expired';

// Passenger Types
export interface UserProfile {
  id: string;
  user_id: string;
  encrypted_data: Record<string, any>;
  privacy_level: PrivacyLevel;
  preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type PrivacyLevel = 'minimal' | 'standard' | 'enhanced';

// Ride Types
export interface Ride {
  id: string;
  passenger_id: string;
  driver_id?: string;
  blockchain_ride_id: string;
  pickup_location: LocationData;
  destination_location: LocationData;
  ride_type: RideType;
  estimated_fare: number;
  final_fare?: number;
  status: RideStatus;
  requested_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  country: string;
}

export type RideType = 'economy' | 'premium' | 'express';
export type RideStatus = 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

// Emergency Types
export interface EmergencyIncident {
  id: string;
  ride_id: string;
  emergency_type: EmergencyType;
  location_data: LocationData;
  status: EmergencyStatus;
  triggered_at: string;
  resolved_at?: string;
}

export interface EmergencyContact {
  id: string;
  user_id: string;
  encrypted_contact_info: Record<string, any>;
  contact_type: ContactType;
  is_active: boolean;
  created_at: string;
}

export type EmergencyType = 'safety' | 'medical' | 'vehicle' | 'other';
export type EmergencyStatus = 'active' | 'resolved' | 'escalated';
export type ContactType = 'family' | 'friend' | 'medical' | 'legal';

// Blockchain Types
export interface EscrowTransaction {
  id: string;
  ride_id: string;
  escrow_contract_address: string;
  transaction_hash: string;
  amount: number;
  status: EscrowStatus;
  created_at: string;
  released_at?: string;
}

export type EscrowStatus = 'created' | 'funded' | 'released' | 'refunded';

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Request Types
export interface CreateRideRequest {
  passengerId: string;
  pickup: LocationData;
  destination: LocationData;
  rideType: RideType;
  estimatedFare: number;
}

export interface DriverRegistrationRequest {
  walletAddress: string;
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  vehicleInfo: VehicleInfo;
  documents: string[];
}

export interface EmergencyRequest {
  rideId: string;
  location: LocationData;
  emergencyType: EmergencyType;
}

// WebSocket Types
export interface SocketEvent {
  type: string;
  data: any;
  timestamp: string;
}

export interface LocationUpdate {
  rideId: string;
  driverId: string;
  location: LocationData;
  timestamp: string;
}

export interface RideUpdate {
  rideId: string;
  status: RideStatus;
  location?: LocationData;
  estimatedArrival?: number;
  timestamp: string;
}