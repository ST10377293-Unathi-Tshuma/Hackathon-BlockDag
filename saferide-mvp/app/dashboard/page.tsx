"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Shield,
  Car,
  Wallet,
  User,
  Settings,
  History,
  Star,
  MapPin,
  Clock,
  CreditCard,
  Edit3,
  Save,
  X,
  Home,
  Phone,
  Mail,
} from "lucide-react"
import Link from "next/link"

export default function UserDashboard() {
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [userProfile, setUserProfile] = useState({
    name: "Alex Johnson",
    email: "alex.johnson@email.com",
    phone: "+1 (555) 123-4567",
    avatar: "/placeholder-user.png",
  })
  const [editedProfile, setEditedProfile] = useState(userProfile)

  // Mock data for user stats and recent activity
  const userStats = {
    totalRides: 47,
    rating: 4.8,
    totalSpent: 342.5,
    carbonSaved: 125.3,
  }

  const recentRides = [
    {
      id: 1,
      from: "Downtown Office",
      to: "Home",
      date: "Today, 6:30 PM",
      cost: 12.5,
      status: "completed",
      driver: "Driver #A7B2",
    },
    {
      id: 2,
      from: "Airport",
      to: "Hotel District",
      date: "Yesterday, 2:15 PM",
      cost: 28.75,
      status: "completed",
      driver: "Driver #C9D4",
    },
    {
      id: 3,
      from: "Shopping Mall",
      to: "Restaurant",
      date: "Dec 15, 7:45 PM",
      cost: 8.25,
      status: "completed",
      driver: "Driver #E1F6",
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

  const connectWallet = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" })
        if (accounts.length > 0) {
          setIsWalletConnected(true)
          setWalletAddress(accounts[0])
        }
      } catch (error) {
        console.error("Error connecting wallet:", error)
        setIsWalletConnected(false)
        setWalletAddress("")
      }
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const handleSaveProfile = () => {
    setUserProfile(editedProfile)
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditedProfile(userProfile)
    setIsEditing(false)
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
                Dashboard
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              {isWalletConnected ? (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  <Wallet className="w-3 h-3 mr-1" />
                  {formatAddress(walletAddress)}
                </Badge>
              ) : (
                <Button onClick={connectWallet} size="sm" className="bg-primary hover:bg-primary/90">
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Welcome back, {userProfile.name}!</h1>
              <p className="text-muted-foreground">Manage your rides, profile, and preferences from your dashboard.</p>
            </div>
            <div className="flex gap-2">
              <Button asChild className="bg-primary hover:bg-primary/90">
                <Link href="/book">
                  <Car className="w-4 h-4 mr-2" />
                  Book a Ride
                </Link>
              </Button>
              <Button variant="outline" asChild className="bg-transparent">
                <Link href="/rides">
                  <History className="w-4 h-4 mr-2" />
                  View All Rides
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Car className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{userStats.totalRides}</p>
                  <p className="text-sm text-muted-foreground">Total Rides</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Star className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{userStats.rating}</p>
                  <p className="text-sm text-muted-foreground">Rating</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">${userStats.totalSpent}</p>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{userStats.carbonSaved}</p>
                  <p className="text-sm text-muted-foreground">kg CO₂ Saved</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Rides */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Recent Rides
                  </CardTitle>
                  <CardDescription>Your latest ride activity</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recentRides.map((ride) => (
                    <div
                      key={ride.id}
                      className="flex items-center justify-between p-3 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            {ride.from} → {ride.to}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {ride.date} • {ride.driver}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">${ride.cost}</p>
                        <Badge variant="secondary" className="text-xs">
                          {ride.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full bg-transparent" asChild>
                    <Link href="/rides">View All Rides</Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Common tasks and shortcuts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start bg-primary hover:bg-primary/90" asChild>
                    <Link href="/book">
                      <Car className="w-4 h-4 mr-2" />
                      Book a New Ride
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                    <Link href="/driver/verify">
                      <Shield className="w-4 h-4 mr-2" />
                      Become a Driver
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Payment Methods
                  </Button>
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <Settings className="w-4 h-4 mr-2" />
                    Account Settings
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Manage your personal information and preferences</CardDescription>
                  </div>
                  {!isEditing && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={userProfile.avatar || "/placeholder.svg"} alt={userProfile.name} />
                    <AvatarFallback className="text-lg">
                      {userProfile.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">{userProfile.name}</h3>
                    <p className="text-muted-foreground">SafeRide Member since 2024</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-4 h-4 fill-primary text-primary" />
                      <span className="text-sm font-medium">{userStats.rating} rating</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    {isEditing ? (
                      <Input
                        id="name"
                        value={editedProfile.name}
                        onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2 border border-border rounded-md">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>{userProfile.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    {isEditing ? (
                      <Input
                        id="email"
                        type="email"
                        value={editedProfile.email}
                        onChange={(e) => setEditedProfile({ ...editedProfile, email: e.target.value })}
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2 border border-border rounded-md">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{userProfile.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    {isEditing ? (
                      <Input
                        id="phone"
                        value={editedProfile.phone}
                        onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2 border border-border rounded-md">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{userProfile.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Wallet Address</Label>
                    <div className="flex items-center gap-2 p-2 border border-border rounded-md">
                      <Wallet className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">
                        {isWalletConnected ? formatAddress(walletAddress) : "Not connected"}
                      </span>
                    </div>
                  </div>
                </div>

                {isEditing && (
                  <div className="flex gap-2">
                    <Button onClick={handleSaveProfile} className="bg-primary hover:bg-primary/90">
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={handleCancelEdit}>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Ride History</CardTitle>
                <CardDescription>Complete history of your SafeRide trips</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentRides.map((ride) => (
                    <div
                      key={ride.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Car className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {ride.from} → {ride.to}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {ride.date}
                            </span>
                            <span>{ride.driver}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground text-lg">${ride.cost}</p>
                        <Badge variant="secondary" className="mt-1">
                          {ride.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Preferences</CardTitle>
                  <CardDescription>Customize your SafeRide experience</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Default Ride Type</Label>
                    <select className="w-full p-2 border border-border rounded-md bg-background">
                      <option>Economy</option>
                      <option>Premium</option>
                      <option>Express</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Notification Preferences</Label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span className="text-sm">Ride confirmations</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span className="text-sm">Driver updates</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm">Promotional offers</span>
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Security</CardTitle>
                  <CardDescription>Manage your account security settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <Shield className="w-4 h-4 mr-2" />
                    Change Password
                  </Button>
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <Wallet className="w-4 h-4 mr-2" />
                    Manage Wallet Connection
                  </Button>
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <Settings className="w-4 h-4 mr-2" />
                    Privacy Settings
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
