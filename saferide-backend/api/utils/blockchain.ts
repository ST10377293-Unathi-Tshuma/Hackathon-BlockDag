import { ethers } from 'ethers';
import crypto from 'crypto';
import { logger } from '../middleware/errorHandler.js';

/**
 * BlockDAG blockchain utility functions
 */

// Smart contract ABI for driver verification
const DRIVER_VERIFICATION_ABI = [
  "function verifyDriver(address driverAddress, string memory documentHash, uint8 verificationLevel) external",
  "function getDriverVerification(address driverAddress) external view returns (bool isVerified, uint8 level, uint256 timestamp)",
  "function revokeVerification(address driverAddress) external",
  "event DriverVerified(address indexed driver, uint8 level, uint256 timestamp)",
  "event VerificationRevoked(address indexed driver, uint256 timestamp)"
];

// Smart contract ABI for escrow
const ESCROW_ABI = [
  "function createEscrow(bytes32 rideId, address passenger, address driver, uint256 amount) external payable",
  "function releaseEscrow(bytes32 rideId) external",
  "function refundEscrow(bytes32 rideId) external",
  "function getEscrowStatus(bytes32 rideId) external view returns (uint8 status, uint256 amount, address passenger, address driver)",
  "event EscrowCreated(bytes32 indexed rideId, address indexed passenger, address indexed driver, uint256 amount)",
  "event EscrowReleased(bytes32 indexed rideId, address indexed driver, uint256 amount)",
  "event EscrowRefunded(bytes32 indexed rideId, address indexed passenger, uint256 amount)"
];

interface BlockchainConfig {
  rpcUrl: string;
  privateKey: string;
  driverVerificationContract: string;
  escrowContract: string;
  chainId: number;
}

class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private driverContract: ethers.Contract;
  private escrowContract: ethers.Contract;

  constructor(config: BlockchainConfig) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    
    this.driverContract = new ethers.Contract(
      config.driverVerificationContract,
      DRIVER_VERIFICATION_ABI,
      this.wallet
    );
    
    this.escrowContract = new ethers.Contract(
      config.escrowContract,
      ESCROW_ABI,
      this.wallet
    );
  }

  /**
   * Verify driver on blockchain
   */
  async verifyDriver(
    driverAddress: string,
    documentHash: string,
    verificationLevel: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const tx = await this.driverContract.verifyDriver(
        driverAddress,
        documentHash,
        verificationLevel
      );
      
      await tx.wait();
      
      logger.info(`Driver verified on blockchain: ${driverAddress}`, {
        txHash: tx.hash,
        verificationLevel
      });
      
      return { success: true, txHash: tx.hash };
    } catch (error) {
      logger.error('Failed to verify driver on blockchain', { error, driverAddress });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get driver verification status from blockchain
   */
  async getDriverVerification(driverAddress: string): Promise<{
    isVerified: boolean;
    level: number;
    timestamp: number;
  }> {
    try {
      const result = await this.driverContract.getDriverVerification(driverAddress);
      return {
        isVerified: result[0],
        level: Number(result[1]),
        timestamp: Number(result[2])
      };
    } catch (error) {
      logger.error('Failed to get driver verification from blockchain', { error, driverAddress });
      return { isVerified: false, level: 0, timestamp: 0 };
    }
  }

  /**
   * Create escrow for ride payment
   */
  async createEscrow(
    rideId: string,
    passengerAddress: string,
    driverAddress: string,
    amount: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const rideIdBytes = ethers.id(rideId);
      const amountWei = ethers.parseEther(amount);
      
      const tx = await this.escrowContract.createEscrow(
        rideIdBytes,
        passengerAddress,
        driverAddress,
        amountWei,
        { value: amountWei }
      );
      
      await tx.wait();
      
      logger.info(`Escrow created for ride: ${rideId}`, {
        txHash: tx.hash,
        amount
      });
      
      return { success: true, txHash: tx.hash };
    } catch (error) {
      logger.error('Failed to create escrow', { error, rideId });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Release escrow payment to driver
   */
  async releaseEscrow(rideId: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const rideIdBytes = ethers.id(rideId);
      const tx = await this.escrowContract.releaseEscrow(rideIdBytes);
      
      await tx.wait();
      
      logger.info(`Escrow released for ride: ${rideId}`, { txHash: tx.hash });
      
      return { success: true, txHash: tx.hash };
    } catch (error) {
      logger.error('Failed to release escrow', { error, rideId });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Verify wallet signature
   */
  verifySignature(message: string, signature: string, expectedAddress: string): boolean {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
      logger.error('Failed to verify signature', { error, expectedAddress });
      return false;
    }
  }

  /**
   * Generate message for wallet signing
   */
  generateSignMessage(action: string, timestamp: number, nonce: string): string {
    return `SafeRide ${action} - Timestamp: ${timestamp} - Nonce: ${nonce}`;
  }
}

// Initialize blockchain service
let blockchainService: BlockchainService | null = null;

export const initializeBlockchain = (): BlockchainService => {
  if (!blockchainService) {
    const config: BlockchainConfig = {
      rpcUrl: process.env.BLOCKDAG_RPC_URL || 'http://localhost:8545',
      privateKey: process.env.BLOCKDAG_PRIVATE_KEY || '',
      driverVerificationContract: process.env.DRIVER_VERIFICATION_CONTRACT || '',
      escrowContract: process.env.ESCROW_CONTRACT || '',
      chainId: parseInt(process.env.BLOCKDAG_CHAIN_ID || '1337')
    };

    if (!config.privateKey || !config.driverVerificationContract || !config.escrowContract) {
      logger.warn('Blockchain configuration incomplete, some features may not work');
    }

    blockchainService = new BlockchainService(config);
  }
  
  return blockchainService;
};

export const getBlockchainService = (): BlockchainService => {
  if (!blockchainService) {
    throw new Error('Blockchain service not initialized');
  }
  return blockchainService;
};

/**
 * Utility functions for document hashing
 */
export const hashDocument = (documentContent: Buffer): string => {
  return '0x' + crypto.createHash('sha256').update(documentContent).digest('hex');
};

export const generateNonce = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

export const generateRideId = (): string => {
  return crypto.randomUUID();
};