"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Shield,
  Car,
  Wallet,
  MapPin,
  Clock,
  Star,
  Search,
  Download,
  Navigation,
  Phone,
  MessageCircle,
  CheckCircle,
  AlertCircle,
  Calendar,
  Route,
  User,
  Loader2,
  LogOut,
} from "lucide-react"
import Link from "next/link"
import { ApiService } from "@/lib/api"
import type { Ride as ApiRide, ApiResponse } from "@/lib/types"
import { useAuth } from "@/lib/auth-context"
import { useApiState } from "@/hooks/useApiState"
import ErrorDisplay from "@/components/ErrorDisplay"
import LoadingState from "@/components/LoadingState"
import { withErrorBoundary } from "@/components/ErrorBoundary"

// Updated Ride interface to match ApiRide
interface Ride {
  id: string
  date: string
  time: string
  from: string
  to: string
  distance: string
  duration: string
  cost: number
  status: "completed" | "cancelled" | "in_progress" | "scheduled"
  driver?: {
    id: string
    name: string
    rating: number
    avatar: string
    vehicle: string
    licensePlate: string
  }
  passenger?: {
    id: string
    name: string
    rating: number
    avatar: string
  }
  rating?: number
  paymentMethod: string
  rideType: string
  route?: Array<{ lat: number; lng: number; name: string }>
}

