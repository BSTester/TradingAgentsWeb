'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, AuthResponse, LoginRequest, RegisterRequest } from '../types'
import { apiClient } from '../lib/apiClient'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginRequest) => Promise<{ success: boolean; error?: string }>
  register: (userData: RegisterRequest) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  refreshUser: () => Promise<void>
  refreshToken: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = !!user

  useEffect(() => {
    initializeAuth()
  }, [])

  const initializeAuth = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const savedUser = localStorage.getItem('user')

      if (token && savedUser) {
        setUser(JSON.parse(savedUser))
        await refreshUser()
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      clearAuth()
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (credentials: LoginRequest) => {
    try {
      setIsLoading(true)
      const response = await apiClient.post<AuthResponse>('/api/auth/login', credentials)

      const { access_token, user: userData } = response.data
      
      localStorage.setItem('access_token', access_token)
      localStorage.setItem('user', JSON.stringify(userData))
      setUser(userData)

      return { success: true }
    } catch (error: any) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message || 'Login failed' 
      }
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (userData: RegisterRequest) => {
    try {
      setIsLoading(true)
      await apiClient.post('/api/auth/register', userData)
      return { success: true }
    } catch (error: any) {
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message || 'Registration failed' 
      }
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    clearAuth()
  }

  const refreshUser = async () => {
    try {
      const response = await apiClient.get<User>('/api/auth/me')
      setUser(response.data)
      localStorage.setItem('user', JSON.stringify(response.data))
    } catch (error) {
      console.error('Error refreshing user:', error)
      clearAuth()
    }
  }

  const refreshToken = async () => {
    try {
      const response = await apiClient.post<{ access_token: string }>('/api/auth/refresh')
      if (response.data?.access_token) {
        localStorage.setItem('access_token', response.data.access_token)
        return true
      }
      return false
    } catch (error) {
      console.error('Error refreshing token:', error)
      clearAuth()
      return false
    }
  }

  const clearAuth = () => {
    setUser(null)
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    refreshUser,
    refreshToken,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}