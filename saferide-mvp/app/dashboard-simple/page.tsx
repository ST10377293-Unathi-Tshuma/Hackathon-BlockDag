"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Car,
  Clock,
  DollarSign,
  Leaf,
  Mail,
  Phone,
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
import Link from "next/link"

interface UserProfile {
  id: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  emergency_contact?: string;
  preferences?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface UserStats {
  totalRides: number;
  totalSpent: number;
  rating: number;
  carbonSaved: number;
  favoriteDestinations: string[];
  monthlyRides: number;
}

interface ApiUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  user_type: 'passenger' | 'driver';
  is_verified: boolean;
  profile_picture?: string;
  created_at: string;
  updated_at: string;
}

export default function SimpleDashboard() {
  const [user, setUser] = useState<ApiUser | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Check if user is authenticated
        const token = localStorage.getItem('accessToken')
        const userId = localStorage.getItem('userId')
        
        if (!token || !userId) {
          window.location.href = '/auth/login'
          return
        }

        // Load user profile and stats
        const [profileResponse, statsResponse] = await Promise.all([
          fetch(`/api/users/${userId}/profile`),
          fetch(`/api/users/${userId}/stats`)
        ])

        const profileData = await profileResponse.json()
        const statsData = await statsResponse.json()

        if (profileData.success && statsData.success) {
          setUser(profileData.data)
          setUserProfile(profileData.data)
          setUserStats(statsData.data)
        } else {
          throw new Error('Failed to load user data')
        }
      } catch (err) {
        console.error('Dashboard load error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  const logout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('userId')
    window.location.href = '/auth/login'
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-destructive" />
          <p className="text-destructive mb-4">Error: {error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  if (!user || !userStats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No user data available</p>
          <Button onClick={() => window.location.href = '/auth/login'} className="mt-4">
            Go to Login
          </Button>
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
              <Button onClick={logout} size="sm" variant="outline" className="bg-transparent">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Welcome back, {user.full_name}!</h1>
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
                  <p className="text-sm text-muted-foreground">Total Rides</p>
                  <p className="text-2xl font-bold text-foreground">{userStats.totalRides}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Star className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rating</p>
                  <p className="text-2xl font-bold text-foreground">{userStats.rating}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-2xl font-bold text-foreground">${userStats.totalSpent}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Leaf className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Carbon Saved</p>
                  <p className="text-2xl font-bold text-foreground">{userStats.carbonSaved}kg</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Profile Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Your personal information and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={user.profile_picture || undefined} />
                    <AvatarFallback>{user.full_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-semibold">{user.full_name}</h3>
                    <p className="text-muted-foreground">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={user.is_verified ? "default" : "secondary"}>
                        {user.is_verified ? "Verified" : "Unverified"}
                      </Badge>
                      <Badge variant="outline">{user.user_type}</Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{user.email}</p>
                    </div>
                  </div>
                  
                  {user.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{user.phone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Monthly Rides</span>
                  <span className="font-semibold">{userStats.monthlyRides}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Average Rating</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{userStats.rating}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Member Since</span>
                  <span className="font-semibold">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