function RideHistoryAndTracking() {
  const router = useRouter()
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth()
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState("")
  const [activeTab, setActiveTab] = useState("history")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null)
  const [rides, setRides] = useState<Ride[]>([])

  const apiService = new ApiService()
  
  // API state management for ride history
  const {
    loading: ridesLoading,
    error: ridesError,
    execute: loadRideHistory
  } = useApiState<Ride[]>()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login')
    }
  }, [authLoading, isAuthenticated, router])

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <LoadingState variant="card" message="Authenticating..." />
      </div>
    )
  }

  // Don't render if not authenticated
  if (!isAuthenticated || !user) {
    return null
  }

  // Mock ride data as fallback
  const mockRides: Ride[] = [
    {
      id: "R-2024-001",
      date: "2024-12-20",
      time: "6:30 PM",
      from: "Downtown Office Building",
      to: "Home - Residential Area",
      distance: "8.2 km",
      duration: "22 min",
      cost: 15.5,
      status: "in_progress",
      driver: {
        id: "D-001",
        name: "Anonymous Driver #A7B2",
        rating: 4.9,
        avatar: "/professional-driver-avatar.png",
        vehicle: "Toyota Camry 2022",
        licensePlate: "ABC123",
      },
      paymentMethod: "Blockchain Wallet",
      rideType: "Economy",
      route: [
        { lat: 40.7128, lng: -74.006, name: "Downtown Office Building" },
        { lat: 40.7589, lng: -73.9851, name: "Midtown" },
        { lat: 40.7831, lng: -73.9712, name: "Home - Residential Area" },
      ],
    },
    {
      id: "R-2024-002",
      date: "2024-12-19",
      time: "2:15 PM",
      from: "Airport Terminal 2",
      to: "Hotel District",
      distance: "12.4 km",
      duration: "35 min",
      cost: 28.75,
      status: "completed",
      driver: {
        id: "D-002",
        name: "Anonymous Driver #C9D4",
        rating: 4.8,
        avatar: "/friendly-driver-avatar.png",
        vehicle: "Honda Accord 2021",
        licensePlate: "XYZ789",
      },
      rating: 5,
      paymentMethod: "Blockchain Wallet",
      rideType: "Premium",
    },
    {
      id: "R-2024-003",
      date: "2024-12-18",
      time: "7:45 PM",
      from: "Shopping Mall",
      to: "Restaurant District",
      distance: "5.1 km",
      duration: "18 min",
      cost: 12.25,
      status: "completed",
      driver: {
        id: "D-003",
        name: "Anonymous Driver #E1F6",
        rating: 4.7,
        avatar: "/reliable-driver-avatar.png",
        vehicle: "Nissan Altima 2023",
        licensePlate: "DEF456",
      },
      rating: 4,
      paymentMethod: "Blockchain Wallet",
      rideType: "Economy",
    },
    {
      id: "R-2024-004",
      date: "2024-12-17",
      time: "9:30 AM",
      from: "Home",
      to: "Medical Center",
      distance: "6.8 km",
      duration: "25 min",
      cost: 18.0,
      status: "cancelled",
      paymentMethod: "Blockchain Wallet",
      rideType: "Express",
    },
    {
      id: "R-2024-005",
      date: "2024-12-25",
      time: "3:00 PM",
      from: "Home",
      to: "Family Gathering",
      distance: "15.2 km",
      duration: "40 min",
      cost: 32.5,
      status: "scheduled",
      paymentMethod: "Blockchain Wallet",
      rideType: "Premium",
    },
    {
      id: "R-2024-006",
      date: "2024-12-15",
      time: "8:00 AM",
      from: "Suburban Park",
      to: "City Center",
      distance: "10.5 km",
      duration: "28 min",
      cost: 22.0,
      status: "completed",
      driver: {
        id: "D-004",
        name: "Anonymous Driver #G2H8",
        rating: 4.6,
        avatar: "/experienced-driver-avatar.png",
        vehicle: "Ford Escape 2020",
        licensePlate: "GHI789",
      },
      rating: 3,
      paymentMethod: "Blockchain Wallet",
      rideType: "Economy",
      route: [
        { lat: 40.7359, lng: -73.9911, name: "Suburban Park" },
        { lat: 40.7484, lng: -73.9857, name: "City Center" },
      ],
    },
    {
      id: "R-2024-007",
      date: "2024-12-14",
      time: "4:20 PM",
      from: "Train Station",
      to: "University Campus",
      distance: "7.3 km",
      duration: "20 min",
      cost: 16.8,
      status: "completed",
      driver: {
        id: "D-005",
        name: "Anonymous Driver #J4K9",
        rating: 4.9,
        avatar: "/courteous-driver-avatar.png",
        vehicle: "Tesla Model 3 2023",
        licensePlate: "JKL012",
      },
      rating: 5,
      paymentMethod: "Blockchain Wallet",
      rideType: "Premium",
    },
    {
      id: "R-2024-008",
      date: "2024-12-13",
      time: "11:45 AM",
      from: "Library",
      to: "Coffee Shop",
      distance: "3.8 km",
      duration: "15 min",
      cost: 10.0,
      status: "completed",
      driver: {
        id: "D-006",
        name: "Anonymous Driver #M7N2",
        rating: 4.5,
        avatar: "/friendly-driver-avatar.png",
        vehicle: "Hyundai Elantra 2021",
        licensePlate: "MNO345",
      },
      rating: 4,
      paymentMethod: "Blockchain Wallet",
      rideType: "Economy",
    },
    {
      id: "R-2024-009",
      date: "2024-12-12",
      time: "6:15 PM",
      from: "Gym",
      to: "Apartment Complex",
      distance: "9.1 km",
      duration: "24 min",
      cost: 19.5,
      status: "cancelled",
      paymentMethod: "Blockchain Wallet",
      rideType: "Express",
    },
    {
      id: "R-2024-010",
      date: "2024-12-26",
      time: "10:00 AM",
      from: "Hotel Lobby",
      to: "Convention Center",
      distance: "4.5 km",
      duration: "17 min",
      cost: 14.0,
      status: "scheduled",
      paymentMethod: "Blockchain Wallet",
      rideType: "Premium",
      route: [
        { lat: 40.7577, lng: -73.9857, name: "Hotel Lobby" },
        { lat: 40.7505, lng: -73.9934, name: "Convention Center" },
      ],
    },
    {
      id: "R-2024-011",
      date: "2024-12-10",
      time: "1:30 PM",
      from: "Shopping Plaza",
      to: "Movie Theater",
      distance: "6.2 km",
      duration: "19 min",
      cost: 13.75,
      status: "completed",
      driver: {
        id: "D-007",
        name: "Anonymous Driver #P8Q3",
        rating: 4.8,
        avatar: "/reliable-driver-avatar.png",
        vehicle: "Chevrolet Malibu 2022",
        licensePlate: "PQR678",
      },
      rating: 4,
      paymentMethod: "Blockchain Wallet",
      rideType: "Economy",
    },
    {
      id: "R-2024-012",
      date: "2024-12-09",
      time: "9:15 PM",
      from: "Concert Venue",
      to: "Downtown Bar",
      distance: "5.7 km",
      duration: "16 min",
      cost: 11.5,
      status: "completed",
      driver: {
        id: "D-008",
        name: "Anonymous Driver #R9S4",
        rating: 4.7,
        avatar: "/professional-driver-avatar.png",
        vehicle: "Kia Optima 2020",
        licensePlate: "STU901",
      },
      rating: 5,
      paymentMethod: "Blockchain Wallet",
      rideType: "Economy",
    },
    {
      id: "R-2024-013",
      date: "2024-12-08",
      time: "7:00 AM",
      from: "Residential Area",
      to: "Airport Terminal 1",
      distance: "14.8 km",
      duration: "38 min",
      cost: 30.0,
      status: "completed",
      driver: {
        id: "D-009",
        name: "Anonymous Driver #T1U6",
        rating: 4.9,
        avatar: "/courteous-driver-avatar.png",
        vehicle: "BMW X3 2023",
        licensePlate: "VWX234",
      },
      rating: 5,
      paymentMethod: "Blockchain Wallet",
      rideType: "Premium",
    },
    {
      id: "R-2024-014",
      date: "2024-12-07",
      time: "3:45 PM",
      from: "Office Park",
      to: "Train Station",
      distance: "8.9 km",
      duration: "23 min",
      cost: 17.25,
      status: "cancelled",
      paymentMethod: "Blockchain Wallet",
      rideType: "Express",
    },
    {
      id: "R-2024-015",
      date: "2024-12-27",
      time: "5:30 PM",
      from: "City Park",
      to: "Restaurant District",
      distance: "7.6 km",
      duration: "21 min",
      cost: 16.5,
      status: "scheduled",
      paymentMethod: "Blockchain Wallet",
      rideType: "Economy",
      route: [
        { lat: 40.7812, lng: -73.9665, name: "City Park" },
        { lat: 40.7661, lng: -73.9771, name: "Restaurant District" },
      ],
    },
  ]

  // Sample shared ride for display when no rides are found
  const sampleSharedRide: Ride = {
    id: "R-2024-099",
    date: "2024-12-30",
    time: "2:00 PM",
    from: "Point A",
    to: "Midrand",
    distance: "10.0 km",
    duration: "25 min",
    cost: 8.5,
    status: "completed",
    driver: {
      id: "D-010",
      name: "Anonymous Driver #X5Y7",
      rating: 4.8,
      avatar: "/sample-driver-avatar.png",
      vehicle: "Toyota Prius 2023",
      licensePlate: "SHA123",
    },
    rating: 4,
    paymentMethod: "Blockchain Wallet",
    rideType: "Shared",
    route: [
      { lat: -26.1000, lng: 28.0500, name: "Point A" },
      { lat: -26.0800, lng: 28.0600, name: "Halfway Stop" },
      { lat: -26.0600, lng: 28.0700, name: "Midrand" },
    ],
  }

  // Fetch ride history from API
  const fetchRideHistory = async () => {
    if (!user?.id) return
    
    await loadRideHistory(async () => {
      // Set auth token for API requests
      const token = localStorage.getItem('accessToken')
      if (token) {
        apiService.setAuthToken(token)
      }
      
      const response = await apiService.getUserRideHistory(user.id, {
        page: 1,
        limit: 50
      })
      
      if (response.success && response.data?.data) {
        const apiRides = response.data.data as ApiRide[]
      
        // Transform API rides to local Ride interface
        const transformedRides: Ride[] = apiRides.map((apiRide: ApiRide) => ({
          id: apiRide.id,
          date: new Date(apiRide.created_at).toISOString().split('T')[0],
          time: new Date(apiRide.created_at).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }),
          from: typeof apiRide.pickup_location === 'string' ? apiRide.pickup_location : apiRide.pickup_location.name,
          to: typeof apiRide.destination === 'string' ? apiRide.destination : apiRide.destination.name,
          distance: `${apiRide.distance_km} km`,
          duration: `${apiRide.duration_mins} min`,
          cost: apiRide.fare,
          status: apiRide.status as "completed" | "cancelled" | "in_progress" | "scheduled",
          driver: apiRide.driver ? {
            id: apiRide.driver.id,
            name: `Anonymous Driver #${apiRide.driver.id.slice(-4).toUpperCase()}`,
            rating: apiRide.driver.rating || 4.5,
            avatar: "/placeholder.svg",
            vehicle: apiRide.driver.vehicle_info || "Vehicle",
            licensePlate: "***-***"
          } : undefined,
          rating: apiRide.rating,
          paymentMethod: "Blockchain Wallet",
          rideType: apiRide.vehicle_type || "Economy"
        }))
      
        setRides(transformedRides)
        return { success: true, data: transformedRides }
      } else {
        // Fallback to mock data on API failure
        setRides(mockRides)
        throw new Error('Failed to load ride history from API')
      }
    })
  }

  // Check wallet connection and load ride history on mount
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        checkWalletConnection().catch((error) => {
          console.error("Failed to check wallet connection:", error)
        }),
        fetchRideHistory()
      ])
    }
    
    initializeData()
  }, [])

  const checkWalletConnection = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" })
        if (accounts.length > 0) {
          setIsWalletConnected(true)
          setWalletAddress(accounts[0])
        }
      } catch (error) {
        console.error("Error checking wallet connection:", error)
        setIsWalletConnected(false)
        setWalletAddress("")
      }
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-primary/10 text-primary border-primary/20"
      case "in_progress":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20"
      case "cancelled":
        return "bg-destructive/10 text-destructive border-destructive/20"
      case "scheduled":
        return "bg-secondary/10 text-secondary border-secondary/20"
      default:
        return "bg-muted/10 text-muted-foreground border-muted/20"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-3 h-3" />
      case "in_progress":
        return <Navigation className="w-3 h-3" />
      case "cancelled":
        return <AlertCircle className="w-3 h-3" />
      case "scheduled":
        return <Calendar className="w-3 h-3" />
      default:
        return <Clock className="w-3 h-3" />
    }
  }

  const filteredRides = rides.filter((ride) => {
    const matchesSearch =
      ride.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ride.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ride.id.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || ride.status === statusFilter

    const matchesDate =
      dateFilter === "all" ||
      (() => {
        const rideDate = new Date(ride.date)
        const now = new Date()
        switch (dateFilter) {
          case "today":
            return rideDate.toDateString() === now.toDateString()
          case "week":
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            return rideDate >= weekAgo
          case "month":
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            return rideDate >= monthAgo
          default:
            return true
        }
      })()

    return matchesSearch && matchesStatus && matchesDate
  })

  const activeRide = rides.find((ride) => ride.status === "in_progress")

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-foreground">SafeRide</span>
              </Link>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                Rides
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              {isWalletConnected && (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  <Wallet className="w-3 h-3 mr-1" />
                  {formatAddress(walletAddress)}
                </Badge>
              )}
              <Button variant="outline" size="sm" asChild className="bg-transparent">
                <Link href="/dashboard">
                  <User className="w-4 h-4 mr-2" />
                  Dashboard
                </Link>
              </Button>
              <Button onClick={logout} size="sm" variant="outline" className="bg-transparent">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Active Ride Banner */}
        {activeRide && (
          <Card className="mb-6 border-blue-500/20 bg-blue-500/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                    <Navigation className="w-6 h-6 text-white animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Ride in Progress - {activeRide.id}</h3>
                    <p className="text-sm text-muted-foreground">
                      {activeRide.from} → {activeRide.to}
                    </p>
                    <p className="text-sm text-blue-600 font-medium">
                      Driver: {activeRide.driver?.name} • ETA: 8 minutes
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </Button>
                  <Button size="sm" variant="outline">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setSelectedRide(activeRide)}
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    Track Live
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Ride History & Tracking</h1>
              <p className="text-muted-foreground">
                View your ride history, track active trips, and manage your transportation records.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="bg-transparent">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button asChild className="bg-primary hover:bg-primary/90">
                <Link href="/book">
                  <Car className="w-4 h-4 mr-2" />
                  Book New Ride
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="search" className="sr-only">
                  Search rides
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    id="search"
                    placeholder="Search by location or ride ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {ridesError && (
          <ErrorDisplay
            variant="card"
            title="Failed to Load Ride History"
            errorMessage={ridesError.message || "Unable to fetch your ride history. Please try again."}
            onRetry={fetchRideHistory}
            showRetry
          />
        )}

        {/* Ride List */}
        <div className="space-y-4">
          {/* Loading State */}
          {ridesLoading ? (
            <LoadingState
              variant="card"
              message="Loading your ride history..."
              className="py-12"
            />
          ) : filteredRides.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Car className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Try a Shared Ride!</h3>
                  <p className="text-sm text-muted-foreground text-center">
                    Save more by sharing your ride with others. Here’s an example of a shared ride:
                  </p>
                  {/* Sample Shared Ride Details */}
                  <div className="w-full border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-foreground">{sampleSharedRide.id}</h4>
                      <Badge variant="secondary" className={getStatusColor(sampleSharedRide.status)}>
                        {getStatusIcon(sampleSharedRide.status)}
                        <span className="ml-1 capitalize">{sampleSharedRide.status.replace("_", " ")}</span>
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-foreground flex items-center">
                        <MapPin className="w-4 h-4 mr-2 text-primary" />
                        <span>
                          <strong>From:</strong> {sampleSharedRide.from}
                        </span>
                      </p>
                      <p className="text-sm text-foreground flex items-center ml-6">
                        <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                        <span>
                          <strong>Stop:</strong> {sampleSharedRide.route![1].name}
                        </span>
                      </p>
                      <p className="text-sm text-foreground flex items-center">
                        <MapPin className="w-4 h-4 mr-2 text-destructive" />
                        <span>
                          <strong>To:</strong> {sampleSharedRide.to}
                        </span>
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {sampleSharedRide.date} at {sampleSharedRide.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {sampleSharedRide.duration}
                        </span>
                        <span className="flex items-center gap-1">
                          <Route className="w-4 h-4" />
                          {sampleSharedRide.distance}
                        </span>
                      </div>
                      {sampleSharedRide.driver && (
                        <div className="flex items-center gap-3 mt-2">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={sampleSharedRide.driver.avatar} alt={sampleSharedRide.driver.name} />
                            <AvatarFallback>
                              {sampleSharedRide.driver.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-foreground">{sampleSharedRide.driver.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {sampleSharedRide.driver.vehicle} • {sampleSharedRide.driver.licensePlate}
                            </p>
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-primary text-primary" />
                              <span className="text-xs">{sampleSharedRide.driver.rating}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-sm text-muted-foreground">Ride Type: {sampleSharedRide.rideType}</p>
                        <p className="text-lg font-bold text-foreground">${sampleSharedRide.cost}</p>
                      </div>
                      {sampleSharedRide.rating && (
                        <div className="flex items-center gap-1">
                          {[...Array(sampleSharedRide.rating)].map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                          ))}
                          <span className="text-xs text-muted-foreground">{sampleSharedRide.rating} stars</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button asChild className="bg-primary hover:bg-primary/90">
                    <Link href="/book">
                      <Car className="w-4 h-4 mr-2" />
                      Book a Shared Ride
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredRides.map((ride) => (
              <Card
                key={ride.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedRide(ride)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                        {ride.status === "in_progress" ? (
                          <Navigation className="w-6 h-6 text-blue-500 animate-pulse" />
                        ) : (
                          <Car className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">{ride.id}</h3>
                          <Badge variant="secondary" className={getStatusColor(ride.status)}>
                            {getStatusIcon(ride.status)}
                            <span className="ml-1 capitalize">{ride.status.replace("_", " ")}</span>
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {ride.date} at {ride.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {ride.duration}
                          </span>
                          <span className="flex items-center gap-1">
                            <Route className="w-3 h-3" />
                            {ride.distance}
                          </span>
                        </div>

                        <p className="text-sm text-foreground">
                          <MapPin className="w-3 h-3 inline mr-1" />
                          {ride.from} → {ride.to}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">${ride.cost}</p>
                      <p className="text-xs text-muted-foreground">{ride.rideType}</p>
                      {ride.rating && (
                        <div className="flex items-center gap-1 mt-1">
                          {[...Array(ride.rating)].map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-primary text-primary" />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Ride Detail Modal/Sidebar */}
        {selectedRide && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Car className="w-5 h-5" />
                      Ride Details - {selectedRide.id}
                    </CardTitle>
                    <CardDescription>
                      {selectedRide.date} at {selectedRide.time}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedRide(null)}>
                    ×
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Status and Progress */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className={getStatusColor(selectedRide.status)}>
                      {getStatusIcon(selectedRide.status)}
                      <span className="ml-1 capitalize">{selectedRide.status.replace("_", " ")}</span>
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {selectedRide.status === "in_progress" && "ETA: 8 minutes"}
                      {selectedRide.status === "completed" && "Trip completed"}
                      {selectedRide.status === "scheduled" && "Scheduled for pickup"}
                      {selectedRide.status === "cancelled" && "Trip was cancelled"}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-foreground">${selectedRide.cost}</span>
                </div>

                {/* Route Information */}
                <div>
                  <h4 className="font-semibold text-foreground mb-3">Route</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-primary rounded-full"></div>
                      <div>
                        <p className="font-medium text-foreground">Pickup</p>
                        <p className="text-sm text-muted-foreground">{selectedRide.from}</p>
                      </div>
                    </div>
                    <div className="ml-1.5 w-0.5 h-8 bg-border"></div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-destructive rounded-full"></div>
                      <div>
                        <p className="font-medium text-foreground">Destination</p>
                        <p className="text-sm text-muted-foreground">{selectedRide.to}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trip Details */}
                <div>
                  <h4 className="font-semibold text-foreground mb-3">Trip Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Distance</Label>
                      <p className="font-medium">{selectedRide.distance}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Duration</Label>
                      <p className="font-medium">{selectedRide.duration}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Ride Type</Label>
                      <p className="font-medium">{selectedRide.rideType}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Payment</Label>
                      <p className="font-medium">{selectedRide.paymentMethod}</p>
                    </div>
                  </div>
                </div>

                {/* Driver Information */}
                {selectedRide.driver && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Driver</h4>
                    <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
                      <Avatar className="w-12 h-12">
                        <AvatarImage
                          src={selectedRide.driver.avatar || "/placeholder.svg"}
                          alt={selectedRide.driver.name}
                        />
                        <AvatarFallback>
                          {selectedRide.driver.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{selectedRide.driver.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedRide.driver.vehicle} • {selectedRide.driver.licensePlate}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="w-3 h-3 fill-primary text-primary" />
                          <span className="text-xs font-medium">{selectedRide.driver.rating}</span>
                        </div>
                      </div>
                      {selectedRide.status === "in_progress" && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Phone className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Rating */}
                {selectedRide.rating && selectedRide.status === "completed" && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Your Rating</h4>
                    <div className="flex items-center gap-2">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${i < selectedRide.rating! ? "fill-primary text-primary" : "text-muted-foreground"}`}
                        />
                      ))}
                      <span className="ml-2 text-sm text-muted-foreground">{selectedRide.rating} out of 5 stars</span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-border">
                  {selectedRide.status === "completed" && !selectedRide.rating && (
                    <Button className="flex-1 bg-primary hover:bg-primary/90">
                      <Star className="w-4 h-4 mr-2" />
                      Rate Trip
                    </Button>
                  )}
                  <Button variant="outline" className="flex-1 bg-transparent">
                    <Download className="w-4 h-4 mr-2" />
                    Receipt
                  </Button>
                  {selectedRide.status === "scheduled" && (
                    <Button variant="outline" className="flex-1 bg-transparent">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

export default withErrorBoundary(RideHistoryAndTracking, {
  fallback: (
    <ErrorDisplay
      variant="card"
      title="Ride History System Error"
      errorMessage="An unexpected error occurred in the ride history system."
      onRetry={() => {}}
      showRetry
    />
  )
})