import express from 'express';
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// BlockDAG network configuration
const BLOCKDAG_RPC_URL = process.env.BLOCKDAG_RPC_URL || 'https://rpc.blockdag.network';
const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY!;
const ESCROW_CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS!;
const VERIFICATION_CONTRACT_ADDRESS = process.env.VERIFICATION_CONTRACT_ADDRESS!;

// Smart contract ABIs
const ESCROW_ABI = [
  'function createEscrow(string memory rideId, address driver, address passenger, uint256 amount) external payable returns (uint256)',
  'function releaseEscrow(uint256 escrowId) external',
  'function refundEscrow(uint256 escrowId) external',
  'function getEscrowDetails(uint256 escrowId) external view returns (string memory, address, address, uint256, uint8)',
  'event EscrowCreated(uint256 indexed escrowId, string rideId, address driver, address passenger, uint256 amount)',
  'event EscrowReleased(uint256 indexed escrowId)',
  'event EscrowRefunded(uint256 indexed escrowId)'
];

const VERIFICATION_ABI = [
  'function verifyDriver(address driverAddress, string memory driverId, bytes32 documentHash) external',
  'function isDriverVerified(address driverAddress) external view returns (bool)',
  'function getDriverVerification(address driverAddress) external view returns (string memory, bytes32, uint256)',
  'event DriverVerified(address indexed driverAddress, string driverId, bytes32 documentHash)'
];

class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private escrowContract: ethers.Contract;
  private verificationContract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(BLOCKDAG_RPC_URL);
    this.wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
    this.escrowContract = new ethers.Contract(ESCROW_CONTRACT_ADDRESS, ESCROW_ABI, this.wallet);
    this.verificationContract = new ethers.Contract(VERIFICATION_CONTRACT_ADDRESS, VERIFICATION_ABI, this.wallet);
  }

  // Create escrow for ride
  async createEscrow(rideId: string, driverAddress: string, passengerAddress: string, amount: string) {
    try {
      const amountWei = ethers.parseEther(amount);
      const tx = await this.escrowContract.createEscrow(
        rideId,
        driverAddress,
        passengerAddress,
        amountWei,
        { value: amountWei }
      );
      
      const receipt = await tx.wait();
      const escrowId = receipt.logs[0].args[0];
      
      // Update database
      await supabase
        .from('escrow_transactions')
        .insert({
          ride_id: rideId,
          escrow_id: escrowId.toString(),
          driver_address: driverAddress,
          passenger_address: passengerAddress,
          amount: parseFloat(amount),
          status: 'active',
          transaction_hash: tx.hash
        });
      
      return {
        success: true,
        escrowId: escrowId.toString(),
        transactionHash: tx.hash
      };
    } catch (error) {
      console.error('Error creating escrow:', error);
      throw error;
    }
  }

  // Release escrow to driver
  async releaseEscrow(escrowId: string) {
    try {
      const tx = await this.escrowContract.releaseEscrow(escrowId);
      await tx.wait();
      
      // Update database
      await supabase
        .from('escrow_transactions')
        .update({ 
          status: 'released',
          released_at: new Date().toISOString()
        })
        .eq('escrow_id', escrowId);
      
      return {
        success: true,
        transactionHash: tx.hash
      };
    } catch (error) {
      console.error('Error releasing escrow:', error);
      throw error;
    }
  }

  // Refund escrow to passenger
  async refundEscrow(escrowId: string) {
    try {
      const tx = await this.escrowContract.refundEscrow(escrowId);
      await tx.wait();
      
      // Update database
      await supabase
        .from('escrow_transactions')
        .update({ 
          status: 'refunded',
          refunded_at: new Date().toISOString()
        })
        .eq('escrow_id', escrowId);
      
      return {
        success: true,
        transactionHash: tx.hash
      };
    } catch (error) {
      console.error('Error refunding escrow:', error);
      throw error;
    }
  }

  // Verify driver on blockchain
  async verifyDriverOnBlockchain(driverId: string, driverAddress: string, documentHash: string) {
    try {
      const tx = await this.verificationContract.verifyDriver(
        driverAddress,
        driverId,
        documentHash
      );
      await tx.wait();
      
      // Update database
      await supabase
        .from('driver_verification')
        .update({ 
          blockchain_verified: true,
          blockchain_tx_hash: tx.hash,
          verification_date: new Date().toISOString()
        })
        .eq('driver_id', driverId);
      
      return {
        success: true,
        transactionHash: tx.hash
      };
    } catch (error) {
      console.error('Error verifying driver on blockchain:', error);
      throw error;
    }
  }

  // Check if driver is verified on blockchain
  async isDriverVerified(driverAddress: string) {
    try {
      const isVerified = await this.verificationContract.isDriverVerified(driverAddress);
      return { verified: isVerified };
    } catch (error) {
      console.error('Error checking driver verification:', error);
      throw error;
    }
  }

  // Get escrow details
  async getEscrowDetails(escrowId: string) {
    try {
      const details = await this.escrowContract.getEscrowDetails(escrowId);
      return {
        rideId: details[0],
        driver: details[1],
        passenger: details[2],
        amount: ethers.formatEther(details[3]),
        status: details[4]
      };
    } catch (error) {
      console.error('Error getting escrow details:', error);
      throw error;
    }
  }

  // Generate wallet for user
  generateWallet() {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase
    };
  }

  // Get wallet balance
  async getBalance(address: string) {
    try {
      const balance = await this.provider.getBalance(address);
      return {
        balance: ethers.formatEther(balance),
        balanceWei: balance.toString()
      };
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    }
  }
}

