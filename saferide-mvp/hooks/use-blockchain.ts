"use client"

import { useState, useEffect, useCallback } from "react"
import { blockchainService, type WalletInfo, type RideTransaction } from "@/lib/blockchain"

export function useBlockchain() {
  const [walletInfo, setWalletInfo] = useState<WalletInfo>({
    address: "",
    balance: "0",
    isConnected: false,
  })
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if wallet is already connected on mount
  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" })
        if (accounts.length > 0) {
          const { address, balance } = await blockchainService.connectWallet()
          setWalletInfo({
            address,
            balance,
            isConnected: true,
          })
        }
      } catch (error: any) {
        console.log("Initial connection check failed:", error.message)
        // Don't set error state for initial check failures
      }
    }
  }

  const connectWallet = useCallback(async () => {
    setIsConnecting(true)
    setError(null)

    try {
      if (!blockchainService.isMetaMaskInstalled()) {
        throw new Error("MetaMask is not installed. Please install MetaMask to use SafeRide.")
      }

      const { address, balance } = await blockchainService.connectWallet()
      setWalletInfo({
        address,
        balance,
        isConnected: true,
      })
    } catch (error: any) {
      const errorMessage = error.message || "Failed to connect wallet"
      setError(errorMessage)
      console.error("Wallet connection error:", errorMessage)
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const disconnectWallet = useCallback(() => {
    blockchainService.disconnect()
    setWalletInfo({
      address: "",
      balance: "0",
      isConnected: false,
    })
    setError(null)
  }, [])

  const createRideBooking = useCallback(
    async (pickup: string, destination: string, rideType: number, fare: number): Promise<RideTransaction> => {
      if (!walletInfo.isConnected) {
        throw new Error("Wallet not connected")
      }

      try {
        const { rideId, txHash } = await blockchainService.createRideBooking(pickup, destination, rideType, fare)

        return {
          rideId,
          txHash,
          status: "pending",
          amount: fare,
          timestamp: Date.now(),
        }
      } catch (error: any) {
        setError(error.message || "Failed to create ride booking")
        throw error
      }
    },
    [walletInfo.isConnected],
  )

  const createEscrowPayment = useCallback(
    async (rideId: string, driverAddress: string, amount: number): Promise<string> => {
      if (!walletInfo.isConnected) {
        throw new Error("Wallet not connected")
      }

      try {
        return await blockchainService.createEscrow(rideId, driverAddress, amount)
      } catch (error: any) {
        setError(error.message || "Failed to create escrow payment")
        throw error
      }
    },
    [walletInfo.isConnected],
  )

  const registerDriver = useCallback(
    async (name: string, vehicleInfo: string, documents: File[]): Promise<string> => {
      if (!walletInfo.isConnected) {
        throw new Error("Wallet not connected")
      }

      try {
        const documentHash = await blockchainService.generateDocumentHash(documents)
        return await blockchainService.registerDriver(name, vehicleInfo, documentHash)
      } catch (error: any) {
        setError(error.message || "Failed to register driver")
        throw error
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
