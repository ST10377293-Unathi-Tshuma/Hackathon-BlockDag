import crypto from 'crypto';
import CryptoJS from 'crypto-js';
import { logger } from '../middleware/errorHandler.js';

/**
 * Encryption utilities for data privacy and anonymization
 */

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * AES encryption/decryption utilities
 */
export class EncryptionService {
  private static key = Buffer.from(ENCRYPTION_KEY, 'hex');

  /**
   * Encrypt sensitive data
   */
  static encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv('aes-256-cbc', this.key, iv);
      cipher.setAutoPadding(true);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      logger.error('Encryption failed', { error });
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedText: string): string {
    try {
      const textParts = encryptedText.split(':');
      const iv = Buffer.from(textParts.shift()!, 'hex');
      const encrypted = textParts.join(':');
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { error });
      throw new Error('Decryption failed');
    }
  }

  /**
   * Hash sensitive data (one-way)
   */
  static hash(text: string, salt?: string): string {
    const saltToUse = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(text, saltToUse, 10000, 64, 'sha512');
    return saltToUse + ':' + hash.toString('hex');
  }

  /**
   * Verify hashed data
   */
  static verifyHash(text: string, hashedText: string): boolean {
    try {
      const [salt, hash] = hashedText.split(':');
      const newHash = crypto.pbkdf2Sync(text, salt, 10000, 64, 'sha512');
      return hash === newHash.toString('hex');
    } catch (error) {
      logger.error('Hash verification failed', { error });
      return false;
    }
  }
}

/**
 * Anonymization utilities for passenger data
 */
export class AnonymizationService {
  /**
   * Generate pseudonym from wallet address
   */
  static generatePseudonym(walletAddress: string): string {
    const hash = crypto.createHash('sha256').update(walletAddress).digest('hex');
    const adjectives = ['Swift', 'Bright', 'Calm', 'Bold', 'Quick', 'Smart', 'Cool', 'Fast'];
    const nouns = ['Rider', 'Traveler', 'Explorer', 'Voyager', 'Navigator', 'Passenger', 'Guest', 'User'];
    
    const adjIndex = parseInt(hash.substring(0, 8), 16) % adjectives.length;
    const nounIndex = parseInt(hash.substring(8, 16), 16) % nouns.length;
    const number = parseInt(hash.substring(16, 20), 16) % 9999;
    
    return `${adjectives[adjIndex]}${nouns[nounIndex]}${number.toString().padStart(4, '0')}`;
  }

  /**
   * Anonymize location data
   */
  static anonymizeLocation(latitude: number, longitude: number, precision: number = 3): {
    latitude: number;
    longitude: number;
  } {
    // Reduce precision to anonymize exact location
    const factor = Math.pow(10, precision);
    return {
      latitude: Math.round(latitude * factor) / factor,
      longitude: Math.round(longitude * factor) / factor
    };
  }

  /**
   * Generate anonymous ride ID
   */
  static generateAnonymousRideId(): string {
    return 'ride_' + crypto.randomBytes(16).toString('hex');
  }

  /**
   * Mask sensitive information
   */
  static maskEmail(email: string): string {
    const [username, domain] = email.split('@');
    const maskedUsername = username.substring(0, 2) + '*'.repeat(username.length - 2);
    return `${maskedUsername}@${domain}`;
  }

  static maskPhone(phone: string): string {
    if (phone.length < 4) return phone;
    return phone.substring(0, 3) + '*'.repeat(phone.length - 6) + phone.substring(phone.length - 3);
  }

  static maskLicensePlate(plate: string): string {
    if (plate.length < 3) return plate;
    return plate.substring(0, 2) + '*'.repeat(plate.length - 2);
  }
}

/**
 * Zero-knowledge proof utilities (simplified implementation)
 */
export class ZKProofService {
  /**
   * Generate proof of identity without revealing identity
   */
  static generateIdentityProof(walletAddress: string, secret: string): {
    proof: string;
    commitment: string;
  } {
    // Simplified ZK proof - in production, use proper ZK libraries
    const commitment = crypto.createHash('sha256')
      .update(walletAddress + secret)
      .digest('hex');
    
    const proof = crypto.createHash('sha256')
      .update(commitment + Date.now().toString())
      .digest('hex');
    
    return { proof, commitment };
  }

  /**
   * Verify identity proof
   */
  static verifyIdentityProof(
    proof: string,
    commitment: string,
    walletAddress: string,
    secret: string
  ): boolean {
    try {
      const expectedCommitment = crypto.createHash('sha256')
        .update(walletAddress + secret)
        .digest('hex');
      
      return commitment === expectedCommitment;
    } catch (error) {
      logger.error('ZK proof verification failed', { error });
      return false;
    }
  }

  /**
   * Generate proof of location without revealing exact location
   */
  static generateLocationProof(
    latitude: number,
    longitude: number,
    radius: number = 1000 // meters
  ): {
    proof: string;
    zone: string;
  } {
    // Create a zone identifier based on approximate location
    const zoneLat = Math.floor(latitude * 100) / 100;
    const zoneLng = Math.floor(longitude * 100) / 100;
    const zone = `${zoneLat},${zoneLng}`;
    
    const proof = crypto.createHash('sha256')
      .update(zone + radius.toString())
      .digest('hex');
    
    return { proof, zone };
  }
}

/**
 * Secure data storage utilities
 */
export class SecureStorage {
  /**
   * Encrypt and store sensitive data
   */
  static encryptForStorage(data: any): string {
    const jsonString = JSON.stringify(data);
    return EncryptionService.encrypt(jsonString);
  }

  /**
   * Decrypt stored data
   */
  static decryptFromStorage(encryptedData: string): any {
    const decryptedString = EncryptionService.decrypt(encryptedData);
    return JSON.parse(decryptedString);
  }

  /**
   * Generate secure token
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate time-based one-time password
   */
  static generateTOTP(secret: string, window: number = 30): string {
    const time = Math.floor(Date.now() / 1000 / window);
    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(Buffer.from(time.toString(16).padStart(16, '0'), 'hex'));
    const hash = hmac.digest();
    
    const offset = hash[hash.length - 1] & 0xf;
    const code = ((hash[offset] & 0x7f) << 24) |
                 ((hash[offset + 1] & 0xff) << 16) |
                 ((hash[offset + 2] & 0xff) << 8) |
                 (hash[offset + 3] & 0xff);
    
    return (code % 1000000).toString().padStart(6, '0');
  }
}

/**
 * Initialize encryption service
 */
export const initializeEncryption = (): void => {
  if (!process.env.ENCRYPTION_KEY) {
    logger.warn('ENCRYPTION_KEY not set, using generated key (data will not persist across restarts)');
  }
  
  logger.info('Encryption service initialized');
};