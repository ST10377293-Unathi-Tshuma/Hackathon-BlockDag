import { ethers } from "ethers"

// BlockDAG network configuration
export const BLOCKDAG_NETWORK = {
  chainId: "0x1f90", // 8080 in hex (example BlockDAG chain ID)
  chainName: "BlockDAG Network",
  nativeCurrency: {
    name: "BDAG",
    symbol: "BDAG",
    decimals: 18,
  },
  rpcUrls: ["https://rpc.blockdag.network"], // Mock RPC URL
  blockExplorerUrls: ["https://explorer.blockdag.network"],
}

// Smart contract addresses (mock addresses for demo)
export const CONTRACTS = {
  SAFERIDE_ESCROW: "0x1234567890123456789012345678901234567890",
  DRIVER_REGISTRY: "0x0987654321098765432109876543210987654321",
  RIDE_BOOKING: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
}

// Smart contract ABIs
export const ESCROW_ABI = [
  "function createEscrow(bytes32 rideId, address driver, uint256 amount) external payable",
  "function releasePayment(bytes32 rideId) external",
  "function refundPayment(bytes32 rideId) external",
  "function getEscrowStatus(bytes32 rideId) external view returns (uint8)",
  "event EscrowCreated(bytes32 indexed rideId, address indexed rider, address indexed driver, uint256 amount)",
  "event PaymentReleased(bytes32 indexed rideId, address indexed driver, uint256 amount)",
  "event PaymentRefunded(bytes32 indexed rideId, address indexed rider, uint256 amount)",
]

export const DRIVER_REGISTRY_ABI = [
  "function registerDriver(string memory name, string memory vehicleInfo, bytes32 documentHash) external",
  "function verifyDriver(address driver, uint8 verificationLevel) external",
  "function getDriverInfo(address driver) external view returns (string memory, string memory, uint8, bool)",
  "function isDriverVerified(address driver) external view returns (bool)",
  "event DriverRegistered(address indexed driver, string name, string vehicleInfo)",
  "event DriverVerified(address indexed driver, uint8 verificationLevel)",
]

export const RIDE_BOOKING_ABI = [
  "function createRide(string memory pickup, string memory destination, uint8 rideType, uint256 fare) external returns (bytes32)",
  "function acceptRide(bytes32 rideId) external",
  "function completeRide(bytes32 rideId) external",
  "function cancelRide(bytes32 rideId) external",
  "function getRideInfo(bytes32 rideId) external view returns (address, address, string memory, string memory, uint8, uint256, uint8)",
  "event RideCreated(bytes32 indexed rideId, address indexed rider, string pickup, string destination)",
  "event RideAccepted(bytes32 indexed rideId, address indexed driver)",
  "event RideCompleted(bytes32 indexed rideId)",
  "event RideCancelled(bytes32 indexed rideId)",
]

export class BlockchainService {
  private provider: ethers.BrowserProvider | null = null
  private signer: ethers.JsonRpcSigner | null = null

  isMetaMaskInstalled(): boolean {
    return typeof window !== "undefined" && typeof window.ethereum !== "undefined"
  }

