"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Shield,
  MapPin,
  Navigation,
  Car,
  Clock,
  Star,
  Wallet,
  Search,
  Users,
  Zap,
  Crown,
  CheckCircle,
  ArrowLeft,
  AlertCircle,
  ExternalLink,
  Crosshair,
  Loader2,
  Phone,
  MessageCircle,
  Home,
  LogOut,
} from "lucide-react"
import Link from "next/link"
import { useBlockchain } from "@/hooks/use-blockchain"
import { formatAddress } from "@/lib/blockchain"
import { ApiService } from "@/lib/api"
import { RideOption, Driver, BookingRequest } from "@/lib/types"
import { useAuth } from "@/lib/auth-context"
import { useApiState } from "@/hooks/useApiState"
import ErrorDisplay from "@/components/ErrorDisplay"
import LoadingState from "@/components/LoadingState"
import { withErrorBoundary } from "@/components/ErrorBoundary"

// Types are now imported from @/lib/types

// API service instance
const apiService = new ApiService()

function RideBooking() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, logout } = useAuth()

  // State for API data
  const [rideOptions, setRideOptions] = useState<RideOption[]>([])
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([])

  // Debug logging
  useEffect(() => {
    console.log('rideOptions:', rideOptions)
    console.log('availableDrivers:', availableDrivers)
  }, [rideOptions, availableDrivers])

  const {
    loading: optionsLoading,
    error: optionsError,
    execute: loadRideOptions,
    retry: retryOptions
  } = useApiState()

  const {
    loading: driversLoading,
    error: driversError,
    execute: searchDriversApi,
    retry: retryDrivers
  } = useApiState()

  const {
    loading: bookingLoading,
    error: bookingError,
    execute: createBookingApi,
    retry: retryBooking
  } = useApiState()

  const [currentStep, setCurrentStep] = useState<"location" | "options" | "drivers" | "booking" | "confirmed">(
    "location",
  )
  const [pickup, setPickup] = useState("")
  const [destination, setDestination] = useState("")
  const [selectedRide, setSelectedRide] = useState<RideOption | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isBooking, setIsBooking] = useState(false)
  const [bookingId, setBookingId] = useState("")
  const [transactionHash, setTransactionHash] = useState("")
  const [escrowHash, setEscrowHash] = useState("")
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [locationError, setLocationError] = useState("")

  // Fallback dummy data in case API fails
  const fallbackRideOptions: RideOption[] = [
    {
      id: "economy",
      name: "Economy",
      description: "Affordable rides for everyday travel",
      estimatedTime: "5-10 min",
      capacity: 4,
      price: 12.50,
      type: "standard",
      features: ["Air conditioning", "Clean vehicle", "Professional driver"]
    },
    {
      id: "premium",
      name: "Premium",
      description: "Comfortable rides with extra amenities",
      estimatedTime: "3-7 min",
      capacity: 4,
      price: 18.75,
      type: "premium",
      features: ["Premium vehicle", "Free WiFi", "Bottled water", "Phone charger"]
    },
    {
      id: "shared",
      name: "Shared Ride",
      description: "Share your ride and save money",
      estimatedTime: "8-15 min",
      capacity: 6,
      price: 8.25,
      type: "shared",
      features: ["Shared vehicle", "Eco-friendly", "Lower cost"]
    }
  ]

  const fallbackDrivers: Driver[] = [
    {
      id: "James Bond",
      user_id: "user_1",
      license_number: "LIC000001",
      vehicle_info: {
        make: "Toyota",
        model: "Camry",
        year: 2022,
        color: "Silver",
        plate_number: "ABC001"
      },
      verification_status: "verified",
      rating: 4.8,
      total_rides: 1250,
      created_at: "2023-01-15T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
      avatar: "/avatars/driver1.png"
    },
    {
      id: "Thomas Green",
      user_id: "user_2",
      license_number: "LIC000002",
      vehicle_info: {
        make: "Honda",
        model: "Civic",
        year: 2021,
        color: "Blue",
        plate_number: "ABC002"
      },
      verification_status: "verified",
      rating: 4.9,
      total_rides: 890,
      created_at: "2023-03-20T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
      avatar: "/avatars/driver2.png"
    },
    {
      id: "Lorraine Khumalo",
      user_id: "user_3",
      license_number: "LIC000003",
      vehicle_info: {
        make: "Ford",
        model: "Focus",
        year: 2023,
        color: "White",
        plate_number: "ABC003"
      },
      verification_status: "pending",
      rating: 4.7,
      total_rides: 567,
      created_at: "2023-06-10T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
      avatar: "/avatars/driver3.png"
    }
  ]

  const {
    walletInfo,
    isConnecting,
    error: blockchainError,
    connectWallet,
    disconnectWallet,
    createRideBooking,
    createEscrowPayment,
    clearError,
  } = useBlockchain()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login')
    }
  }, [isAuthenticated, isLoading, router])

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  // Don't render if not authenticated
  if (!isAuthenticated || !user) {
    return null
  }

  const handleLocationSubmit = async () => {
    if (pickup && destination) {
      const result = await loadRideOptions(async () => {
        // Set authentication token for API requests
        const token = localStorage.getItem('token')
        if (token) {
          apiService.setAuthToken(token)
        }

        // Fetch available ride options from backend
        return await apiService.getRideOptions({
          pickup,
          destination,
          rideType: 'all'
        })
      })

      if (Array.isArray(result)) {
        setRideOptions(result)
        setCurrentStep("options")
      } else {
        // Use fallback data if API fails
        setRideOptions(fallbackRideOptions)
        setCurrentStep("options")
      }
    }
  }

  const handleRideSelection = async (ride: RideOption) => {
    setSelectedRide(ride)
    setCurrentStep("drivers")

    const result = await searchDriversApi(async () => {
      // Set authentication token for API requests
      const token = localStorage.getItem('token')
      if (token) {
        apiService.setAuthToken(token)
      }

      // Search for available drivers
      return await apiService.searchDrivers({
        pickup,
        destination,
        rideType: ride.id,
        maxDrivers: 5
      })
    })

    if (Array.isArray(result)) {
      setAvailableDrivers(result)
    } else {
      // Use fallback data if API fails
      setAvailableDrivers(fallbackDrivers)
    }
  }

  const handleDriverSelection = (driver: Driver) => {
    setSelectedDriver(driver)
    setCurrentStep("booking")
  }

  // Inside the RideBooking function, add this function before the return statement
  const handleNextStep = async () => {
    switch (currentStep) {
      case "location":
        if (!pickup || !destination) {
          alert("Please enter both pickup and destination locations.");
          return;
        }
        await handleLocationSubmit(); // Calls API to fetch ride options and sets step to "options"
        break;

      case "options":
        if (!selectedRide) {
          alert("Please select a ride option.");
          return;
        }
        await handleRideSelection(selectedRide); // Calls API to fetch drivers and sets step to "drivers"
        break;

      case "drivers":
        if (!selectedDriver) {
          alert("Please select a driver.");
          return;
        }
        handleDriverSelection(selectedDriver); // Sets step to "booking"
        break;

      case "booking":
        if (!walletInfo.isConnected) {
          alert("Please connect your wallet to confirm the booking.");
          return;
        }
        await handleBookingConfirm(); // Processes booking and sets step to "confirmed"
        break;

      case "confirmed":
        // No next step after confirmation; optionally redirect to home or reset
        router.push("/");
        break;

      default:
        console.error("Unknown step:", currentStep);
    }
  };

  const handleBookingConfirm = async () => {
    if (!selectedRide || !selectedDriver) return

    clearError()

    // Use mock data for demonstration
    await createBookingApi(async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Mock booking data
      const mockBookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const mockTransactionHash = `0x${Math.random().toString(36).substr(2, 40)}`
      const mockEscrowHash = `0x${Math.random().toString(36).substr(2, 40)}`

      console.log('Using mock booking data for demonstration')
      console.log('Mock booking ID:', mockBookingId)
      console.log('Mock transaction hash:', mockTransactionHash)

      // Set mock data
      setBookingId(mockBookingId)
      setTransactionHash(mockTransactionHash)
      setEscrowHash(mockEscrowHash)

      // Move to confirmed step
      setCurrentStep("confirmed")
      
      // Automatically navigate to dashboard after 3 seconds
      setTimeout(() => {
        router.push('/dashboard')
      }, 3000)
      
      return {
        success: true,
        data: {
          bookingId: mockBookingId,
          status: 'confirmed',
          message: 'Mock booking created successfully'
        }
      }
    })
  }



  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.")
      return
    }

    setIsGettingLocation(true)
    setLocationError("")

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords

        try {
          // Mock reverse geocoding - in a real app, you'd use a geocoding service
          const mockAddress = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`

          // Simulate API call delay
          await new Promise((resolve) => setTimeout(resolve, 1000))

          // For demo purposes, use a readable address
          const readableAddress = "Current Location (123 Main St, City, State)"
          setPickup(readableAddress)
          setLocationError("")
        } catch (error) {
          setLocationError("Failed to get address for your location.")
        } finally {
          setIsGettingLocation(false)
        }
      },
      (error) => {
        setIsGettingLocation(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location access denied. Please enable location permissions.")
            break
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information is unavailable.")
            break
          case error.TIMEOUT:
            setLocationError("Location request timed out.")
            break
          default:
            setLocationError("An unknown error occurred while getting location.")
            break
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      },
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">SafeRide</span>
            </Link>

            <div className="flex items-center gap-2">
              {walletInfo.isConnected ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 hidden sm:flex">
                    <Wallet className="w-3 h-3 mr-1" />
                    {formatAddress(walletInfo.address)}
                  </Badge>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 sm:hidden">
                    <Wallet className="w-3 h-3 mr-1" />
                    {walletInfo.address.slice(0, 4)}...
                  </Badge>
                  <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                    {Number.parseFloat(walletInfo.balance).toFixed(4)} BDAG
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={disconnectWallet}
                    className="hidden sm:inline-flex bg-transparent"
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="bg-primary hover:bg-primary/90 text-sm sm:text-base"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">{isConnecting ? "Connecting..." : "Connect Wallet"}</span>
                  <span className="sm:hidden">{isConnecting ? "..." : "Connect"}</span>
                </Button>
              )}
              <Button onClick={logout} size="sm" variant="outline" className="bg-transparent">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-2xl">
        {blockchainError && (
          <ErrorDisplay
            variant="alert"
            title="Blockchain Error"
            description={blockchainError}
            onDismiss={clearError}
            className="mb-6" error={null} />
        )}

        {(optionsError || driversError || bookingError) && (
          <ErrorDisplay
            variant="alert"
            title="API Error"
            description={optionsError || driversError || bookingError || 'An error occurred'}
            onRetry={() => {
              if (optionsError) loadRideOptions(async () => {
                // Set authentication token for API requests
                const token = localStorage.getItem('token')
                if (token) {
                  apiService.setAuthToken(token)
                }
                // Fetch available ride options from backend
                return await apiService.getRideOptions({
                  pickup,
                  destination,
                  rideType: 'all'
                })
              })
              if (driversError) searchDriversApi(async () => {
                // Set authentication token for API requests
                const token = localStorage.getItem('token')
                if (token) {
                  apiService.setAuthToken(token)
                }
                // Search for available drivers
                return await apiService.searchDrivers({
                  pickup,
                  destination,
                  rideType: selectedRide?.id || '',
                  maxDrivers: 5
                })
              })
              if (bookingError) createBookingApi(async () => {
                // Set authentication token for API requests
                const token = localStorage.getItem('token')
                if (token) {
                  apiService.setAuthToken(token)
                }
                // Create booking request
                const bookingRequest: BookingRequest = {
                  pickup,
                  destination,
                  rideType: selectedRide?.id || '',
                  driverId: selectedDriver?.id || '',
                  fare: (selectedRide?.price ?? 0) + 1.5,
                  paymentMethod: 'blockchain',
                  walletAddress: walletInfo.address,
                  userId: user.id,
                  passengerCount: 0
                }
                // Create ride booking via API
                return await apiService.createRideBooking(bookingRequest)
              })
            }}
            className="mb-6" error={null} />
        )}

        {locationError && (
          <Alert className="mb-6 border-orange-500/50 text-orange-600">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {locationError}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocationError("")}
                className="ml-2 h-auto p-0 text-orange-600 hover:text-orange-600/80"
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Wallet connection alert removed for mock data demonstration */}

        {/* Location Input Step */}
        {currentStep === "location" && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <MapPin className="w-5 h-5 text-primary" />
                Where to?
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Enter your pickup location and destination to get started.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pickup" className="text-sm font-medium">
                  Pickup Location
                </Label>
                <div className="space-y-2">
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="pickup"
                      placeholder="Enter pickup address"
                      value={pickup}
                      onChange={(e) => setPickup(e.target.value)}
                      className="pl-10 h-12 text-base"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={getCurrentLocation}
                    disabled={isGettingLocation}
                    className="w-full sm:w-auto bg-transparent hover:bg-primary/5 border-primary/20 text-primary hover:text-primary"
                  >
                    {isGettingLocation ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Getting Location...
                      </>
                    ) : (
                      <>
                        <Crosshair className="w-4 h-4 mr-2" />
                        Use Current Location
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination" className="text-sm font-medium">
                  Destination
                </Label>
                <div className="relative">
                  <Navigation className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="destination"
                    placeholder="Enter destination address"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="pl-10 h-12 text-base"
                  />
                </div>
              </div>

              <Button
                onClick={handleLocationSubmit}
                disabled={!pickup || !destination || optionsLoading}
                className="w-full bg-primary hover:bg-primary/90 h-12 text-base transition-all duration-200 hover:scale-[1.02]"
              >
                {optionsLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Finding Rides...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Find Rides
                  </>
                )}
              </Button>



              {/* Mock Map Placeholder */}
              <div className="h-40 sm:h-48 bg-muted/30 rounded-lg flex items-center justify-center border border-border">
                <div className="text-center">
                  <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Interactive map will appear here</p>
                  <p className="text-xs text-muted-foreground">Showing pickup and destination</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ride Options Step */}
        {currentStep === "options" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentStep("location")} className="p-2">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-foreground">Choose Your Ride</h2>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {pickup} → {destination}
                </p>
              </div>
            </div>

            {optionsLoading ? (
              <LoadingState
                variant="card"
                message="Finding the best rides for your route..."
                className="shadow-lg"
              />
            ) : rideOptions.length === 0 ? (
              <Card className="shadow-lg">
                <CardContent className="p-6 sm:p-8 text-center">
                  <div className="w-12 h-12 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 text-sm sm:text-base">No Rides Available</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                    No ride options found for this route. Please try again.
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleLocationSubmit}
                    className="bg-transparent"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Search Again
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {(rideOptions || []).map((option) => (
                  <Card
                    key={option.id}
                    className="cursor-pointer hover:border-primary/50 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                    onClick={() => handleRideSelection(option)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Users className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground text-sm sm:text-base">{option.name}</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground">{option.description}</p>
                            <div className="flex items-center gap-3 sm:gap-4 mt-1">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {option.estimatedTime}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {option.capacity} seats
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <div className="text-base sm:text-lg font-bold text-foreground">${option.price}</div>
                          <div className="text-xs text-muted-foreground">Estimated</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Driver Selection Step */}
        {currentStep === "drivers" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentStep("options")} className="p-2">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-foreground">Available Drivers</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {selectedRide?.name} • Anonymous profiles for privacy
                </p>
              </div>
            </div>

            {driversLoading ? (
              <LoadingState
                variant="card"
                message="Matching you with verified drivers in your area..."
                className="shadow-lg"
              />
            ) : availableDrivers.length === 0 ? (
              <Card className="shadow-lg">
                <CardContent className="p-6 sm:p-8 text-center">
                  <div className="w-12 h-12 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 text-sm sm:text-base">No Drivers Available</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                    No drivers found in your area. Please try again later.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => handleRideSelection(selectedRide!)}
                    className="bg-transparent"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Search Again
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {(availableDrivers || []).map((driver) => (
                  <Card
                    key={driver.id}
                    className="cursor-pointer hover:border-primary/50 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                    onClick={() => handleDriverSelection(driver)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Avatar className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
                            <AvatarImage src={driver.avatar || "/placeholder.svg"} alt={`Driver ${driver.id}`} />
                            <AvatarFallback>
                              {`D${driver.id}`}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold text-foreground text-sm sm:text-base">Driver {driver.id}</h3>
                              <Badge variant={driver.verification_status === 'verified' ? 'default' : 'secondary'}>
                                {driver.verification_status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 mb-1">
                              <Star className="w-3 h-3 sm:w-4 sm:h-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-xs sm:text-sm font-medium">{driver.rating}</span>
                              <span className="text-xs sm:text-sm text-muted-foreground">
                                ({driver.total_rides} rides)
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">{driver.vehicle_info.make} {driver.vehicle_info.model}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <div className="text-sm sm:text-lg font-bold text-primary">5-10 min</div>
                          <div className="text-xs text-muted-foreground">away</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Booking Confirmation Step */}
        {currentStep === "booking" && selectedRide && selectedDriver && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentStep("drivers")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h2 className="text-xl font-bold text-foreground">Confirm Your Ride</h2>
                <p className="text-sm text-muted-foreground">Review details before booking</p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Trip Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">From:</span>
                    <span className="font-medium">{pickup}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Navigation className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">To:</span>
                    <span className="font-medium">{destination}</span>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback>
                        Driver {selectedDriver.id}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Driver {selectedDriver.id}</span>
                        <Badge variant={selectedDriver.verification_status === 'verified' ? 'default' : 'secondary'}>
                          {selectedDriver.verification_status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm">{selectedDriver.rating}</span>
                        <span className="text-sm text-muted-foreground">• {selectedDriver.vehicle_info.make} {selectedDriver.vehicle_info.model}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-primary">5-10 min</div>
                    <div className="text-xs text-muted-foreground">arrival</div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ride Type:</span>
                    <span className="font-medium">{selectedRide.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Fare:</span>
                    <span className="font-medium">${selectedRide.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform Fee:</span>
                    <span className="font-medium">$1.50</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-primary">${(selectedRide.price + 1.5).toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Mock Payment System</p>
                      <p className="text-sm text-muted-foreground mb-2">
                        Using mock data for demonstration purposes
                      </p>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Payment Method:</span>
                          <span>Mock Payment</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <span className="text-green-600">Ready</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Network:</span>
                          <span>Demo Mode</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleBookingConfirm}
                  disabled={bookingLoading}
                  className="w-full bg-primary hover:bg-primary/90"
                  size="lg"
                >
                  {bookingLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                      Processing Booking...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirm Booking - ${(selectedRide.price + 1.5).toFixed(2)}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Booking Confirmed Step */}
        {currentStep === "confirmed" && selectedDriver && (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Ride Confirmed!</h2>
                <p className="text-muted-foreground mb-4">
                  Your ride has been booked successfully (mock data). Booking ID:{" "}
                  <span className="font-mono font-medium">{bookingId}</span>
                </p>
                <p className="text-sm text-primary mb-4">
                  You'll be redirected to your dashboard in a few seconds...
                </p>

                <div className="bg-muted/30 rounded-lg p-4 mb-6 space-y-3">
                  <h4 className="font-medium text-foreground">Mock Transactions</h4>

                  {transactionHash && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Ride Booking:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{formatAddress(transactionHash)}</span>
                        <Button variant="ghost" size="sm" className="h-auto p-0" asChild>
                          <a
                            href={`https://explorer.blockdag.network/tx/${transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}

                  {escrowHash && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Escrow Payment:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{formatAddress(escrowHash)}</span>
                        <Button variant="ghost" size="sm" className="h-auto p-0" asChild>
                          <a
                            href={`https://explorer.blockdag.network/tx/${escrowHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-muted/30 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback>
                          Driver {selectedDriver.id}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Driver {selectedDriver.id}</span>
                          <Badge variant={selectedDriver.verification_status === 'verified' ? 'default' : 'secondary'}>
                            {selectedDriver.verification_status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium">{selectedDriver.rating}</span>
                          <span className="text-sm text-muted-foreground">• {selectedDriver.vehicle_info.make} {selectedDriver.vehicle_info.model}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary">5-10 min</div>
                      <div className="text-xs text-muted-foreground">away</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button className="w-full bg-primary hover:bg-primary/90">
                      <MapPin className="w-4 h-4 mr-2" />
                      Track Driver
                    </Button>
                    <Button variant="outline" className="w-full bg-transparent">
                      Contact Driver
                    </Button>
                    <Button variant="default" asChild className="w-full bg-secondary hover:bg-secondary/80">
                      <Link href="/dashboard">
                        <Home className="w-4 h-4 mr-2" />
                        Go to Dashboard
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

export default withErrorBoundary(RideBooking)
