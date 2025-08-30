import { ethers } from 'ethers';
import crypto from 'crypto';

// BlockDAG network configuration
export const BLOCKDAG_CONFIG = {
  rpcUrl: process.env.BLOCKDAG_RPC_URL || 'https://rpc.blockdag.network',
  chainId: parseInt(process.env.BLOCKDAG_CHAIN_ID || '1001'),
  networkName: 'BlockDAG',
  nativeCurrency: {
    name: 'BDAG',
    symbol: 'BDAG',
    decimals: 18
  }
};

// Contract addresses
export const CONTRACT_ADDRESSES = {
  escrow: process.env.ESCROW_CONTRACT_ADDRESS!,
  verification: process.env.VERIFICATION_CONTRACT_ADDRESS!
};

// Smart contract ABIs
export const ESCROW_ABI = [
  'function createEscrow(string memory rideId, address driver, address passenger, uint256 amount) external payable returns (uint256)',
  'function releaseEscrow(uint256 escrowId) external',
  'function refundEscrow(uint256 escrowId) external',
  'function disputeEscrow(uint256 escrowId) external',
  'function resolveDispute(uint256 escrowId, bool releaseToDriver) external',
  'function getEscrowDetails(uint256 escrowId) external view returns (string memory, address, address, uint256, uint8)',
  'function updatePlatformFee(uint256 newFeePercent) external',
  'function getContractBalance() external view returns (uint256)',
  'event EscrowCreated(uint256 indexed escrowId, string rideId, address driver, address passenger, uint256 amount)',
  'event EscrowReleased(uint256 indexed escrowId, address driver, uint256 amount, uint256 platformFee)',
  'event EscrowRefunded(uint256 indexed escrowId, address passenger, uint256 amount)',
  'event EscrowDisputed(uint256 indexed escrowId, address initiator)'
];

export const VERIFICATION_ABI = [
  'function verifyDriver(address driverAddress, string memory driverId, bytes32 documentHash, string memory ipfsHash) external',
  'function rejectDriver(address driverAddress, string memory driverId, string memory reason) external',
  'function suspendDriver(address driverAddress, string memory reason) external',
  'function updateReputationScore(address driverAddress, uint256 newScore) external',
  'function renewVerification(address driverAddress) external',
  'function isDriverVerified(address driverAddress) external view returns (bool)',
  'function getDriverVerification(address driverAddress) external view returns (string memory, bytes32, uint8, uint256, uint256, address, string memory, uint256)',
  'function getDriverAddressById(string memory driverId) external view returns (address)',
  'function getVerifiedDrivers() external view returns (address[])',
  'function getDriverReputationScore(address driverAddress) external view returns (uint256)',
  'function isVerificationExpired(address driverAddress) external view returns (bool)',
  'function getTotalVerifiedDrivers() external view returns (uint256)',
  'event DriverVerified(address indexed driverAddress, string driverId, bytes32 documentHash, address verifier)',
  'event DriverRejected(address indexed driverAddress, string driverId, address verifier, string reason)',
  'event DriverSuspended(address indexed driverAddress, string driverId, address verifier, string reason)',
  'event ReputationUpdated(address indexed driverAddress, uint256 oldScore, uint256 newScore)'
];

/**
 * Blockchain utility class for SafeRide
 */
export class BlockchainUtils {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private escrowContract: ethers.Contract;
  private verificationContract: ethers.Contract;

  constructor(privateKey: string) {
    this.provider = new ethers.JsonRpcProvider(BLOCKDAG_CONFIG.rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.escrowContract = new ethers.Contract(
      CONTRACT_ADDRESSES.escrow,
      ESCROW_ABI,
      this.wallet
    );
    this.verificationContract = new ethers.Contract(
      CONTRACT_ADDRESSES.verification,
      VERIFICATION_ABI,
      this.wallet
    );
  }

  /**
   * Generate a new wallet
   */
  static generateWallet(): {
    address: string;
    privateKey: string;
    mnemonic: string | null;
  } {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase || null
    };
  }

  /**
   * Get wallet balance
   */
  async getBalance(address: string): Promise<{
    balance: string;
    balanceWei: string;
  }> {
    const balance = await this.provider.getBalance(address);
    return {
      balance: ethers.formatEther(balance),
      balanceWei: balance.toString()
    };
  }