  async connectWallet(): Promise<{ address: string; balance: string }> {
    if (!this.isMetaMaskInstalled()) {
      throw new Error("MetaMask is not installed. Please install MetaMask to use SafeRide.")
    }

    try {
      // Request account access
      await window.ethereum.request({ method: "eth_requestAccounts" })

      // Initialize provider and signer
      this.provider = new ethers.BrowserProvider(window.ethereum)
      this.signer = await this.provider.getSigner()

      // Get address and balance
      const address = await this.signer.getAddress()
      const balance = await this.provider.getBalance(address)

      // Switch to BlockDAG network if not already connected
      await this.switchToBlockDAG()

      return {
        address,
        balance: ethers.formatEther(balance),
      }
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error("User rejected the connection request")
      } else if (error.code === -32002) {
        throw new Error("Connection request already pending. Please check MetaMask.")
      } else {
        console.error("Wallet connection failed:", error)
        throw new Error(`Failed to connect wallet: ${error.message || "Unknown error"}`)
      }
    }
  }

  async switchToBlockDAG(): Promise<void> {
    if (!window.ethereum) return

    try {
      // Try to switch to BlockDAG network
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BLOCKDAG_NETWORK.chainId }],
      })
    } catch (switchError: any) {
      // If network doesn't exist, add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [BLOCKDAG_NETWORK],
        })
      } else {
        throw switchError
      }
    }
  }

  async registerDriver(name: string, vehicleInfo: string, documentHash: string): Promise<string> {
    if (!this.signer) throw new Error("Wallet not connected")

    const contract = new ethers.Contract(CONTRACTS.DRIVER_REGISTRY, DRIVER_REGISTRY_ABI, this.signer)

    const tx = await contract.registerDriver(name, vehicleInfo, documentHash)
    await tx.wait()

    return tx.hash
  }

  async createRideBooking(
    pickup: string,
    destination: string,
    rideType: number,
    fare: number,
  ): Promise<{ rideId: string; txHash: string }> {
    if (!this.signer) throw new Error("Wallet not connected")

    const contract = new ethers.Contract(CONTRACTS.RIDE_BOOKING, RIDE_BOOKING_ABI, this.signer)

    const fareWei = ethers.parseEther(fare.toString())
    const tx = await contract.createRide(pickup, destination, rideType, fareWei)
    const receipt = await tx.wait()

    // Extract ride ID from event logs
    const rideCreatedEvent = receipt.logs.find(
      (log: any) => log.topics[0] === ethers.id("RideCreated(bytes32,address,string,string)"),
    )

    const rideId = rideCreatedEvent?.topics[1] || ethers.id(`${pickup}-${destination}-${Date.now()}`)

    return {
      rideId,
      txHash: tx.hash,
    }
  }

  async createEscrow(rideId: string, driverAddress: string, amount: number): Promise<string> {
    if (!this.signer) throw new Error("Wallet not connected")

    const contract = new ethers.Contract(CONTRACTS.SAFERIDE_ESCROW, ESCROW_ABI, this.signer)

    const amountWei = ethers.parseEther(amount.toString())
    const rideIdBytes = ethers.id(rideId)

    const tx = await contract.createEscrow(rideIdBytes, driverAddress, amountWei, {
      value: amountWei,
    })

    await tx.wait()
    return tx.hash
  }

  async releasePayment(rideId: string): Promise<string> {
    if (!this.signer) throw new Error("Wallet not connected")

    const contract = new ethers.Contract(CONTRACTS.SAFERIDE_ESCROW, ESCROW_ABI, this.signer)

    const rideIdBytes = ethers.id(rideId)
    const tx = await contract.releasePayment(rideIdBytes)
    await tx.wait()

    return tx.hash
  }

  async getTransactionStatus(txHash: string): Promise<"pending" | "confirmed" | "failed"> {
    if (!this.provider) throw new Error("Provider not initialized")

    try {
      const receipt = await this.provider.getTransactionReceipt(txHash)
      if (!receipt) return "pending"
      return receipt.status === 1 ? "confirmed" : "failed"
    } catch (error) {
      return "failed"
    }
  }

  async estimateGas(contractAddress: string, abi: string[], methodName: string, params: any[]): Promise<string> {
    if (!this.signer) throw new Error("Wallet not connected")

    const contract = new ethers.Contract(contractAddress, abi, this.signer)
    const gasEstimate = await contract[methodName].estimateGas(...params)

    return ethers.formatUnits(gasEstimate, "gwei")
  }

  // Utility function to generate document hash for driver verification
  generateDocumentHash(files: File[]): Promise<string> {
    return new Promise((resolve) => {
      const fileNames = files.map((f) => f.name).join(",")
      const fileSizes = files.map((f) => f.size).join(",")
      const timestamp = Date.now().toString()
      const combined = `${fileNames}-${fileSizes}-${timestamp}`

      // Simple hash simulation (in production, use proper hashing)
      const hash = ethers.id(combined)
      resolve(hash)
    })
  }

  disconnect(): void {
    this.provider = null
    this.signer = null
  }
}

// Global blockchain service instance
export const blockchainService = new BlockchainService()

// Utility functions
export const formatAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export const formatBalance = (balance: string): string => {
  const num = Number.parseFloat(balance)
  return num.toFixed(4)
}

export const generateRideId = (pickup: string, destination: string): string => {
  return `SR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Type definitions for blockchain interactions
export interface WalletInfo {
  address: string
  balance: string
  isConnected: boolean
}

export interface RideTransaction {
  rideId: string
  txHash: string
  status: "pending" | "confirmed" | "failed"
  amount: number
  timestamp: number
}

export interface DriverVerification {
  address: string
  name: string
  vehicleInfo: string
  verificationLevel: number
  isVerified: boolean
  documentHash: string
}
