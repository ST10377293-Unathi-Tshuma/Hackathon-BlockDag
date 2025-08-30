"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Car,
  Clock,
  DollarSign,
  Leaf,
  Mail,
  Phone,
  Save,
  Settings,
  Shield,
  Star,
  TrendingUp,
  User,
  Wallet,
  X,
  Loader2,
  AlertCircle,
  History,
  MapPin,
  CreditCard,
  Edit3,
  Home,
  LogOut,
} from "lucide-react"
import { useBlockchain } from "@/hooks/use-blockchain"
import { ApiService } from "@/lib/api"
import { UserProfile, UserStatistics, Ride } from "@/lib/types"
import { useAuth } from "@/lib/auth-context"
import { useApiState } from "@/hooks/useApiState"
import ErrorDisplay from "@/components/ErrorDisplay"
import LoadingState from "@/components/LoadingState"
import { withErrorBoundary } from "@/components/ErrorBoundary"
import Link from "next/link"

function UserDashboard() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth()
  const { isWalletConnected, walletAddress, connectWallet } = useBlockchain()
  const {
    data: userProfile,
    loading: profileLoading,
    error: profileError,
    execute: loadProfile,
    retry: retryProfile
  } = useApiState<UserProfile>()
  
  const {
    data: rideHistory,
    loading: historyLoading,
    error: historyError,
    execute: loadHistory,
    retry: retryHistory
  } = useApiState<{ data: Ride[], total: number }>()

  const {
    data: userStats,
    loading: statsLoading,
    error: statsError,
    execute: loadStats,
    retry: retryStats
  } = useApiState<UserStatistics>()

  // Local state for editing
  const [editedProfile, setEditedProfile] = useState<UserProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const apiService = new ApiService()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = '/auth/login'
    }
  }, [isAuthenticated, authLoading])

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Don't render if not authenticated
  if (!isAuthenticated || !user) {
    return null
  }

  // Load user data on component mount
  useEffect(() => {
    if (!user?.id) return
    
    const loadUserData = async () => {
      // Set auth token for API requests
      const token = localStorage.getItem('accessToken')
      if (token) {
        apiService.setAuthToken(token)
      }
      
      // Load user profile, statistics, and ride history
      await Promise.all([
        loadProfile(async () => {
          const response = await apiService.getUserProfile(user.id)
          if (response.success && response.data) {
            setEditedProfile(response.data)
            return response.data
          }
          throw new Error(response.error || 'Failed to load profile')
        }),
        loadStats(async () => {
          const response = await apiService.getUserStatistics(user.id)
          if (response.success && response.data) {
            return response.data
          }
          throw new Error(response.error || 'Failed to load statistics')
        }),
        loadHistory(async () => {
          const response = await apiService.getUserRideHistory(user.id, { limit: 3 })
          if (response.success && response.data) {
            return response.data
          }
          throw new Error(response.error || 'Failed to load ride history')
        })
      ])
    }
    
    loadUserData()
  }, [user?.id, loadProfile, loadStats, loadHistory])

  // Wallet connection is handled by useBlockchain hook

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const {
    loading: saveLoading,
    error: saveError,
    execute: saveProfile
  } = useApiState()

  const handleSaveProfile = async () => {
    if (!editedProfile || !user?.id) return
    
    await saveProfile(async () => {
      const token = localStorage.getItem('accessToken')
      if (token) {
        apiService.setAuthToken(token)
      }
      
      const response = await apiService.updateUserProfile(user.id, editedProfile)
      if (response.success && response.data) {
        setEditedProfile(response.data)
        setIsEditing(false)
        // Reload profile data
        await loadProfile(async () => {
          const profileResponse = await apiService.getUserProfile(user.id)
          if (profileResponse.success && profileResponse.data) {
            return profileResponse.data
          }
          throw new Error(profileResponse.error || 'Failed to reload profile')
        })
        return response.data
      }
      throw new Error(response.error || 'Failed to save profile')
    })
  }

  const handleCancelEdit = () => {
    setEditedProfile(userProfile)
    setIsEditing(false)
  }

  if (profileLoading || historyLoading || statsLoading) {
    return <LoadingState variant="page" message="Loading dashboard..." />
  }

  if (profileError || statsError) {
    return (
      <ErrorDisplay
        variant="page"
        title="Dashboard Error"
        message={(profileError || statsError)?.message || "Failed to load dashboard data"}
        onRetry={() => {
          if (profileError) retryProfile()
          if (statsError) retryStats()
        }}
        showRetry
      />
    )
  }

  if (!userProfile || !userStats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No user data available</p>
        </div>
      </div>
    )
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
              <Button onClick={logout} size="sm" variant="outline" className="bg-transparent">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Error Display */}
      {historyError && (
        <div className="container mx-auto px-4 py-6">
          <ErrorDisplay
            variant="alert"
            title="Failed to Load Recent Rides"
            message={historyError.message || "Unable to fetch your recent ride history."}
            onRetry={retryHistory}
            showRetry
            className="mb-6"
          />
        </div>
      )}

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
                  {historyLoading ? (
                    <LoadingState message="Loading recent rides..." />
                  ) : historyError ? (
                    <ErrorDisplay 
                      error={historyError} 
                      onRetry={retryHistory}
                      title="Failed to load recent rides"
                    />
                  ) : rideHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Car className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No rides yet</p>
                      <p className="text-sm">Book your first ride to get started!</p>
                    </div>
                  ) : (
                    rideHistory.slice(0, 3).map((ride) => (
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
                              {ride.pickup_location} → {ride.destination}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(ride.created_at).toLocaleDateString()} • {ride.driver_name || 'Driver'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-foreground">${ride.fare}</p>
                          <Badge variant="secondary" className="text-xs">
                            {ride.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
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
                        value={editedProfile?.name || ''}
                        onChange={(e) => setEditedProfile(prev => prev ? { ...prev, name: e.target.value } : null)}
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
                        value={editedProfile?.email || ''}
                        onChange={(e) => setEditedProfile(prev => prev ? { ...prev, email: e.target.value } : null)}
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
                        value={editedProfile?.phone || ''}
                        onChange={(e) => setEditedProfile(prev => prev ? { ...prev, phone: e.target.value } : null)}
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
                  <div className="space-y-4">
                    {saveError && (
                      <ErrorDisplay 
                        error={saveError} 
                        onRetry={handleSaveProfile}
                        title="Failed to save profile"
                        variant="inline"
                      />
                    )}
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleSaveProfile} 
                        disabled={saveLoading}
                        className="bg-primary hover:bg-primary/90"
                      >
                        {saveLoading ? (
                          <>
                            <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={handleCancelEdit} disabled={saveLoading}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
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
                  {historyLoading ? (
                    <LoadingState message="Loading ride history..." />
                  ) : historyError ? (
                    <ErrorDisplay 
                      error={historyError} 
                      onRetry={retryHistory}
                      title="Failed to load ride history"
                    />
                  ) : rideHistory.length > 0 ? (
                    rideHistory.map((ride) => (
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
                              {ride.pickup_location} → {ride.destination}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(ride.created_at).toLocaleDateString()}
                              </span>
                              <span>{ride.driver_name || `Driver #${ride.driver_id}`}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-foreground text-lg">${ride.fare}</p>
                          <Badge 
                            variant={ride.status === 'completed' ? 'default' : ride.status === 'cancelled' ? 'destructive' : 'secondary'} 
                            className="mt-1"
                          >
                            {ride.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Car className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No rides yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Book your first ride to see it here</p>
                    </div>
                  )}
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

export default withErrorBoundary(UserDashboard, {
  fallback: ({ error, retry }) => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <ErrorDisplay
        error={error}
        variant="card"
        title="Dashboard Error"
        description="Something went wrong while loading your dashboard."
        showRetry
        onRetry={retry}
        className="max-w-md"
      />
    </div>
  )
});
