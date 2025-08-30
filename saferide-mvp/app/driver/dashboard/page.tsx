"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Shield,
  Car,
  Wallet,
  Settings,
  History,
  Star,
  CreditCard,
  TrendingUp,
  DollarSign,
  Navigation,
  Phone,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Calendar,
  Target,
  LogOut,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { ApiService } from "@/lib/api"

export default function DriverDashboard() {
  const router = useRouter()
  const { user, logout, isLoading } = useAuth()
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState("")
  const [isOnline, setIsOnline] = useState(false)
  const [hasActiveRide, setHasActiveRide] = useState(false)
  const [isAuthChecking, setIsAuthChecking] = useState(true)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login')
        return
      }
      setIsAuthChecking(false)
    }
  }, [user, isLoading, router])

  // Show loading spinner while checking authentication
  if (isLoading || isAuthChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  // Don't render if not authenticated
  if (!user) {
    return null
  }

  // Mock driver data
  const driverProfile = {
    name: "Sarah Martinez",
    rating: 4.9,
    totalRides: 342,
    joinDate: "March 2024",
    vehicle: "Toyota Camry 2022",
    license: "ABC123",
    avatar: "/placeholder.svg?key=driver1",
  }

  const earningsData = {
    today: 127.5,
    thisWeek: 892.75,
    thisMonth: 3456.2,
    allTime: 12847.9,
    pendingPayout: 456.3,
  }

  const performanceData = {
    acceptanceRate: 94,
    completionRate: 98,
    averageRating: 4.9,
    onTimeRate: 96,
  }

  const activeRide = {
    id: "R-2024-001",
    passenger: "Anonymous User #A7B2",
    pickup: "Downtown Office Building",
    destination: "Airport Terminal 2",
    estimatedEarnings: 28.5,
    estimatedTime: "25 min",
    status: "en_route",
  }

  const recentRides = [
    {
      id: 1,
      passenger: "Anonymous #C9D4",
      route: "Mall → Restaurant",
      earnings: 12.5,
      rating: 5,
      date: "2 hours ago",
      duration: "15 min",
    },
    {
      id: 2,
      passenger: "Anonymous #E1F6",
      route: "Hotel → Airport",
      earnings: 35.75,
      rating: 5,
      date: "4 hours ago",
      duration: "32 min",
    },
    {
      id: 3,
      passenger: "Anonymous #G3H8",
      route: "Home → Office",
      earnings: 18.25,
      rating: 4,
      date: "6 hours ago",
      duration: "22 min",
    },
  ]

  const rideRequests = [
    {
      id: "REQ-001",
      pickup: "Central Station",
      destination: "University Campus",
      distance: "8.2 km",
      estimatedEarnings: 15.5,
      estimatedTime: "18 min",
      passengerRating: 4.8,
    },
    {
      id: "REQ-002",
      pickup: "Shopping Center",
      destination: "Residential Area",
      distance: "5.4 km",
      estimatedEarnings: 11.25,
      estimatedTime: "12 min",
      passengerRating: 4.6,
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

  const handleGoOnline = () => {
    setIsOnline(!isOnline)
  }

  const acceptRide = (requestId: string) => {
    console.log(`[v0] Accepting ride request: ${requestId}`)
    setHasActiveRide(true)
  }

  const completeRide = () => {
    console.log("[v0] Completing active ride")
    setHasActiveRide(false)
  }

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
                Driver Dashboard
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="online-status" className="text-sm font-medium">
                  {isOnline ? "Online" : "Offline"}
                </Label>
                <Switch id="online-status" checked={isOnline} onCheckedChange={handleGoOnline} />
              </div>
              {isWalletConnected && (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  <Wallet className="w-3 h-3 mr-1" />
                  {formatAddress(walletAddress)}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Status Banner */}
        {hasActiveRide && (
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                    <Navigation className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Active Ride - {activeRide.id}</h3>
                    <p className="text-sm text-muted-foreground">
                      {activeRide.pickup} → {activeRide.destination}
                    </p>
                    <p className="text-sm text-primary font-medium">
                      Estimated: ${activeRide.estimatedEarnings} • {activeRide.estimatedTime}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <Phone className="w-4 h-4 mr-2" />
                    Contact
                  </Button>
                  <Button size="sm" onClick={completeRide} className="bg-primary hover:bg-primary/90">
                    Complete Ride
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={driverProfile.avatar || "/placeholder.svg"} alt={driverProfile.name} />
                <AvatarFallback className="text-lg">
                  {driverProfile.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Welcome, {driverProfile.name}!</h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-primary text-primary" />
                    {driverProfile.rating} rating
                  </span>
                  <span>{driverProfile.totalRides} rides completed</span>
                  <Badge variant={isOnline ? "default" : "secondary"} className="text-xs">
                    {isOnline ? "Online" : "Offline"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Earnings Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">${earningsData.today}</p>
                  <p className="text-xs text-muted-foreground">Today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">${earningsData.thisWeek}</p>
                  <p className="text-xs text-muted-foreground">This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">${earningsData.thisMonth}</p>
                  <p className="text-xs text-muted-foreground">This Month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">${earningsData.allTime}</p>
                  <p className="text-xs text-muted-foreground">All Time</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">${earningsData.pendingPayout}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="rides" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-4">
            <TabsTrigger value="rides" className="flex items-center gap-2">
              <Car className="w-4 h-4" />
              <span className="hidden sm:inline">Rides</span>
            </TabsTrigger>
            <TabsTrigger value="earnings" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">Earnings</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Rides Tab */}
          <TabsContent value="rides" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Ride Requests */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Ride Requests
                  </CardTitle>
                  <CardDescription>
                    {isOnline ? "Available ride requests in your area" : "Go online to see ride requests"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isOnline ? (
                    rideRequests.map((request) => (
                      <div key={request.id} className="p-4 border border-border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground text-sm">
                              {request.pickup} → {request.destination}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {request.distance} • Est. ${request.estimatedEarnings} • {request.estimatedTime}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-primary text-primary" />
                            <span className="text-xs">{request.passengerRating}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 bg-primary hover:bg-primary/90"
                            onClick={() => acceptRide(request.id)}
                          >
                            Accept
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 bg-transparent">
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Car className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Go online to start receiving ride requests</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Rides */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Recent Rides
                  </CardTitle>
                  <CardDescription>Your latest completed rides</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recentRides.map((ride) => (
                    <div
                      key={ride.id}
                      className="flex items-center justify-between p-3 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{ride.route}</p>
                          <p className="text-xs text-muted-foreground">
                            {ride.passenger} • {ride.date} • {ride.duration}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">${ride.earnings}</p>
                        <div className="flex items-center gap-1">
                          {[...Array(ride.rating)].map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-primary text-primary" />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Earnings Tab */}
          <TabsContent value="earnings" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Earnings Breakdown</CardTitle>
                  <CardDescription>Detailed view of your earnings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Base Fare</span>
                      <span className="font-medium">${(earningsData.thisWeek * 0.7).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Tips</span>
                      <span className="font-medium">${(earningsData.thisWeek * 0.15).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Bonuses</span>
                      <span className="font-medium">${(earningsData.thisWeek * 0.1).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Surge Pricing</span>
                      <span className="font-medium">${(earningsData.thisWeek * 0.05).toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between items-center font-semibold">
                      <span>Total This Week</span>
                      <span>${earningsData.thisWeek}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payout Information</CardTitle>
                  <CardDescription>Manage your earnings and payouts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Pending Payout</span>
                      <span className="text-lg font-bold text-primary">${earningsData.pendingPayout}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">Next payout: Monday, Dec 23rd</p>
                    <Button className="w-full bg-primary hover:bg-primary/90">
                      <Wallet className="w-4 h-4 mr-2" />
                      Request Instant Payout
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Payout Method</Label>
                    <div className="p-3 border border-border rounded-lg flex items-center gap-3">
                      <Wallet className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">Blockchain Wallet</p>
                        <p className="text-xs text-muted-foreground">
                          {isWalletConnected ? formatAddress(walletAddress) : "Not connected"}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                  <CardDescription>Track your driver performance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Acceptance Rate</span>
                        <span className="text-sm font-bold">{performanceData.acceptanceRate}%</span>
                      </div>
                      <Progress value={performanceData.acceptanceRate} className="h-2" />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Completion Rate</span>
                        <span className="text-sm font-bold">{performanceData.completionRate}%</span>
                      </div>
                      <Progress value={performanceData.completionRate} className="h-2" />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">On-Time Rate</span>
                        <span className="text-sm font-bold">{performanceData.onTimeRate}%</span>
                      </div>
                      <Progress value={performanceData.onTimeRate} className="h-2" />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Average Rating</span>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-primary text-primary" />
                          <span className="text-sm font-bold">{performanceData.averageRating}</span>
                        </div>
                      </div>
                      <Progress value={(performanceData.averageRating / 5) * 100} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Goals & Achievements</CardTitle>
                  <CardDescription>Track your progress and milestones</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 border border-border rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <Target className="w-5 h-5 text-primary" />
                      <span className="font-medium">Weekly Goal</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">50 rides this week</span>
                      <span className="text-sm font-bold">38/50</span>
                    </div>
                    <Progress value={76} className="h-2" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">100 Rides Milestone</p>
                        <p className="text-xs text-muted-foreground">Completed last month</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
                      <Star className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">5-Star Rating Streak</p>
                        <p className="text-xs text-muted-foreground">15 consecutive rides</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Driver Preferences</CardTitle>
                  <CardDescription>Customize your driving experience</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-Accept Rides</Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically accept rides matching your criteria
                        </p>
                      </div>
                      <Switch />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Destination Mode</Label>
                        <p className="text-xs text-muted-foreground">Only accept rides toward your destination</p>
                      </div>
                      <Switch />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Long Distance Rides</Label>
                        <p className="text-xs text-muted-foreground">Accept rides over 30 minutes</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Vehicle Information</CardTitle>
                  <CardDescription>Manage your vehicle details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <Label>Vehicle</Label>
                      <p className="text-sm text-muted-foreground">{driverProfile.vehicle}</p>
                    </div>
                    <div>
                      <Label>License Plate</Label>
                      <p className="text-sm text-muted-foreground">{driverProfile.license}</p>
                    </div>
                    <div>
                      <Label>Verification Status</Label>
                      <Badge className="bg-primary/10 text-primary border-primary/20">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    </div>
                  </div>

                  <Button variant="outline" className="w-full bg-transparent">
                    <Car className="w-4 h-4 mr-2" />
                    Update Vehicle Info
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
