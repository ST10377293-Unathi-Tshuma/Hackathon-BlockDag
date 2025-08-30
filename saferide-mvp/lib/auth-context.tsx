"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ApiService } from './api'
import { ApiUser } from './types'

interface AuthContextType {
  user: ApiUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (user: ApiUser, token: string) => void
  logout: () => void
  updateUser: (userData: Partial<ApiUser>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const apiService = new ApiService()

  const isAuthenticated = !!user

  // Check for existing authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        const userId = localStorage.getItem('userId')
        
        if (token && userId) {
          // Verify token is still valid by fetching user profile
          const response = await apiService.getUserProfile(userId)
          if (response.success && response.data) {
            setUser(response.data)
          } else {
            throw new Error('Invalid user profile response')
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        // Clear invalid tokens
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('userId')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = (userData: ApiUser, token: string) => {
    setUser(userData)
    localStorage.setItem('accessToken', token)
    localStorage.setItem('userId', userData.id)
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('userId')
    
    // Redirect to login page
    window.location.href = '/auth/login'
  }

  const updateUser = (userData: Partial<ApiUser>) => {
    if (user) {
      setUser({ ...user, ...userData })
    }
  }

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    updateUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Higher-order component for protected routes
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading } = useAuth()
    
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      )
    }
    
    if (!isAuthenticated) {
      window.location.href = '/auth/login'
      return null
    }
    
    return <Component {...props} />
  }
}

// Hook for protected routes
export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth()
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/auth/login'
    }
  }, [isAuthenticated, isLoading])
  
  return { isAuthenticated, isLoading }
}