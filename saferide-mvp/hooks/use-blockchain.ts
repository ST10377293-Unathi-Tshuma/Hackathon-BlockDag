"use client"

import { useState, useEffect, useCallback } from "react"
import { blockchainService, type WalletInfo, type RideTransaction } from "@/lib/blockchain"

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] | object[] }) => Promise<any>
      isMetaMask?: boolean
    }
  }
}

export function useBlockchain() {
  const [walletInfo, setWalletInfo] = useState<WalletInfo>({
    address: "",
    balance: "0",
    isConnected: false,
  })
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const networkParams = {
    chainId: "0x413", // 1043 decimal → hex
    chainName: "Primordial",
    nativeCurrency: { name: "BlockDAG Test Token", symbol: "BDT", decimals: 18 },
    rpcUrls: ["https://rpc.primordial.bdagscan.com"],
    blockExplorerUrls: ["https://primordial.bdagscan.com"],
  }

  // Check if wallet is already connected on mount
  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" })
        if (accounts.length > 0) {
          await ensureCorrectNetwork()
          const { address, balance } = await blockchainService.connectWallet()
          setWalletInfo({ address, balance, isConnected: true })
        }
      } catch (err: any) {
        console.log("Initial connection check failed:", err.message)
      }
    }
  }

  // Ensure wallet is on the correct network
  const ensureCorrectNetwork = async () => {
    if (!window.ethereum) throw new Error("MetaMask/MaskWolf is not installed")

    const currentChainId = await window.ethereum.request({ method: "eth_chainId" })
    if (currentChainId === networkParams.chainId) return // already correct

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: networkParams.chainId }],
      })
    } catch (switchError: any) {
      // Only attempt to add network if error code = 4902 (network not found)
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [networkParams],
        })
      } else {
        throw switchError
      }
    }
  }

  const connectWallet = useCallback(async () => {
    setIsConnecting(true)
    setError(null)

    try {
      if (!window.ethereum) {
        throw new Error("MetaMask/MaskWolf is not installed")
      }

      await switchToPrimordialNetwork()

      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" })
      const address = accounts[0]
      // Use connectWallet to get balance if getBalance does not exist
      const { balance } = await blockchainService.connectWallet()

      setWalletInfo({ address, balance, isConnected: true })
    } catch (error: any) {
      const errorMessage = error.message || "Failed to connect wallet"
      setError(errorMessage)
      console.error("Wallet connection error:", errorMessage)
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const switchToPrimordialNetwork = async () => {
    if (!window.ethereum) throw new Error("MetaMask/MaskWolf not installed")

    const currentChainId = await window.ethereum.request({ method: "eth_chainId" })
    if (currentChainId === networkParams.chainId) return

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: networkParams.chainId }],
      })
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [networkParams],
        })
      } else {
        throw switchError
      }
    }
  }

  const disconnectWallet = useCallback(() => {
    blockchainService.disconnect()
    setWalletInfo({ address: "", balance: "0", isConnected: false })
    setError(null)
  }, [])

  const createRideBooking = useCallback(
    async (pickup: string, destination: string, rideType: number, fare: number): Promise<RideTransaction> => {
      if (!walletInfo.isConnected) throw new Error("Wallet not connected")
      try {
        const { rideId, txHash } = await blockchainService.createRideBooking(pickup, destination, rideType, fare)
        return { rideId, txHash, status: "pending", amount: fare, timestamp: Date.now() }
      } catch (err: any) {
        setError(err.message || "Failed to create ride booking")
        throw err
      }
    },
    [walletInfo.isConnected],
  )

  const createEscrowPayment = useCallback(
    async (rideId: string, driverAddress: string, amount: number): Promise<string> => {
      if (!walletInfo.isConnected) throw new Error("Wallet not connected")
      try {
        return await blockchainService.createEscrow(rideId, driverAddress, amount)
      } catch (err: any) {
        setError(err.message || "Failed to create escrow payment")
        throw err
      }
    },
    [walletInfo.isConnected],
  )

  const registerDriver = useCallback(
    async (name: string, vehicleInfo: string, documents: File[]): Promise<string> => {
      if (!walletInfo.isConnected) throw new Error("Wallet not connected")
      try {
        const documentHash = await blockchainService.generateDocumentHash(documents)
        return await blockchainService.registerDriver(name, vehicleInfo, documentHash)
      } catch (err: any) {
        setError(err.message || "Failed to register driver")
        throw err
      }
    },
    [walletInfo.isConnected],
  )

  return {
    walletInfo,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    createRideBooking,
    createEscrowPayment,
    registerDriver,
    clearError: () => setError(null),
  }
}
