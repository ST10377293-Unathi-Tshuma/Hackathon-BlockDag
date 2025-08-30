"use client"

import { useState, useEffect } from "react"
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
} from "lucide-react"
import Link from "next/link"

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

export default function RideHistoryAndTracking() {
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState("")
  const [activeTab, setActiveTab] = useState("history")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null)

  // Mock ride data
  const rides: Ride[] = [
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
  ]

  // Check wallet connection on load
  useEffect(() => {
    checkWalletConnection().catch((error) => {
      console.error("Failed to check wallet connection:", error)
    })
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

        {/* Ride List */}
        <div className="space-y-4">
          {filteredRides.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Car className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No rides found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || statusFilter !== "all" || dateFilter !== "all"
                    ? "Try adjusting your filters to see more results."
                    : "You haven't taken any rides yet. Book your first ride to get started!"}
                </p>
                <Button asChild className="bg-primary hover:bg-primary/90">
                  <Link href="/book">
                    <Car className="w-4 h-4 mr-2" />
                    Book Your First Ride
                  </Link>
                </Button>
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