  /**
   * Create document hash for verification
   */
  static createDocumentHash(documentData: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(documentData));
  }

  /**
   * Create IPFS hash placeholder (in real implementation, upload to IPFS)
   */
  static createIPFSHash(data: string): string {
    // In real implementation, this would upload to IPFS and return the hash
    // For now, we'll create a mock hash
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return `Qm${hash.substring(0, 44)}`; // Mock IPFS hash format
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(
    contractMethod: any,
    ...args: any[]
  ): Promise<{
    gasLimit: string;
    gasPrice: string;
    estimatedCost: string;
  }> {
    const gasLimit = await contractMethod.estimateGas(...args);
    const gasPrice = await this.provider.getFeeData();
    const estimatedCost = gasLimit * (gasPrice.gasPrice || 0n);

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: gasPrice.gasPrice?.toString() || '0',
      estimatedCost: ethers.formatEther(estimatedCost)
    };
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(
    txHash: string,
    confirmations: number = 1
  ): Promise<ethers.TransactionReceipt | null> {
    return await this.provider.waitForTransaction(txHash, confirmations);
  }

  /**
   * Get transaction details
   */
  async getTransaction(txHash: string): Promise<ethers.TransactionResponse | null> {
    return await this.provider.getTransaction(txHash);
  }

  /**
   * Get current block number
   */
  async getCurrentBlockNumber(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  /**
   * Get network information
   */
  async getNetworkInfo(): Promise<{
    chainId: number;
    name: string;
    blockNumber: number;
  }> {
    const network = await this.provider.getNetwork();
    const blockNumber = await this.provider.getBlockNumber();
    
    return {
      chainId: Number(network.chainId),
      name: network.name,
      blockNumber
    };
  }

  /**
   * Listen to contract events
   */
  listenToEscrowEvents(callback: (event: any) => void): void {
    this.escrowContract.on('*', (event) => {
      callback({
        type: 'escrow',
        event: event.eventName,
        data: event.args,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      });
    });
  }

  /**
   * Listen to verification events
   */
  listenToVerificationEvents(callback: (event: any) => void): void {
    this.verificationContract.on('*', (event) => {
      callback({
        type: 'verification',
        event: event.eventName,
        data: event.args,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      });
    });
  }

  /**
   * Stop listening to events
   */
  stopListening(): void {
    this.escrowContract.removeAllListeners();
    this.verificationContract.removeAllListeners();
  }

  /**
   * Validate Ethereum address
   */
  static isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * Convert amount to Wei
   */
  static toWei(amount: string): bigint {
    return ethers.parseEther(amount);
  }

  /**
   * Convert Wei to Ether
   */
  static fromWei(amountWei: bigint): string {
    return ethers.formatEther(amountWei);
  }

  /**
   * Sign message
   */
  async signMessage(message: string): Promise<string> {
    return await this.wallet.signMessage(message);
  }

  /**
   * Verify signature
   */
  static verifySignature(
    message: string,
    signature: string,
    expectedAddress: string
  ): boolean {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a typed data signature (EIP-712)
   */
  async signTypedData(
    domain: any,
    types: any,
    value: any
  ): Promise<string> {
    return await this.wallet.signTypedData(domain, types, value);
  }

  /**
   * Get contract instance
   */
  getEscrowContract(): ethers.Contract {
    return this.escrowContract;
  }

  /**
   * Get verification contract instance
   */
  getVerificationContract(): ethers.Contract {
    return this.verificationContract;
  }

  /**
   * Get provider instance
   */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  /**
   * Get wallet instance
   */
  getWallet(): ethers.Wallet {
    return this.wallet;
  }
}

/**
 * Transaction helper functions
 */
export class TransactionHelper {
  /**
   * Build transaction data
   */
  static buildTransactionData(
    to: string,
    value: string,
    data: string = '0x'
  ): {
    to: string;
    value: string;
    data: string;
  } {
    return {
      to,
      value: ethers.parseEther(value).toString(),
      data
    };
  }

  /**
   * Calculate transaction fee
   */
  static calculateTransactionFee(
    gasLimit: string,
    gasPrice: string
  ): string {
    const fee = BigInt(gasLimit) * BigInt(gasPrice);
    return ethers.formatEther(fee);
  }

  /**
   * Parse transaction receipt
   */
  static parseTransactionReceipt(receipt: ethers.TransactionReceipt): {
    success: boolean;
    gasUsed: string;
    effectiveGasPrice: string;
    transactionFee: string;
    logs: any[];
  } {
    const gasUsed = receipt.gasUsed.toString();
    const effectiveGasPrice = receipt.gasPrice?.toString() || '0';
    const transactionFee = ethers.formatEther(
      receipt.gasUsed * (receipt.gasPrice || 0n)
    );

    return {
      success: receipt.status === 1,
      gasUsed,
      effectiveGasPrice,
      transactionFee,
      logs: receipt.logs
    };
  }
}

/**
 * Event listener helper
 */
export class EventListener {
  private provider: ethers.JsonRpcProvider;
  private contracts: Map<string, ethers.Contract>;

  constructor(provider: ethers.JsonRpcProvider) {
    this.provider = provider;
    this.contracts = new Map();
  }

  /**
   * Add contract to listen to
   */
  addContract(name: string, contract: ethers.Contract): void {
    this.contracts.set(name, contract);
  }

  /**
   * Start listening to all events
   */
  startListening(callback: (event: any) => void): void {
    this.contracts.forEach((contract, name) => {
      contract.on('*', (event) => {
        callback({
          contractName: name,
          eventName: event.eventName,
          args: event.args,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          timestamp: Date.now()
        });
      });
    });
  }

  /**
   * Stop listening to all events
   */
  stopListening(): void {
    this.contracts.forEach((contract) => {
      contract.removeAllListeners();
    });
  }

  /**
   * Get past events
   */
  async getPastEvents(
    contractName: string,
    eventName: string,
    fromBlock: number,
    toBlock: number = -1
  ): Promise<any[]> {
    const contract = this.contracts.get(contractName);
    if (!contract) {
      throw new Error(`Contract ${contractName} not found`);
    }

    const filter = contract.filters[eventName]();
    return await contract.queryFilter(filter, fromBlock, toBlock);
  }
}

export default BlockchainUtils;