const blockchainService = new BlockchainService();

// Routes

// Create escrow for ride
app.post('/escrow/create', async (req, res) => {
  try {
    const { rideId, driverAddress, passengerAddress, amount } = req.body;
    
    if (!rideId || !driverAddress || !passengerAddress || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await blockchainService.createEscrow(
      rideId,
      driverAddress,
      passengerAddress,
      amount
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error creating escrow:', error);
    res.status(500).json({ error: 'Failed to create escrow' });
  }
});

// Release escrow
app.post('/escrow/:escrowId/release', async (req, res) => {
  try {
    const { escrowId } = req.params;
    const result = await blockchainService.releaseEscrow(escrowId);
    res.json(result);
  } catch (error) {
    console.error('Error releasing escrow:', error);
    res.status(500).json({ error: 'Failed to release escrow' });
  }
});

// Refund escrow
app.post('/escrow/:escrowId/refund', async (req, res) => {
  try {
    const { escrowId } = req.params;
    const result = await blockchainService.refundEscrow(escrowId);
    res.json(result);
  } catch (error) {
    console.error('Error refunding escrow:', error);
    res.status(500).json({ error: 'Failed to refund escrow' });
  }
});

// Get escrow details
app.get('/escrow/:escrowId', async (req, res) => {
  try {
    const { escrowId } = req.params;
    const details = await blockchainService.getEscrowDetails(escrowId);
    res.json(details);
  } catch (error) {
    console.error('Error getting escrow details:', error);
    res.status(500).json({ error: 'Failed to get escrow details' });
  }
});

// Verify driver on blockchain
app.post('/verification/driver', async (req, res) => {
  try {
    const { driverId, driverAddress, documentHash } = req.body;
    
    if (!driverId || !driverAddress || !documentHash) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await blockchainService.verifyDriverOnBlockchain(
      driverId,
      driverAddress,
      documentHash
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error verifying driver:', error);
    res.status(500).json({ error: 'Failed to verify driver' });
  }
});

// Check driver verification status
app.get('/verification/driver/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const result = await blockchainService.isDriverVerified(address);
    res.json(result);
  } catch (error) {
    console.error('Error checking verification:', error);
    res.status(500).json({ error: 'Failed to check verification' });
  }
});

// Generate new wallet
app.post('/wallet/generate', async (req, res) => {
  try {
    const wallet = blockchainService.generateWallet();
    res.json(wallet);
  } catch (error) {
    console.error('Error generating wallet:', error);
    res.status(500).json({ error: 'Failed to generate wallet' });
  }
});

// Get wallet balance
app.get('/wallet/:address/balance', async (req, res) => {
  try {
    const { address } = req.params;
    const balance = await blockchainService.getBalance(address);
    res.json(balance);
  } catch (error) {
    console.error('Error getting balance:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Get all escrow transactions
app.get('/escrow/transactions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('escrow_transactions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// Get escrow transactions by ride
app.get('/escrow/ride/:rideId', async (req, res) => {
  try {
    const { rideId } = req.params;
    const { data, error } = await supabase
      .from('escrow_transactions')
      .select('*')
      .eq('ride_id', rideId)
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error getting ride escrow:', error);
    res.status(500).json({ error: 'Failed to get ride escrow' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'blockchain' });
});

const PORT = process.env.BLOCKCHAIN_SERVICE_PORT || 3005;

app.listen(PORT, () => {
  console.log(`Blockchain service running on port ${PORT}`);
});

export default app;