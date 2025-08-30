import { User } from './types';

// Mock in-memory database
class MockDatabase {
  private users: (User & { password: string })[] = [];
  private userIdCounter = 1;

  constructor() {
    // Initialize with test users for development
    this.initializeTestUsers();
  }

  private initializeTestUsers() {
    // Test rider
    this.createUser({
      email: 'rider@test.com',
      password: 'password123',
      full_name: 'Test Rider',
      phone: '+1234567890',
      user_type: 'passenger'
    });

    // Test driver
    this.createUser({
      email: 'driver@test.com',
      password: 'password123',
      full_name: 'Test Driver',
      phone: '+1234567891',
      user_type: 'driver'
    });
  }

  // User methods
  createUser(userData: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    user_type: 'passenger' | 'driver';
  }): User & { password: string } {
    const newUser: User & { password: string } = {
      id: this.userIdCounter.toString(),
      email: userData.email,
      password: userData.password,
      full_name: userData.full_name,
      phone: userData.phone || null,
      user_type: userData.user_type,
      is_verified: false,
      profile_picture: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.users.push(newUser);
    this.userIdCounter++;
    return newUser;
  }

  findUserByEmail(email: string): (User & { password: string }) | undefined {
    return this.users.find(user => user.email === email);
  }

  findUserById(id: string): (User & { password: string }) | undefined {
    return this.users.find(user => user.id === id);
  }

  getAllUsers(): (User & { password: string })[] {
    return [...this.users];
  }

  updateUser(id: string, updates: Partial<User>): (User & { password: string }) | undefined {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) {
      return undefined;
    }

    this.users[userIndex] = {
      ...this.users[userIndex],
      ...updates,
      updated_at: new Date().toISOString()
    };

    return this.users[userIndex];
  }

  // Token generation
  generateTokens(userId: string) {
    return {
      accessToken: `mock_access_token_${userId}_${Date.now()}`,
      refreshToken: `mock_refresh_token_${userId}_${Date.now()}`
    };
  }
}

// Export singleton instance
export const mockDb = new MockDatabase();