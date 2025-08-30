"use client"

import React, { useState, useMemo, useCallback, memo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import ErrorBoundary from "@/components/ErrorBoundary"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import {
  Shield,
  Users,
  Car,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  PieChart,
  Settings,
  Search,
  Download,
  RefreshCw,
  Eye,
  Ban,
  UserCheck,
  MessageSquare,
  Wallet,
  Globe,
  Server,
  Database,
  Zap,
} from "lucide-react"
import Link from "next/link"

interface MetricCard {
  title: string
  value: string
  change: string
  trend: "up" | "down" | "neutral"
  icon: any
}

interface User {
  id: string
  name: string
  email: string
  type: "rider" | "driver"
  status: "active" | "suspended" | "pending"
  joinDate: string
  totalRides: number
  rating: number
  avatar: string
}

interface Ride {
  id: string
  riderId: string
  driverId: string
  from: string
  to: string
  status: "completed" | "in_progress" | "cancelled"
  amount: number
  date: string
  duration: string
}

const AdminPanel = memo(() => {
  const [selectedTab, setSelectedTab] = useState("overview")
  const [userFilter, setUserFilter] = useState("all")
  const [rideFilter, setRideFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Debounced search for users and rides
  const {
    searchValue: userSearchValue,
    debouncedValue: debouncedUserSearch,
    setSearchValue: setUserSearchValue,
    isSearching: isUserSearching
  } = useDebouncedSearch('', 300)
  
  const {
    searchValue: rideSearchValue,
    debouncedValue: debouncedRideSearch,
    setSearchValue: setRideSearchValue,
    isSearching: isRideSearching
  } = useDebouncedSearch('', 300)

  // Mock data
  const metrics: MetricCard[] = [
    {
      title: "Total Users",
      value: "12,847",
      change: "+12.5%",
      trend: "up",
      icon: Users,
    },
    {
      title: "Active Drivers",
      value: "1,234",
      change: "+8.2%",
      trend: "up",
      icon: Car,
    },
    {
      title: "Total Rides",
      value: "45,678",
      change: "+15.3%",
      trend: "up",
      icon: Activity,
    },
    {
      title: "Revenue",
      value: "$234,567",
      change: "+18.7%",
      trend: "up",
      icon: DollarSign,
    },
    {
      title: "Avg Rating",
      value: "4.8",
      change: "+0.2",
      trend: "up",
      icon: TrendingUp,
    },
    {
      title: "Support Tickets",
      value: "23",
      change: "-15.4%",
      trend: "down",
      icon: MessageSquare,
    },
  ]

  const recentUsers: User[] = [
    {
      id: "U001",
      name: "Alice Johnson",
      email: "alice@example.com",
      type: "rider",
      status: "active",
      joinDate: "2024-12-20",
      totalRides: 15,
      rating: 4.9,
      avatar: "/placeholder-user.png",
    },
    {
      id: "D001",
      name: "Bob Smith",
      email: "bob@example.com",
      type: "driver",
      status: "active",
      joinDate: "2024-12-19",
      totalRides: 89,
      rating: 4.8,
      avatar: "/professional-driver-avatar.png",
    },
    {
      id: "U002",
      name: "Carol Davis",
      email: "carol@example.com",
      type: "rider",
      status: "pending",
      joinDate: "2024-12-18",
      totalRides: 0,
      rating: 0,
      avatar: "/placeholder-user.png",
    },
    {
      id: "D002",
      name: "David Wilson",
      email: "david@example.com",
      type: "driver",
      status: "suspended",
      joinDate: "2024-12-17",
      totalRides: 156,
      rating: 4.2,
      avatar: "/reliable-driver-avatar.png",
    },
  ]

  const recentRides: Ride[] = [
    {
      id: "R-2024-001",
      riderId: "U001",
      driverId: "D001",
      from: "Downtown",
      to: "Airport",
      status: "completed",
      amount: 28.5,
      date: "2024-12-20 14:30",
      duration: "35 min",
    },
    {
      id: "R-2024-002",
      riderId: "U002",
      driverId: "D002",
      from: "Mall",
      to: "Home",
      status: "in_progress",
      amount: 15.75,
      date: "2024-12-20 15:45",
      duration: "18 min",
    },
    {
      id: "R-2024-003",
      riderId: "U003",
      driverId: "D001",
      from: "Office",
      to: "Restaurant",
      status: "cancelled",
      amount: 12.25,
      date: "2024-12-20 12:15",
      duration: "22 min",
    },
  ]

  const systemHealth = {
    apiStatus: "healthy",
    databaseStatus: "healthy",
    blockchainStatus: "healthy",
    uptime: "99.9%",
    responseTime: "145ms",
    activeConnections: 1247,
  }

  const handleRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true)
      setError(null)
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      // In a real app, you would fetch fresh data here
      console.log('Data refreshed')
    } catch (err) {
      setError('Failed to refresh data. Please try again.')
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "completed":
      case "healthy":
        return "bg-primary/10 text-primary border-primary/20"
      case "pending":
      case "in_progress":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20"
      case "suspended":
      case "cancelled":
        return "bg-destructive/10 text-destructive border-destructive/20"
      default:
        return "bg-muted/10 text-muted-foreground border-muted/20"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
      case "completed":
      case "healthy":
        return <CheckCircle className="w-3 h-3" />
      case "pending":
      case "in_progress":
        return <Clock className="w-3 h-3" />
      case "suspended":
      case "cancelled":
        return <AlertCircle className="w-3 h-3" />
      default:
        return <Activity className="w-3 h-3" />
    }
  }

  const filteredUsers = useMemo(() => {
    return recentUsers.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(debouncedUserSearch.toLowerCase()) ||
        user.email.toLowerCase().includes(debouncedUserSearch.toLowerCase())
      const matchesFilter = userFilter === "all" || user.type === userFilter || user.status === userFilter
      return matchesSearch && matchesFilter
    })
  }, [debouncedUserSearch, userFilter])

  const filteredRides = useMemo(() => {
    return recentRides.filter((ride) => {
      const matchesSearch =
        ride.id.toLowerCase().includes(debouncedRideSearch.toLowerCase()) ||
        ride.from.toLowerCase().includes(debouncedRideSearch.toLowerCase()) ||
        ride.to.toLowerCase().includes(debouncedRideSearch.toLowerCase())
      const matchesFilter = rideFilter === "all" || ride.status === rideFilter
      return matchesSearch && matchesFilter
    })
  }, [debouncedRideSearch, rideFilter])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6">
          {/* Header Skeleton */}
          <div className="flex justify-between items-center mb-6">
            <div className="space-y-2">
              <div className="h-8 w-48 bg-muted animate-pulse rounded"></div>
              <div className="h-4 w-64 bg-muted animate-pulse rounded"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-10 w-24 bg-muted animate-pulse rounded"></div>
              <div className="h-10 w-10 bg-muted animate-pulse rounded"></div>
            </div>
          </div>
          
          {/* Metrics Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-4 w-20 bg-muted animate-pulse rounded"></div>
                  <div className="h-4 w-4 bg-muted animate-pulse rounded"></div>
                </div>
                <div className="h-8 w-16 bg-muted animate-pulse rounded mb-2"></div>
                <div className="h-3 w-24 bg-muted animate-pulse rounded"></div>
              </div>
            ))}
          </div>
          
          {/* Tabs Skeleton */}
          <div className="border border-border rounded-lg">
            <div className="flex border-b border-border">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 w-24 bg-muted animate-pulse m-1 rounded"></div>
              ))}
            </div>
            <div className="p-6 space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
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
              <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20">
                Admin Panel
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="bg-transparent"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" asChild className="bg-transparent">
                <Link href="/dashboard">
                  <Users className="w-4 h-4 mr-2" />
                  User View
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
              <p className="text-muted-foreground">
                Monitor platform performance, manage users, and oversee SafeRide operations.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="bg-transparent">
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>
              <Button variant="outline" className="bg-transparent">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>

        {/* System Health Alert */}
        <Alert className="mb-6 border-primary/50 bg-primary/5">
          <CheckCircle className="h-4 w-4 text-primary" />
          <AlertDescription className="text-primary">
            All systems operational. Uptime: {systemHealth.uptime} | Response time: {systemHealth.responseTime}
          </AlertDescription>
        </Alert>

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          {metrics.map((metric, index) => {
            const Icon = metric.icon
            return (
              <Card key={index} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-bold text-foreground truncate">{metric.value}</p>
                      <p className="text-xs text-muted-foreground truncate">{metric.title}</p>
                      <div
                        className={`flex items-center gap-1 text-xs ${
                          metric.trend === "up"
                            ? "text-primary"
                            : metric.trend === "down"
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }`}
                      >
                        {metric.trend === "up" ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : metric.trend === "down" ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : (
                          <Activity className="w-3 h-3" />
                        )}
                        {metric.change}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="rides" className="flex items-center gap-2">
              <Car className="w-4 h-4" />
              <span className="hidden sm:inline">Rides</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <PieChart className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              <span className="hidden sm:inline">System</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>Latest platform activity and events</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
                      <UserCheck className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground text-sm">New driver verified</p>
                        <p className="text-xs text-muted-foreground">Bob Smith completed verification</p>
                      </div>
                      <span className="text-xs text-muted-foreground ml-auto">2 min ago</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
                      <Car className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="font-medium text-foreground text-sm">Ride completed</p>
                        <p className="text-xs text-muted-foreground">Downtown → Airport ($28.50)</p>
                      </div>
                      <span className="text-xs text-muted-foreground ml-auto">5 min ago</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
                      <MessageSquare className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="font-medium text-foreground text-sm">Support ticket resolved</p>
                        <p className="text-xs text-muted-foreground">Payment issue #1234</p>
                      </div>
                      <span className="text-xs text-muted-foreground ml-auto">12 min ago</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Quick Stats
                  </CardTitle>
                  <CardDescription>Key performance indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Driver Utilization</span>
                        <span className="text-sm font-bold">78%</span>
                      </div>
                      <Progress value={78} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Customer Satisfaction</span>
                        <span className="text-sm font-bold">94%</span>
                      </div>
                      <Progress value={94} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Platform Uptime</span>
                        <span className="text-sm font-bold">99.9%</span>
                      </div>
                      <Progress value={99.9} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Revenue Growth</span>
                        <span className="text-sm font-bold">+18.7%</span>
                      </div>
                      <Progress value={85} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Manage riders and drivers on the platform</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          placeholder="Search users..."
                          value={userSearchValue}
                          onChange={(e) => setUserSearchValue(e.target.value)}
                          className="pl-10 w-64"
                        />
                        {isUserSearching && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          </div>
                        )}
                      </div>
                    <select
                      value={userFilter}
                      onChange={(e) => setUserFilter(e.target.value)}
                      className="px-3 py-2 border border-border rounded-md bg-background text-sm"
                    >
                      <option value="all">All Users</option>
                      <option value="rider">Riders</option>
                      <option value="driver">Drivers</option>
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                          <AvatarFallback>
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-foreground">{user.name}</p>
                            <Badge variant="secondary" className="text-xs">
                              {user.type}
                            </Badge>
                            <Badge variant="secondary" className={getStatusColor(user.status)}>
                              {getStatusIcon(user.status)}
                              <span className="ml-1 capitalize">{user.status}</span>
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                            <span>Joined: {user.joinDate}</span>
                            <span>Rides: {user.totalRides}</span>
                            {user.rating > 0 && <span>Rating: {user.rating}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="bg-transparent">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="bg-transparent">
                          <Ban className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rides Tab */}
          <TabsContent value="rides" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Ride Management</CardTitle>
                    <CardDescription>Monitor and manage all rides on the platform</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          placeholder="Search rides..."
                          value={rideSearchValue}
                          onChange={(e) => setRideSearchValue(e.target.value)}
                          className="pl-10 w-64"
                        />
                        {isRideSearching && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          </div>
                        )}
                      </div>
                    <select
                      value={rideFilter}
                      onChange={(e) => setRideFilter(e.target.value)}
                      className="px-3 py-2 border border-border rounded-md bg-background text-sm"
                    >
                      <option value="all">All Rides</option>
                      <option value="completed">Completed</option>
                      <option value="in_progress">In Progress</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredRides.map((ride) => (
                    <div
                      key={ride.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                          <Car className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-foreground">{ride.id}</p>
                            <Badge variant="secondary" className={getStatusColor(ride.status)}>
                              {getStatusIcon(ride.status)}
                              <span className="ml-1 capitalize">{ride.status.replace("_", " ")}</span>
                            </Badge>
                          </div>
                          <p className="text-sm text-foreground">
                            {ride.from} → {ride.to}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                            <span>{ride.date}</span>
                            <span>{ride.duration}</span>
                            <span>Rider: {ride.riderId}</span>
                            <span>Driver: {ride.driverId}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">${ride.amount}</p>
                        <Button size="sm" variant="outline" className="mt-2 bg-transparent">
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Revenue Analytics
                  </CardTitle>
                  <CardDescription>Financial performance metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Today's Revenue</span>
                      <span className="font-bold text-foreground">$12,847</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">This Week</span>
                      <span className="font-bold text-foreground">$89,234</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">This Month</span>
                      <span className="font-bold text-foreground">$234,567</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Average per Ride</span>
                      <span className="font-bold text-foreground">$18.45</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Platform Usage
                  </CardTitle>
                  <CardDescription>User engagement and activity</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Daily Active Users</span>
                      <span className="font-bold text-foreground">8,234</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Peak Hours</span>
                      <span className="font-bold text-foreground">6-9 PM</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Avg Session Time</span>
                      <span className="font-bold text-foreground">12 min</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Conversion Rate</span>
                      <span className="font-bold text-foreground">78.5%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Blockchain Analytics
                </CardTitle>
                <CardDescription>Blockchain transaction and wallet metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">1,247</p>
                    <p className="text-sm text-muted-foreground">Connected Wallets</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">45,678</p>
                    <p className="text-sm text-muted-foreground">Total Transactions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">$234K</p>
                    <p className="text-sm text-muted-foreground">Volume (24h)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">2.3s</p>
                    <p className="text-sm text-muted-foreground">Avg Block Time</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5" />
                    System Health
                  </CardTitle>
                  <CardDescription>Monitor system performance and status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-medium text-foreground">API Status</p>
                          <p className="text-sm text-muted-foreground">All endpoints operational</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={getStatusColor(systemHealth.apiStatus)}>
                        {getStatusIcon(systemHealth.apiStatus)}
                        <span className="ml-1 capitalize">{systemHealth.apiStatus}</span>
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Database className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-medium text-foreground">Database</p>
                          <p className="text-sm text-muted-foreground">Connection stable</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={getStatusColor(systemHealth.databaseStatus)}>
                        {getStatusIcon(systemHealth.databaseStatus)}
                        <span className="ml-1 capitalize">{systemHealth.databaseStatus}</span>
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Zap className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-medium text-foreground">Blockchain</p>
                          <p className="text-sm text-muted-foreground">BlockDAG network synced</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={getStatusColor(systemHealth.blockchainStatus)}>
                        {getStatusIcon(systemHealth.blockchainStatus)}
                        <span className="ml-1 capitalize">{systemHealth.blockchainStatus}</span>
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Performance Metrics
                  </CardTitle>
                  <CardDescription>Real-time system performance data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Uptime</span>
                      <span className="font-bold text-foreground">{systemHealth.uptime}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Response Time</span>
                      <span className="font-bold text-foreground">{systemHealth.responseTime}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Active Connections</span>
                      <span className="font-bold text-foreground">
                        {systemHealth.activeConnections.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Memory Usage</span>
                      <span className="font-bold text-foreground">68%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">CPU Usage</span>
                      <span className="font-bold text-foreground">42%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Platform Configuration
                </CardTitle>
                <CardDescription>Manage platform settings and configurations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline" className="justify-start bg-transparent">
                    <Users className="w-4 h-4 mr-2" />
                    User Management Settings
                  </Button>
                  <Button variant="outline" className="justify-start bg-transparent">
                    <Car className="w-4 h-4 mr-2" />
                    Ride Configuration
                  </Button>
                  <Button variant="outline" className="justify-start bg-transparent">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Pricing & Fees
                  </Button>
                  <Button variant="outline" className="justify-start bg-transparent">
                    <Wallet className="w-4 h-4 mr-2" />
                    Blockchain Settings
                  </Button>
                  <Button variant="outline" className="justify-start bg-transparent">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Support Configuration
                  </Button>
                  <Button variant="outline" className="justify-start bg-transparent">
                    <Shield className="w-4 h-4 mr-2" />
                    Security Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
})

AdminPanel.displayName = 'AdminPanel'

// Wrapper component with ErrorBoundary
const AdminPanelWithErrorBoundary = () => {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Admin Panel Error:', error, errorInfo)
        // In a real app, you might want to send this to an error reporting service
      }}
    >
      <AdminPanel />
    </ErrorBoundary>
  )
}

export default AdminPanelWithErrorBoundary
