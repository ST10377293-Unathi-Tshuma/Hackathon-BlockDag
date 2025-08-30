import { 
  ApiResponse, 
  User, 
  UserProfile, 
  Driver, 
  DriverVerification, 
  Ride, 
  RideRequest, 
  EmergencyIncident, 
  EmergencyContact, 
  EscrowTransaction,
  UserStats,
  DriverStats,
  PaginationParams,
  PaginatedResponse,
  Location
} from './types';

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  setAuthToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // User Management APIs
  async getUser(userId: string): Promise<ApiResponse<User>> {
    return this.request<User>(`/api/users/${userId}`);
  }

  async getUserProfile(userId: string): Promise<ApiResponse<UserProfile>> {
    return this.request<UserProfile>(`/api/users/${userId}/profile`);
  }

  async updateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<ApiResponse<UserProfile>> {
    return this.request<UserProfile>(`/api/users/${userId}/profile`, {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
  }

  async getUserStats(userId: string): Promise<ApiResponse<UserStats>> {
    return this.request<UserStats>(`/api/users/${userId}/stats`);
  }

  async getUserRideHistory(userId: string, params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<Ride>>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sort_by) queryParams.append('sort_by', params.sort_by);
    if (params?.sort_order) queryParams.append('sort_order', params.sort_order);
    
    const query = queryParams.toString();
    return this.request<PaginatedResponse<Ride>>(`/api/users/${userId}/rides${query ? `?${query}` : ''}`);
  }

  // Driver APIs
  async getDriver(driverId: string): Promise<ApiResponse<Driver>> {
    return this.request<Driver>(`/api/drivers/${driverId}`);
  }

  async registerDriver(driverData: Omit<Driver, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Driver>> {
    return this.request<Driver>('/api/drivers/register', {
      method: 'POST',
      body: JSON.stringify(driverData),
    });
  }

  async getDriverVerification(driverId: string): Promise<ApiResponse<DriverVerification[]>> {
    return this.request<DriverVerification[]>(`/api/drivers/${driverId}/verification`);
  }

  async uploadDriverDocument(driverId: string, documentType: string, file: File): Promise<ApiResponse<DriverVerification>> {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('document_type', documentType);

    return this.request<DriverVerification>(`/api/drivers/${driverId}/documents`, {
      method: 'POST',
      body: formData,
      headers: {}, // Remove Content-Type to let browser set it for FormData
    });
  }

  async getDriverStats(driverId: string): Promise<ApiResponse<DriverStats>> {
    return this.request<DriverStats>(`/api/drivers/${driverId}/stats`);
  }

  async getNearbyDrivers(location: Location, radius: number = 5): Promise<ApiResponse<Driver[]>> {
    return this.request<Driver[]>(`/api/drivers/nearby?lat=${location.latitude}&lng=${location.longitude}&radius=${radius}`);
  }

  // Ride Booking APIs
  async requestRide(rideRequest: RideRequest): Promise<ApiResponse<Ride>> {
    return this.request<Ride>('/api/rides/request', {
      method: 'POST',
      body: JSON.stringify(rideRequest),
    });
  }

  async getRide(rideId: string): Promise<ApiResponse<Ride>> {
    return this.request<Ride>(`/api/rides/${rideId}`);
  }

  async cancelRide(rideId: string, reason?: string): Promise<ApiResponse<Ride>> {
    return this.request<Ride>(`/api/rides/${rideId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async acceptRide(rideId: string, driverId: string): Promise<ApiResponse<Ride>> {
    return this.request<Ride>(`/api/rides/${rideId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ driver_id: driverId }),
    });
  }

  async startRide(rideId: string): Promise<ApiResponse<Ride>> {
    return this.request<Ride>(`/api/rides/${rideId}/start`, {
      method: 'POST',
    });
  }

  async completeRide(rideId: string): Promise<ApiResponse<Ride>> {
    return this.request<Ride>(`/api/rides/${rideId}/complete`, {
      method: 'POST',
    });
  }

  async getRideEstimate(pickup: Location, destination: Location): Promise<ApiResponse<{ fare: number; duration: number; distance: number }>> {
    return this.request(`/api/rides/estimate`, {
      method: 'POST',
      body: JSON.stringify({ pickup_location: pickup, destination }),
    });
  }

  // Emergency APIs
  async triggerEmergency(incident: Omit<EmergencyIncident, 'id' | 'created_at' | 'status'>): Promise<ApiResponse<EmergencyIncident>> {
    return this.request<EmergencyIncident>('/api/emergency/trigger', {
      method: 'POST',
      body: JSON.stringify(incident),
    });
  }

  async getEmergencyContacts(userId: string): Promise<ApiResponse<EmergencyContact[]>> {
    return this.request<EmergencyContact[]>(`/api/emergency/contacts/${userId}`);
  }

  async addEmergencyContact(contact: Omit<EmergencyContact, 'id' | 'created_at'>): Promise<ApiResponse<EmergencyContact>> {
    return this.request<EmergencyContact>('/api/emergency/contacts', {
      method: 'POST',
      body: JSON.stringify(contact),
    });
  }

  async updateEmergencyContact(contactId: string, contact: Partial<EmergencyContact>): Promise<ApiResponse<EmergencyContact>> {
    return this.request<EmergencyContact>(`/api/emergency/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify(contact),
    });
  }

  async deleteEmergencyContact(contactId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/emergency/contacts/${contactId}`, {
      method: 'DELETE',
    });
  }

  // Escrow APIs
  async createEscrowTransaction(rideId: string, amount: number): Promise<ApiResponse<EscrowTransaction>> {
    return this.request<EscrowTransaction>('/api/escrow/create', {
      method: 'POST',
      body: JSON.stringify({ ride_id: rideId, amount }),
    });
  }

  async releaseEscrow(transactionId: string): Promise<ApiResponse<EscrowTransaction>> {
    return this.request<EscrowTransaction>(`/api/escrow/${transactionId}/release`, {
      method: 'POST',
    });
  }

  async refundEscrow(transactionId: string): Promise<ApiResponse<EscrowTransaction>> {
    return this.request<EscrowTransaction>(`/api/escrow/${transactionId}/refund`, {
      method: 'POST',
    });
  }

  async getEscrowTransaction(transactionId: string): Promise<ApiResponse<EscrowTransaction>> {
    return this.request<EscrowTransaction>(`/api/escrow/${transactionId}`);
  }

  // Health Check
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.request('/health');
  }
}

// Create singleton instance
const apiService = new ApiService();
export default apiService;

// Export the class for testing
export { ApiService };